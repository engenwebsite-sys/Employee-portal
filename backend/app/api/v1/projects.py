from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_active_user, require_roles
from app.db.session import get_db
from app.models.project import Project, ProjectDivision
from app.models.user import Role, User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_active_user),
    manage: Annotated[bool, Query()] = False,
):
    stmt = select(Project).order_by(Project.name.asc())
    if not (manage and _.role == Role.HR.value):
        stmt = stmt.where(Project.visible_to_email(_.email))
    if status_filter:
        stmt = stmt.where(Project.status == status_filter)
    if search:
        pat = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Project.name.ilike(pat),
                Project.code.ilike(pat),
                Project.client.ilike(pat),
            )
        )
    return list(db.scalars(stmt).all())


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_active_user),
):
    own_division = ProjectDivision.from_email(_.email)
    division = payload.division or own_division
    if division is None or (_.role != Role.HR.value and division != own_division):
        raise HTTPException(status_code=403, detail="Cannot create a project for this division.")

    clean_name = payload.name.strip()
    existing = db.scalar(select(Project).where(func.lower(Project.name) == clean_name.lower()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A project named '{clean_name}' already exists.",
        )

    code_clean = payload.code.strip().upper() if payload.code else None
    if code_clean:
        code_exist = db.scalar(select(Project).where(Project.code == code_clean))
        if code_exist:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Project code '{code_clean}' is already in use.",
            )

    proj = Project(
        name=clean_name,
        code=code_clean,
        client=payload.client.strip() if payload.client else None,
        description=payload.description.strip() if payload.description else None,
        status=payload.status or "Active",
        division=division,
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_active_user),
):
    proj = db.scalar(
        select(Project).where(Project.id == project_id, Project.visible_to_email(_.email))
    )
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return proj


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.HR, Role.MANAGER)),
):
    stmt = select(Project).where(Project.id == project_id)
    if _.role != Role.HR.value:
        stmt = stmt.where(Project.visible_to_email(_.email))
    proj = db.scalar(stmt)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    data = payload.model_dump(exclude_unset=True)
    if "division" in data:
        division = data["division"]
        if division is None:
            raise HTTPException(status_code=422, detail="Select a project division.")
        if _.role != Role.HR.value and division != proj.division:
            raise HTTPException(status_code=403, detail="Cannot move a project to this division.")
        proj.division = division

    if "name" in data and data["name"] is not None:
        clean = data["name"].strip()
        dup = db.scalar(select(Project).where(func.lower(Project.name) == clean.lower(), Project.id != proj.id))
        if dup:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Project name '{clean}' already exists.",
            )
        proj.name = clean

    if "code" in data:
        code_clean = data["code"].strip().upper() if data["code"] else None
        if code_clean:
            dup = db.scalar(select(Project).where(Project.code == code_clean, Project.id != proj.id))
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Project code '{code_clean}' is already in use.",
                )
        proj.code = code_clean

    if "client" in data:
        proj.client = data["client"].strip() if data["client"] else None
    if "description" in data:
        proj.description = data["description"].strip() if data["description"] else None
    if "status" in data and data["status"] is not None:
        proj.status = data["status"]

    db.commit()
    db.refresh(proj)
    return proj


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.HR)),
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    db.delete(proj)
    db.commit()
    return None


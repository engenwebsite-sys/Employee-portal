from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.project import Project
from app.models.user import Role, User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Project).order_by(Project.name.asc())
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
    _: User = Depends(get_current_user),  # Any logged-in user can quick-add a project
):
    clean_name = payload.name.strip()
    existing = db.scalar(select(Project).where(Project.name.ilike(clean_name)))
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
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    proj = db.get(Project, project_id)
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
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        clean = data["name"].strip()
        dup = db.scalar(select(Project).where(Project.name.ilike(clean), Project.id != proj.id))
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

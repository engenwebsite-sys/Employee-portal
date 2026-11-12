# Nemilink Employee Portal: Step 2 (Authentication)

## What this step adds
**Backend**
- Tables `users` and `refresh_tokens` (migration `0002`).
- `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password` and `GET /me`.
- Role guards: `require_roles(Role.HR)` in `app/api/deps.py`. The role is re-read from the database on every request, so disabling a user or changing a role takes effect immediately.
- First-login rule: a user with a temporary password can only call `/me` and `/auth/change-password`.
- `app/scripts/seed_users.py` creates accounts (there is no public sign-up).
- Dev-only test routes under `/api/v1/dev/*` (removed in Step 3).

**Frontend**
- Real login form, session kept across page refresh, automatic token refresh.
- `ProtectedRoute` (any user, or `roles={["hr"]}`), First-login "Set your own password" page, placeholder dashboard, 403 page.

**Not in this step (planned later):** forgot/reset password (needs email sending) and the audit log. Login attempts are not rate-limited yet.

## Upgrade from Step 1 (your .env, .venv and node_modules stay untouched)
1. Extract this zip over your existing `nemilink-portal` folder and choose "replace files".
2. Open `backend/.env` and add these lines (copy from `.env.example`):
       JWT_SECRET_KEY=any-long-random-string
       ACCESS_TOKEN_EXPIRE_MINUTES=15
       REFRESH_TOKEN_EXPIRE_DAYS=7
   Generate a secret with: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
3. Backend (venv active, inside `backend/`):
       pip install -r requirements.txt
       alembic upgrade head
       python -m app.scripts.seed_users --demo
       uvicorn app.main:app --reload
4. Frontend (inside `frontend/`): `npm run dev`  (no new packages needed)

## Demo accounts (development only)
| Email | Role | Password | First login |
| --- | --- | --- | --- |
| hr@nemilink.com | HR | Welcome@123 | must change password |
| manager@nemilink.com | Manager | Welcome@123 | no |
| employee@nemilink.com | Employee | Welcome@123 | no |

`python -m app.scripts.seed_users --demo --reset` puts them back to this state.
Create a real account: `python -m app.scripts.seed_users --email you@company.com --role hr`

## Optional: automated tests
    CREATE DATABASE nemilink_portal_test;      (once, in psql or pgAdmin)
    pip install -r requirements-dev.txt
    pytest

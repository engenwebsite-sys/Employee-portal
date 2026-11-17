import json
import urllib.error
import urllib.parse
import urllib.request

from fastapi import HTTPException, status

from app.core.config import settings


def build_microsoft_auth_url(state: str, challenge: str) -> str:
    if not settings.microsoft_sso_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft SSO is not configured on the server.",
        )
    params = urllib.parse.urlencode(
        {
            "client_id": settings.microsoft_client_id.strip(),
            "response_type": "code",
            "redirect_uri": settings.microsoft_redirect_uri.strip(),
            "response_mode": "query",
            "scope": "openid profile email User.Read",
            "prompt": "select_account",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    tenant = settings.microsoft_tenant_id.strip()
    return f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{params}"


def exchange_code_for_profile(code: str, verifier: str) -> tuple[str, str]:
    if not settings.microsoft_sso_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft SSO is not configured on the server.",
        )

    tenant = settings.microsoft_tenant_id.strip()
    token_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    body = urllib.parse.urlencode(
        {
            "client_id": settings.microsoft_client_id.strip(),
            "client_secret": settings.microsoft_client_secret.strip(),
            "code": code,
            "redirect_uri": settings.microsoft_redirect_uri.strip(),
            "grant_type": "authorization_code",
            "code_verifier": verifier,
            "scope": "openid profile email User.Read",
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        token_url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Microsoft sign-in failed. Start sign-in again.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to reach Microsoft authentication service.",
        ) from exc

    ms_access_token = token_data.get("access_token")
    if not ms_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Microsoft did not return an access token.",
        )

    graph_req = urllib.request.Request(
        "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName",
        headers={"Authorization": f"Bearer {ms_access_token}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(graph_req, timeout=15) as resp:
            profile = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to fetch user profile from Microsoft Graph.",
        ) from exc

    email = (profile.get("mail") or profile.get("userPrincipalName") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Microsoft account did not provide a valid work email.",
        )
    display_name = (profile.get("displayName") or "").strip()
    return email, display_name


from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


class GoogleAuthError(Exception):
    pass


def verify_google_id_token(token: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Google sign-in is not configured on the server.")

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise GoogleAuthError("Invalid Google token.") from exc

    issuer = idinfo.get("iss")
    if issuer not in ("accounts.google.com", "https://accounts.google.com"):
        raise GoogleAuthError("Invalid Google token issuer.")

    if not idinfo.get("email_verified"):
        raise GoogleAuthError("Google email is not verified.")

    if not idinfo.get("email"):
        raise GoogleAuthError("Google account has no email.")

    return idinfo

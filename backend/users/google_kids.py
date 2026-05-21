from django.db import transaction

from .models import Kid
from .services import create_primary_guardian_invitation


class GoogleKidAccountConflictError(Exception):
    pass


class GoogleKidAlreadyExistsError(Exception):
    pass


@transaction.atomic
def signup_kid_from_google(
    idinfo: dict,
    *,
    name: str,
    username: str,
    parent_email: str,
) -> Kid:
    google_sub = idinfo["sub"]
    email = idinfo["email"].lower()
    parent_email = parent_email.lower()

    if Kid.objects.filter(google_sub=google_sub).exists():
        raise GoogleKidAlreadyExistsError("A kid account already exists for this Google account.")

    if Kid.objects.filter(username__iexact=username).exists():
        raise GoogleKidAccountConflictError("This username is already taken.")

    existing = Kid.objects.filter(email=email).first()
    if existing:
        if existing.google_sub and existing.google_sub != google_sub:
            raise GoogleKidAccountConflictError(
                "This email is linked to a different Google account."
            )
        raise GoogleKidAlreadyExistsError("A kid account already exists for this email.")

    kid = Kid.objects.create(
        name=name,
        username=username,
        email=email,
        google_sub=google_sub,
        email_verified=True,
        registration_status=Kid.RegistrationStatus.AWAITING_PRIMARY_PARENT,
    )
    create_primary_guardian_invitation(kid, parent_email)
    return kid


def login_kid_from_google(idinfo: dict) -> Kid:
    google_sub = idinfo["sub"]
    email = idinfo["email"].lower()

    kid = Kid.objects.filter(google_sub=google_sub).first()
    if not kid:
        kid = Kid.objects.filter(email=email).first()
        if kid:
            if kid.google_sub and kid.google_sub != google_sub:
                raise GoogleKidAccountConflictError(
                    "This email is linked to a different Google account."
                )
            kid.google_sub = google_sub
            kid.email_verified = True
            kid.save(update_fields=["google_sub", "email_verified"])
        else:
            raise GoogleKidAccountConflictError(
                "No kid account found for this Google account."
            )

    if kid.registration_status != Kid.RegistrationStatus.ACTIVE:
        raise GoogleKidAccountConflictError("Kid account is not active yet.")

    if not kid.email_verified:
        raise GoogleKidAccountConflictError("Kid email is not verified.")

    return kid

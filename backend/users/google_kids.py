from django.db import transaction

from .messages import (
    EMAIL_ALREADY_REGISTERED,
    EMAIL_LINKED_TO_DIFFERENT_GOOGLE_ACCOUNT,
    EMAIL_REGISTERED_AS_KID_ACCOUNT,
    KID_ACCOUNT_NOT_ACTIVE_YET,
    KID_EMAIL_ALREADY_EXISTS,
    KID_EMAIL_MUST_DIFFER_FROM_PARENT,
    KID_EMAIL_NOT_VERIFIED,
    KID_GOOGLE_ACCOUNT_ALREADY_EXISTS,
    KID_GOOGLE_ACCOUNT_NOT_FOUND,
    USERNAME_ALREADY_TAKEN,
)
from .models import CustomUser, Kid
from .services import (
    create_primary_guardian_invitation,
    email_belongs_to_kid,
    email_belongs_to_parent,
    username_is_taken,
)


class GoogleKidAccountConflictError(Exception):
    pass


class GoogleKidAlreadyExistsError(Exception):
    pass

# will take the kid account and link it to the Google account
# will take the parent email and create a primary guardian invitation
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

    if email == parent_email:
        raise GoogleKidAccountConflictError(KID_EMAIL_MUST_DIFFER_FROM_PARENT)

    if email_belongs_to_kid(parent_email):
        raise GoogleKidAccountConflictError(EMAIL_REGISTERED_AS_KID_ACCOUNT)

    if Kid.objects.filter(google_sub=google_sub).exists():
        raise GoogleKidAlreadyExistsError(KID_GOOGLE_ACCOUNT_ALREADY_EXISTS)

    if username_is_taken(username):
        raise GoogleKidAccountConflictError(USERNAME_ALREADY_TAKEN)

    if email_belongs_to_parent(email):
        raise GoogleKidAccountConflictError(EMAIL_ALREADY_REGISTERED)

    existing = Kid.objects.filter(email=email).first()
    if existing:
        if existing.google_sub and existing.google_sub != google_sub:
            raise GoogleKidAccountConflictError(EMAIL_LINKED_TO_DIFFERENT_GOOGLE_ACCOUNT)
        raise GoogleKidAlreadyExistsError(KID_EMAIL_ALREADY_EXISTS)

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
                    EMAIL_LINKED_TO_DIFFERENT_GOOGLE_ACCOUNT
                )
            kid.google_sub = google_sub
            kid.email_verified = True
            kid.save(update_fields=["google_sub", "email_verified"])
        else:
            raise GoogleKidAccountConflictError(KID_GOOGLE_ACCOUNT_NOT_FOUND)

    if kid.registration_status != Kid.RegistrationStatus.ACTIVE:
        raise GoogleKidAccountConflictError(KID_ACCOUNT_NOT_ACTIVE_YET)

    if not kid.email_verified:
        raise GoogleKidAccountConflictError(KID_EMAIL_NOT_VERIFIED)

    return kid

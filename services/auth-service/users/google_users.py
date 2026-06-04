from django.db import transaction
from django.utils.crypto import get_random_string

from .messages import (
    EMAIL_LINKED_TO_DIFFERENT_GOOGLE_ACCOUNT,
    EMAIL_REGISTERED_AS_KID_USE_KID_SIGNIN,
    GOOGLE_ACCOUNT_REGISTERED_AS_KID,
)
from .models import CustomUser, Kid
from .services import email_belongs_to_kid, username_is_taken

# it exists because we want to raise an error if the Google account is already linked to a different account
# and to be able to handle the error in the view
class GoogleAccountConflictError(Exception):
    pass


# _unique_username is a helper function that generates a unique username by:
# 1. Truncating the base username to 150 characters
# 2. Checking if the username is taken
# 3. If it is, adding a suffix to the username
# 4. Returning the unique username
def _unique_username(base: str) -> str:
    username = base[:150]
    if not username_is_taken(username):
        return username

    suffix = 1
    while True:
        candidate = f"{base[:140]}_{suffix}"
        if not username_is_taken(candidate):
            return candidate
        suffix += 1


@transaction.atomic
def get_or_create_parent_from_google(idinfo: dict) -> CustomUser:
    google_sub = idinfo["sub"]
    email = idinfo["email"].lower()

    if Kid.objects.filter(google_sub=google_sub).exists():
        raise GoogleAccountConflictError(GOOGLE_ACCOUNT_REGISTERED_AS_KID)

    if email_belongs_to_kid(email):
        raise GoogleAccountConflictError(EMAIL_REGISTERED_AS_KID_USE_KID_SIGNIN)

    # returning Google user — already linked by google_sub
    user = CustomUser.objects.filter(google_sub=google_sub).first()
    if user:
        return user

    # existing parent by email — link Google, or reject if another Google account is linked
    user = CustomUser.objects.filter(email=email).first()
    if user:
        if user.google_sub and user.google_sub != google_sub:
            raise GoogleAccountConflictError(EMAIL_LINKED_TO_DIFFERENT_GOOGLE_ACCOUNT)
        user.google_sub = google_sub
        user.email_verified = True
        user.save(update_fields=["google_sub", "email_verified"])
        return user

    # new parent — build username from email (or google_sub fallback)
    username_base = email.split("@")[0] or f"google_{google_sub[:8]}"
    return CustomUser.objects.create_user(
        email=email,
        username=_unique_username(username_base),
        password=get_random_string(32),
        role="parent",
        google_sub=google_sub,
        email_verified=True,
    )

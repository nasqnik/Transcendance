"""User-facing API error messages."""

# Registration / uniqueness
USERNAME_ALREADY_TAKEN = "This username is already taken."
EMAIL_ALREADY_REGISTERED = "This email is already registered."
EMAIL_REGISTERED_AS_KID_ACCOUNT = "This email is registered as a kid account."
KID_EMAIL_MUST_DIFFER_FROM_PARENT = "Kid email must be different from the parent email."

# Kid auth
KID_VERIFY_EMAIL_FIRST = "Verify your email first."
KID_EMAIL_NOT_VERIFIED = "Kid email is not verified."
KID_ACCOUNT_NOT_ACTIVE_YET = "Kid account is not active yet."
KID_ACCOUNT_NOT_ACTIVE = "Kid account is not active."

# Kid tokens
KID_INVALID_REFRESH_TOKEN = "Invalid refresh token."
KID_NOT_REFRESH_TOKEN = "Not a kid refresh token."
KID_NOT_FOUND = "Kid not found."
KID_INVALID_ACCESS_TOKEN = "Invalid token."
KID_NOT_ACCESS_TOKEN = "Not a kid access token."

# Google
GOOGLE_ACCOUNT_REGISTERED_AS_KID = (
    "This Google account is registered as a kid account. Use kid sign-in instead."
)
EMAIL_REGISTERED_AS_KID_USE_KID_SIGNIN = (
    "This email is registered as a kid account. Use kid sign-in instead."
)
EMAIL_LINKED_TO_DIFFERENT_GOOGLE_ACCOUNT = (
    "This email is linked to a different Google account."
)
KID_GOOGLE_ACCOUNT_ALREADY_EXISTS = (
    "A kid account already exists for this Google account."
)
KID_EMAIL_ALREADY_EXISTS = "A kid account already exists for this email."
KID_GOOGLE_ACCOUNT_NOT_FOUND = "No kid account found for this Google account."

# Account
ACCOUNT_INACTIVE = "This account is inactive."

# Guardians
MAX_GUARDIANS_REACHED = "This kid already has the maximum number of guardians."

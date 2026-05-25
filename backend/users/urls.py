from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from .views import (
    AcceptGuardianInviteView,
    GoogleLoginView,
    GuardianInviteDetailView,
    InviteSecondParentView,
    KidGoogleLoginView,
    KidGoogleSignupView,
    KidSignupView,
    KidTokenObtainView,
    KidTokenRefreshView,
    KidTokenVerifyView,
    KidVerifyEmailView,
    ParentRegisterView,
    ParentVerifyEmailView,
)

urlpatterns = [
    # Parent registration
    path("auth/register/", ParentRegisterView.as_view()),
    path("auth/verify-email/", ParentVerifyEmailView.as_view()),

    # Parent authentication
    path("auth/token/", TokenObtainPairView.as_view()),
    path("auth/token/refresh/", TokenRefreshView.as_view()),
    path("auth/token/verify/", TokenVerifyView.as_view()),
    path("auth/google/", GoogleLoginView.as_view()),

    # Kid registration
    path("kids/signup/", KidSignupView.as_view()),
    path("kids/signup/google/", KidGoogleSignupView.as_view()),
    path("auth/kid/verify-email/", KidVerifyEmailView.as_view()),

    # Kid — invite second parent
    path("kids/invite-parent/", InviteSecondParentView.as_view()),

    # Kid authentication
    path("auth/kid/token/", KidTokenObtainView.as_view()),
    path("auth/kid/token/refresh/", KidTokenRefreshView.as_view()),
    path("auth/kid/token/verify/", KidTokenVerifyView.as_view()),
    path("auth/kid/google/", KidGoogleLoginView.as_view()),

    # Guardian invitations
    path(
        "guardian-invitations/<uuid:token>/",
        GuardianInviteDetailView.as_view(),
    ),
    path("guardian-invitations/accept/", AcceptGuardianInviteView.as_view()),
]


# explain the goal of each endpoint

# Parent registration
# - /auth/register/:       "register a parent and send a verification email"
# - /auth/verify-email/:   "verify a parent's email"

# Parent authentication
# - /auth/token/:           "log in a parent with email and password"
# - /auth/token/refresh/:   "refresh a parent's JWT"
# - /auth/token/verify/:    "check if a parent's access token is still valid"
# - /auth/google/:          "log in or sign up a parent using Google"

# Kid registration
# - /kids/signup/:            "register a kid and invite the primary parent"
# - /kids/signup/google/:     "not used yet — register a kid using Google"
# - /auth/kid/verify-email/:  "verify a kid's email"

# Kid — invite second parent
# - /kids/invite-parent/:     "logged-in kid invites a second parent"

# Kid authentication
# - /auth/kid/token/:           "log in a kid with email/username and password"
# - /auth/kid/token/refresh/:   "refresh a kid's JWT"
# - /auth/kid/token/verify/:    "check if a kid's access token is still valid"
# - /auth/kid/google/:          "log in a kid using Google"

# Guardian invitations
# - /guardian-invitations/<token>/: "preview a pending invitation (public)"
# - /guardian-invitations/accept/:  "logged-in parent accepts a guardian invitation"

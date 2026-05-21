from django.urls import path

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
    KidVerifyEmailView,
    ParentRegisterView,
    ParentVerifyEmailView,
)

urlpatterns = [
    path("kids/signup/", KidSignupView.as_view(), name="kid-signup"),
    path("kids/signup/google/", KidGoogleSignupView.as_view(), name="kid-signup-google"),
    path(
        "kids/invite-parent/",
        InviteSecondParentView.as_view(),
        name="kid-invite-second-parent",
    ),
    path("auth/register/", ParentRegisterView.as_view(), name="parent-register"),
    path("auth/verify-email/", ParentVerifyEmailView.as_view(), name="parent-verify-email"),
    path("auth/google/", GoogleLoginView.as_view(), name="google-login"),
    path(
        "auth/kid/verify-email/",
        KidVerifyEmailView.as_view(),
        name="kid-verify-email",
    ),
    path("auth/kid/token/", KidTokenObtainView.as_view(), name="kid-token-obtain"),
    path(
        "auth/kid/token/refresh/",
        KidTokenRefreshView.as_view(),
        name="kid-token-refresh",
    ),
    path("auth/kid/google/", KidGoogleLoginView.as_view(), name="kid-google-login"),
    path(
        "guardian-invitations/<uuid:token>/",
        GuardianInviteDetailView.as_view(),
        name="guardian-invite-detail",
    ),
    path(
        "guardian-invitations/accept/",
        AcceptGuardianInviteView.as_view(),
        name="guardian-invite-accept",
    ),
]

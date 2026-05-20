from django.urls import path

from .views import (
    AcceptGuardianInviteView,
    GoogleLoginView,
    GuardianInviteDetailView,
    InviteSecondParentView,
    KidSignupView,
    KidTokenObtainView,
    KidTokenRefreshView,
    ParentRegisterView,
)

urlpatterns = [
    path("kids/signup/", KidSignupView.as_view(), name="kid-signup"),
    path(
        "kids/invite-parent/",
        InviteSecondParentView.as_view(),
        name="kid-invite-second-parent",
    ),
    path("auth/register/", ParentRegisterView.as_view(), name="parent-register"),
    path("auth/google/", GoogleLoginView.as_view(), name="google-login"),
    path("auth/kid/token/", KidTokenObtainView.as_view(), name="kid-token-obtain"),
    path("auth/kid/token/refresh/", KidTokenRefreshView.as_view(), name="kid-token-refresh"),
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

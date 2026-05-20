from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAuthenticatedKid
from .serializers import (
    AcceptGuardianInviteSerializer,
    GuardianInviteDetailSerializer,
    InviteSecondParentSerializer,
    KidSignupSerializer,
    KidTokenObtainSerializer,
    KidTokenRefreshSerializer,
    ParentRegisterSerializer,
    GoogleLoginSerializer,
)
from .services import InvitationNotFound, get_guardian_invitation_by_token, mark_expired_if_needed


class KidSignupView(generics.CreateAPIView):
    """Register a kid and email the primary guardian a pending invitation."""

    permission_classes = [AllowAny]
    serializer_class = KidSignupSerializer


class ParentRegisterView(generics.CreateAPIView):
    """Create a parent CustomUser account (email + password)."""

    permission_classes = [AllowAny]
    serializer_class = ParentRegisterSerializer


@extend_schema(request=GoogleLoginSerializer)
class GoogleLoginView(APIView):
    """Parent sign-in via Google Identity Services id_token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class GuardianInviteDetailView(generics.RetrieveAPIView):
    """Public preview of an invitation (for apps / parent UI)."""

    permission_classes = [AllowAny]
    serializer_class = GuardianInviteDetailSerializer

    def get_object(self):
        try:
            invitation = get_guardian_invitation_by_token(self.kwargs["token"])
        except InvitationNotFound as exc:
            raise NotFound("Invitation not found.") from exc
        return mark_expired_if_needed(invitation)


class AcceptGuardianInviteView(generics.GenericAPIView):
    """Authenticated parent accepts a pending guardian invitation."""

    permission_classes = [IsAuthenticated]
    serializer_class = AcceptGuardianInviteSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save()
        return Response(
            serializer.to_representation(invitation),
            status=status.HTTP_200_OK,
        )


@extend_schema(request=KidTokenObtainSerializer)
class KidTokenObtainView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = KidTokenObtainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


@extend_schema(request=KidTokenRefreshSerializer)
class KidTokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = KidTokenRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class InviteSecondParentView(generics.CreateAPIView):
    permission_classes = [IsAuthenticatedKid]
    serializer_class = InviteSecondParentSerializer

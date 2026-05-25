from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAuthenticatedKid
from .serializers import (
    AcceptGuardianInviteSerializer,
    GoogleLoginSerializer,
    GuardianInviteDetailSerializer,
    InviteSecondParentSerializer,
    KidGoogleLoginSerializer,
    KidGoogleSignupSerializer,
    KidSignupSerializer,
    KidTokenObtainSerializer,
    KidTokenRefreshSerializer,
    KidTokenVerifySerializer,
    KidVerifyEmailSerializer,
    ParentRegisterSerializer,
    ParentVerifyEmailSerializer,
)
from .services import InvitationNotFound, get_guardian_invitation_by_token, mark_expired_if_needed

# views vs serializers
# views are the logic of the API
# serializers are the data validation and serialization
    # serialization is the process of converting the data
        # into a format that can be sent over the network

class KidSignupView(generics.CreateAPIView):
    """Register a kid and email the primary guardian a pending invitation."""

    permission_classes = [AllowAny] # no login required
    serializer_class = KidSignupSerializer


class KidGoogleSignupView(generics.CreateAPIView):
    """Register a kid via Google and email the primary guardian."""

    permission_classes = [AllowAny]
    serializer_class = KidGoogleSignupSerializer


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
        #is_valid call => validate_username , validate_password, validate_email, .... , validate .
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


@extend_schema(request=ParentVerifyEmailSerializer)
class ParentVerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ParentVerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


@extend_schema(request=KidVerifyEmailSerializer)
class KidVerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = KidVerifyEmailSerializer(data=request.data)
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

    permission_classes = [IsAuthenticated] #logged in parent required
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


@extend_schema(request=KidTokenVerifySerializer)
class KidTokenVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = KidTokenVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


@extend_schema(request=KidGoogleLoginSerializer)
class KidGoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = KidGoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class InviteSecondParentView(generics.CreateAPIView):
    permission_classes = [IsAuthenticatedKid] #logged in kid required
    serializer_class = InviteSecondParentSerializer


# Permissions:
# 1. AllowAny            -> no login required (signup, login, verify, invite preview)
# 2. IsAuthenticated     -> parent JWT required (request.user = CustomUser)
# 3. IsAuthenticatedKid  -> kid JWT required (request.user = Kid)


# Base classes in this file:
# 1. CreateAPIView    -> POST: create DB row, return 201
# 2. RetrieveAPIView  -> GET: read one DB row, return 200
# 3. GenericAPIView   -> no auto HTTP method; you write post/get yourself
# 4. APIView          -> fully manual; no serializer_class helper on the class


# What you set / override per category:

# 1. CreateAPIView (KidSignup, KidGoogleSignup, ParentRegister, InviteSecondParent)
#    Set:     permission_classes, serializer_class
#    Write:   nothing (DRF handles POST → validate → save → 201)
#    Logic:   lives in serializer.create()

# 2. RetrieveAPIView (GuardianInviteDetail)
#    Set:     permission_classes, serializer_class
#    Override get_object() only when URL is not /<pk>/ (here: lookup by invite token)
#    Logic:   lives in serializer (output shape) + services (fetch invite)

# 3. GenericAPIView (AcceptGuardianInvite)
#    Set:     permission_classes, serializer_class
#    Write:   def post() yourself
#    Uses:    get_serializer() + save() + to_representation() → 200
#    Logic:   lives in serializer.save() (updates invite, activates kid)
#    Note:    NOT a create endpoint — it's an action on existing data

# 4. APIView (Google login, kid login/refresh, email verify)
#    Set:     permission_classes
#    Write:   def post() yourself
#    Uses:    Serializer(...) inline; return validated_data → 200
#    Add:     @extend_schema(request=...) for Swagger (no serializer_class on class)
#    Logic:   lives in serializer.validate() — no save() in the view
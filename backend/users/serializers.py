from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .google_auth import GoogleAuthError, verify_google_id_token
from .google_users import GoogleAccountConflictError, get_or_create_parent_from_google
from .models import CustomUser, GuardianInvitation, Kid
from .services import (
    InvitationEmailMismatch,
    InvitationExpired,
    InvitationNotFound,
    InvitationNotPending,
    MaxGuardiansReached,
    accept_guardian_invitation,
    build_guardian_invite_url,
    create_secondary_guardian_invitation,
    ensure_invitation_acceptable,
    get_guardian_invitation_by_token,
    send_guardian_invitation_email,
)
from .tokens import KidRefreshToken


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Include stable parent-facing claims on the access token."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["username"] = user.username
        token["role"] = user.role
        return token


class KidSignupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    username = serializers.CharField(max_length=100)
    password = serializers.CharField(write_only=True, min_length=8)
    parent_email = serializers.EmailField()

    def validate_username(self, value):
        if Kid.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        parent_email = validated_data.pop("parent_email").lower()
        password = validated_data.pop("password")

        kid = Kid(
            name=validated_data["name"],
            username=validated_data["username"],
            registration_status=Kid.RegistrationStatus.AWAITING_PRIMARY_PARENT,
        )
        kid.set_password(password)
        kid.save()

        expires_at = timezone.now() + timedelta(
            days=settings.GUARDIAN_INVITE_EXPIRY_DAYS
        )
        invitation = GuardianInvitation.objects.create(
            kid=kid,
            invite_email=parent_email,
            role=GuardianInvitation.Role.PRIMARY,
            status=GuardianInvitation.Status.PENDING,
            created_by_kid=True,
            expires_at=expires_at,
        )
        send_guardian_invitation_email(invitation)
        return kid

    def to_representation(self, instance):
        data = {
            "kid_id": str(instance.id),
            "username": instance.username,
            "name": instance.name,
            "registration_status": instance.registration_status,
            "message": "Waiting for parent response",
        }
        if settings.DEBUG:
            invitation = instance.guardian_invitations.filter(
                status=GuardianInvitation.Status.PENDING,
                role=GuardianInvitation.Role.PRIMARY,
            ).first()
            if invitation:
                data["invite_url"] = build_guardian_invite_url(invitation.token)
                data["invite_token"] = str(invitation.token)
        return data


class ParentRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = CustomUser
        fields = ("email", "username", "password")

    def validate_email(self, value):
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        return CustomUser.objects.create_user(
            password=password,
            role="parent",
            **validated_data,
        )

    def to_representation(self, instance):
        return {
            "user_id": str(instance.id),
            "email": instance.email,
            "username": instance.username,
            "role": instance.role,
        }


class GuardianInviteDetailSerializer(serializers.ModelSerializer):
    kid_name = serializers.CharField(source="kid.name", read_only=True)
    kid_id = serializers.UUIDField(source="kid.id", read_only=True)

    class Meta:
        model = GuardianInvitation
        fields = (
            "token",
            "status",
            "role",
            "invite_email",
            "expires_at",
            "kid_name",
            "kid_id",
        )
        read_only_fields = fields


class AcceptGuardianInviteSerializer(serializers.Serializer):
    token = serializers.UUIDField()

    def validate_token(self, value):
        try:
            invitation = get_guardian_invitation_by_token(value)
        except InvitationNotFound as exc:
            raise serializers.ValidationError("Invitation not found.") from exc
        try:
            self.invitation = ensure_invitation_acceptable(invitation)
        except InvitationNotPending as exc:
            raise serializers.ValidationError(
                f"Invitation is not pending (status: {exc.status})."
            ) from exc
        except InvitationExpired as exc:
            raise serializers.ValidationError("Invitation has expired.") from exc
        return value

    @transaction.atomic
    def save(self, **kwargs):
        parent = self.context["request"].user
        try:
            return accept_guardian_invitation(self.invitation, parent)
        except InvitationEmailMismatch as exc:
            raise serializers.ValidationError(
                "Your account email does not match the invitation email."
            ) from exc

    def to_representation(self, instance):
        kid = instance.kid
        return {
            "invitation_id": str(instance.id),
            "status": instance.status,
            "role": instance.role,
            "kid_id": str(kid.id),
            "kid_name": kid.name,
            "kid_username": kid.username,
            "registration_status": kid.registration_status,
            "message": "Guardian invitation accepted.",
        }


class KidTokenObtainSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            kid = Kid.objects.get(username__iexact=attrs["username"])
        except Kid.DoesNotExist as exc:
            raise AuthenticationFailed(
                "No active kid account found with the given credentials."
            ) from exc

        if not kid.check_password(attrs["password"]):
            raise AuthenticationFailed(
                "No active kid account found with the given credentials."
            )

        if kid.registration_status != Kid.RegistrationStatus.ACTIVE:
            raise AuthenticationFailed("Kid account is not active yet.")

        refresh = KidRefreshToken.for_kid(kid)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class KidTokenRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        try:
            refresh = KidRefreshToken(attrs["refresh"])
        except Exception as exc:
            raise serializers.ValidationError("Invalid refresh token.") from exc

        if refresh.get("role") != "kid":
            raise serializers.ValidationError("Not a kid refresh token.")

        try:
            kid = Kid.objects.get(pk=refresh["kid_id"])
        except Kid.DoesNotExist as exc:
            raise serializers.ValidationError("Kid not found.") from exc

        if kid.registration_status != Kid.RegistrationStatus.ACTIVE:
            raise serializers.ValidationError("Kid account is not active.")

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class InviteSecondParentSerializer(serializers.Serializer):
    parent_email = serializers.EmailField()
    invited_username_hint = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        default="",
    )

    @transaction.atomic
    def create(self, validated_data):
        kid = self.context["request"].user
        try:
            return create_secondary_guardian_invitation(
                kid=kid,
                parent_email=validated_data["parent_email"],
                invited_username_hint=validated_data.get(
                    "invited_username_hint", ""
                ),
            )
        except MaxGuardiansReached as exc:
            raise serializers.ValidationError(
                "This kid already has the maximum number of guardians."
            ) from exc

    def to_representation(self, instance):
        data = {
            "invitation_id": str(instance.id),
            "invite_email": instance.invite_email,
            "role": instance.role,
            "status": instance.status,
            "message": "Second parent invitation sent.",
        }
        if settings.DEBUG:
            data["invite_url"] = build_guardian_invite_url(instance.token)
            data["invite_token"] = str(instance.token)
        return data


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()

    def validate(self, attrs):
        try:
            idinfo = verify_google_id_token(attrs["id_token"])
        except GoogleAuthError as exc:
            raise serializers.ValidationError(str(exc)) from exc

        try:
            user = get_or_create_parent_from_google(idinfo)
        except GoogleAccountConflictError as exc:
            raise serializers.ValidationError(str(exc)) from exc

        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

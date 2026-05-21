from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .google_auth import GoogleAuthError, verify_google_id_token
from .google_kids import (
    GoogleKidAccountConflictError,
    GoogleKidAlreadyExistsError,
    login_kid_from_google,
    signup_kid_from_google,
)
from .google_users import GoogleAccountConflictError, get_or_create_parent_from_google
from .models import CustomUser, GuardianInvitation, Kid
from .services import (
    EmailAlreadyVerified,
    EmailVerificationExpired,
    EmailVerificationNotFound,
    InvitationEmailMismatch,
    InvitationExpired,
    InvitationNotFound,
    InvitationNotPending,
    MaxGuardiansReached,
    accept_guardian_invitation,
    build_guardian_invite_url,
    build_kid_verify_email_url,
    build_parent_verify_email_url,
    create_primary_guardian_invitation,
    create_secondary_guardian_invitation,
    ensure_invitation_acceptable,
    get_guardian_invitation_by_token,
    issue_kid_email_verification,
    issue_parent_email_verification,
    verify_kid_email,
    verify_parent_email,
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

    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.email_verified:
            raise AuthenticationFailed("Email not verified.")
        return data


class KidSignupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    username = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    parent_email = serializers.EmailField()

    def validate_username(self, value):
        if Kid.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        email = value.lower()
        if Kid.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email is already registered.")
        if CustomUser.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("This email is already registered.")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        parent_email = validated_data.pop("parent_email").lower()
        password = validated_data.pop("password")
        email = validated_data.pop("email")

        kid = Kid(
            name=validated_data["name"],
            username=validated_data["username"],
            email=email,
            email_verified=False,
            registration_status=Kid.RegistrationStatus.AWAITING_PRIMARY_PARENT,
        )
        kid.set_password(password)
        kid.save()

        create_primary_guardian_invitation(kid, parent_email)
        issue_kid_email_verification(kid)
        return kid

    def to_representation(self, instance):
        data = {
            "kid_id": str(instance.id),
            "username": instance.username,
            "email": instance.email,
            "name": instance.name,
            "registration_status": instance.registration_status,
            "email_verified": instance.email_verified,
            "message": "Check your email to verify your account. Waiting for parent response.",
        }
        if settings.DEBUG:
            invitation = instance.guardian_invitations.filter(
                status=GuardianInvitation.Status.PENDING,
                role=GuardianInvitation.Role.PRIMARY,
            ).first()
            if invitation:
                data["invite_url"] = build_guardian_invite_url(invitation.token)
                data["invite_token"] = str(invitation.token)
            if instance.email_verification_token:
                data["verify_url"] = build_kid_verify_email_url(
                    instance.email_verification_token
                )
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
        user = CustomUser.objects.create_user(
            password=password,
            role="parent",
            email_verified=False,
            **validated_data,
        )
        issue_parent_email_verification(user)
        return user

    def to_representation(self, instance):
        data = {
            "user_id": str(instance.id),
            "email": instance.email,
            "username": instance.username,
            "role": instance.role,
            "email_verified": instance.email_verified,
            "message": "Check your email to verify your account.",
        }
        if settings.DEBUG and instance.email_verification_token:
            data["verify_url"] = build_parent_verify_email_url(
                instance.email_verification_token
            )
        return data


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

        if not kid.email_verified:
            raise AuthenticationFailed("Verify your email first.")

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

        if not kid.email_verified:
            raise serializers.ValidationError("Kid email is not verified.")

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


class ParentVerifyEmailSerializer(serializers.Serializer):
    token = serializers.UUIDField()

    def validate(self, attrs):
        try:
            user = verify_parent_email(attrs["token"])
        except EmailVerificationNotFound as exc:
            raise serializers.ValidationError(
                {"token": ["Invalid verification token."]}
            ) from exc
        except EmailAlreadyVerified as exc:
            raise serializers.ValidationError(
                {"token": ["Email is already verified."]}
            ) from exc
        except EmailVerificationExpired as exc:
            raise serializers.ValidationError(
                {"token": ["Verification link has expired."]}
            ) from exc

        return {
            "email": user.email,
            "email_verified": user.email_verified,
            "message": "Email verified successfully.",
        }


class KidVerifyEmailSerializer(serializers.Serializer):
    token = serializers.UUIDField()

    def validate(self, attrs):
        try:
            kid = verify_kid_email(attrs["token"])
        except EmailVerificationNotFound as exc:
            raise serializers.ValidationError(
                {"token": ["Invalid verification token."]}
            ) from exc
        except EmailAlreadyVerified as exc:
            raise serializers.ValidationError(
                {"token": ["Email is already verified."]}
            ) from exc
        except EmailVerificationExpired as exc:
            raise serializers.ValidationError(
                {"token": ["Verification link has expired."]}
            ) from exc

        return {
            "kid_id": str(kid.id),
            "email": kid.email,
            "email_verified": kid.email_verified,
            "registration_status": kid.registration_status,
            "message": "Email verified successfully.",
        }


class KidGoogleSignupSerializer(serializers.Serializer):
    id_token = serializers.CharField()
    name = serializers.CharField(max_length=100)
    username = serializers.CharField(max_length=100)
    parent_email = serializers.EmailField()

    def validate_username(self, value):
        if Kid.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_parent_email(self, value):
        return value.lower()

    @transaction.atomic
    def create(self, validated_data):
        try:
            idinfo = verify_google_id_token(validated_data["id_token"])
        except GoogleAuthError as exc:
            raise serializers.ValidationError({"id_token": [str(exc)]}) from exc

        try:
            return signup_kid_from_google(
                idinfo,
                name=validated_data["name"],
                username=validated_data["username"],
                parent_email=validated_data["parent_email"],
            )
        except GoogleKidAlreadyExistsError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        except GoogleKidAccountConflictError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def to_representation(self, instance):
        data = {
            "kid_id": str(instance.id),
            "username": instance.username,
            "email": instance.email,
            "name": instance.name,
            "email_verified": instance.email_verified,
            "registration_status": instance.registration_status,
            "message": "Account created. Waiting for parent response.",
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


class KidGoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField()

    def validate(self, attrs):
        try:
            idinfo = verify_google_id_token(attrs["id_token"])
        except GoogleAuthError as exc:
            raise serializers.ValidationError(str(exc)) from exc

        try:
            kid = login_kid_from_google(idinfo)
        except GoogleKidAccountConflictError as exc:
            raise serializers.ValidationError(str(exc)) from exc

        refresh = KidRefreshToken.for_kid(kid)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

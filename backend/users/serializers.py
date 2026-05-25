from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken

from .google_auth import GoogleAuthError, verify_google_id_token
from .google_kids import (
    GoogleKidAccountConflictError,
    GoogleKidAlreadyExistsError,
    login_kid_from_google,
    signup_kid_from_google,
)
from .google_users import GoogleAccountConflictError, get_or_create_parent_from_google
from .messages import (
    ACCOUNT_INACTIVE,
    EMAIL_ALREADY_REGISTERED,
    EMAIL_REGISTERED_AS_KID_ACCOUNT,
    KID_ACCOUNT_NOT_ACTIVE,
    KID_ACCOUNT_NOT_ACTIVE_YET,
    KID_EMAIL_MUST_DIFFER_FROM_PARENT,
    KID_EMAIL_NOT_VERIFIED,
    KID_INVALID_ACCESS_TOKEN,
    KID_INVALID_REFRESH_TOKEN,
    KID_NOT_ACCESS_TOKEN,
    KID_NOT_FOUND,
    KID_NOT_REFRESH_TOKEN,
    KID_VERIFY_EMAIL_FIRST,
    MAX_GUARDIANS_REACHED,
    USERNAME_ALREADY_TAKEN,
)
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
    email_belongs_to_kid,
    email_belongs_to_parent,
    ensure_invitation_acceptable,
    get_guardian_invitation_by_token,
    issue_kid_email_verification,
    issue_parent_email_verification,
    username_belongs_to_kid,
    username_is_taken,
    verify_kid_email,
    verify_parent_email,
)
from .tokens import KidRefreshToken

LOGIN_IDENTIFIER_FIELD = "emailOrUsername"


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Include stable parent-facing claims on the access token."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop(self.username_field, None)
        self.fields[LOGIN_IDENTIFIER_FIELD] = serializers.CharField()

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["username"] = user.username
        token["role"] = user.role
        return token

    def validate(self, attrs):
        identifier = attrs[LOGIN_IDENTIFIER_FIELD]
        password = attrs["password"]

        user = CustomUser.objects.filter(email__iexact=identifier).first()
        if user is None:
            user = CustomUser.objects.filter(username__iexact=identifier).first()

        if user is None or not user.check_password(password):
            raise AuthenticationFailed(
                "No active account found with the given credentials."
            )

        if not api_settings.USER_AUTHENTICATION_RULE(user):
            raise AuthenticationFailed(
                "No active account found with the given credentials."
            )

        if not user.email_verified:
            raise AuthenticationFailed(
                "Please verify your email before logging in."
            )

        self.user = user
        refresh = self.get_token(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class KidSignupSerializer(serializers.Serializer):
    # rules and validations
    name = serializers.CharField(max_length=100)
    username = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    parent_email = serializers.EmailField()

    def validate_username(self, value):
        if username_is_taken(value):
            raise serializers.ValidationError(USERNAME_ALREADY_TAKEN)
        return value

    def validate_email(self, value):
        email = value.lower()
        if email_belongs_to_kid(email) or email_belongs_to_parent(email):
            raise serializers.ValidationError(EMAIL_ALREADY_REGISTERED)
        return email

    def validate_parent_email(self, value):
        parent_email = value.lower()
        if email_belongs_to_kid(parent_email):
            raise serializers.ValidationError(EMAIL_REGISTERED_AS_KID_ACCOUNT)
        return parent_email

    def validate(self, attrs):
        email = attrs["email"]
        parent_email = attrs["parent_email"]
        if email == parent_email:
            raise serializers.ValidationError(KID_EMAIL_MUST_DIFFER_FROM_PARENT)
        return attrs

    def validate_password(self, value):
        validate_password(value)
        return value

    # write to the database
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

    # shape the json response
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
                status="pending",
                role="primary",
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
    # rules and validations
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = CustomUser
        fields = ("email", "username", "password")

    def validate_email(self, value):
        email = value.lower()
        if email_belongs_to_kid(email):
            raise serializers.ValidationError(EMAIL_ALREADY_REGISTERED)
        return email

    def validate_username(self, value):
        if username_belongs_to_kid(value):
            raise serializers.ValidationError(USERNAME_ALREADY_TAKEN)
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    # write to the database
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

    # shape the json response
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
    emailOrUsername = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs[LOGIN_IDENTIFIER_FIELD]
        password = attrs["password"]

        kid = Kid.objects.filter(username__iexact=identifier).first()
        if kid is None:
            kid = Kid.objects.filter(email__iexact=identifier).first()

        if kid is None or not kid.check_password(password):
            raise AuthenticationFailed(
                "No active kid account found with the given credentials."
            )

        if not kid.email_verified:
            raise AuthenticationFailed(KID_VERIFY_EMAIL_FIRST)

        if kid.registration_status != Kid.RegistrationStatus.ACTIVE:
            raise AuthenticationFailed(KID_ACCOUNT_NOT_ACTIVE_YET)

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
            raise serializers.ValidationError(KID_INVALID_REFRESH_TOKEN) from exc

        if refresh.get("role") != "kid":
            raise serializers.ValidationError(KID_NOT_REFRESH_TOKEN)

        try:
            kid = Kid.objects.get(pk=refresh["kid_id"])
        except Kid.DoesNotExist as exc:
            raise serializers.ValidationError(KID_NOT_FOUND) from exc

        if not kid.email_verified:
            raise serializers.ValidationError(KID_EMAIL_NOT_VERIFIED)

        if kid.registration_status != Kid.RegistrationStatus.ACTIVE:
            raise serializers.ValidationError(KID_ACCOUNT_NOT_ACTIVE)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class KidTokenVerifySerializer(serializers.Serializer):
    token = serializers.CharField()

    def validate(self, attrs):
        try:
            token = AccessToken(attrs["token"])
        except Exception as exc:
            raise serializers.ValidationError(KID_INVALID_ACCESS_TOKEN) from exc

        if token.get("role") != "kid":
            raise serializers.ValidationError(KID_NOT_ACCESS_TOKEN)

        try:
            kid = Kid.objects.get(pk=token["kid_id"])
        except Kid.DoesNotExist as exc:
            raise serializers.ValidationError(KID_NOT_FOUND) from exc

        if not kid.email_verified:
            raise serializers.ValidationError(KID_EMAIL_NOT_VERIFIED)

        if kid.registration_status != Kid.RegistrationStatus.ACTIVE:
            raise serializers.ValidationError(KID_ACCOUNT_NOT_ACTIVE)

        return {}


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
            raise serializers.ValidationError(MAX_GUARDIANS_REACHED) from exc

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
            raise serializers.ValidationError(ACCOUNT_INACTIVE)

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
        if username_is_taken(value):
            raise serializers.ValidationError(USERNAME_ALREADY_TAKEN)
        return value

    def validate_parent_email(self, value):
        parent_email = value.lower()
        if email_belongs_to_kid(parent_email):
            raise serializers.ValidationError(EMAIL_REGISTERED_AS_KID_ACCOUNT)
        return parent_email

    def validate(self, attrs):
        try:
            idinfo = verify_google_id_token(attrs["id_token"])
        except GoogleAuthError as exc:
            raise serializers.ValidationError({"id_token": [str(exc)]}) from exc

        kid_email = idinfo["email"].lower()
        parent_email = attrs["parent_email"]
        if kid_email == parent_email:
            raise serializers.ValidationError(KID_EMAIL_MUST_DIFFER_FROM_PARENT)
        return attrs

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
                status="pending",
                role="primary",
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

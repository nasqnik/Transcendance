from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.hashers import check_password, make_password
from uuid import uuid4


class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ("parent", "Parent"),
        ("admin", "Admin"),
    )

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    email = models.EmailField(unique=True)

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="parent",
    )

    google_sub = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
    )

    email_verified = models.BooleanField(default=False)

    email_verification_token = models.UUIDField(
        null=True,
        blank=True,
        unique=True,
        editable=False,
    )

    email_verification_sent_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email


class Kid(models.Model):
    class RegistrationStatus(models.TextChoices):
        AWAITING_PRIMARY_PARENT = (
            "awaiting_primary_parent",
            "Awaiting primary parent",
        )
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    parent = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="kids",
        null=True,
        blank=True,
    )

    registration_status = models.CharField(
        max_length=32,
        choices=RegistrationStatus.choices,
        default=RegistrationStatus.AWAITING_PRIMARY_PARENT,
        db_index=True,
    )

    name = models.CharField(max_length=100)

    username = models.CharField(max_length=100, unique=True)

    email = models.EmailField(unique=True, null=True, blank=True)

    email_verified = models.BooleanField(default=False)

    google_sub = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
    )

    email_verification_token = models.UUIDField(
        null=True,
        blank=True,
        unique=True,
        editable=False,
    )

    email_verification_sent_at = models.DateTimeField(null=True, blank=True)

    password_hash = models.TextField(null=True, blank=True)

    avatar_url = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def set_password(self, raw_password):
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        if not self.password_hash:
            return False
        return check_password(raw_password, self.password_hash)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def __str__(self):
        return self.username


class GuardianInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    class Role(models.TextChoices):
        PRIMARY = "primary", "Primary"
        SECONDARY = "secondary", "Secondary"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    kid = models.ForeignKey(
        Kid,
        on_delete=models.CASCADE,
        related_name="guardian_invitations",
    )

    parent = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="guardian_invitations",
    )

    invite_email = models.EmailField()

    invited_username_hint = models.CharField(
        max_length=150,
        blank=True,
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.PRIMARY,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    token = models.UUIDField(default=uuid4, unique=True, editable=False)

    created_by_kid = models.BooleanField(default=True)

    sent_at = models.DateTimeField(null=True, blank=True)

    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("kid", "invite_email"),
                condition=models.Q(status="pending"),
                name="uniq_pending_guardian_invite_email_per_kid",
            ),
        ]

    def __str__(self):
        return f"{self.invite_email} → {self.kid_id} ({self.status})"

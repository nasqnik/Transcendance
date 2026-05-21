from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from .models import CustomUser, GuardianInvitation, Kid


class EmailVerificationNotFound(Exception):
    pass


class EmailVerificationExpired(Exception):
    pass


class EmailAlreadyVerified(Exception):
    pass


class InvitationNotFound(Exception):
    pass


class InvitationNotPending(Exception):
    def __init__(self, status):
        self.status = status


class InvitationExpired(Exception):
    pass


class InvitationEmailMismatch(Exception):
    pass


class MaxGuardiansReached(Exception):
    pass


def count_active_guardians(kid: Kid) -> int:
    return kid.guardian_invitations.filter(
        status=GuardianInvitation.Status.ACCEPTED,
    ).count()


def create_secondary_guardian_invitation(
    kid: Kid,
    parent_email: str,
    invited_username_hint: str = "",
) -> GuardianInvitation:
    if kid.registration_status != Kid.RegistrationStatus.ACTIVE:
        raise ValueError("Kid account must be active before inviting another parent.")

    if count_active_guardians(kid) >= settings.MAX_GUARDIANS_PER_KID:
        raise MaxGuardiansReached

    parent_email = parent_email.lower()
    expires_at = timezone.now() + timedelta(days=settings.GUARDIAN_INVITE_EXPIRY_DAYS)
    invitation = GuardianInvitation.objects.create(
        kid=kid,
        invite_email=parent_email,
        invited_username_hint=invited_username_hint,
        role=GuardianInvitation.Role.SECONDARY,
        status=GuardianInvitation.Status.PENDING,
        created_by_kid=True,
        expires_at=expires_at,
    )
    send_guardian_invitation_email(invitation)
    return invitation


def build_guardian_invite_url(token) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/accept-invite?token={token}"


def get_guardian_invitation_by_token(token) -> GuardianInvitation:
    try:
        return GuardianInvitation.objects.select_related("kid").get(token=token)
    except GuardianInvitation.DoesNotExist as exc:
        raise InvitationNotFound from exc


def mark_expired_if_needed(invitation: GuardianInvitation) -> GuardianInvitation:
    if (
        invitation.status == GuardianInvitation.Status.PENDING
        and invitation.expires_at
        and invitation.expires_at < timezone.now()
    ):
        invitation.status = GuardianInvitation.Status.EXPIRED
        invitation.save(update_fields=["status"])
    return invitation


def ensure_invitation_acceptable(invitation: GuardianInvitation) -> GuardianInvitation:
    invitation = mark_expired_if_needed(invitation)
    if invitation.status != GuardianInvitation.Status.PENDING:
        raise InvitationNotPending(invitation.status)
    return invitation


def accept_guardian_invitation(
    invitation: GuardianInvitation,
    parent,
) -> GuardianInvitation:
    if parent.email.lower() != invitation.invite_email.lower():
        raise InvitationEmailMismatch

    invitation.parent = parent
    invitation.status = GuardianInvitation.Status.ACCEPTED
    invitation.responded_at = timezone.now()
    invitation.save(update_fields=["parent", "status", "responded_at"])

    kid: Kid = invitation.kid
    if invitation.role == GuardianInvitation.Role.PRIMARY:
        kid.parent = parent
        kid.registration_status = Kid.RegistrationStatus.ACTIVE
        kid.save(update_fields=["parent", "registration_status"])

    return invitation


def send_guardian_invitation_email(invitation) -> None:
    invite_url = build_guardian_invite_url(invitation.token)
    role_label = (
        "primary guardian"
        if invitation.role == GuardianInvitation.Role.PRIMARY
        else "secondary guardian"
    )
    context = {
        "app_name": settings.APP_NAME,
        "kid_name": invitation.kid.name,
        "kid_username": invitation.kid.username,
        "invite_url": invite_url,
        "invite_token": str(invitation.token),
        "invite_email": invitation.invite_email,
        "role_label": role_label,
        "expires_at": invitation.expires_at,
    }
    subject = f"{invitation.kid.name} invited you to be their {role_label}"
    text_body = render_to_string("emails/guardian_invite.txt", context)
    html_body = render_to_string("emails/guardian_invite.html", context)

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[invitation.invite_email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)

    invitation.sent_at = timezone.now()
    invitation.save(update_fields=["sent_at"])


def build_parent_verify_email_url(token) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/verify-email?token={token}"


def build_kid_verify_email_url(token) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/kid/verify-email?token={token}"


def _verification_expired(sent_at) -> bool:
    if not sent_at:
        return True
    expiry = sent_at + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRY_HOURS)
    return timezone.now() > expiry


def issue_parent_email_verification(user: CustomUser) -> None:
    user.email_verification_token = uuid4()
    user.email_verification_sent_at = timezone.now()
    user.save(
        update_fields=["email_verification_token", "email_verification_sent_at"]
    )
    verify_url = build_parent_verify_email_url(user.email_verification_token)
    context = {
        "app_name": settings.APP_NAME,
        "verify_url": verify_url,
        "email": user.email,
        "expires_hours": settings.EMAIL_VERIFICATION_EXPIRY_HOURS,
    }
    subject = f"Verify your {settings.APP_NAME} account"
    text_body = render_to_string("emails/parent_verify_email.txt", context)
    html_body = render_to_string("emails/parent_verify_email.html", context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)


def issue_kid_email_verification(kid: Kid) -> None:
    kid.email_verification_token = uuid4()
    kid.email_verification_sent_at = timezone.now()
    kid.save(
        update_fields=["email_verification_token", "email_verification_sent_at"]
    )
    verify_url = build_kid_verify_email_url(kid.email_verification_token)
    context = {
        "app_name": settings.APP_NAME,
        "verify_url": verify_url,
        "email": kid.email,
        "kid_name": kid.name,
        "expires_hours": settings.EMAIL_VERIFICATION_EXPIRY_HOURS,
    }
    subject = f"Verify your {settings.APP_NAME} account"
    text_body = render_to_string("emails/kid_verify_email.txt", context)
    html_body = render_to_string("emails/kid_verify_email.html", context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[kid.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)


def verify_parent_email(token) -> CustomUser:
    try:
        user = CustomUser.objects.get(email_verification_token=token)
    except CustomUser.DoesNotExist as exc:
        raise EmailVerificationNotFound from exc

    if user.email_verified:
        raise EmailAlreadyVerified

    if _verification_expired(user.email_verification_sent_at):
        raise EmailVerificationExpired

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_sent_at = None
    user.save(
        update_fields=[
            "email_verified",
            "email_verification_token",
            "email_verification_sent_at",
        ]
    )
    return user


def verify_kid_email(token) -> Kid:
    try:
        kid = Kid.objects.get(email_verification_token=token)
    except Kid.DoesNotExist as exc:
        raise EmailVerificationNotFound from exc

    if kid.email_verified:
        raise EmailAlreadyVerified

    if _verification_expired(kid.email_verification_sent_at):
        raise EmailVerificationExpired

    kid.email_verified = True
    kid.email_verification_token = None
    kid.email_verification_sent_at = None
    kid.save(
        update_fields=[
            "email_verified",
            "email_verification_token",
            "email_verification_sent_at",
        ]
    )
    return kid


def create_primary_guardian_invitation(kid: Kid, parent_email: str) -> GuardianInvitation:
    expires_at = timezone.now() + timedelta(days=settings.GUARDIAN_INVITE_EXPIRY_DAYS)
    invitation = GuardianInvitation.objects.create(
        kid=kid,
        invite_email=parent_email,
        role=GuardianInvitation.Role.PRIMARY,
        status=GuardianInvitation.Status.PENDING,
        created_by_kid=True,
        expires_at=expires_at,
    )
    send_guardian_invitation_email(invitation)
    return invitation

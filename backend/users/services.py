from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from .models import GuardianInvitation, Kid


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


def build_guardian_invite_url() -> str:
    return settings.FRONTEND_URL.rstrip("/")


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
    invite_url = build_guardian_invite_url()
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

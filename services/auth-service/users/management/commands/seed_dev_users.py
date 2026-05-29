from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from users.models import CustomUser, GuardianInvitation, Kid
from users.serializers import CustomTokenObtainPairSerializer
from users.services import accept_guardian_invitation
from users.tokens import KidRefreshToken

DEV_PARENT_EMAIL = 'dev-parent@localhost'
DEV_PARENT_USERNAME = 'dev_parent'
DEV_KID_USERNAME = 'dev_kid'
DEV_KID_EMAIL = 'dev-kid@localhost'
DEV_KID_NAME = 'Dev Kid'
DEV_PASSWORD = 'DevPass123!'


class Command(BaseCommand):
    help = 'Create dev parent + active kid and print JWT tokens for Swagger/curl.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Run even when DEBUG is False (local dev only).',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['force']:
            raise CommandError(
                'Refusing to seed dev users when DEBUG is False. '
                'Use --force if you really mean it.'
            )

        with transaction.atomic():
            parent = self._ensure_parent()
            kid = self._ensure_kid(parent)

        parent_refresh = CustomTokenObtainPairSerializer.get_token(parent)
        kid_refresh = KidRefreshToken.for_kid(kid)

        self.stdout.write(self.style.SUCCESS('\nDev users ready (auth-service):\n'))
        self.stdout.write(f'  Parent  email:    {DEV_PARENT_EMAIL}')
        self.stdout.write(f'  Parent  username: {DEV_PARENT_USERNAME}')
        self.stdout.write(f'  Kid     username: {DEV_KID_USERNAME}')
        self.stdout.write(f'  Kid     email:    {DEV_KID_EMAIL}')
        self.stdout.write(f'  Password (both):  {DEV_PASSWORD}')
        self.stdout.write(f'  Kid ID:           {kid.id}')
        self.stdout.write(f'  Parent user ID:   {parent.id}\n')

        self.stdout.write('Paste into Swagger Authorize (Bearer …):\n')
        self.stdout.write(f'  PARENT_ACCESS={parent_refresh.access_token}')
        self.stdout.write(f'  KID_ACCESS={kid_refresh.access_token}\n')

        self.stdout.write('Or export in your shell:\n')
        self.stdout.write(f'  export PARENT_ACCESS="{parent_refresh.access_token}"')
        self.stdout.write(f'  export KID_ACCESS="{kid_refresh.access_token}"')
        self.stdout.write(f'  export KID_ID="{kid.id}"\n')

    def _ensure_parent(self) -> CustomUser:
        parent = CustomUser.objects.filter(email=DEV_PARENT_EMAIL).first()
        if parent is None:
            parent = CustomUser.objects.create_user(
                email=DEV_PARENT_EMAIL,
                username=DEV_PARENT_USERNAME,
                password=DEV_PASSWORD,
                role='parent',
                email_verified=True,
            )
            return parent

        parent.email_verified = True
        parent.role = 'parent'
        update_fields = ['email_verified', 'role']
        if not parent.check_password(DEV_PASSWORD):
            parent.set_password(DEV_PASSWORD)
            update_fields.append('password')
        parent.save(update_fields=update_fields)
        return parent

    def _ensure_kid(self, parent: CustomUser) -> Kid:
        kid = Kid.objects.filter(username=DEV_KID_USERNAME).first()
        if kid is None:
            kid = Kid(
                name=DEV_KID_NAME,
                username=DEV_KID_USERNAME,
                email=DEV_KID_EMAIL,
                email_verified=True,
                registration_status=Kid.RegistrationStatus.AWAITING_PRIMARY_PARENT,
            )
            kid.set_password(DEV_PASSWORD)
            kid.save()
            invitation = GuardianInvitation.objects.create(
                kid=kid,
                invite_email=DEV_PARENT_EMAIL,
                role='primary',
                status='pending',
                created_by_kid=True,
                expires_at=timezone.now() + timedelta(days=7),
            )
            accept_guardian_invitation(invitation, parent)
            kid.refresh_from_db()
            return kid

        kid.email_verified = True
        kid.email = DEV_KID_EMAIL
        kid.registration_status = Kid.RegistrationStatus.ACTIVE
        kid.parent = parent
        update_fields = ['email_verified', 'email', 'registration_status', 'parent']
        if not kid.check_password(DEV_PASSWORD):
            kid.set_password(DEV_PASSWORD)
            update_fields.append('password_hash')
        kid.save(update_fields=update_fields)

        invitation = kid.guardian_invitations.filter(
            invite_email__iexact=DEV_PARENT_EMAIL,
            role='primary',
        ).first()
        if invitation is None:
            invitation = GuardianInvitation.objects.create(
                kid=kid,
                invite_email=DEV_PARENT_EMAIL,
                role='primary',
                status='pending',
                created_by_kid=True,
                expires_at=timezone.now() + timedelta(days=7),
            )
        if invitation.status != 'accepted':
            accept_guardian_invitation(invitation, parent)
            kid.refresh_from_db()

        return kid

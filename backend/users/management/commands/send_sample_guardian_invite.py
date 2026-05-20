from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string
from django.utils import timezone

from users.services import build_guardian_invite_url


class Command(BaseCommand):
    help = "Send a sample guardian invitation email (preview templates + link)."

    def add_arguments(self, parser):
        parser.add_argument(
            "recipient",
            help="Email address to send the sample to.",
        )
        parser.add_argument(
            "--role",
            choices=("primary", "secondary"),
            default="primary",
            help="Invitation role shown in the email (default: primary).",
        )

    def handle(self, *args, **options):
        recipient = options["recipient"]
        role = options["role"]
        token = uuid4()
        role_label = (
            "primary guardian" if role == "primary" else "secondary guardian"
        )

        context = {
            "app_name": settings.APP_NAME,
            "kid_name": "Alex (sample)",
            "kid_username": "alex_sample",
            "invite_email": recipient,
            "invite_url": build_guardian_invite_url(token),
            "invite_token": str(token),
            "role_label": role_label,
            "expires_at": timezone.now() + timedelta(days=7),
        }

        subject = f"{context['kid_name']} invited you to be their {role_label}"
        text_body = render_to_string("emails/guardian_invite.txt", context)
        html_body = render_to_string("emails/guardian_invite.html", context)

        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=False)

        self.stdout.write(
            self.style.SUCCESS(f"Sample guardian invite sent to {recipient}")
        )
        self.stdout.write(f"Subject: {subject}")
        self.stdout.write(f"App link: {context['invite_url']}")
        self.stdout.write(f"Invite token: {context['invite_token']}")
        self.stdout.write(
            self.style.WARNING(
                "This is a preview — the token is random and not stored in the database."
            )
        )

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Send a test email using the configured EMAIL_* settings."

    def add_arguments(self, parser):
        parser.add_argument(
            "recipient",
            help="Email address to send the test message to.",
        )

    def handle(self, *args, **options):
        recipient = options["recipient"]
        backend = settings.EMAIL_BACKEND

        if "console" in backend:
            self.stdout.write(
                self.style.WARNING(
                    "EMAIL_BACKEND is console — message will print in logs, "
                    "not deliver to a real inbox. Set SMTP vars in .env to send real mail."
                )
            )

        if "smtp" in backend and not settings.EMAIL_HOST:
            raise CommandError(
                "EMAIL_BACKEND is SMTP but EMAIL_HOST is empty. "
                "Configure EMAIL_* in .env (see .env.example)."
            )

        send_mail(
            subject=f"{settings.APP_NAME} — test email",
            message=(
                "If you received this, Django email is configured correctly.\n\n"
                f"EMAIL_BACKEND={backend}\n"
                f"EMAIL_HOST={settings.EMAIL_HOST or '(not set)'}\n"
                f"DEFAULT_FROM_EMAIL={settings.DEFAULT_FROM_EMAIL}\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )

        self.stdout.write(
            self.style.SUCCESS(f"Test email sent to {recipient} via {backend}")
        )

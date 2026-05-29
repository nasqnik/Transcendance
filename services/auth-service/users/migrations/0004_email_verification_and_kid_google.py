from django.db import migrations, models


def mark_existing_users_verified(apps, schema_editor):
    CustomUser = apps.get_model("users", "CustomUser")
    Kid = apps.get_model("users", "Kid")
    CustomUser.objects.all().update(email_verified=True)
    Kid.objects.all().update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_customuser_google_sub"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="email_verified",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="customuser",
            name="email_verification_token",
            field=models.UUIDField(blank=True, editable=False, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="customuser",
            name="email_verification_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="kid",
            name="email_verified",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="kid",
            name="google_sub",
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="kid",
            name="email_verification_token",
            field=models.UUIDField(blank=True, editable=False, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="kid",
            name="email_verification_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(
            mark_existing_users_verified,
            migrations.RunPython.noop,
        ),
    ]

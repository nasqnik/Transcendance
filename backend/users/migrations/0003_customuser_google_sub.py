# Generated manually for google_sub on CustomUser

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_phase_a_guardians"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="google_sub",
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                unique=True,
            ),
        ),
    ]

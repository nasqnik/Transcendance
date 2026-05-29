# Generated manually for kid category visibility settings

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0002_task_ai_fields_taskcategoryreward'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='should_be_reviewed',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='KidCategoryVisibility',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kid_id', models.UUIDField(unique=True)),
                ('show_health', models.BooleanField(default=True)),
                ('show_learning', models.BooleanField(default=True)),
                ('show_responsibility', models.BooleanField(default=True)),
                ('show_creativity', models.BooleanField(default=True)),
            ],
        ),
    ]

# Generated manually for task-service initial schema

import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Task',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('kid_id', models.UUIDField(db_index=True)),
                ('created_by', models.UUIDField()),
                ('title', models.TextField()),
                ('description', models.TextField(blank=True, default='')),
                ('xp_reward', models.PositiveIntegerField(default=10)),
                ('is_active', models.BooleanField(default=True)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TaskCompletion',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('kid_id', models.UUIDField(db_index=True)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('confirmed', 'Confirmed'), ('rejected', 'Rejected')],
                    default='pending',
                    max_length=16,
                )),
                ('completed_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('reviewer_id', models.UUIDField(blank=True, null=True)),
                ('review_note', models.TextField(blank=True, default='')),
                ('task', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='completions',
                    to='tasks.task',
                )),
            ],
            options={
                'ordering': ['-completed_at'],
            },
        ),
    ]

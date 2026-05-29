# Generated manually for task-service AI evaluation schema

import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='ai_evaluated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='task',
            name='ai_summary',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.CreateModel(
            name='TaskCategoryReward',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('category', models.CharField(
                    choices=[
                        ('health', 'Health'),
                        ('learning', 'Learning'),
                        ('responsibility', 'Responsibility'),
                        ('creativity', 'Creativity'),
                    ],
                    max_length=255,
                )),
                ('points_value', models.PositiveIntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('task', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='category_rewards',
                    to='tasks.task',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='taskcategoryreward',
            constraint=models.UniqueConstraint(
                fields=('task', 'category'),
                name='unique_task_category_reward',
            ),
        ),
    ]

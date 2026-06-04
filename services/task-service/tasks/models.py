import uuid

from django.db import models


CATEGORY_CHOICES = [
    ('health', 'Health'),
    ('learning', 'Learning'),
    ('responsibility', 'Responsibility'),
    ('creativity', 'Creativity'),
]

TASK_STATUS = [
    ('pending', 'Pending'),
    ('confirmed', 'Confirmed'),
    ('rejected', 'Rejected'),
]


class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kid_id = models.UUIDField(db_index=True)
    created_by = models.UUIDField()
    title = models.TextField()
    description = models.TextField(blank=True, default='')
    xp_reward = models.PositiveIntegerField(default=10)
    ai_evaluated = models.BooleanField(default=False)
    ai_summary = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    should_be_reviewed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class TaskCompletion(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        REJECTED = 'rejected', 'Rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='completions')
    kid_id = models.UUIDField(db_index=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    completed_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewer_id = models.UUIDField(null=True, blank=True)
    review_note = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-completed_at']

    def __str__(self):
        return f'{self.task_id} ({self.status})'


class TaskCategoryReward(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='category_rewards')
    category = models.CharField(max_length=255, choices=CATEGORY_CHOICES)
    points_value = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['task', 'category'],
                name='unique_task_category_reward',
            ),
        ]

    def __str__(self):
        return f'{self.task_id} ({self.category})'

class KidCategoryVisibility(models.Model):
    kid_id = models.UUIDField(unique=True)
    show_health = models.BooleanField(default=True)
    show_learning = models.BooleanField(default=True)
    show_responsibility = models.BooleanField(default=True)
    show_creativity = models.BooleanField(default=True)

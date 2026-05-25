import uuid

from django.db import models


class Task(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kid_id = models.UUIDField(db_index=True)
    created_by = models.UUIDField()
    title = models.TextField()
    description = models.TextField(blank=True, default='')
    xp_reward = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

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

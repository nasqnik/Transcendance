from rest_framework import serializers

from .models import Task, TaskCompletion


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = (
            'id',
            'kid_id',
            'created_by',
            'title',
            'description',
            'xp_reward',
            'is_active',
            'due_date',
            'created_at',
        )
        read_only_fields = ('id', 'created_by', 'created_at')


class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = (
            'kid_id',
            'title',
            'description',
            'xp_reward',
            'due_date',
        )


class TaskCompletionSerializer(serializers.ModelSerializer):
    task_id = serializers.UUIDField(source='task.id', read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)

    class Meta:
        model = TaskCompletion
        fields = (
            'id',
            'task_id',
            'task_title',
            'kid_id',
            'status',
            'completed_at',
            'reviewed_at',
            'reviewer_id',
            'review_note',
        )
        read_only_fields = (
            'id',
            'kid_id',
            'status',
            'completed_at',
            'reviewed_at',
            'reviewer_id',
            'review_note',
        )


class TaskCompletionCreateSerializer(serializers.Serializer):
    task_id = serializers.UUIDField()


class TaskCompletionReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['confirmed', 'rejected'])
    review_note = serializers.CharField(required=False, allow_blank=True, default='')

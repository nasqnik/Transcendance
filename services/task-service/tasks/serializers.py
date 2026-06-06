from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import APIException

from .ai_evaluation import apply_classification, classify_task
from .models import Task, TaskCategoryReward, TaskCompletion, KidCategoryVisibility
from .notifications import push_completion_confirmed


# Review modes returned to the client so the UI knows how to handle submission.
REVIEW_ALWAYS = 'always'      # all categories shown -> completion is always pending
REVIEW_NEVER = 'never'        # no categories shown -> completion auto-confirms
REVIEW_OPTIONAL = 'optional'  # mixed -> the kid chooses (send_for_review)


def compute_review_mode(task, kid_id, visibility=None):
    """Decide whether completing this task needs parent review.

    Single source of truth shared by TaskSerializer.review_mode (what the UI
    reads) and the completion create logic (what actually sets the status).

    Pass `visibility` to reuse an already-fetched settings row (avoids an
    N+1 query when serializing a list of tasks).
    """
    # .all() (not values_list) so a prefetch_related cache is reused.
    categories = [r.category for r in task.category_rewards.all()]
    if not categories:
        return REVIEW_NEVER

    if visibility is None:
        visibility, _ = KidCategoryVisibility.objects.get_or_create(kid_id=kid_id)
    shown = [c for c in categories if getattr(visibility, f'show_{c}')]

    if len(shown) == len(categories):
        return REVIEW_ALWAYS
    if not shown:
        return REVIEW_NEVER
    return REVIEW_OPTIONAL


class TaskCategoryRewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCategoryReward
        fields = ('category', 'points_value')


class TaskSerializer(serializers.ModelSerializer):
    category_rewards = TaskCategoryRewardSerializer(many=True, read_only=True)
    review_mode = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            'id', 'kid_id', 'title', 'description',
            'xp_reward', 'ai_summary', 'ai_evaluated',
            'due_date', 'is_active', 'created_at',
            'category_rewards', 'review_mode',
        )

    def get_review_mode(self, task):
        # The task owner's visibility settings decide the mode.
        # Reuse a cached row from the view's context when present (list view).
        visibility = self.context.get('kid_visibility')
        return compute_review_mode(task, task.kid_id, visibility=visibility)

class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ('title', 'description', 'due_date')

    @transaction.atomic
    def create(self, validated_data):
        task = Task.objects.create(**validated_data)
        try:
            text = f'{task.title}\n{task.description}'.strip()
            result = classify_task(text)
        except RuntimeError as exc:
            raise APIException(str(exc)) from exc
        apply_classification(task, result)
        task.xp_reward = result.get('responsibility', 0) + result.get('learning', 0) + result.get('health', 0) + result.get('creativity', 0)
        task.save(update_fields=['xp_reward'])
        return task



# ModelSerializer is used to serialize and deserialize the model instance.

class KidCategoryVisibilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = KidCategoryVisibility
        fields = ('show_health', 'show_learning', 'show_responsibility', 'show_creativity')


class TaskCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCompletion
        fields = (
            'id', 'task', 'kid_id', 'status',
            'completed_at', 'reviewed_at', 'review_note',
        )


class TaskCompletionCreateSerializer(serializers.ModelSerializer):
    # Only consulted in the "mixed" case (some shown, some hidden categories).
    send_for_review = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
    )

    class Meta:
        model = TaskCompletion
        fields = ('task', 'send_for_review')

    def validate_task(self, task):
        kid_id = self.context['request'].user.kid_id
        if task.kid_id != kid_id:
            raise serializers.ValidationError('This task is not yours.')
        return task

    def create(self, validated_data):
        kid_id = self.context['request'].user.kid_id
        send_for_review = validated_data.pop('send_for_review', False)
        task = validated_data['task']

        new_status = self._resolve_status(task, kid_id, send_for_review)
        completion = TaskCompletion.objects.create(
            kid_id=kid_id,
            status=new_status,
            **validated_data,
        )

        # Auto-confirmed completions skip parent review, so push here too.
        if new_status == TaskCompletion.Status.CONFIRMED:
            push_completion_confirmed(completion)

        return completion

    def _resolve_status(self, task, kid_id, send_for_review):
        mode = compute_review_mode(task, kid_id)
        if mode == REVIEW_ALWAYS:
            return TaskCompletion.Status.PENDING
        if mode == REVIEW_NEVER:
            return TaskCompletion.Status.CONFIRMED
        # REVIEW_OPTIONAL -> the kid chooses.
        if send_for_review:
            return TaskCompletion.Status.PENDING
        return TaskCompletion.Status.CONFIRMED


class TaskCompletionReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            TaskCompletion.Status.CONFIRMED,
            TaskCompletion.Status.REJECTED,
        ],
    )
    review_note = serializers.CharField(required=False, allow_blank=True, default='')
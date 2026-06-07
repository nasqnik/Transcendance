from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.actors import KidActor, ParentActor
# permissions in settings.py
from common.permissions import IsKid, IsParent

from .models import Task, KidCategoryVisibility, TaskCompletion
from .notifications import push_completion_confirmed
from .serializers import (
    KidCategoryVisibilitySerializer,
    TaskCompletionCreateSerializer,
    TaskCompletionReviewSerializer,
    TaskCompletionSerializer,
    TaskCreateSerializer,
    TaskSerializer,
    TaskUpdateSerializer,
)


@extend_schema_view(
    get=extend_schema(
        summary='List tasks',
        description="Kid lists their own active tasks.",
        responses=TaskSerializer(many=True),
    ),
    post=extend_schema(
        summary='Create a task',
        description=(
            'Kid creates a task. The AI scores each category, writes a '
            'summary, and sets xp_reward as the sum of the category points.'
        ),
        request=TaskCreateSerializer,
        responses=TaskSerializer,
    ),
)
class TaskListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        user = self.request.user
        if isinstance(user, KidActor):
            return (
                Task.objects
                .filter(kid_id=user.kid_id, is_active=True)
                .prefetch_related('category_rewards')
            )
        return Task.objects.none()

    def get_serializer_context(self):
        # Fetch the kid's visibility once so review_mode doesn't query per task.
        context = super().get_serializer_context()
        user = self.request.user
        if isinstance(user, KidActor):
            context['kid_visibility'] = KidCategoryVisibility.objects.get_or_create(
                kid_id=user.kid_id,
            )[0]
        return context

    def get_serializer_class(self):
        # TODO: POST -> TaskCreateSerializer, GET -> TaskSerializer
        if self.request.method == 'POST':
            return TaskCreateSerializer
        return TaskSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsKid()]
        return super().get_permissions()

    def perform_create(self, serializer):
        kid_id = self.request.user.kid_id
        serializer.save(kid_id=kid_id, created_by=kid_id)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        out = TaskSerializer(serializer.instance)
        return Response(out.data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    get=extend_schema(
        summary='Get one task',
        description="Kid retrieves a single one of their own tasks by id.",
        responses=TaskSerializer,
    ),
    patch=extend_schema(
        summary='Edit a task',
        description=(
            "Kid edits one of their own tasks. Changing the title or "
            "description re-runs the AI classification (category points / XP); "
            "editing only the due_date does not."
        ),
        request=TaskUpdateSerializer,
        responses=TaskSerializer,
    ),
)
class TaskDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsKid]
    lookup_url_kwarg = 'task_id'
    http_method_names = ['get', 'patch']

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return TaskUpdateSerializer
        return TaskSerializer

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, KidActor):
            return (
                Task.objects
                .filter(kid_id=user.kid_id, is_active=True)
                .prefetch_related('category_rewards')
            )
        return Task.objects.none()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Re-fetch so the response reflects regenerated category_rewards
        # (the prefetch cache from get_object() is stale after reclassify).
        fresh = self.get_queryset().get(pk=instance.pk)
        return Response(TaskSerializer(fresh).data)


@extend_schema_view(
    get=extend_schema(
        summary='List completions',
        description=(
            "Kid lists their own completions. Parent lists completions for "
            "the kids they guard."
        ),
        responses=TaskCompletionSerializer(many=True),
    ),
    post=extend_schema(
        summary='Submit a completion',
        description="Kid marks one of their tasks as completed (status pending).",
        request=TaskCompletionCreateSerializer,
        responses=TaskCompletionSerializer,
    ),
)
class TaskCompletionListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        user = self.request.user
        if isinstance(user, KidActor):
            return TaskCompletion.objects.filter(kid_id=user.kid_id)
        if isinstance(user, ParentActor):
            return TaskCompletion.objects.filter(kid_id__in=user.kid_ids)
        return TaskCompletion.objects.none()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TaskCompletionCreateSerializer
        return TaskCompletionSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsKid()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        completion = serializer.save()
        out = TaskCompletionSerializer(completion)
        return Response(out.data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    post=extend_schema(
        summary='Review a completion',
        description=(
            "Parent confirms or rejects a completion for one of their kids. "
            "Returns 404 if the completion does not belong to a guarded kid."
        ),
        request=TaskCompletionReviewSerializer,
        responses=TaskCompletionSerializer,
    ),
)
class TaskCompletionReviewView(APIView):
    permission_classes = [IsParent]

    def post(self, request, completion_id):
        completion = get_object_or_404(
            TaskCompletion,
            id=completion_id,
            kid_id__in=request.user.kid_ids,
        )

        serializer = TaskCompletionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        # Only push when the completion actually transitions into confirmed,
        # so re-confirming an already-confirmed completion won't push twice.
        became_confirmed = (
            new_status == TaskCompletion.Status.CONFIRMED
            and completion.status != TaskCompletion.Status.CONFIRMED
        )

        completion.status = new_status
        completion.review_note = serializer.validated_data['review_note']
        completion.reviewer_id = request.user.user_id
        completion.reviewed_at = timezone.now()
        completion.save(
            update_fields=['status', 'review_note', 'reviewer_id', 'reviewed_at'],
        )

        if became_confirmed:
            push_completion_confirmed(completion)

        return Response(TaskCompletionSerializer(completion).data)


@extend_schema_view(
    get=extend_schema(
        summary='Get category visibility settings',
        description='Kid reads which task categories their parent can see.',
        responses=KidCategoryVisibilitySerializer,
    ),
    put=extend_schema(
        summary='Update category visibility settings',
        description='Kid toggles which categories are visible to their parent.',
        request=KidCategoryVisibilitySerializer,
        responses=KidCategoryVisibilitySerializer,
    ),
)
class KidCategoryVisibilityView(APIView):
    permission_classes = [IsKid]

    def _get_settings(self, request):
        return KidCategoryVisibility.objects.get_or_create(
            kid_id=request.user.kid_id,
        )

    def get(self, request):
        settings, _ = self._get_settings(request)
        serializer = KidCategoryVisibilitySerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        settings, _ = self._get_settings(request)
        serializer = KidCategoryVisibilitySerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



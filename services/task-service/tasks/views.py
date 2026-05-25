from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.actors import KidActor, ParentActor
from common.permissions import IsKid, IsParent

from .models import Task, TaskCompletion
from .serializers import (
    TaskCompletionCreateSerializer,
    TaskCompletionReviewSerializer,
    TaskCompletionSerializer,
    TaskCreateSerializer,
    TaskSerializer,
)


class TaskListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        user = self.request.user
        if isinstance(user, KidActor):
            return Task.objects.filter(kid_id=user.kid_id, is_active=True)
        if isinstance(user, ParentActor):
            kid_id = self.request.query_params.get('kid_id')
            qs = Task.objects.filter(is_active=True)
            if kid_id:
                qs = qs.filter(kid_id=kid_id)
            return qs
        return Task.objects.none()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TaskCreateSerializer
        return TaskSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsParent()]
        return super().get_permissions()

    def perform_create(self, serializer):
        parent = self.request.user
        serializer.save(created_by=parent.user_id)


class TaskDetailView(generics.RetrieveAPIView):
    serializer_class = TaskSerializer
    lookup_url_kwarg = 'task_id'

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, KidActor):
            return Task.objects.filter(kid_id=user.kid_id, is_active=True)
        if isinstance(user, ParentActor):
            return Task.objects.filter(is_active=True)
        return Task.objects.none()


class TaskCompletionListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        user = self.request.user
        qs = TaskCompletion.objects.select_related('task')
        if isinstance(user, KidActor):
            return qs.filter(kid_id=user.kid_id)
        if isinstance(user, ParentActor):
            kid_id = self.request.query_params.get('kid_id')
            status_filter = self.request.query_params.get('status')
            if kid_id:
                qs = qs.filter(kid_id=kid_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            return qs
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
        kid = request.user
        task_id = serializer.validated_data['task_id']

        try:
            task = Task.objects.get(pk=task_id, kid_id=kid.kid_id, is_active=True)
        except Task.DoesNotExist as exc:
            raise NotFound('Task not found.') from exc

        if TaskCompletion.objects.filter(
            task=task,
            kid_id=kid.kid_id,
            status=TaskCompletion.Status.PENDING,
        ).exists():
            raise ValidationError({'task_id': 'This task already has a pending completion.'})

        completion = TaskCompletion.objects.create(task=task, kid_id=kid.kid_id)
        output = TaskCompletionSerializer(completion)
        return Response(output.data, status=status.HTTP_201_CREATED)


class TaskCompletionReviewView(APIView):
    permission_classes = [IsParent]

    def post(self, request, completion_id):
        try:
            completion = TaskCompletion.objects.select_related('task').get(pk=completion_id)
        except TaskCompletion.DoesNotExist as exc:
            raise NotFound('Completion not found.') from exc

        if completion.status != TaskCompletion.Status.PENDING:
            raise ValidationError({'detail': 'Completion is already reviewed.'})

        serializer = TaskCompletionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        parent = request.user
        completion.status = serializer.validated_data['status']
        completion.review_note = serializer.validated_data.get('review_note', '')
        completion.reviewer_id = parent.user_id
        completion.reviewed_at = timezone.now()
        completion.save(
            update_fields=['status', 'review_note', 'reviewer_id', 'reviewed_at'],
        )

        return Response(TaskCompletionSerializer(completion).data)

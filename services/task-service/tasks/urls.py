from django.urls import path

from .views import (
    TaskCompletionListCreateView,
    TaskCompletionReviewView,
    TaskDetailView,
    TaskListCreateView,
)

urlpatterns = [
    path('tasks/', TaskListCreateView.as_view()),
    path('tasks/<uuid:task_id>/', TaskDetailView.as_view()),
    path('completions/', TaskCompletionListCreateView.as_view()),
    path('completions/<uuid:completion_id>/review/', TaskCompletionReviewView.as_view()),
]

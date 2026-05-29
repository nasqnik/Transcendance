from django.urls import path

from .views import (
    KidCategoryVisibilityView,
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
    path('settings/categories/', KidCategoryVisibilityView.as_view()),
]

# URL responsibilities:
#
# tasks/
#   GET  -> list tasks
#   POST -> create task (parent)
#
# tasks/<task_id>/
#   GET -> get one task
#
# completions/
#   GET  -> list completions
#   POST -> kid submits completion
#
# completions/<completion_id>/review/
#   POST -> parent confirms or rejects
#
# settings/categories/
#   GET -> kid reads category visibility settings
#   PUT -> kid updates category visibility settings

from django.urls import path

from .views import InternalCompletionView, KidStatListView, KidProfileView, KidStatListViewParent
                

urlpatterns = [
    path('internal/completions/', InternalCompletionView.as_view(), name='internal-completions'),

    # read endpoints
    path('stats/', KidStatListView.as_view(), name='kid-stat-list'),
    path('profile/', KidProfileView.as_view(), name='kid-profile'),
    path('kids/<uuid:kid_id>/stats/', KidStatListViewParent.as_view(), name='parent-kid-stat-list'),
]

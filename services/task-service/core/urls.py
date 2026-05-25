from django.urls import include, path

urlpatterns = [
    path('api/', include('common.urls')),
    path('api/', include('tasks.urls')),
]

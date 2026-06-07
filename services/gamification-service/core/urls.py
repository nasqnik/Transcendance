from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('api/gamification/schema/', SpectacularAPIView.as_view(), name='gamification-schema'),
    path('api/gamification/docs/', SpectacularSwaggerView.as_view(url_name='gamification-schema')),
    path('api/gamification/', include('common.urls')),       # health
    path('api/gamification/', include('gamification.urls')),
]
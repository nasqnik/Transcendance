from rest_framework.permissions import BasePermission

from .actors import KidActor, ParentActor

from django.conf import settings


class IsKid(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, KidActor)


class IsParent(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, ParentActor)

class IsInternalService(BasePermission):
    def has_permission(self, request, view):
        token = request.headers.get('X-Internal-Token')
        return bool(token) and token == settings.INTERNAL_SERVICE_TOKEN
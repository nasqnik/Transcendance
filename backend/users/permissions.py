from rest_framework.permissions import BasePermission

from .models import Kid


class IsAuthenticatedKid(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, Kid) and request.user.is_authenticated

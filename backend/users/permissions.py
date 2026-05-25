from rest_framework.permissions import BasePermission

from .models import Kid

class IsAuthenticatedKid(BasePermission):
    # has_permission -> check if the user is authenticated and is a kid "by defult it just returns True"
    def has_permission(self, request, view):
        return isinstance(request.user, Kid) and request.user.is_authenticated

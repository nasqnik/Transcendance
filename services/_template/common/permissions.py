from rest_framework.permissions import BasePermission

from .actors import KidActor, ParentActor


class IsKid(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, KidActor)


class IsParent(BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, ParentActor)

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import CustomUser, GuardianInvitation, Kid


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "username", "role", "is_staff", "is_active")
    search_fields = ("email", "username")


@admin.register(Kid)
class KidAdmin(admin.ModelAdmin):
    list_display = ("username", "name", "parent", "registration_status", "created_at")
    list_filter = ("registration_status",)
    search_fields = ("username", "name", "email")


@admin.register(GuardianInvitation)
class GuardianInvitationAdmin(admin.ModelAdmin):
    list_display = (
        "invite_email",
        "kid",
        "parent",
        "role",
        "status",
        "created_at",
    )
    list_filter = ("status", "role")
    search_fields = ("invite_email", "token")
    readonly_fields = ("id", "token", "created_at")

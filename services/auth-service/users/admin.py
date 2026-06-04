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


# the decorators are used to register the models with the admin site

# UserAdmin -> used for custom user model
# ModelAdmin -> used for custom models

# ModelAdmin options :

# ordering -> order of display
# list_display -> fields to display
# list_filter -> fields to filter
# search_fields -> fields to search
# readonly_fields -> fields to readonly
# list_editable -> fields to edit
# list_per_page -> number of items to display per page
# list_max_show_all -> number of items to display when showing all
# list_select_related -> fields to select related
# list_prefetch_related -> fields to prefetch related
# list_filter_vertical -> fields to filter vertically
# list_filter_horizontal -> fields to filter horizontally

# source<link> : https://docs.djangoproject.com/en/6.0/ref/contrib/admin/#modeladmin-options
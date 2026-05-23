from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Room, Booking, RoomFeature
from .models_users import Organization, User


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "invite_key", "created_at")
    search_fields = ("name", "slug")
    readonly_fields = ("invite_key", "created_at")


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "role", "organization", "is_active")
    list_filter = ("role", "organization", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        (
            "Organization",
            {"fields": ("role", "organization")},
        ),
    )


@admin.register(RoomFeature)
class RoomFeatureAdmin(admin.ModelAdmin):
    list_display = ("name", "icon")
    search_fields = ("name",)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "capacity", "location")
    search_fields = ("name", "location")
    list_filter = ("organization", "capacity", "features")
    filter_horizontal = ("features",)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "room",
        "user",
        "organization",
        "start_time_display",
        "end_time_display",
        "created_at",
    )
    search_fields = ("room__name", "user__username")
    list_filter = (
        "organization",
        "room",
        ("start_time", admin.DateFieldListFilter),
        ("end_time", admin.DateFieldListFilter),
    )
    autocomplete_fields = ("room", "user")
    date_hierarchy = "start_time"

    def start_time_display(self, obj):
        return obj.start_time.strftime("%H:%M")

    start_time_display.short_description = "Start Time"

    def end_time_display(self, obj):
        return obj.end_time.strftime("%H:%M")

    end_time_display.short_description = "End Time"

    def save_model(self, request, obj, form, change):
        obj.full_clean()
        super().save_model(request, obj, form, change)

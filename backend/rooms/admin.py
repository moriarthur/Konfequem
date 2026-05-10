from django.contrib import admin
from .models import Room, Booking, RoomFeature


@admin.register(RoomFeature)
class RoomFeatureAdmin(admin.ModelAdmin):
    list_display = ("name", "icon")
    search_fields = ("name",)


# Register model Room in admin panel
@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "capacity", "location")  # what to display in the table
    search_fields = ("name", "location")  # search fields
    list_filter = ("capacity", "features")  # filters on the right
    filter_horizontal = ("features",)  # many-to-many filter widget


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "room",
        "user",
        "start_time_display",
        "end_time_display",
        "created_at",
    )
    search_fields = ("room__name", "user__username")
    list_filter = (
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

from django.contrib import admin
from .models import Room, Booking
# Register model Room in admin panel
@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity', 'location')  # what to display in the table
    search_fields = ('name', 'location')             # search fields
    list_filter = ('capacity',)                      # filters on the right

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('room', 'user', 'start_time', 'end_time', 'created_at')
    search_fields = ('room__name', 'user__username')
    list_filter = ('start_time', 'room')

    def save_model(self, request, obj, form, change):  # override save_model method to call clean() method
        obj.full_clean()  # вызов метода clean()
        super().save_model(request, obj, form, change)
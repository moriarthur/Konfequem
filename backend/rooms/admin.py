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
    list_filter = (
        'room', ('start_time', admin.DateFieldListFilter), ('end_time', admin.DateFieldListFilter)  # filters for room and date fields
    ) 
    autocomplete_fields = ('room', 'user')                                                          # allows to search for a room or user in the booking form 
    date_hierarchy = 'start_time'                                                                   # adds a date hierarchy filter

    def save_model(self, request, obj, form, change):                                               # override save_model method to call clean() method
        obj.full_clean()                                                                            # call the clean method to validate the booking
        super().save_model(request, obj, form, change)
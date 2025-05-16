from django.contrib import admin
from .models import Room

# Register model Room in admin panel
@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity', 'location')  # what to display in the table
    search_fields = ('name', 'location')             # search fields
    list_filter = ('capacity',)                      # filters on the right

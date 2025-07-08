from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('rooms.urls')),  # Include the URLs from the rooms app
    path('api/', include('api.urls')),  # Include the URLs from the api app
]

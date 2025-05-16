from django.shortcuts import render
from rest_framework import viewsets
from .models import Room
from .serializers import RoomSerializer

# This viewset provides CRUD operations for the Room model
class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all() 
    serializer_class = RoomSerializer 

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT token serializer with UTF-8 support.
    """
    def validate(self, attrs):
        # Let parent class handle authentication
        # The parent class properly handles UTF-8
        return super().validate(attrs)

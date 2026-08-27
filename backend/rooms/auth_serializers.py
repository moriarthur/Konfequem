from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "organization": (
                {
                    "id": user.organization.id,
                    "name": user.organization.name,
                    "slug": user.organization.slug,
                }
                if user.organization
                else None
            ),
        }
        return data

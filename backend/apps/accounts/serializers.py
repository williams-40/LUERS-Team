from rest_framework import serializers
from apps.core.choices import Role
from django.contrib.auth import get_user_model
User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_display', 'university_id', 'phone_number', 'date_joined']
        read_only_fields = ['id', 'date_joined']

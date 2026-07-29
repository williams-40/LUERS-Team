from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.accounts.serializers import OfficerSerializer, UserSerializer
from apps.accounts.permissions import IsSecurity, IsICTAdmin, IsManagement, IsStudentOrStaff
from apps.core.choices import Role

User = get_user_model()

class LoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/
    Returns access and refresh tokens.
    """
    permission_classes = [AllowAny]

class RefreshView(TokenRefreshView):
    """
    POST /api/v1/auth/refresh/
    Returns a new access token using a valid refresh token.
    """
    permission_classes = [AllowAny]

class MeView(APIView):
    """
    GET /api/v1/auth/me/
    Returns the current authenticated user's profile.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class SecurityOfficersView(generics.ListAPIView):
    """
    GET /api/v1/auth/officers/
    Lists security officers for assignment pickers. Same role gate as
    ReportAssignView (IsSecurity|IsICTAdmin) since that's the only place
    this list is used.
    """
    serializer_class = OfficerSerializer
    permission_classes = [IsAuthenticated, IsSecurity | IsICTAdmin]
    pagination_class = None
    queryset = User.objects.filter(role=Role.SECURITY).order_by('username')
# ... existing imports ...


# Add these new views

class TestSecurityView(APIView):
    permission_classes = [IsAuthenticated, IsSecurity]

    def get(self, request):
        return Response({"message": "You are a Security Officer", "role": request.user.role})

class TestICTAdminView(APIView):
    permission_classes = [IsAuthenticated, IsICTAdmin]

    def get(self, request):
        return Response({"message": "You are an ICT Admin", "role": request.user.role})

class TestManagementView(APIView):
    permission_classes = [IsAuthenticated, IsManagement]

    def get(self, request):
        return Response({"message": "You are Management (Escrow Authority)", "role": request.user.role})

class TestStudentStaffView(APIView):
    permission_classes = [IsAuthenticated, IsStudentOrStaff]

    def get(self, request):
        return Response({"message": "You are a Student or Staff member", "role": request.user.role})

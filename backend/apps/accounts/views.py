from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from apps.accounts.serializers import UserSerializer
from apps.accounts.permissions import IsSecurity, IsICTAdmin, IsManagement, IsStudentOrStaff

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

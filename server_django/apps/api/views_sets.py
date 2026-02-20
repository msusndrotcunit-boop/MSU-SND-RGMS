from rest_framework import viewsets, permissions
from .models import Cadet, Staff, Attendance, Grade, MeritDemeritLog
from .serializers import CadetSerializer, StaffSerializer, AttendanceSerializer, GradeSerializer, MeritDemeritLogSerializer
from .permissions import RolePermission

class ReadOnlyUnlessAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        # write operations only for admin
        return RolePermission({'admin'}).has_permission(request, view)

class CadetViewSet(viewsets.ModelViewSet):
    queryset = Cadet.objects.all().order_by('-created_at')
    serializer_class = CadetSerializer
    permission_classes = [ReadOnlyUnlessAdmin]

class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all().order_by('-created_at')
    serializer_class = StaffSerializer
    permission_classes = [ReadOnlyUnlessAdmin]

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all().order_by('-created_at')
    serializer_class = AttendanceSerializer
    permission_classes = [ReadOnlyUnlessAdmin]

class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.all().order_by('-updated_at')
    serializer_class = GradeSerializer
    permission_classes = [ReadOnlyUnlessAdmin]

class MeritDemeritLogViewSet(viewsets.ModelViewSet):
    queryset = MeritDemeritLog.objects.all().order_by('-created_at')
    serializer_class = MeritDemeritLogSerializer
    permission_classes = [ReadOnlyUnlessAdmin]

"""
Root URL view for the API.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.conf import settings


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    """
    API root endpoint that provides information about the API.
    """
    return Response({
        'message': 'MSU-SND ROTC Management System API',
        'version': '1.0.0',
        'status': 'online',
        'endpoints': {
            'admin': '/admin/',
            'api_v1': '/api/v1/',
            'api_auth': '/api/auth/',
            'api_cadets': '/api/cadets/',
            'api_grades': '/api/grades/',
            'api_attendance': '/api/attendance/',
            'api_activities': '/api/activities/',
            'api_reports': '/api/reports/',
            'api_health': '/api/health/',
        },
        'documentation': 'https://github.com/msusndrotcunit-boop/MSU-SND-RGMS',
    })

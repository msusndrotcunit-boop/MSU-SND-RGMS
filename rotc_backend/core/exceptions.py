"""
Custom exception handler for Django REST Framework.
Provides user-friendly error messages and comprehensive error logging.
"""
import logging
import traceback
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework.exceptions import (
    ValidationError,
    PermissionDenied,
    NotAuthenticated,
    AuthenticationFailed,
    NotFound,
    MethodNotAllowed,
    Throttled,
)
from core.notifications import send_critical_error_notification


logger = logging.getLogger('apps')


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides user-friendly error messages
    and logs all errors with stack traces.
    Formats errors to match Node.js backend format:
    {error: true, message: "...", code: "...", details: {...}}
    
    Args:
        exc: The exception instance
        context: Context dictionary containing view, request, etc.
        
    Returns:
        Response object with error details
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # Get request information for logging
    request = context.get('request')
    view = context.get('view')
    
    # Prepare error context for logging
    error_context = {
        'exception_type': type(exc).__name__,
        'exception_message': str(exc),
        'path': request.path if request else None,
        'method': request.method if request else None,
        'user': request.user.username if request and hasattr(request, 'user') and request.user.is_authenticated else 'anonymous',
        'view': view.__class__.__name__ if view else None,
    }
    
    # Log the error with stack trace
    if response is None:
        # Unhandled exception
        logger.error(
            f'Unhandled exception: {type(exc).__name__}: {str(exc)}',
            extra=error_context,
            exc_info=True
        )
    else:
        # Handled exception
        if response.status_code >= 500:
            logger.error(
                f'Server error: {type(exc).__name__}: {str(exc)}',
                extra=error_context,
                exc_info=True
            )
        elif response.status_code >= 400:
            logger.warning(
                f'Client error: {type(exc).__name__}: {str(exc)}',
                extra=error_context
            )
    
    # Handle specific exception types with Node.js compatible format
    if isinstance(exc, NotAuthenticated):
        return Response({
            'error': True,
            'message': 'Authentication required. You must be logged in to access this resource',
            'code': 'UNAUTHORIZED',
            'details': {}
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    elif isinstance(exc, AuthenticationFailed):
        return Response({
            'error': True,
            'message': str(exc),
            'code': 'UNAUTHORIZED',
            'details': {}
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    elif isinstance(exc, PermissionDenied):
        return Response({
            'error': True,
            'message': 'You do not have permission to perform this action',
            'code': 'FORBIDDEN',
            'details': {}
        }, status=status.HTTP_403_FORBIDDEN)
    
    elif isinstance(exc, NotFound) or isinstance(exc, Http404):
        return Response({
            'error': True,
            'message': 'The requested resource was not found',
            'code': 'NOT_FOUND',
            'details': {}
        }, status=status.HTTP_404_NOT_FOUND)
    
    elif isinstance(exc, MethodNotAllowed):
        return Response({
            'error': True,
            'message': f'Method {request.method} is not allowed for this endpoint',
            'code': 'METHOD_NOT_ALLOWED',
            'details': {'method': request.method}
        }, status=status.HTTP_405_METHOD_NOT_ALLOWED)
    
    elif isinstance(exc, Throttled):
        return Response({
            'error': True,
            'message': f'Request was throttled. Please wait {exc.wait} seconds before trying again.',
            'code': 'TOO_MANY_REQUESTS',
            'details': {'retry_after': exc.wait}
        }, status=status.HTTP_429_TOO_MANY_REQUESTS)
    
    elif isinstance(exc, ValidationError) or isinstance(exc, DjangoValidationError):
        # Validation errors
        if hasattr(exc, 'detail'):
            error_detail = exc.detail
        else:
            error_detail = str(exc)
        
        return Response({
            'error': True,
            'message': 'Validation error',
            'code': 'BAD_REQUEST',
            'details': error_detail if isinstance(error_detail, dict) else {'validation': error_detail}
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Handle database errors
    elif 'DatabaseError' in type(exc).__name__ or 'OperationalError' in type(exc).__name__:
        logger.critical(
            f'Database error: {type(exc).__name__}: {str(exc)}',
            extra=error_context,
            exc_info=True
        )
        
        # Send critical error notification to admins
        send_critical_error_notification(
            'Database Error',
            str(exc),
            error_context
        )
        
        if settings.DEBUG:
            return Response({
                'error': True,
                'message': str(exc),
                'code': 'INTERNAL_SERVER_ERROR',
                'details': {'type': type(exc).__name__}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            return Response({
                'error': True,
                'message': 'A database error occurred. Please try again later.',
                'code': 'INTERNAL_SERVER_ERROR',
                'details': {}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # Handle Redis/cache errors
    elif 'ConnectionError' in type(exc).__name__ or 'RedisError' in type(exc).__name__:
        logger.error(
            f'Cache error: {type(exc).__name__}: {str(exc)}',
            extra=error_context,
            exc_info=True
        )
        
        # Send critical error notification to admins
        send_critical_error_notification(
            'Redis/Cache Error',
            str(exc),
            error_context
        )
        
        if settings.DEBUG:
            return Response({
                'error': True,
                'message': str(exc),
                'code': 'SERVICE_UNAVAILABLE',
                'details': {'type': type(exc).__name__}
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        else:
            return Response({
                'error': True,
                'message': 'A temporary error occurred. Please try again.',
                'code': 'SERVICE_UNAVAILABLE',
                'details': {}
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    # Generic error handling
    if response is not None:
        # DRF handled the exception
        if settings.DEBUG:
            # In development, return detailed error information
            return response
        else:
            # In production, return generic error messages
            if response.status_code >= 500:
                return Response({
                    'error': True,
                    'message': 'An unexpected error occurred. Please try again later.',
                    'code': 'INTERNAL_SERVER_ERROR',
                    'details': {}
                }, status=response.status_code)
            else:
                # Client errors can show more detail
                return response
    else:
        # Unhandled exception
        logger.critical(
            f'Unhandled exception: {type(exc).__name__}: {str(exc)}',
            extra=error_context,
            exc_info=True
        )
        
        if settings.DEBUG:
            # In development, return full traceback
            return Response({
                'error': True,
                'message': str(exc),
                'code': 'INTERNAL_SERVER_ERROR',
                'details': {
                    'type': type(exc).__name__,
                    'traceback': traceback.format_exc()
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # In production, return generic error
            return Response({
                'error': True,
                'message': 'An unexpected error occurred. Please try again later.',
                'code': 'INTERNAL_SERVER_ERROR',
                'details': {}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

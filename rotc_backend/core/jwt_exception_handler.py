"""
Custom JWT exception handler with detailed error codes and messages.
"""
from rest_framework.views import exception_handler
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger('apps.authentication')


def jwt_exception_handler(exc, context):
    """
    Custom exception handler for JWT authentication errors.
    Returns structured error responses with clear error codes.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # Get request ID if available
    request = context.get('request')
    request_id = getattr(request, 'request_id', 'unknown')
    
    # Handle JWT-specific exceptions
    if isinstance(exc, InvalidToken):
        error_code, error_message, http_status = _handle_invalid_token(exc, request_id)
        
        return Response({
            'error': error_code,
            'message': error_message,
            'request_id': request_id,
            'detail': 'Authentication credentials were not provided or are invalid.'
        }, status=http_status)
    
    elif isinstance(exc, TokenError):
        error_code, error_message, http_status = _handle_token_error(exc, request_id)
        
        return Response({
            'error': error_code,
            'message': error_message,
            'request_id': request_id,
            'detail': 'Token validation failed.'
        }, status=http_status)
    
    # Add request ID to all error responses
    if response is not None and request_id != 'unknown':
        response.data['request_id'] = request_id
    
    return response


def _handle_invalid_token(exc, request_id):
    """
    Handle InvalidToken exceptions and return appropriate error code.
    """
    error_detail = str(exc.detail) if hasattr(exc, 'detail') else str(exc)
    error_detail_lower = error_detail.lower()
    
    # Token signature verification failed
    if 'signature' in error_detail_lower or 'invalid' in error_detail_lower:
        logger.warning(f"[{request_id}] Token signature verification failed")
        return (
            'token_invalid_signature',
            'Token signature is invalid. Please log in again.',
            status.HTTP_401_UNAUTHORIZED
        )
    
    # Token is expired
    if 'expired' in error_detail_lower:
        logger.info(f"[{request_id}] Token expired")
        return (
            'token_expired',
            'Your session has expired. Please log in again.',
            status.HTTP_401_UNAUTHORIZED
        )
    
    # Token is malformed
    if 'malformed' in error_detail_lower or 'decode' in error_detail_lower:
        logger.warning(f"[{request_id}] Malformed token")
        return (
            'token_malformed',
            'Authentication token is malformed. Please log in again.',
            status.HTTP_401_UNAUTHORIZED
        )
    
    # Token is blacklisted
    if 'blacklist' in error_detail_lower:
        logger.info(f"[{request_id}] Token is blacklisted")
        return (
            'token_blacklisted',
            'This token has been revoked. Please log in again.',
            status.HTTP_401_UNAUTHORIZED
        )
    
    # Generic invalid token
    logger.warning(f"[{request_id}] Invalid token - {error_detail}")
    return (
        'token_invalid',
        'Authentication token is invalid. Please log in again.',
        status.HTTP_401_UNAUTHORIZED
    )


def _handle_token_error(exc, request_id):
    """
    Handle TokenError exceptions and return appropriate error code.
    """
    error_detail = str(exc) if not hasattr(exc, 'detail') else str(exc.detail)
    error_detail_lower = error_detail.lower()
    
    # Token not found in request
    if 'not found' in error_detail_lower or 'no active account' in error_detail_lower:
        logger.info(f"[{request_id}] Token not found or user not active")
        return (
            'token_not_found',
            'Authentication credentials were not provided.',
            status.HTTP_401_UNAUTHORIZED
        )
    
    # Generic token error
    logger.warning(f"[{request_id}] Token error - {error_detail}")
    return (
        'token_error',
        'An error occurred while validating your authentication token.',
        status.HTTP_401_UNAUTHORIZED
    )

"""
Custom JSON renderer for API response format standardization.
Ensures all API responses match Node.js backend format exactly.
"""
from rest_framework.renderers import JSONRenderer
from rest_framework.utils.serializer_helpers import ReturnDict, ReturnList
from datetime import datetime, date
from decimal import Decimal
import json


class StandardJSONEncoder(json.JSONEncoder):
    """
    Custom JSON encoder that handles special types and ensures
    consistent formatting across all responses.
    """
    def default(self, obj):
        # Handle datetime objects - ISO 8601 format
        if isinstance(obj, datetime):
            return obj.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
        elif isinstance(obj, date):
            return obj.isoformat()
        # Handle Decimal objects
        elif isinstance(obj, Decimal):
            return float(obj)
        # Handle other types
        return super().default(obj)


class NodeJSCompatibleRenderer(JSONRenderer):
    """
    Custom renderer that formats all API responses to match Node.js backend format.
    
    Success responses: {success: true, data: {...}, message: "..."}
    Error responses: {error: true, message: "...", code: "...", details: {...}}
    Pagination responses: {page: 1, limit: 50, total: 100, data: [...]}
    """
    
    encoder_class = StandardJSONEncoder
    
    def render(self, data, accepted_media_type=None, renderer_context=None):
        """
        Render data into JSON with Node.js compatible format.
        """
        if renderer_context is None:
            return super().render(data, accepted_media_type, renderer_context)
        
        response = renderer_context.get('response')
        request = renderer_context.get('request')
        view = renderer_context.get('view')
        
        if response is None:
            return super().render(data, accepted_media_type, renderer_context)
        
        status_code = response.status_code
        
        # Don't wrap if data is already in correct format
        if isinstance(data, dict):
            # Check if it's already formatted (has 'success', 'error', or pagination keys)
            if 'success' in data or 'error' in data or ('page' in data and 'limit' in data):
                return super().render(data, accepted_media_type, renderer_context)
        
        # Handle error responses (4xx, 5xx)
        if status_code >= 400:
            error_response = self._format_error_response(data, status_code)
            return super().render(error_response, accepted_media_type, renderer_context)
        
        # Handle pagination responses
        if isinstance(data, dict) and 'results' in data:
            paginated_response = self._format_paginated_response(data, request)
            return super().render(paginated_response, accepted_media_type, renderer_context)
        
        # Handle success responses (2xx)
        if 200 <= status_code < 300:
            success_response = self._format_success_response(data, status_code)
            return super().render(success_response, accepted_media_type, renderer_context)
        
        # Default: return as-is
        return super().render(data, accepted_media_type, renderer_context)
    
    def _format_success_response(self, data, status_code):
        """
        Format success response to match Node.js format.
        {success: true, data: {...}, message: "..."}
        """
        # Extract message if present in data
        message = None
        if isinstance(data, dict):
            message = data.pop('message', None)
        
        response = {
            'success': True,
            'data': data
        }
        
        # Add message if present
        if message:
            response['message'] = message
        elif status_code == 201:
            response['message'] = 'Resource created successfully'
        
        return response
    
    def _format_error_response(self, data, status_code):
        """
        Format error response to match Node.js format.
        {error: true, message: "...", code: "...", details: {...}}
        """
        # Default error message
        message = 'An error occurred'
        code = self._get_error_code(status_code)
        details = {}
        
        if isinstance(data, dict):
            # Extract error information
            if 'error' in data and isinstance(data['error'], str):
                message = data['error']
            elif 'detail' in data:
                message = data['detail'] if isinstance(data['detail'], str) else str(data['detail'])
            elif 'message' in data:
                message = data['message']
            else:
                # Use first key's value as message
                for key, value in data.items():
                    if isinstance(value, (str, list)):
                        message = value[0] if isinstance(value, list) else value
                        break
            
            # Extract details
            details = {k: v for k, v in data.items() if k not in ['error', 'detail', 'message']}
        elif isinstance(data, str):
            message = data
        elif isinstance(data, list):
            message = data[0] if data else message
        
        response = {
            'error': True,
            'message': message,
            'code': code
        }
        
        # Add details if present
        if details:
            response['details'] = details
        
        return response
    
    def _format_paginated_response(self, data, request):
        """
        Format paginated response to match Node.js format.
        {page: 1, limit: 50, total: 100, data: [...]}
        """
        # Extract pagination info
        count = data.get('count', 0)
        results = data.get('results', [])
        
        # Get page and limit from request
        page = 1
        limit = 50
        
        if request:
            try:
                page = int(request.query_params.get('page', 1))
            except (ValueError, TypeError):
                page = 1
            
            try:
                limit = int(request.query_params.get('limit', 50))
            except (ValueError, TypeError):
                limit = 50
        
        return {
            'page': page,
            'limit': limit,
            'total': count,
            'data': results
        }
    
    def _get_error_code(self, status_code):
        """
        Get error code string based on HTTP status code.
        """
        error_codes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            405: 'METHOD_NOT_ALLOWED',
            409: 'CONFLICT',
            422: 'UNPROCESSABLE_ENTITY',
            429: 'TOO_MANY_REQUESTS',
            500: 'INTERNAL_SERVER_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE',
            504: 'GATEWAY_TIMEOUT',
        }
        return error_codes.get(status_code, 'ERROR')

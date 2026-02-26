"""
Custom pagination classes for Node.js backend compatibility.
Ensures pagination format matches: {page, limit, total, data}
"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from collections import OrderedDict


class NodeJSCompatiblePagination(PageNumberPagination):
    """
    Pagination class that returns results in Node.js compatible format:
    {
        page: 1,
        limit: 50,
        total: 100,
        data: [...]
    }
    """
    page_size = 50
    page_size_query_param = 'limit'
    page_query_param = 'page'
    max_page_size = 1000
    
    def get_paginated_response(self, data):
        """
        Return paginated response in Node.js format.
        """
        return Response(OrderedDict([
            ('page', self.page.number),
            ('limit', self.get_page_size(self.request)),
            ('total', self.page.paginator.count),
            ('data', data)
        ]))
    
    def get_paginated_response_schema(self, schema):
        """
        Return schema for paginated response.
        """
        return {
            'type': 'object',
            'properties': {
                'page': {
                    'type': 'integer',
                    'example': 1,
                },
                'limit': {
                    'type': 'integer',
                    'example': 50,
                },
                'total': {
                    'type': 'integer',
                    'example': 100,
                },
                'data': schema,
            },
        }

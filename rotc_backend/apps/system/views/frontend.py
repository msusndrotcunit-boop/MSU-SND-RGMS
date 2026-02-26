"""
View to serve the React frontend.
"""
from django.http import HttpResponse
from django.conf import settings
import os


def serve_react_app(request):
    """
    Serve the React app's index.html for all non-API routes.
    """
    try:
        index_path = os.path.join(settings.STATIC_ROOT, 'index.html')
        with open(index_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')
    except FileNotFoundError:
        return HttpResponse(
            '<h1>Frontend Not Found</h1>'
            '<p>The React frontend has not been built yet. Please run the build process.</p>',
            status=404
        )
    except Exception as e:
        return HttpResponse(
            f'<h1>Error Loading Frontend</h1><p>{str(e)}</p>',
            status=500
        )

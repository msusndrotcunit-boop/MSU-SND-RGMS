"""
Content Security Policy (CSP) middleware for XSS protection.
"""


class ContentSecurityPolicyMiddleware:
    """
    Middleware to add Content-Security-Policy headers to all responses.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Define CSP directives
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob: https://res.cloudinary.com",
            "connect-src 'self' https://res.cloudinary.com wss: ws:",
            "media-src 'self' https://res.cloudinary.com",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "upgrade-insecure-requests",
        ]
        
        # Join directives with semicolons
        csp_header = "; ".join(csp_directives)
        
        # Add CSP header
        response['Content-Security-Policy'] = csp_header
        
        # Also add report-only header for monitoring (optional)
        # response['Content-Security-Policy-Report-Only'] = csp_header
        
        return response

import time

class ResponseTimeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - start) * 1000
        try:
            response["X-Response-Time-ms"] = f"{duration_ms:.2f}"
        except Exception:
            # Non-standard responses may not support header assignment
            pass
        return response


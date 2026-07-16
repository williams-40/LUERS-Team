from apps.reports.services import ReportService

class RequestIPMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Get client IP address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR', '0.0.0.0')

        # Store it on the service class
        ReportService._ip = ip

        # Debug: print to confirm it's running
        print(f"[MIDDLEWARE] IP captured: {ip}")

        response = self.get_response(request)
        return response
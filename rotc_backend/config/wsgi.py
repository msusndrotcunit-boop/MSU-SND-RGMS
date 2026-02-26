"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os
import sys

from django.core.wsgi import get_wsgi_application

# Force production settings if DJANGO_SETTINGS_MODULE is set to config.settings.production
# or if DJANGO_ENV is production
django_settings = os.environ.get('DJANGO_SETTINGS_MODULE', '')
django_env = os.environ.get('DJANGO_ENV', '')

# Debug logging
print(f"[WSGI] DJANGO_SETTINGS_MODULE from env: {django_settings}", file=sys.stderr)
print(f"[WSGI] DJANGO_ENV from env: {django_env}", file=sys.stderr)

if 'production' in django_settings or django_env == 'production':
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.production'
    print(f"[WSGI] Setting DJANGO_SETTINGS_MODULE to: config.settings.production", file=sys.stderr)
elif not django_settings:
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.development'
    print(f"[WSGI] Setting DJANGO_SETTINGS_MODULE to: config.settings.development", file=sys.stderr)

print(f"[WSGI] Final DJANGO_SETTINGS_MODULE: {os.environ.get('DJANGO_SETTINGS_MODULE')}", file=sys.stderr)

application = get_wsgi_application()

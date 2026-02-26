"""
Settings package for ROTC Backend.
Automatically loads the appropriate settings based on DJANGO_ENV environment variable.
"""
import os

env = os.getenv('DJANGO_ENV', 'development')

if env == 'production':
    from .production import *
else:
    from .development import *

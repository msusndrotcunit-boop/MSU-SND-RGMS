"""
Daphne configuration file for Django ASGI application (WebSocket support).
"""
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8001')}"

# Application
application = "config.asgi:application"

# Logging
verbosity = int(os.getenv('DAPHNE_VERBOSITY', '1'))
access_log = '-'

# WebSocket settings
websocket_timeout = 86400  # 24 hours
websocket_connect_timeout = 5
ping_interval = 20
ping_timeout = 30

# HTTP settings
http_timeout = 60

# Server settings
root_path = os.getenv('DAPHNE_ROOT_PATH', '')
proxy_headers = True

# Process settings
process_name = 'rotc-daphne'

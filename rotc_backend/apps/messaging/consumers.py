"""
WebSocket consumers for real-time updates.
Handles grade updates, attendance changes, and notifications.
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

User = get_user_model()


class UpdatesConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time updates.
    Supports token-based authentication and broadcasts grade, attendance, and notification updates.
    Includes error handling and reconnection support.
    """
    
    async def connect(self):
        """
        Handle WebSocket connection.
        Authenticate user via token in query params and add to appropriate groups.
        """
        try:
            # Get token from query string
            query_string = self.scope.get('query_string', b'').decode()
            token = None
            
            # Parse query string for token
            for param in query_string.split('&'):
                if '=' in param:
                    key, value = param.split('=', 1)
                    if key == 'token':
                        token = value
                        break
            
            if not token:
                logger.warning("WebSocket connection rejected: No token provided")
                await self.close(code=4001)
                return
            
            # Authenticate user with token
            user = await self.authenticate_token(token)
            if not user:
                logger.warning("WebSocket connection rejected: Invalid token")
                await self.close(code=4001)
                return
            
            # Store user in scope
            self.scope['user'] = user
            self.user = user
            
            # Accept the connection
            await self.accept()
            
            # Add user to their personal group
            self.user_group_name = f'user_{user.id}'
            await self.channel_layer.group_add(
                self.user_group_name,
                self.channel_name
            )
            
            # Add user to role-based group
            self.role_group_name = f'role_{user.role}'
            await self.channel_layer.group_add(
                self.role_group_name,
                self.channel_name
            )
            
            # If user is a cadet, add to cadet-specific group
            if user.role == 'cadet' and user.cadet_id:
                self.cadet_group_name = f'cadet_{user.cadet_id}'
                await self.channel_layer.group_add(
                    self.cadet_group_name,
                    self.channel_name
                )
            
            # Send connection success message
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': 'WebSocket connection established',
                'user_id': user.id,
                'role': user.role
            }))
            
            logger.info(f"WebSocket connected: user={user.username}, role={user.role}")
        
        except Exception as e:
            logger.error(f"Error during WebSocket connection: {e}")
            await self.close(code=4000)
    
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        Remove user from all groups.
        """
        try:
            if hasattr(self, 'user'):
                # Remove from user group
                if hasattr(self, 'user_group_name'):
                    await self.channel_layer.group_discard(
                        self.user_group_name,
                        self.channel_name
                    )
                
                # Remove from role group
                if hasattr(self, 'role_group_name'):
                    await self.channel_layer.group_discard(
                        self.role_group_name,
                        self.channel_name
                    )
                
                # Remove from cadet group if applicable
                if hasattr(self, 'cadet_group_name'):
                    await self.channel_layer.group_discard(
                        self.cadet_group_name,
                        self.channel_name
                    )
                
                logger.info(f"WebSocket disconnected: user={self.user.username}, code={close_code}")
        
        except Exception as e:
            logger.error(f"Error during WebSocket disconnection: {e}")
    
    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages.
        Supports heartbeat/ping messages and message replay requests.
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                # Respond to ping with pong
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
            
            elif message_type == 'replay_request':
                # Handle message replay for reconnection
                last_event_id = data.get('last_event_id', 0)
                await self.replay_missed_events(last_event_id)
            
            else:
                logger.warning(f"Unknown message type: {message_type}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}'
                }))
        
        except json.JSONDecodeError:
            logger.error("Invalid JSON received from WebSocket")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Internal server error'
            }))
    
    async def replay_missed_events(self, last_event_id):
        """
        Replay events that were missed during disconnection.
        
        Args:
            last_event_id: ID of the last event received by the client
        """
        try:
            # Get missed sync events
            missed_events = await self.get_missed_sync_events(last_event_id)
            
            # Send each missed event
            for event in missed_events:
                await self.send(text_data=json.dumps({
                    'type': 'sync_event',
                    'event_type': event['event_type'],
                    'data': event['payload'],
                    'event_id': event['id'],
                    'replayed': True
                }))
            
            # Send replay complete message
            await self.send(text_data=json.dumps({
                'type': 'replay_complete',
                'count': len(missed_events)
            }))
        
        except Exception as e:
            logger.error(f"Error replaying missed events: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to replay missed events'
            }))
    
    # Handlers for different event types
    
    async def grade_update(self, event):
        """
        Handle grade update events.
        Broadcast grade changes to connected clients.
        """
        try:
            await self.send(text_data=json.dumps({
                'type': 'grade_update',
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"Error sending grade update: {e}")
    
    async def attendance_update(self, event):
        """
        Handle attendance update events.
        Broadcast attendance changes to connected clients.
        """
        try:
            await self.send(text_data=json.dumps({
                'type': 'attendance_update',
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"Error sending attendance update: {e}")
    
    async def exam_score_update(self, event):
        """
        Handle exam score update events.
        Broadcast exam score changes to connected clients.
        """
        try:
            await self.send(text_data=json.dumps({
                'type': 'exam_score_update',
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"Error sending exam score update: {e}")
    
    async def notification(self, event):
        """
        Handle notification events.
        Broadcast notifications to connected clients.
        """
        try:
            await self.send(text_data=json.dumps({
                'type': 'notification',
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
    
    async def message(self, event):
        """
        Handle message events.
        Broadcast messages to connected clients.
        """
        try:
            await self.send(text_data=json.dumps({
                'type': 'message',
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"Error sending message: {e}")
    
    async def sync_event(self, event):
        """
        Handle sync event broadcasts.
        Generic handler for sync_events table processing.
        """
        try:
            await self.send(text_data=json.dumps({
                'type': event.get('event_type', 'sync_event'),
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"Error sending sync event: {e}")
    
    async def system_settings_update(self, event):
        """
        Handle system settings update events.
        Broadcast system settings changes to all connected clients.
        """
        try:
            await self.send(text_data=json.dumps({
                'type': 'system_settings_update',
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"Error sending system settings update: {e}")
    
    @database_sync_to_async
    def authenticate_token(self, token):
        """
        Authenticate user using JWT token.
        Returns User object if valid, None otherwise.
        """
        try:
            # Decode and validate token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            
            # Get user from database
            from apps.authentication.models import User
            user = User.objects.get(id=user_id)
            
            # Check if user is approved
            if not user.is_approved:
                logger.warning(f"User {user.username} not approved")
                return None
            
            return user
        
        except (TokenError, InvalidToken) as e:
            logger.error(f"Token validation error: {e}")
            return None
        except User.DoesNotExist:
            logger.error(f"User not found for token")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during authentication: {e}")
            return None
    
    @database_sync_to_async
    def get_missed_sync_events(self, last_event_id):
        """
        Get sync events that were missed during disconnection.
        
        Args:
            last_event_id: ID of the last event received by the client
            
        Returns:
            List of missed events
        """
        try:
            from apps.system.models import SyncEvent
            
            # Get events since last_event_id
            events = SyncEvent.objects.filter(
                id__gt=last_event_id
            ).order_by('id')[:50]  # Limit to 50 events
            
            # Filter events based on user role and cadet_id
            filtered_events = []
            for event in events:
                should_include = False
                
                # Include for admins and training staff
                if self.user.role in ['admin', 'training_staff']:
                    should_include = True
                # Include for cadet if it's their event
                elif self.user.role == 'cadet' and event.cadet_id == self.user.cadet_id:
                    should_include = True
                
                if should_include:
                    filtered_events.append({
                        'id': event.id,
                        'event_type': event.event_type,
                        'cadet_id': event.cadet_id,
                        'payload': event.payload
                    })
            
            return filtered_events
        
        except Exception as e:
            logger.error(f"Error getting missed sync events: {e}")
            return []

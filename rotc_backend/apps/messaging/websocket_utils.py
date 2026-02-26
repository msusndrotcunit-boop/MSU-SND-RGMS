"""
Utility functions for WebSocket broadcasting.
Provides functions to broadcast updates to connected clients via Django Channels.
"""
import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


def broadcast_grade_update(cadet_id, grade_data):
    """
    Broadcast grade update to relevant users.
    
    Args:
        cadet_id: ID of the cadet whose grades were updated
        grade_data: Dictionary containing updated grade information
    """
    channel_layer = get_channel_layer()
    
    if not channel_layer:
        logger.warning("Channel layer not configured, skipping WebSocket broadcast")
        return
    
    try:
        # Broadcast to the specific cadet
        async_to_sync(channel_layer.group_send)(
            f'cadet_{cadet_id}',
            {
                'type': 'grade_update',
                'data': {
                    'cadet_id': cadet_id,
                    **grade_data
                }
            }
        )
        
        # Broadcast to admins and training staff
        for role in ['admin', 'training_staff']:
            async_to_sync(channel_layer.group_send)(
                f'role_{role}',
                {
                    'type': 'grade_update',
                    'data': {
                        'cadet_id': cadet_id,
                        **grade_data
                    }
                }
            )
        
        logger.info(f"Broadcasted grade update for cadet {cadet_id}")
    
    except Exception as e:
        logger.error(f"Error broadcasting grade update: {e}")


def broadcast_attendance_update(cadet_id, attendance_data):
    """
    Broadcast attendance update to relevant users.
    
    Args:
        cadet_id: ID of the cadet whose attendance was updated
        attendance_data: Dictionary containing updated attendance information
    """
    channel_layer = get_channel_layer()
    
    if not channel_layer:
        logger.warning("Channel layer not configured, skipping WebSocket broadcast")
        return
    
    try:
        # Broadcast to the specific cadet
        async_to_sync(channel_layer.group_send)(
            f'cadet_{cadet_id}',
            {
                'type': 'attendance_update',
                'data': {
                    'cadet_id': cadet_id,
                    **attendance_data
                }
            }
        )
        
        # Broadcast to admins and training staff
        for role in ['admin', 'training_staff']:
            async_to_sync(channel_layer.group_send)(
                f'role_{role}',
                {
                    'type': 'attendance_update',
                    'data': {
                        'cadet_id': cadet_id,
                        **attendance_data
                    }
                }
            )
        
        logger.info(f"Broadcasted attendance update for cadet {cadet_id}")
    
    except Exception as e:
        logger.error(f"Error broadcasting attendance update: {e}")


def broadcast_exam_score_update(cadet_id, exam_data):
    """
    Broadcast exam score update to relevant users.
    
    Args:
        cadet_id: ID of the cadet whose exam scores were updated
        exam_data: Dictionary containing updated exam score information
    """
    channel_layer = get_channel_layer()
    
    if not channel_layer:
        logger.warning("Channel layer not configured, skipping WebSocket broadcast")
        return
    
    try:
        # Broadcast to the specific cadet
        async_to_sync(channel_layer.group_send)(
            f'cadet_{cadet_id}',
            {
                'type': 'exam_score_update',
                'data': {
                    'cadet_id': cadet_id,
                    **exam_data
                }
            }
        )
        
        # Broadcast to admins and training staff
        for role in ['admin', 'training_staff']:
            async_to_sync(channel_layer.group_send)(
                f'role_{role}',
                {
                    'type': 'exam_score_update',
                    'data': {
                        'cadet_id': cadet_id,
                        **exam_data
                    }
                }
            )
        
        logger.info(f"Broadcasted exam score update for cadet {cadet_id}")
    
    except Exception as e:
        logger.error(f"Error broadcasting exam score update: {e}")


def broadcast_notification(user_id, notification_data):
    """
    Broadcast notification to a specific user.
    
    Args:
        user_id: ID of the user to receive the notification
        notification_data: Dictionary containing notification information
    """
    channel_layer = get_channel_layer()
    
    if not channel_layer:
        logger.warning("Channel layer not configured, skipping WebSocket broadcast")
        return
    
    try:
        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}',
            {
                'type': 'notification',
                'data': notification_data
            }
        )
        
        logger.info(f"Broadcasted notification to user {user_id}")
    
    except Exception as e:
        logger.error(f"Error broadcasting notification: {e}")


def broadcast_message(recipient_ids, message_data):
    """
    Broadcast message to multiple users.
    
    Args:
        recipient_ids: List of user IDs to receive the message
        message_data: Dictionary containing message information
    """
    channel_layer = get_channel_layer()
    
    if not channel_layer:
        logger.warning("Channel layer not configured, skipping WebSocket broadcast")
        return
    
    try:
        for user_id in recipient_ids:
            async_to_sync(channel_layer.group_send)(
                f'user_{user_id}',
                {
                    'type': 'message',
                    'data': message_data
                }
            )
        
        logger.info(f"Broadcasted message to {len(recipient_ids)} users")
    
    except Exception as e:
        logger.error(f"Error broadcasting message: {e}")


def broadcast_sync_event(event_type, cadet_id, payload):
    """
    Broadcast sync event to relevant users.
    Generic function for processing sync_events table entries.
    
    Args:
        event_type: Type of sync event
        cadet_id: ID of the cadet (if applicable)
        payload: Event payload data
    """
    channel_layer = get_channel_layer()
    
    if not channel_layer:
        logger.warning("Channel layer not configured, skipping WebSocket broadcast")
        return
    
    try:
        # Broadcast to the specific cadet if cadet_id is provided
        if cadet_id:
            async_to_sync(channel_layer.group_send)(
                f'cadet_{cadet_id}',
                {
                    'type': 'sync_event',
                    'event_type': event_type,
                    'data': payload
                }
            )
        
        # Broadcast to admins and training staff
        for role in ['admin', 'training_staff']:
            async_to_sync(channel_layer.group_send)(
                f'role_{role}',
                {
                    'type': 'sync_event',
                    'event_type': event_type,
                    'data': payload
                }
            )
        
        logger.info(f"Broadcasted sync event: {event_type}")
    
    except Exception as e:
        logger.error(f"Error broadcasting sync event: {e}")


def broadcast_system_settings_update(key, value):
    """
    Broadcast system settings update to all connected clients.
    
    Args:
        key: Setting key that was updated
        value: New value of the setting
    """
    channel_layer = get_channel_layer()
    
    if not channel_layer:
        logger.warning("Channel layer not configured, skipping WebSocket broadcast")
        return
    
    try:
        # Broadcast to all roles (admin, cadet, training_staff)
        for role in ['admin', 'cadet', 'training_staff']:
            async_to_sync(channel_layer.group_send)(
                f'role_{role}',
                {
                    'type': 'system_settings_update',
                    'data': {
                        'key': key,
                        'value': value
                    }
                }
            )
        
        logger.info(f"Broadcasted system settings update: {key}")
    
    except Exception as e:
        logger.error(f"Error broadcasting system settings update: {e}")

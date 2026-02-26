"""
Sync event processor for broadcasting real-time updates.
Processes unprocessed sync_events and broadcasts them via WebSocket.
"""
import logging
from django.db import transaction
from apps.system.models import SyncEvent
from apps.messaging.websocket_utils import broadcast_sync_event

logger = logging.getLogger(__name__)


def process_sync_events(batch_size=100):
    """
    Process unprocessed sync events and broadcast them via WebSocket.
    
    Args:
        batch_size: Number of events to process in one batch
        
    Returns:
        Number of events processed
    """
    processed_count = 0
    
    try:
        # Get unprocessed sync events
        sync_events = SyncEvent.objects.filter(
            processed=False
        ).order_by('created_at')[:batch_size]
        
        for event in sync_events:
            try:
                # Broadcast the event via WebSocket
                broadcast_sync_event(
                    event_type=event.event_type,
                    cadet_id=event.cadet_id,
                    payload=event.payload
                )
                
                # Mark as processed
                event.processed = True
                event.save()
                
                processed_count += 1
                logger.debug(f"Processed sync event {event.id}: {event.event_type}")
            
            except Exception as e:
                logger.error(f"Error processing sync event {event.id}: {e}")
                # Continue processing other events
                continue
        
        if processed_count > 0:
            logger.info(f"Processed {processed_count} sync events")
        
        return processed_count
    
    except Exception as e:
        logger.error(f"Error in sync event processing: {e}")
        return processed_count


def cleanup_old_sync_events(days=7):
    """
    Clean up old processed sync events.
    
    Args:
        days: Number of days to keep processed events
        
    Returns:
        Number of events deleted
    """
    from django.utils import timezone
    from datetime import timedelta
    
    try:
        cutoff_date = timezone.now() - timedelta(days=days)
        
        deleted_count, _ = SyncEvent.objects.filter(
            processed=True,
            created_at__lt=cutoff_date
        ).delete()
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old sync events")
        
        return deleted_count
    
    except Exception as e:
        logger.error(f"Error cleaning up sync events: {e}")
        return 0

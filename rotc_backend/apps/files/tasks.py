"""
Celery tasks for file processing.
"""
from celery import shared_task
from PIL import Image
import io
import cloudinary.uploader
from django.core.files.uploadedfile import InMemoryUploadedFile
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def compress_and_upload_image(self, image_data, entity_type, entity_id, max_size=(1920, 1080), quality=85):
    """
    Compress an image and upload it to Cloudinary.
    
    Args:
        image_data: Base64 encoded image data or file path
        entity_type: Type of entity (profile_pic, activity_image, excuse_letter)
        entity_id: ID of the entity
        max_size: Maximum dimensions (width, height)
        quality: JPEG quality (1-100)
    
    Returns:
        dict: Cloudinary upload response with URL and public_id
    """
    try:
        logger.info(f"Starting image compression for {entity_type}:{entity_id}")
        
        # Open the image
        if isinstance(image_data, str):
            # If it's a file path
            img = Image.open(image_data)
        else:
            # If it's binary data
            img = Image.open(io.BytesIO(image_data))
        
        # Convert RGBA to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        
        # Resize if image is larger than max_size
        if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            logger.info(f"Resized image to {img.size}")
        
        # Compress and save to bytes
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        output.seek(0)
        
        # Upload to Cloudinary
        folder = f"rotc/{entity_type}"
        upload_result = cloudinary.uploader.upload(
            output,
            folder=folder,
            resource_type='image',
            public_id=f"{entity_type}_{entity_id}",
            overwrite=True,
            invalidate=True
        )
        
        logger.info(f"Successfully uploaded image to Cloudinary: {upload_result['secure_url']}")
        
        return {
            'url': upload_result['secure_url'],
            'public_id': upload_result['public_id'],
            'format': upload_result['format'],
            'width': upload_result['width'],
            'height': upload_result['height'],
            'bytes': upload_result['bytes']
        }
        
    except Exception as exc:
        logger.error(f"Error compressing/uploading image: {str(exc)}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def delete_cloudinary_image(self, public_id):
    """
    Delete an image from Cloudinary.
    
    Args:
        public_id: Cloudinary public ID of the image
    
    Returns:
        dict: Deletion result
    """
    try:
        logger.info(f"Deleting image from Cloudinary: {public_id}")
        result = cloudinary.uploader.destroy(public_id)
        logger.info(f"Successfully deleted image: {public_id}")
        return result
        
    except Exception as exc:
        logger.error(f"Error deleting image: {str(exc)}")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@shared_task(bind=True, max_retries=3)
def batch_compress_images(self, image_list):
    """
    Compress multiple images in batch.
    
    Args:
        image_list: List of dicts with image_data, entity_type, entity_id
    
    Returns:
        list: Results for each image
    """
    results = []
    for image_info in image_list:
        try:
            result = compress_and_upload_image.apply_async(
                args=[
                    image_info['image_data'],
                    image_info['entity_type'],
                    image_info['entity_id']
                ]
            )
            results.append({
                'entity_id': image_info['entity_id'],
                'task_id': result.id,
                'status': 'queued'
            })
        except Exception as e:
            logger.error(f"Error queuing image compression: {str(e)}")
            results.append({
                'entity_id': image_info['entity_id'],
                'error': str(e),
                'status': 'failed'
            })
    
    return results



@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_ocr_document(self, file_url, excuse_letter_id):
    """
    Process OCR on an uploaded document (excuse letter).
    
    Args:
        file_url: URL of the document to process
        excuse_letter_id: ID of the excuse letter
    
    Returns:
        dict: OCR result with extracted text
    """
    from apps.files.ocr import process_image_from_url, validate_tesseract_installation
    from apps.attendance.models import ExcuseLetter
    from apps.messaging.models import Notification
    from apps.authentication.models import User
    from django.utils import timezone
    
    try:
        logger.info(f"Starting OCR processing for excuse letter {excuse_letter_id}")
        
        # Validate Tesseract installation
        if not validate_tesseract_installation():
            raise ValueError("Tesseract OCR is not properly installed or configured")
        
        # Get excuse letter
        excuse_letter = ExcuseLetter.objects.get(id=excuse_letter_id)
        
        # Process OCR
        result = process_image_from_url(
            file_url,
            lang='eng',  # Can be configured to support multiple languages
            preprocess=True,
            auto_rotate=True,
            use_cache=True
        )
        
        # Update excuse letter with extracted text
        excuse_letter.ocr_text = result['text']
        excuse_letter.ocr_confidence = result['confidence']
        excuse_letter.ocr_processed_at = timezone.now()
        excuse_letter.save(update_fields=['ocr_text', 'ocr_confidence', 'ocr_processed_at'])
        
        logger.info(f"Successfully processed OCR for excuse letter {excuse_letter_id}")
        
        return {
            'excuse_letter_id': excuse_letter_id,
            'extracted_text': result['text'],
            'confidence': result['confidence'],
            'word_count': result['word_count'],
            'processed_at': str(excuse_letter.ocr_processed_at)
        }
        
    except ExcuseLetter.DoesNotExist:
        logger.error(f"Excuse letter {excuse_letter_id} not found")
        raise ValueError(f"Excuse letter {excuse_letter_id} not found")
    except Exception as exc:
        logger.error(f"Error processing OCR for excuse letter {excuse_letter_id}: {str(exc)}")
        
        # Notify admins of OCR failure
        try:
            admin_users = User.objects.filter(role='admin')
            for admin in admin_users:
                Notification.objects.create(
                    user=admin,
                    message=f"OCR processing failed for excuse letter #{excuse_letter_id}: {str(exc)}",
                    type='ocr_error'
                )
        except Exception as notify_error:
            logger.error(f"Failed to notify admins of OCR error: {str(notify_error)}")
        
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries)
        else:
            # Max retries reached, return error result
            return {
                'excuse_letter_id': excuse_letter_id,
                'error': str(exc),
                'status': 'failed',
                'retries': self.request.retries
            }


@shared_task(bind=True, max_retries=3)
def batch_process_ocr(self, file_urls_and_ids):
    """
    Process OCR on multiple documents in batch.
    
    Args:
        file_urls_and_ids: List of tuples (file_url, excuse_letter_id) or list of dicts
    
    Returns:
        list: Results for each document with task IDs and status
    """
    results = []
    
    # Handle both tuple and dict formats
    for item in file_urls_and_ids:
        if isinstance(item, dict):
            file_url = item.get('file_url')
            excuse_letter_id = item.get('excuse_letter_id')
        else:
            file_url, excuse_letter_id = item
        
        try:
            result = process_ocr_document.apply_async(
                args=[file_url, excuse_letter_id]
            )
            results.append({
                'excuse_letter_id': excuse_letter_id,
                'task_id': result.id,
                'status': 'queued',
                'file_url': file_url
            })
            logger.info(f"Queued OCR processing for excuse letter {excuse_letter_id}")
        except Exception as e:
            logger.error(f"Error queuing OCR processing for excuse letter {excuse_letter_id}: {str(e)}")
            results.append({
                'excuse_letter_id': excuse_letter_id,
                'error': str(e),
                'status': 'failed',
                'file_url': file_url
            })
    
    logger.info(f"Batch OCR processing queued: {len(results)} documents")
    return results

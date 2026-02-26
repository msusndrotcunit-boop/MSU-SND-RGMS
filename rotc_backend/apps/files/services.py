"""
File upload service with Cloudinary integration.
Handles file validation, image compression, and upload to Cloudinary.
"""
import os
import io
from typing import Dict, Optional, Tuple
from PIL import Image
import cloudinary
import cloudinary.uploader
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from core.validators import validate_filename, sanitize_text_input


# Configure Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
    api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
    api_secret=settings.CLOUDINARY_STORAGE['API_SECRET'],
)


# File type validation
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
ALLOWED_TYPES = {
    'profile_pic': ALLOWED_IMAGE_TYPES,
    'excuse_letter': ALLOWED_IMAGE_TYPES + ALLOWED_DOCUMENT_TYPES,
    'activity_image': ALLOWED_IMAGE_TYPES,
}

# File size limits (in bytes)
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DOCUMENT_SIZE = 20 * 1024 * 1024  # 20MB
SIZE_LIMITS = {
    'profile_pic': MAX_IMAGE_SIZE,
    'excuse_letter': MAX_DOCUMENT_SIZE,
    'activity_image': MAX_IMAGE_SIZE,
}

# Image compression settings
MAX_IMAGE_DIMENSION = 1920  # Max width or height
COMPRESSION_QUALITY = 85


def validate_file(file: UploadedFile, file_type: str) -> Tuple[bool, Optional[str]]:
    """
    Validate file type and size.
    
    Args:
        file: Uploaded file object
        file_type: Type of file (profile_pic, excuse_letter, activity_image)
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check if file type is supported
    if file_type not in ALLOWED_TYPES:
        return False, f"Unsupported file type: {file_type}"
    
    # Check content type
    content_type = file.content_type
    if content_type not in ALLOWED_TYPES[file_type]:
        return False, f"Invalid file format. Allowed types: {', '.join(ALLOWED_TYPES[file_type])}"
    
    # Check file size
    if file.size > SIZE_LIMITS[file_type]:
        max_size_mb = SIZE_LIMITS[file_type] / (1024 * 1024)
        return False, f"File size exceeds {max_size_mb}MB limit"
    
    return True, None


def compress_image(file: UploadedFile) -> io.BytesIO:
    """
    Compress image using Pillow before upload.
    
    Args:
        file: Uploaded image file
    
    Returns:
        BytesIO object containing compressed image
    """
    try:
        # Open image
        image = Image.open(file)
        
        # Convert RGBA to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        
        # Resize if image is too large
        if image.width > MAX_IMAGE_DIMENSION or image.height > MAX_IMAGE_DIMENSION:
            image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)
        
        # Save compressed image to BytesIO
        output = io.BytesIO()
        image_format = 'JPEG' if file.content_type in ['image/jpeg', 'image/jpg'] else 'PNG'
        image.save(output, format=image_format, quality=COMPRESSION_QUALITY, optimize=True)
        output.seek(0)
        
        return output
    except Exception as e:
        raise ValueError(f"Failed to compress image: {str(e)}")


def upload_to_cloudinary(
    file: UploadedFile,
    file_type: str,
    entity_id: Optional[int] = None
) -> Dict[str, str]:
    """
    Upload file to Cloudinary with validation and compression.
    
    Args:
        file: Uploaded file object
        file_type: Type of file (profile_pic, excuse_letter, activity_image)
        entity_id: Optional ID of the related entity
    
    Returns:
        Dictionary with url, public_id, and format
    
    Raises:
        ValueError: If validation fails or upload fails
    """
    # Validate file
    is_valid, error_message = validate_file(file, file_type)
    if not is_valid:
        raise ValueError(error_message)
    
    # Sanitize filename to prevent path traversal attacks
    try:
        safe_filename = validate_filename(file.name)
    except Exception as e:
        raise ValueError(f"Invalid filename: {str(e)}")
    
    # Determine folder based on file type
    folder_map = {
        'profile_pic': 'rotc/profiles',
        'excuse_letter': 'rotc/excuse_letters',
        'activity_image': 'rotc/activities',
    }
    folder = folder_map.get(file_type, 'rotc/uploads')
    
    try:
        # Compress image if it's an image file
        if file.content_type in ALLOWED_IMAGE_TYPES:
            compressed_file = compress_image(file)
            upload_file = compressed_file
        else:
            upload_file = file
        
        # Generate resource type
        resource_type = 'image' if file.content_type in ALLOWED_IMAGE_TYPES else 'raw'
        
        # Upload to Cloudinary with sanitized filename
        result = cloudinary.uploader.upload(
            upload_file,
            folder=folder,
            resource_type=resource_type,
            public_id=os.path.splitext(safe_filename)[0],  # Use sanitized filename without extension
            use_filename=True,
            unique_filename=True,
        )
        
        return {
            'url': result['secure_url'],
            'public_id': result['public_id'],
            'format': result.get('format', ''),
        }
    except Exception as e:
        raise ValueError(f"Failed to upload file to Cloudinary: {str(e)}")


def delete_from_cloudinary(public_id: str) -> bool:
    """
    Delete file from Cloudinary.
    
    Args:
        public_id: Cloudinary public ID of the file
    
    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        # Determine resource type from public_id
        resource_type = 'image' if not public_id.endswith('.pdf') else 'raw'
        
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        return result.get('result') == 'ok'
    except Exception as e:
        print(f"Failed to delete file from Cloudinary: {str(e)}")
        return False


def create_activity_image_record(activity_id: int, image_url: str, public_id: str) -> Dict[str, any]:
    """
    Create ActivityImage record after successful upload.
    
    Args:
        activity_id: ID of the activity
        image_url: Cloudinary URL of the image
        public_id: Cloudinary public ID
    
    Returns:
        Dictionary with activity_image record data
    """
    from apps.activities.models import Activity, ActivityImage
    import json
    
    try:
        # Get the activity
        activity = Activity.objects.get(id=activity_id)
        
        # Create ActivityImage record
        activity_image = ActivityImage.objects.create(
            activity=activity,
            image_url=image_url
        )
        
        # Update Activity.images JSON field
        if activity.images:
            try:
                images_list = json.loads(activity.images)
            except json.JSONDecodeError:
                images_list = []
        else:
            images_list = []
        
        images_list.append(image_url)
        activity.images = json.dumps(images_list)
        activity.save()
        
        return {
            'activity_image_id': activity_image.id,
            'activity_id': activity.id,
            'image_url': image_url,
            'public_id': public_id,
        }
    except Activity.DoesNotExist:
        raise ValueError(f"Activity with id {activity_id} does not exist")
    except Exception as e:
        raise ValueError(f"Failed to create activity image record: {str(e)}")

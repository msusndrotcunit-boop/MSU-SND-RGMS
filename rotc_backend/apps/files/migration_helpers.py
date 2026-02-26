"""
Helper functions for preserving Cloudinary URLs during data migration.

These functions ensure that existing Cloudinary URLs from the Node.js backend
are preserved when migrating data to the Django backend.
"""
import re
from typing import Optional


def validate_cloudinary_url(url: Optional[str]) -> bool:
    """
    Validate that a URL is a valid Cloudinary URL.
    
    Args:
        url: URL string to validate
    
    Returns:
        True if URL is a valid Cloudinary URL, False otherwise
    """
    if not url:
        return False
    
    # Cloudinary URLs typically follow this pattern:
    # https://res.cloudinary.com/{cloud_name}/{resource_type}/{type}/{version}/{public_id}.{format}
    cloudinary_pattern = r'https?://res\.cloudinary\.com/[^/]+/(image|video|raw)/(upload|private)/.*'
    
    return bool(re.match(cloudinary_pattern, url))


def extract_public_id_from_url(url: str) -> Optional[str]:
    """
    Extract the public_id from a Cloudinary URL.
    
    Args:
        url: Cloudinary URL
    
    Returns:
        Public ID if extraction is successful, None otherwise
    
    Example:
        Input: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/image.jpg
        Output: folder/image
    """
    if not validate_cloudinary_url(url):
        return None
    
    try:
        # Pattern to extract public_id from Cloudinary URL
        # Format: https://res.cloudinary.com/{cloud_name}/{resource_type}/{type}/{version}/{public_id}.{format}
        pattern = r'https?://res\.cloudinary\.com/[^/]+/(?:image|video|raw)/(?:upload|private)/(?:v\d+/)?(.+?)(?:\.[^.]+)?$'
        match = re.search(pattern, url)
        
        if match:
            return match.group(1)
        return None
    except Exception:
        return None


def preserve_url_field(old_value: Optional[str], new_value: Optional[str]) -> str:
    """
    Preserve existing Cloudinary URL during migration.
    
    Args:
        old_value: Existing URL from Node.js backend
        new_value: New URL (if any) from Django backend
    
    Returns:
        The URL to use (prefers old_value if it's a valid Cloudinary URL)
    """
    # If old value is a valid Cloudinary URL, preserve it
    if validate_cloudinary_url(old_value):
        return old_value
    
    # Otherwise, use new value if available
    if new_value:
        return new_value
    
    # Return empty string if neither is valid
    return ''


def migrate_image_urls(data: dict, url_fields: list) -> dict:
    """
    Migrate image URL fields from Node.js data to Django format.
    Preserves existing Cloudinary URLs.
    
    Args:
        data: Dictionary containing the data to migrate
        url_fields: List of field names that contain URLs
    
    Returns:
        Updated data dictionary with preserved URLs
    
    Example:
        data = {
            'profile_pic': 'https://res.cloudinary.com/demo/image/upload/v123/profile.jpg',
            'name': 'John Doe'
        }
        url_fields = ['profile_pic']
        Result: Same data with validated URL
    """
    migrated_data = data.copy()
    
    for field in url_fields:
        if field in migrated_data:
            url = migrated_data[field]
            if validate_cloudinary_url(url):
                # URL is valid, keep it as is
                migrated_data[field] = url
            else:
                # URL is invalid or empty, set to None
                migrated_data[field] = None
    
    return migrated_data


# List of models and their URL fields for migration reference
URL_FIELD_MAPPING = {
    'User': ['profile_pic'],
    'Cadet': ['profile_pic'],
    'TrainingStaff': ['profile_pic'],
    'Activity': ['image_path', 'images'],  # images is JSON array
    'ActivityImage': ['image_url'],
    'ExcuseLetter': ['file_url'],
}


def get_url_fields_for_model(model_name: str) -> list:
    """
    Get the list of URL fields for a given model.
    
    Args:
        model_name: Name of the model
    
    Returns:
        List of URL field names
    """
    return URL_FIELD_MAPPING.get(model_name, [])

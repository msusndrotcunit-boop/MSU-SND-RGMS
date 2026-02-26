"""
Custom validators for input validation and sanitization.
"""
import re
import os
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def validate_filename(filename):
    """
    Validate and sanitize filename to prevent path traversal attacks.
    
    Args:
        filename: The filename to validate
        
    Returns:
        Sanitized filename
        
    Raises:
        ValidationError: If filename contains invalid characters
    """
    if not filename:
        raise ValidationError(_('Filename cannot be empty'))
    
    # Remove any path components
    filename = os.path.basename(filename)
    
    # Check for dangerous patterns
    dangerous_patterns = [
        r'\.\.',  # Parent directory
        r'[<>:"|?*]',  # Windows invalid characters
        r'[\x00-\x1f]',  # Control characters
        r'^\.+$',  # Only dots
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, filename):
            raise ValidationError(
                _('Filename contains invalid characters: %(filename)s'),
                params={'filename': filename}
            )
    
    # Limit filename length
    if len(filename) > 255:
        raise ValidationError(_('Filename is too long (max 255 characters)'))
    
    return filename


def sanitize_html_input(text):
    """
    Sanitize HTML input to prevent XSS attacks.
    Removes potentially dangerous HTML tags and attributes.
    
    Args:
        text: The text to sanitize
        
    Returns:
        Sanitized text
    """
    if not text:
        return text
    
    # Remove script tags and their content
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove event handlers (onclick, onerror, etc.)
    text = re.sub(r'\s*on\w+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*on\w+\s*=\s*\S+', '', text, flags=re.IGNORECASE)
    
    # Remove javascript: protocol
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    
    # Remove data: protocol (can be used for XSS)
    text = re.sub(r'data:', '', text, flags=re.IGNORECASE)
    
    # Remove iframe tags
    text = re.sub(r'<iframe[^>]*>.*?</iframe>', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove object and embed tags
    text = re.sub(r'<(object|embed)[^>]*>.*?</\1>', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    return text


def validate_student_id(value):
    """
    Validate student ID format.
    
    Args:
        value: The student ID to validate
        
    Raises:
        ValidationError: If student ID format is invalid
    """
    if not value:
        raise ValidationError(_('Student ID is required'))
    
    # Allow alphanumeric and hyphens
    if not re.match(r'^[A-Za-z0-9\-]+$', value):
        raise ValidationError(
            _('Student ID can only contain letters, numbers, and hyphens')
        )
    
    # Limit length
    if len(value) > 50:
        raise ValidationError(_('Student ID is too long (max 50 characters)'))


def validate_email_format(value):
    """
    Validate email format with additional checks.
    
    Args:
        value: The email to validate
        
    Raises:
        ValidationError: If email format is invalid
    """
    if not value:
        return
    
    # Basic email pattern
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(email_pattern, value):
        raise ValidationError(_('Enter a valid email address'))
    
    # Check for common typos
    if '..' in value or value.startswith('.') or value.endswith('.'):
        raise ValidationError(_('Email address contains invalid dots'))


def validate_phone_number(value):
    """
    Validate phone number format.
    
    Args:
        value: The phone number to validate
        
    Raises:
        ValidationError: If phone number format is invalid
    """
    if not value:
        return
    
    # Remove common separators
    cleaned = re.sub(r'[\s\-\(\)]+', '', value)
    
    # Check if it contains only digits and optional + prefix
    if not re.match(r'^\+?\d{7,15}$', cleaned):
        raise ValidationError(
            _('Phone number must contain 7-15 digits and may start with +')
        )


def validate_url_format(value):
    """
    Validate URL format.
    
    Args:
        value: The URL to validate
        
    Raises:
        ValidationError: If URL format is invalid
    """
    if not value:
        return
    
    # Basic URL pattern (http, https, or cloudinary URLs)
    url_pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    
    if not re.match(url_pattern, value, re.IGNORECASE):
        raise ValidationError(_('Enter a valid URL'))
    
    # Block dangerous protocols
    dangerous_protocols = ['javascript:', 'data:', 'vbscript:', 'file:']
    for protocol in dangerous_protocols:
        if value.lower().startswith(protocol):
            raise ValidationError(_('URL contains invalid protocol'))


def validate_positive_integer(value):
    """
    Validate that value is a positive integer.
    
    Args:
        value: The value to validate
        
    Raises:
        ValidationError: If value is not a positive integer
    """
    if value is None:
        return
    
    try:
        int_value = int(value)
        if int_value < 0:
            raise ValidationError(_('Value must be a positive integer'))
    except (ValueError, TypeError):
        raise ValidationError(_('Value must be a valid integer'))


def validate_score_range(value, min_score=0, max_score=100):
    """
    Validate that score is within valid range.
    
    Args:
        value: The score to validate
        min_score: Minimum allowed score
        max_score: Maximum allowed score
        
    Raises:
        ValidationError: If score is out of range
    """
    if value is None:
        return
    
    try:
        float_value = float(value)
        if float_value < min_score or float_value > max_score:
            raise ValidationError(
                _('Score must be between %(min)s and %(max)s'),
                params={'min': min_score, 'max': max_score}
            )
    except (ValueError, TypeError):
        raise ValidationError(_('Score must be a valid number'))


def validate_date_not_future(value):
    """
    Validate that date is not in the future.
    
    Args:
        value: The date to validate
        
    Raises:
        ValidationError: If date is in the future
    """
    if not value:
        return
    
    from django.utils import timezone
    
    if value > timezone.now().date():
        raise ValidationError(_('Date cannot be in the future'))


def sanitize_text_input(text, max_length=None):
    """
    Sanitize general text input.
    
    Args:
        text: The text to sanitize
        max_length: Optional maximum length
        
    Returns:
        Sanitized text
    """
    if not text:
        return text
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Truncate if max_length specified
    if max_length and len(text) > max_length:
        text = text[:max_length]
    
    return text

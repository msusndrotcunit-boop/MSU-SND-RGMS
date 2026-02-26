"""
OCR processing utilities using pytesseract.
"""
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import io
import requests
from typing import Dict, Optional, Tuple
import logging
import hashlib
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


def validate_tesseract_installation() -> bool:
    """
    Validate that Tesseract is installed and configured correctly.
    
    Returns:
        bool: True if Tesseract is available, False otherwise
    """
    try:
        # Set tesseract command path from settings
        if hasattr(settings, 'TESSERACT_CMD'):
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        
        # Try to get version to verify installation
        version = pytesseract.get_tesseract_version()
        logger.info(f"Tesseract OCR version: {version}")
        return True
    except Exception as e:
        logger.error(f"Tesseract validation failed: {str(e)}")
        return False


def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Preprocess image for better OCR accuracy.
    
    Applies:
    - Grayscale conversion
    - Contrast enhancement
    - Sharpening
    - Noise reduction
    
    Args:
        image: PIL Image object
    
    Returns:
        Preprocessed PIL Image object
    """
    try:
        # Convert to grayscale
        if image.mode != 'L':
            image = image.convert('L')
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        
        # Sharpen image
        image = image.filter(ImageFilter.SHARPEN)
        
        # Reduce noise
        image = image.filter(ImageFilter.MedianFilter(size=3))
        
        logger.debug("Image preprocessing completed")
        return image
    except Exception as e:
        logger.error(f"Image preprocessing failed: {str(e)}")
        # Return original image if preprocessing fails
        return image


def detect_rotation(image: Image.Image) -> float:
    """
    Detect image rotation angle using pytesseract OSD (Orientation and Script Detection).
    
    Args:
        image: PIL Image object
    
    Returns:
        Rotation angle in degrees (0, 90, 180, or 270)
    """
    try:
        osd = pytesseract.image_to_osd(image)
        rotation = 0
        
        for line in osd.split('\n'):
            if 'Rotate:' in line:
                rotation = int(line.split(':')[1].strip())
                break
        
        logger.debug(f"Detected rotation: {rotation} degrees")
        return rotation
    except Exception as e:
        logger.warning(f"Rotation detection failed: {str(e)}")
        return 0


def auto_rotate_image(image: Image.Image) -> Image.Image:
    """
    Automatically rotate image to correct orientation.
    
    Args:
        image: PIL Image object
    
    Returns:
        Rotated PIL Image object
    """
    try:
        rotation = detect_rotation(image)
        
        if rotation != 0:
            # Rotate counter-clockwise to correct orientation
            image = image.rotate(rotation, expand=True)
            logger.info(f"Image rotated by {rotation} degrees")
        
        return image
    except Exception as e:
        logger.error(f"Auto-rotation failed: {str(e)}")
        return image


def extract_text_from_image(
    image: Image.Image,
    lang: str = 'eng',
    preprocess: bool = True,
    auto_rotate: bool = True
) -> Dict[str, any]:
    """
    Extract text from image using OCR.
    
    Args:
        image: PIL Image object
        lang: Language code(s) for OCR (e.g., 'eng', 'fil', 'eng+fil')
        preprocess: Whether to preprocess image for better accuracy
        auto_rotate: Whether to automatically detect and correct rotation
    
    Returns:
        dict: {
            'text': Extracted text,
            'confidence': Average confidence score (0-100),
            'word_count': Number of words extracted,
            'language': Language used for OCR
        }
    """
    try:
        # Set tesseract command path
        if hasattr(settings, 'TESSERACT_CMD'):
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        
        # Auto-rotate if enabled
        if auto_rotate:
            image = auto_rotate_image(image)
        
        # Preprocess if enabled
        if preprocess:
            image = preprocess_image(image)
        
        # Extract text with detailed data
        data = pytesseract.image_to_data(image, lang=lang, output_type=pytesseract.Output.DICT)
        
        # Calculate average confidence (excluding -1 values which indicate no text)
        confidences = [int(conf) for conf in data['conf'] if int(conf) != -1]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        # Extract full text
        text = pytesseract.image_to_string(image, lang=lang)
        
        # Count words
        word_count = len(text.split())
        
        result = {
            'text': text.strip(),
            'confidence': round(avg_confidence, 2),
            'word_count': word_count,
            'language': lang
        }
        
        logger.info(f"OCR completed: {word_count} words, {avg_confidence:.2f}% confidence")
        return result
        
    except Exception as e:
        logger.error(f"OCR text extraction failed: {str(e)}")
        raise ValueError(f"OCR processing failed: {str(e)}")


def process_image_from_url(
    url: str,
    lang: str = 'eng',
    preprocess: bool = True,
    auto_rotate: bool = True,
    use_cache: bool = True
) -> Dict[str, any]:
    """
    Download image from URL and extract text using OCR.
    
    Args:
        url: URL of the image to process
        lang: Language code(s) for OCR
        preprocess: Whether to preprocess image
        auto_rotate: Whether to auto-rotate image
        use_cache: Whether to use cached results
    
    Returns:
        dict: OCR result with extracted text and metadata
    """
    try:
        # Generate cache key from URL hash
        cache_key = f"ocr:{hashlib.md5(url.encode()).hexdigest()}"
        
        # Check cache if enabled
        if use_cache:
            cached_result = cache.get(cache_key)
            if cached_result:
                logger.info(f"OCR result retrieved from cache for URL: {url}")
                cached_result['cached'] = True
                return cached_result
        
        # Download image
        logger.info(f"Downloading image from URL: {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Open image
        image = Image.open(io.BytesIO(response.content))
        
        # Extract text
        result = extract_text_from_image(image, lang, preprocess, auto_rotate)
        result['url'] = url
        result['cached'] = False
        
        # Cache result if enabled
        if use_cache:
            cache_ttl = getattr(settings, 'OCR_CACHE_TTL', 86400)  # Default 24 hours
            cache.set(cache_key, result, cache_ttl)
            logger.info(f"OCR result cached for {cache_ttl} seconds")
        
        return result
        
    except requests.RequestException as e:
        logger.error(f"Failed to download image from URL: {str(e)}")
        raise ValueError(f"Failed to download image: {str(e)}")
    except Exception as e:
        logger.error(f"OCR processing from URL failed: {str(e)}")
        raise ValueError(f"OCR processing failed: {str(e)}")


def process_pdf_document(
    pdf_path: str,
    lang: str = 'eng',
    preprocess: bool = True
) -> Dict[str, any]:
    """
    Extract text from PDF document using OCR.
    Converts PDF pages to images and processes each page.
    
    Args:
        pdf_path: Path to PDF file or URL
        lang: Language code(s) for OCR
        preprocess: Whether to preprocess images
    
    Returns:
        dict: {
            'text': Combined text from all pages,
            'pages': List of per-page results,
            'total_pages': Number of pages processed,
            'avg_confidence': Average confidence across all pages
        }
    """
    try:
        from pdf2image import convert_from_path, convert_from_bytes
        import requests
        
        # Download PDF if URL
        if pdf_path.startswith('http'):
            response = requests.get(pdf_path, timeout=30)
            response.raise_for_status()
            images = convert_from_bytes(response.content)
        else:
            images = convert_from_path(pdf_path)
        
        pages_results = []
        all_text = []
        all_confidences = []
        
        for i, image in enumerate(images, 1):
            logger.info(f"Processing PDF page {i}/{len(images)}")
            
            page_result = extract_text_from_image(image, lang, preprocess, auto_rotate=True)
            page_result['page_number'] = i
            
            pages_results.append(page_result)
            all_text.append(page_result['text'])
            all_confidences.append(page_result['confidence'])
        
        combined_text = '\n\n'.join(all_text)
        avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0
        
        result = {
            'text': combined_text,
            'pages': pages_results,
            'total_pages': len(images),
            'avg_confidence': round(avg_confidence, 2),
            'word_count': len(combined_text.split())
        }
        
        logger.info(f"PDF OCR completed: {len(images)} pages processed")
        return result
        
    except ImportError:
        logger.error("pdf2image library not installed")
        raise ValueError("PDF processing requires pdf2image library")
    except Exception as e:
        logger.error(f"PDF OCR processing failed: {str(e)}")
        raise ValueError(f"PDF processing failed: {str(e)}")


def get_cache_key_for_file(file_content: bytes) -> str:
    """
    Generate cache key from file content hash.
    
    Args:
        file_content: Binary file content
    
    Returns:
        Cache key string
    """
    file_hash = hashlib.md5(file_content).hexdigest()
    return f"ocr:file:{file_hash}"


def clear_ocr_cache(url: Optional[str] = None) -> bool:
    """
    Clear OCR cache for a specific URL or all OCR cache.
    
    Args:
        url: Optional URL to clear cache for. If None, clears all OCR cache.
    
    Returns:
        bool: True if cache was cleared
    """
    try:
        if url:
            cache_key = f"ocr:{hashlib.md5(url.encode()).hexdigest()}"
            cache.delete(cache_key)
            logger.info(f"Cleared OCR cache for URL: {url}")
        else:
            # Clear all OCR cache keys (requires pattern matching support)
            cache.delete_pattern("ocr:*")
            logger.info("Cleared all OCR cache")
        
        return True
    except Exception as e:
        logger.error(f"Failed to clear OCR cache: {str(e)}")
        return False

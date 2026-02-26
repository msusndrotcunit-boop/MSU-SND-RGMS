"""
Test script for Task 23: OCR Document Processing
Tests OCR utilities and endpoints.
"""
import os
import sys

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set up Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

from apps.files.ocr import (
    validate_tesseract_installation,
    preprocess_image,
    extract_text_from_image,
    get_cache_key_for_file
)
from PIL import Image, ImageDraw, ImageFont
import io


def create_test_image_with_text(text="Test OCR Document", size=(800, 400)):
    """Create a test image with text for OCR testing."""
    # Create a white image
    img = Image.new('RGB', size, color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
    except:
        font = ImageFont.load_default()
    
    # Draw text in the center
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    position = ((size[0] - text_width) // 2, (size[1] - text_height) // 2)
    draw.text(position, text, fill='black', font=font)
    
    return img


def test_tesseract_installation():
    """Test 23.1: Tesseract installation validation."""
    print("\n" + "="*60)
    print("TEST 23.1: Tesseract Installation Validation")
    print("="*60)
    
    is_installed = validate_tesseract_installation()
    
    if is_installed:
        print("✓ Tesseract is properly installed and configured")
        return True
    else:
        print("✗ Tesseract is NOT installed or not configured properly")
        print("  Note: This is expected in development without Tesseract installed")
        print("  Install Tesseract: sudo apt-get install tesseract-ocr")
        return False


def test_ocr_utilities():
    """Test 23.2: OCR processing utilities."""
    print("\n" + "="*60)
    print("TEST 23.2: OCR Processing Utilities")
    print("="*60)
    
    # Check if Tesseract is available
    if not validate_tesseract_installation():
        print("⚠ Skipping OCR utilities test - Tesseract not installed")
        return False
    
    try:
        # Create test image
        test_text = "ROTC Excuse Letter"
        img = create_test_image_with_text(test_text)
        
        print(f"Created test image with text: '{test_text}'")
        
        # Test preprocessing
        preprocessed = preprocess_image(img)
        print("✓ Image preprocessing works")
        
        # Test OCR extraction
        result = extract_text_from_image(img, lang='eng', preprocess=True, auto_rotate=False)
        
        print(f"✓ OCR extraction completed")
        print(f"  - Extracted text: '{result['text'].strip()}'")
        print(f"  - Confidence: {result['confidence']}%")
        print(f"  - Word count: {result['word_count']}")
        print(f"  - Language: {result['language']}")
        
        return True
        
    except Exception as e:
        print(f"✗ OCR utilities test failed: {str(e)}")
        return False


def test_cache_key_generation():
    """Test 23.6: OCR result caching."""
    print("\n" + "="*60)
    print("TEST 23.6: OCR Cache Key Generation")
    print("="*60)
    
    try:
        # Test cache key generation
        test_content = b"test file content"
        cache_key = get_cache_key_for_file(test_content)
        
        print(f"✓ Cache key generated: {cache_key}")
        
        # Verify same content produces same key
        cache_key2 = get_cache_key_for_file(test_content)
        if cache_key == cache_key2:
            print("✓ Cache key is consistent for same content")
        else:
            print("✗ Cache key is NOT consistent")
            return False
        
        # Verify different content produces different key
        different_content = b"different content"
        cache_key3 = get_cache_key_for_file(different_content)
        if cache_key != cache_key3:
            print("✓ Different content produces different cache key")
        else:
            print("✗ Different content produces same cache key")
            return False
        
        return True
        
    except Exception as e:
        print(f"✗ Cache key generation test failed: {str(e)}")
        return False


def test_model_fields():
    """Test 23.4: ExcuseLetter model OCR fields."""
    print("\n" + "="*60)
    print("TEST 23.4: ExcuseLetter Model OCR Fields")
    print("="*60)
    
    try:
        from apps.attendance.models import ExcuseLetter
        
        # Check if OCR fields exist
        fields = [f.name for f in ExcuseLetter._meta.get_fields()]
        
        required_fields = ['ocr_text', 'ocr_confidence', 'ocr_processed_at']
        missing_fields = [f for f in required_fields if f not in fields]
        
        if missing_fields:
            print(f"✗ Missing OCR fields: {', '.join(missing_fields)}")
            return False
        
        print("✓ All OCR fields exist in ExcuseLetter model:")
        for field in required_fields:
            print(f"  - {field}")
        
        return True
        
    except Exception as e:
        print(f"✗ Model fields test failed: {str(e)}")
        return False


def test_api_endpoints():
    """Test 23.3, 23.5, 23.8: OCR API endpoints."""
    print("\n" + "="*60)
    print("TEST 23.3/23.5/23.8: OCR API Endpoints")
    print("="*60)
    
    try:
        from apps.files.urls import urlpatterns
        
        # Check if OCR endpoints are registered
        expected_endpoints = [
            'process-ocr',
            'process-pdf-ocr',
            'process-document-url-ocr',
            'batch-process-ocr',
            'ocr-status',
            'clear-ocr-cache'
        ]
        
        registered_names = [pattern.name for pattern in urlpatterns if hasattr(pattern, 'name')]
        
        missing_endpoints = [ep for ep in expected_endpoints if ep not in registered_names]
        
        if missing_endpoints:
            print(f"✗ Missing OCR endpoints: {', '.join(missing_endpoints)}")
            return False
        
        print("✓ All OCR endpoints are registered:")
        for endpoint in expected_endpoints:
            print(f"  - {endpoint}")
        
        return True
        
    except Exception as e:
        print(f"✗ API endpoints test failed: {str(e)}")
        return False


def test_celery_tasks():
    """Test 23.4, 23.8: OCR Celery tasks."""
    print("\n" + "="*60)
    print("TEST 23.4/23.8: OCR Celery Tasks")
    print("="*60)
    
    try:
        from apps.files.tasks import process_ocr_document, batch_process_ocr
        
        print("✓ OCR Celery tasks are defined:")
        print(f"  - process_ocr_document: {process_ocr_document.name}")
        print(f"  - batch_process_ocr: {batch_process_ocr.name}")
        
        return True
        
    except Exception as e:
        print(f"✗ Celery tasks test failed: {str(e)}")
        return False


def test_settings_configuration():
    """Test 23.1: Settings configuration."""
    print("\n" + "="*60)
    print("TEST 23.1: Settings Configuration")
    print("="*60)
    
    try:
        from django.conf import settings
        
        # Check Tesseract settings
        if hasattr(settings, 'TESSERACT_CMD'):
            print(f"✓ TESSERACT_CMD configured: {settings.TESSERACT_CMD}")
        else:
            print("✗ TESSERACT_CMD not configured")
            return False
        
        if hasattr(settings, 'TESSERACT_LANGUAGES'):
            print(f"✓ TESSERACT_LANGUAGES configured: {settings.TESSERACT_LANGUAGES}")
        else:
            print("✗ TESSERACT_LANGUAGES not configured")
            return False
        
        if hasattr(settings, 'OCR_CACHE_TTL'):
            print(f"✓ OCR_CACHE_TTL configured: {settings.OCR_CACHE_TTL} seconds")
        else:
            print("✗ OCR_CACHE_TTL not configured")
            return False
        
        return True
        
    except Exception as e:
        print(f"✗ Settings configuration test failed: {str(e)}")
        return False


def main():
    """Run all OCR tests."""
    print("\n" + "="*60)
    print("TASK 23: OCR DOCUMENT PROCESSING - TEST SUITE")
    print("="*60)
    
    results = {
        'Settings Configuration': test_settings_configuration(),
        'Tesseract Installation': test_tesseract_installation(),
        'Model OCR Fields': test_model_fields(),
        'API Endpoints': test_api_endpoints(),
        'Celery Tasks': test_celery_tasks(),
        'Cache Key Generation': test_cache_key_generation(),
    }
    
    # Only run OCR utilities test if Tesseract is installed
    if results['Tesseract Installation']:
        results['OCR Utilities'] = test_ocr_utilities()
    
    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✓ All Task 23 tests PASSED!")
        return 0
    else:
        print(f"\n⚠ {total - passed} test(s) FAILED")
        return 1


if __name__ == '__main__':
    exit(main())

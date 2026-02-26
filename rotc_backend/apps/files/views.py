"""
Views for file upload and management.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_ratelimit.decorators import ratelimit

from .services import upload_to_cloudinary, delete_from_cloudinary, create_activity_image_record
from .serializers import (
    FileUploadSerializer,
    FileUploadResponseSerializer,
    FileDeleteSerializer
)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
@ratelimit(key='user', rate='10/m', method='POST', block=True)
def upload_file(request):
    """
    Upload a file to Cloudinary.
    
    Accepts multipart/form-data with:
    - file: The file to upload
    - type: Type of file (profile_pic, excuse_letter, activity_image)
    - entity_id: Optional ID of related entity
    
    Returns:
    - url: Cloudinary URL
    - public_id: Cloudinary public ID
    - format: File format
    """
    import logging
    logger = logging.getLogger('apps.files')
    
    serializer = FileUploadSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(
            {'error': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    file = serializer.validated_data['file']
    file_type = serializer.validated_data['type']
    entity_id = serializer.validated_data.get('entity_id')
    
    # Log file upload attempt
    logger.info(
        f'File upload attempt - User: {request.user.username}, Type: {file_type}, '
        f'Filename: {file.name}, Size: {file.size} bytes',
        extra={
            'user': request.user.username,
            'user_id': request.user.id,
            'file_type': file_type,
            'filename': file.name,
            'file_size': file.size,
            'content_type': file.content_type,
            'entity_id': entity_id,
            'event_type': 'file_upload_attempt'
        }
    )
    
    try:
        result = upload_to_cloudinary(file, file_type, entity_id)
        
        # Log successful upload
        logger.info(
            f'File upload successful - User: {request.user.username}, '
            f'URL: {result["url"]}, Public ID: {result["public_id"]}',
            extra={
                'user': request.user.username,
                'user_id': request.user.id,
                'file_type': file_type,
                'filename': file.name,
                'file_size': file.size,
                'cloudinary_url': result['url'],
                'cloudinary_public_id': result['public_id'],
                'event_type': 'file_upload_success'
            }
        )
        
        # If this is an activity image and entity_id is provided, create ActivityImage record
        if file_type == 'activity_image' and entity_id:
            try:
                activity_result = create_activity_image_record(
                    entity_id,
                    result['url'],
                    result['public_id']
                )
                result.update(activity_result)
            except ValueError as e:
                # If activity record creation fails, delete the uploaded file
                delete_from_cloudinary(result['public_id'])
                logger.error(
                    f'Activity image record creation failed - User: {request.user.username}, Error: {str(e)}',
                    extra={
                        'user': request.user.username,
                        'user_id': request.user.id,
                        'entity_id': entity_id,
                        'error': str(e),
                        'event_type': 'file_upload_error'
                    }
                )
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        return Response(result, status=status.HTTP_200_OK)
    except ValueError as e:
        logger.warning(
            f'File upload validation failed - User: {request.user.username}, Error: {str(e)}',
            extra={
                'user': request.user.username,
                'user_id': request.user.id,
                'file_type': file_type,
                'filename': file.name,
                'error': str(e),
                'event_type': 'file_upload_validation_error'
            }
        )
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(
            f'File upload failed - User: {request.user.username}, Error: {str(e)}',
            extra={
                'user': request.user.username,
                'user_id': request.user.id,
                'file_type': file_type,
                'filename': file.name,
                'error': str(e),
                'event_type': 'file_upload_error'
            },
            exc_info=True
        )
        return Response(
            {'error': f'Upload failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_file(request, public_id):
    """
    Delete a file from Cloudinary.
    
    Args:
        public_id: Cloudinary public ID of the file to delete
    
    Returns:
        message: Success or error message
        deleted: Boolean indicating if deletion was successful
    """
    try:
        # URL decode the public_id (it may contain slashes)
        from urllib.parse import unquote
        decoded_public_id = unquote(public_id)
        
        success = delete_from_cloudinary(decoded_public_id)
        
        if success:
            return Response(
                {
                    'message': 'File deleted successfully',
                    'deleted': True
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    'message': 'File not found or already deleted',
                    'deleted': False
                },
                status=status.HTTP_404_NOT_FOUND
            )
    except Exception as e:
        return Response(
            {
                'message': f'Deletion failed: {str(e)}',
                'deleted': False
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def process_ocr(request):
    """
    Process OCR on an uploaded image or URL.
    
    Accepts multipart/form-data or JSON with:
    - file: Image file to process (optional)
    - url: URL of image to process (optional)
    - language: Language code(s) for OCR (default: 'eng')
    - preprocess: Whether to preprocess image (default: True)
    - auto_rotate: Whether to auto-rotate image (default: True)
    - use_cache: Whether to use cached results (default: True)
    
    Returns:
    - text: Extracted text
    - confidence: Average confidence score (0-100)
    - word_count: Number of words extracted
    - language: Language used for OCR
    - cached: Whether result was from cache
    """
    from .serializers import OCRProcessRequestSerializer, OCRProcessResponseSerializer
    from .ocr import (
        extract_text_from_image,
        process_image_from_url,
        validate_tesseract_installation
    )
    from PIL import Image
    
    # Validate Tesseract installation
    if not validate_tesseract_installation():
        return Response(
            {'error': 'Tesseract OCR is not properly installed or configured'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    serializer = OCRProcessRequestSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(
            {'error': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    validated_data = serializer.validated_data
    lang = validated_data.get('language', 'eng')
    preprocess = validated_data.get('preprocess', True)
    auto_rotate = validated_data.get('auto_rotate', True)
    use_cache = validated_data.get('use_cache', True)
    
    try:
        # Process from URL if provided
        if validated_data.get('url'):
            result = process_image_from_url(
                validated_data['url'],
                lang=lang,
                preprocess=preprocess,
                auto_rotate=auto_rotate,
                use_cache=use_cache
            )
        # Process from uploaded file
        elif validated_data.get('file'):
            file = validated_data['file']
            image = Image.open(file)
            result = extract_text_from_image(
                image,
                lang=lang,
                preprocess=preprocess,
                auto_rotate=auto_rotate
            )
            result['cached'] = False
        else:
            return Response(
                {'error': 'Either file or url must be provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        response_serializer = OCRProcessResponseSerializer(data=result)
        if response_serializer.is_valid():
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_200_OK)
            
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"OCR processing failed: {str(e)}", exc_info=True)
        
        return Response(
            {'error': f'OCR processing failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ocr_status(request):
    """
    Check OCR system status and Tesseract installation.
    
    Returns:
    - available: Whether OCR is available
    - tesseract_version: Tesseract version if available
    - supported_languages: List of supported languages
    """
    from .ocr import validate_tesseract_installation
    import pytesseract
    from django.conf import settings
    
    try:
        is_available = validate_tesseract_installation()
        
        if is_available:
            # Set tesseract command path
            if hasattr(settings, 'TESSERACT_CMD'):
                pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
            
            version = str(pytesseract.get_tesseract_version())
            languages = pytesseract.get_languages()
            
            return Response({
                'available': True,
                'tesseract_version': version,
                'supported_languages': languages,
                'configured_languages': getattr(settings, 'TESSERACT_LANGUAGES', ['eng'])
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'available': False,
                'error': 'Tesseract is not properly installed or configured'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
    except Exception as e:
        return Response({
            'available': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def process_pdf_ocr(request):
    """
    Process OCR on a PDF document.
    
    Accepts multipart/form-data with:
    - file: PDF file to process
    - language: Language code(s) for OCR (default: 'eng')
    - preprocess: Whether to preprocess images (default: True)
    
    Returns:
    - text: Combined text from all pages
    - pages: List of per-page results
    - total_pages: Number of pages processed
    - avg_confidence: Average confidence across all pages
    """
    from .ocr import process_pdf_document, validate_tesseract_installation
    from .serializers import OCRPDFResponseSerializer
    import tempfile
    import os
    
    # Validate Tesseract installation
    if not validate_tesseract_installation():
        return Response(
            {'error': 'Tesseract OCR is not properly installed or configured'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Check if file is provided
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    file = request.FILES['file']
    lang = request.data.get('language', 'eng')
    preprocess = request.data.get('preprocess', 'true').lower() == 'true'
    
    # Validate file type
    if not file.name.lower().endswith('.pdf'):
        return Response(
            {'error': 'Only PDF files are supported'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            for chunk in file.chunks():
                tmp_file.write(chunk)
            tmp_path = tmp_file.name
        
        try:
            # Process PDF
            result = process_pdf_document(tmp_path, lang=lang, preprocess=preprocess)
            
            response_serializer = OCRPDFResponseSerializer(data=result)
            if response_serializer.is_valid():
                return Response(response_serializer.data, status=status.HTTP_200_OK)
            else:
                return Response(result, status=status.HTTP_200_OK)
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"PDF OCR processing failed: {str(e)}", exc_info=True)
        
        return Response(
            {'error': f'PDF OCR processing failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_document_url_ocr(request):
    """
    Process OCR on a document from URL (supports images and PDFs).
    
    Accepts JSON with:
    - url: URL of document to process
    - document_type: 'image' or 'pdf'
    - language: Language code(s) for OCR (default: 'eng')
    - preprocess: Whether to preprocess (default: True)
    - use_cache: Whether to use cached results (default: True)
    
    Returns:
    - For images: text, confidence, word_count, language
    - For PDFs: text, pages, total_pages, avg_confidence
    """
    from .ocr import (
        process_image_from_url,
        process_pdf_document,
        validate_tesseract_installation
    )
    from .serializers import OCRProcessResponseSerializer, OCRPDFResponseSerializer
    
    # Validate Tesseract installation
    if not validate_tesseract_installation():
        return Response(
            {'error': 'Tesseract OCR is not properly installed or configured'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Validate request data
    url = request.data.get('url')
    if not url:
        return Response(
            {'error': 'URL is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    document_type = request.data.get('document_type', 'image')
    lang = request.data.get('language', 'eng')
    preprocess = request.data.get('preprocess', True)
    use_cache = request.data.get('use_cache', True)
    
    try:
        if document_type == 'pdf':
            result = process_pdf_document(url, lang=lang, preprocess=preprocess)
            response_serializer = OCRPDFResponseSerializer(data=result)
        else:
            result = process_image_from_url(
                url,
                lang=lang,
                preprocess=preprocess,
                auto_rotate=True,
                use_cache=use_cache
            )
            response_serializer = OCRProcessResponseSerializer(data=result)
        
        if response_serializer.is_valid():
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_200_OK)
            
    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Document OCR processing failed: {str(e)}", exc_info=True)
        
        return Response(
            {'error': f'Document OCR processing failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def clear_ocr_cache(request):
    """
    Clear OCR cache for a specific URL or all OCR cache.
    Admin only.
    
    Query params:
    - url: Optional URL to clear cache for. If not provided, clears all OCR cache.
    
    Returns:
    - message: Success message
    - cleared: Boolean indicating if cache was cleared
    """
    from apps.authentication.permissions import IsAdmin
    from .ocr import clear_ocr_cache as clear_cache
    
    # Check if user is admin
    if not request.user.role == 'admin':
        return Response(
            {'error': 'Only admins can clear OCR cache'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    url = request.query_params.get('url')
    
    try:
        success = clear_cache(url)
        
        if success:
            message = f"OCR cache cleared for URL: {url}" if url else "All OCR cache cleared"
            return Response(
                {
                    'message': message,
                    'cleared': True
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    'message': 'Failed to clear OCR cache',
                    'cleared': False
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to clear OCR cache: {str(e)}")
        
        return Response(
            {
                'message': f'Failed to clear OCR cache: {str(e)}',
                'cleared': False
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def batch_process_ocr_endpoint(request):
    """
    Process OCR on multiple documents in batch.
    Admin or Training Staff only.
    
    Accepts JSON with:
    - documents: List of objects with file_url and excuse_letter_id
      Example: [
        {"file_url": "https://...", "excuse_letter_id": 1},
        {"file_url": "https://...", "excuse_letter_id": 2}
      ]
    
    Returns:
    - task_id: Celery task ID for the batch job
    - total_documents: Number of documents queued
    - message: Status message
    """
    from apps.authentication.permissions import IsAdminOrTrainingStaff
    from .tasks import batch_process_ocr
    
    # Check permissions
    if request.user.role not in ['admin', 'training_staff']:
        return Response(
            {'error': 'Only admins and training staff can batch process OCR'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Validate request data
    documents = request.data.get('documents', [])
    
    if not documents:
        return Response(
            {'error': 'No documents provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not isinstance(documents, list):
        return Response(
            {'error': 'Documents must be a list'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate each document
    for i, doc in enumerate(documents):
        if not isinstance(doc, dict):
            return Response(
                {'error': f'Document at index {i} must be an object'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if 'file_url' not in doc or 'excuse_letter_id' not in doc:
            return Response(
                {'error': f'Document at index {i} must have file_url and excuse_letter_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    try:
        # Queue batch OCR processing
        task = batch_process_ocr.apply_async(args=[documents])
        
        return Response(
            {
                'task_id': task.id,
                'total_documents': len(documents),
                'message': f'Batch OCR processing queued for {len(documents)} documents',
                'status': 'queued'
            },
            status=status.HTTP_202_ACCEPTED
        )
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to queue batch OCR processing: {str(e)}")
        
        return Response(
            {'error': f'Failed to queue batch OCR processing: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

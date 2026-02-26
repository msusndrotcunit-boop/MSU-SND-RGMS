"""
Serializers for file upload operations.
"""
from rest_framework import serializers


class FileUploadSerializer(serializers.Serializer):
    """Serializer for file upload requests."""
    file = serializers.FileField(required=True)
    type = serializers.ChoiceField(
        choices=['profile_pic', 'excuse_letter', 'activity_image'],
        required=True
    )
    entity_id = serializers.IntegerField(required=False, allow_null=True)


class FileUploadResponseSerializer(serializers.Serializer):
    """Serializer for file upload responses."""
    url = serializers.URLField()
    public_id = serializers.CharField()
    format = serializers.CharField()


class FileDeleteSerializer(serializers.Serializer):
    """Serializer for file deletion responses."""
    message = serializers.CharField()
    deleted = serializers.BooleanField()


class OCRProcessRequestSerializer(serializers.Serializer):
    """Serializer for OCR processing requests."""
    file = serializers.FileField(required=False, allow_null=True)
    url = serializers.URLField(required=False, allow_null=True)
    language = serializers.CharField(
        required=False,
        default='eng',
        help_text='Language code(s) for OCR (e.g., eng, fil, eng+fil)'
    )
    preprocess = serializers.BooleanField(required=False, default=True)
    auto_rotate = serializers.BooleanField(required=False, default=True)
    use_cache = serializers.BooleanField(required=False, default=True)
    
    def validate(self, data):
        """Ensure either file or url is provided."""
        if not data.get('file') and not data.get('url'):
            raise serializers.ValidationError(
                "Either 'file' or 'url' must be provided"
            )
        return data


class OCRProcessResponseSerializer(serializers.Serializer):
    """Serializer for OCR processing responses."""
    text = serializers.CharField()
    confidence = serializers.FloatField()
    word_count = serializers.IntegerField()
    language = serializers.CharField()
    cached = serializers.BooleanField(required=False)
    url = serializers.URLField(required=False)


class OCRPageResultSerializer(serializers.Serializer):
    """Serializer for individual PDF page OCR results."""
    text = serializers.CharField()
    confidence = serializers.FloatField()
    word_count = serializers.IntegerField()
    page_number = serializers.IntegerField()


class OCRPDFResponseSerializer(serializers.Serializer):
    """Serializer for PDF OCR processing responses."""
    text = serializers.CharField()
    pages = OCRPageResultSerializer(many=True)
    total_pages = serializers.IntegerField()
    avg_confidence = serializers.FloatField()
    word_count = serializers.IntegerField()

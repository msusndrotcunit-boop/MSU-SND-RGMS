"""
Serializers for activities app.
"""
from rest_framework import serializers
from .models import Activity, ActivityImage
import json


class ActivityImageSerializer(serializers.ModelSerializer):
    """Serializer for ActivityImage model."""
    
    class Meta:
        model = ActivityImage
        fields = ['id', 'activity', 'image_url', 'created_at']
        read_only_fields = ['id', 'created_at']


class ActivitySerializer(serializers.ModelSerializer):
    """Basic serializer for Activity model."""
    
    class Meta:
        model = Activity
        fields = ['id', 'title', 'description', 'date', 'image_path', 
                  'images', 'type', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def validate_images(self, value):
        """Validate images field is valid JSON if provided."""
        if value:
            try:
                # Try to parse as JSON
                if isinstance(value, str):
                    json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Images field must be valid JSON.")
        return value


class ActivityWithImagesSerializer(serializers.ModelSerializer):
    """Serializer for Activity model with nested images."""
    activity_images = ActivityImageSerializer(many=True, read_only=True)
    images_list = serializers.SerializerMethodField()
    
    class Meta:
        model = Activity
        fields = ['id', 'title', 'description', 'date', 'image_path', 
                  'images', 'images_list', 'type', 'activity_images', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_images_list(self, obj):
        """Parse images JSON field into list."""
        if obj.images:
            try:
                return json.loads(obj.images)
            except json.JSONDecodeError:
                return []
        return []


class ActivityCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating activities with image URLs."""
    image_urls = serializers.ListField(
        child=serializers.URLField(),
        required=False,
        write_only=True,
        allow_empty=True
    )
    
    class Meta:
        model = Activity
        fields = ['id', 'title', 'description', 'date', 'image_path', 
                  'images', 'type', 'image_urls', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def create(self, validated_data):
        """Create activity and associated image records."""
        image_urls = validated_data.pop('image_urls', [])
        
        # Store image URLs as JSON in images field
        if image_urls:
            validated_data['images'] = json.dumps(image_urls)
        
        activity = Activity.objects.create(**validated_data)
        
        # Create ActivityImage records
        for image_url in image_urls:
            ActivityImage.objects.create(
                activity=activity,
                image_url=image_url
            )
        
        return activity
    
    def update(self, instance, validated_data):
        """Update activity and associated image records."""
        image_urls = validated_data.pop('image_urls', None)
        
        # Update activity fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Update images if provided
        if image_urls is not None:
            instance.images = json.dumps(image_urls)
            
            # Delete existing ActivityImage records
            instance.activity_images.all().delete()
            
            # Create new ActivityImage records
            for image_url in image_urls:
                ActivityImage.objects.create(
                    activity=instance,
                    image_url=image_url
                )
        
        instance.save()
        return instance

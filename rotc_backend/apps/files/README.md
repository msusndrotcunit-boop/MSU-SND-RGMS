# Files App - File Upload and Cloudinary Integration

## Overview

The files app handles file uploads to Cloudinary with validation, compression, and integration with other models in the ROTC system.

## Features

### 1. File Upload Service (`services.py`)

- **File Type Validation**: Validates file types based on upload type (profile_pic, excuse_letter, activity_image)
- **File Size Validation**: Enforces size limits (10MB for images, 20MB for documents)
- **Image Compression**: Automatically compresses images using Pillow before upload
  - Max dimension: 1920px
  - Quality: 85%
  - Converts RGBA to RGB
- **Cloudinary Integration**: Uploads files to organized folders
  - `rotc/profiles` - Profile pictures
  - `rotc/excuse_letters` - Excuse letter documents
  - `rotc/activities` - Activity images

### 2. API Endpoints (`views.py`)

#### POST /api/upload
Upload a file to Cloudinary.

**Request** (multipart/form-data):
```
file: <file>
type: profile_pic | excuse_letter | activity_image
entity_id: <optional integer>
```

**Response**:
```json
{
  "url": "https://res.cloudinary.com/...",
  "public_id": "rotc/profiles/...",
  "format": "jpg"
}
```

For activity images with entity_id, also returns:
```json
{
  "activity_image_id": 123,
  "activity_id": 456,
  ...
}
```

#### DELETE /api/upload/:public_id
Delete a file from Cloudinary.

**Response**:
```json
{
  "message": "File deleted successfully",
  "deleted": true
}
```

### 3. Activity Image Handling

When uploading an activity image with `entity_id`:
1. File is uploaded to Cloudinary
2. `ActivityImage` record is created
3. `Activity.images` JSON field is updated with the new URL
4. If activity record creation fails, the uploaded file is automatically deleted

### 4. Migration Helpers (`migration_helpers.py`)

Functions to preserve existing Cloudinary URLs during data migration:

- `validate_cloudinary_url()` - Validates Cloudinary URL format
- `extract_public_id_from_url()` - Extracts public_id from URL
- `preserve_url_field()` - Preserves existing URLs during migration
- `migrate_image_urls()` - Migrates URL fields from Node.js data
- `URL_FIELD_MAPPING` - Maps models to their URL fields

## Configuration

### Settings (base.py)
```python
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME', ''),
    'API_KEY': os.environ.get('CLOUDINARY_API_KEY', ''),
    'API_SECRET': os.environ.get('CLOUDINARY_API_SECRET', ''),
}
```

### Production Settings (production.py)
```python
DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

### Environment Variables
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## File Type Support

### Profile Pictures
- **Allowed**: JPEG, JPG, PNG, GIF, WebP
- **Max Size**: 10MB
- **Compression**: Yes

### Excuse Letters
- **Allowed**: JPEG, JPG, PNG, GIF, WebP, PDF, DOC, DOCX
- **Max Size**: 20MB
- **Compression**: Images only

### Activity Images
- **Allowed**: JPEG, JPG, PNG, GIF, WebP
- **Max Size**: 10MB
- **Compression**: Yes

## Usage Examples

### Upload Profile Picture
```python
import requests

files = {'file': open('profile.jpg', 'rb')}
data = {'type': 'profile_pic'}
headers = {'Authorization': 'Bearer <token>'}

response = requests.post(
    'http://localhost:8000/api/upload',
    files=files,
    data=data,
    headers=headers
)
```

### Upload Activity Image
```python
files = {'file': open('activity.jpg', 'rb')}
data = {
    'type': 'activity_image',
    'entity_id': 123  # Activity ID
}

response = requests.post(
    'http://localhost:8000/api/upload',
    files=files,
    data=data,
    headers=headers
)
```

### Delete File
```python
public_id = 'rotc/profiles/abc123'
response = requests.delete(
    f'http://localhost:8000/api/upload/{public_id}',
    headers=headers
)
```

## Error Handling

The service provides detailed error messages for:
- Invalid file types
- File size exceeded
- Upload failures
- Activity not found (for activity images)
- Cloudinary API errors

## Security

- All endpoints require authentication (`IsAuthenticated` permission)
- File type validation prevents malicious uploads
- File size limits prevent resource exhaustion
- Cloudinary credentials stored in environment variables

## Requirements Fulfilled

- ✅ 7.1: Cloudinary integration with django-storages
- ✅ 7.2: POST /api/upload endpoint with multipart/form-data
- ✅ 7.3: Profile picture uploads
- ✅ 7.4: Excuse letter document uploads
- ✅ 7.5: Multiple activity image uploads
- ✅ 7.6: Cloudinary configuration from environment
- ✅ 7.7: Return Cloudinary URLs in correct format
- ✅ 7.8: File type and size validation
- ✅ 7.9: Image compression using Pillow
- ✅ 7.10: Store URLs in database fields
- ✅ 7.11: Delete files from Cloudinary
- ✅ 7.12: Preserve existing URLs during migration
- ✅ 7.13: Create ActivityImage records
- ✅ 7.14: Update Activity.images JSON field

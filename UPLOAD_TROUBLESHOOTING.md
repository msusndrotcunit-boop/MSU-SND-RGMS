# Admin Profile Picture Upload Documentation

This document outlines the requirements and troubleshooting steps for the profile picture upload functionality in the MSU-SND ROTC Unit Grading Management System.

## Upload Requirements

- **Supported Formats**: JPEG, PNG, GIF.
- **Maximum File Size**: 5MB.
- **Aspect Ratio**: Recommended 1:1 (Square) for best display results.
- **Processing**: Large images are automatically compressed client-side to improve upload speed and stay within the 5MB limit.

## Implementation Details

### Frontend (React)
- **Component**: `client/src/pages/admin/Profile.jsx`
- **Validation**: Enforced in `handleFileChange`.
- **Compression**: Uses `browser-image-compression` to ensure the file is under 5MB.
- **Progress**: Axios `onUploadProgress` is used to update the progress bar.
- **Feedback**: `react-hot-toast` provides immediate feedback on success or failure.

### Backend (Django)
- **View**: `admin_profile_view` in `server_django/rotc_backend/api_views.py`.
- **Storage**: Images are uploaded to **Cloudinary** via `django-cloudinary-storage`.
- **Persistence**: The Cloudinary URL is stored in the `AdminProfile` model.
- **Fallback**: If no image is set, the system returns a default transparent PNG via `image_admin_view`.

## Troubleshooting

### Common Errors

1. **"Invalid file type"**:
   - **Cause**: The user attempted to upload a file that is not a JPG, PNG, or GIF.
   - **Solution**: Ensure the file extension is supported.

2. **"File size exceeds 5MB limit"**:
   - **Cause**: The image is too large and client-side compression failed to bring it under the limit.
   - **Solution**: Resize the image manually before uploading.

3. **"No profile picture provided"**:
   - **Cause**: The request reached the server without the `profilePic` field in the `FormData`.
   - **Solution**: Verify the frontend is correctly appending the file to the `FormData` object.

4. **Image not displaying after upload**:
   - **Cause**: The browser may be caching the old image URL, or the Cloudinary URL hasn't propagated.
   - **Solution**: Refresh the page or check the network tab to ensure the new URL is being returned by the API.

5. **Server Error (500)**:
   - **Cause**: Likely a configuration issue with Cloudinary credentials or database connectivity.
   - **Solution**: Check server logs on Render/Local for detailed error messages. Ensure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are set in the environment.

## Database Schema
The admin profile is stored in the `AdminProfile` table:
- `username`: "admin" (unique identifier)
- `profile_pic`: Cloudinary URL/Path
- `email`: Administrator email
- `first_name` / `last_name`: Display names

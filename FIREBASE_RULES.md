# Firebase Security Rules

To ensure strict security where users can **only** access their own files, apply the following rules in your Firebase Console.

## 1. Firestore Rules
Go to **Firestore Database** > **Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated and matches the UID
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // Match users/{userId}/files/{fileId}
    match /users/{userId}/files/{fileId} {
      // Allow read/write ONLY if the requesting user matches the {userId} in the path
      allow read, write: if isOwner(userId);
    }
    
    // Deny everything else by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 2. Storage Rules
Go to **Storage** > **Rules** and paste:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Match users/{userId}/files/{fileName}
    match /users/{userId}/files/{fileName} {
      // Allow read/write ONLY if the requesting user matches the {userId} in the path
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 3. Environment Setup
To make this work, you must provide the Firebase Service Account credentials to your server.

1.  Go to **Project Settings** > **Service accounts**.
2.  Click **Generate new private key**.
3.  Copy the contents of the JSON file.
4.  In your `.env` file (or Render Environment Variables), add:
    ```
    FIREBASE_SERVICE_ACCOUNT='{ "type": "service_account", ... }'
    ```
    (Paste the entire JSON string on one line)

5.  Also add your Client SDK config to `client/.env` (Vite requires `VITE_` prefix):
    ```
    VITE_FIREBASE_API_KEY=...
    VITE_FIREBASE_AUTH_DOMAIN=...
    VITE_FIREBASE_PROJECT_ID=...
    VITE_FIREBASE_STORAGE_BUCKET=...
    VITE_FIREBASE_MESSAGING_SENDER_ID=...
    VITE_FIREBASE_APP_ID=...
    ```

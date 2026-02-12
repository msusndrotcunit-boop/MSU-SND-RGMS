# How to Update a Locked Profile

## Problem
Your profile shows "Profile Locked" and you cannot edit it, including uploading a profile picture.

## Solution: Unlock the Profile First

### Step 1: Login as Admin
1. Logout from cadet account
2. Login with admin credentials

### Step 2: Navigate to Cadet Management
1. Go to **Admin Dashboard**
2. Click on **Cadet Management**

### Step 3: Find Your Cadet Account
1. Search for: **Bahian, Junjie** (or your name)
2. Or search by Student ID: **292**

### Step 4: Unlock the Profile
1. Select the checkbox next to your name
2. Click **"Unlock Profile"** button
3. Confirm the action

### Step 5: Update Profile as Cadet
1. Logout from admin
2. Login as cadet (username: junjie1234)
3. Go to **My Profile**
4. Now you can:
   - Upload profile picture
   - Update any information
5. Click **"Complete Profile & Logout"** when done

---

## Alternative: Use Server Script (If you have server access)

```bash
cd server
node unlock_profile.js
```

This will unlock cadet ID 292's profile.

---

## Why is the Profile Locked?

When you complete your profile for the first time, the system automatically locks it for security. This prevents unauthorized changes. Only administrators can unlock profiles.

---

## After Unlocking

Once unlocked, you can:
1. Upload a new profile picture
2. Update your information
3. Complete the profile again (which will lock it again)

The profile picture should then persist after login.

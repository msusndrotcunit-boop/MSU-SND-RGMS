"""
Quick script to check if admin account exists and verify password hash.
Run with: python check_admin.py
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from apps.authentication.models import User
import bcrypt

username = 'msu-sndrotc_admin'
password = 'admingrading@2026'

try:
    user = User.objects.get(username=username)
    print(f"✓ Admin user found!")
    print(f"  Username: {user.username}")
    print(f"  Email: {user.email}")
    print(f"  Role: {user.role}")
    print(f"  Is Approved: {user.is_approved}")
    print(f"  Password Hash: {user.password[:20]}...")
    
    # Test password verification
    if bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        print(f"\n✓ Password verification: SUCCESS")
    else:
        print(f"\n✗ Password verification: FAILED")
        
except User.DoesNotExist:
    print(f"✗ Admin user '{username}' does NOT exist!")
    print(f"\nCreating admin user now...")
    
    # Create admin user
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
    
    user = User.objects.create(
        username=username,
        email='admin@msu-snd-rotc.edu',
        password=hashed_password,
        role='admin',
        is_approved=True
    )
    
    print(f"✓ Admin user created successfully!")
    print(f"  Username: {username}")
    print(f"  Password: {password}")
except Exception as e:
    print(f"✗ Error: {str(e)}")

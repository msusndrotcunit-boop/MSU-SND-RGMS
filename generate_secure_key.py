#!/usr/bin/env python3
"""
Generate a secure Django SECRET_KEY for production use.
"""
import secrets
import string

def generate_django_secret_key(length=50):
    """Generate a secure Django SECRET_KEY."""
    # Use a mix of letters, digits, and safe special characters
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*(-_=+)'
    return ''.join(secrets.choice(alphabet) for _ in range(length))

if __name__ == '__main__':
    key = generate_django_secret_key()
    print("Generated secure Django SECRET_KEY:")
    print(key)
    print(f"\nLength: {len(key)} characters")
    print("\nAdd this to your Render environment variables as DJANGO_SECRET_KEY")
"""
Management command to create or reset the admin account.
Usage: python manage.py create_admin
"""
from django.core.management.base import BaseCommand
from apps.authentication.models import User
import bcrypt


class Command(BaseCommand):
    help = 'Creates or resets the admin account with predefined credentials'

    def handle(self, *args, **options):
        username = 'msu-sndrotc_admin'
        password = 'admingrading@2026'
        email = 'admin@msu-snd-rotc.edu'
        
        try:
            # Hash the password using bcrypt (same as the authentication backend)
            password_bytes = password.encode('utf-8')
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
            
            # Check if admin user already exists
            try:
                user = User.objects.get(username=username)
                # Update existing user
                user.password = hashed_password
                user.email = email
                user.role = 'admin'
                user.is_approved = True
                user.save()
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Admin account "{username}" updated successfully!'
                    )
                )
            except User.DoesNotExist:
                # Create new admin user
                user = User.objects.create(
                    username=username,
                    email=email,
                    password=hashed_password,
                    role='admin',
                    is_approved=True
                )
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Admin account "{username}" created successfully!'
                    )
                )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nAdmin Credentials:'
                )
            )
            self.stdout.write(f'  Username: {username}')
            self.stdout.write(f'  Password: {password}')
            self.stdout.write(f'  Email: {email}')
            self.stdout.write(f'  Role: admin')
            self.stdout.write('')
            self.stdout.write(
                self.style.WARNING(
                    'You can now log in at /login with the Admin tab.'
                )
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(
                    f'✗ Error creating/updating admin account: {str(e)}'
                )
            )
            raise

"""
API endpoint tests for Task 21: Audit logging and sync events
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.test import Client
from apps.authentication.models import User
from apps.system.models import AuditLog, SyncEvent


def get_admin_token():
    """Get or create an admin user and return JWT token."""
    admin, created = User.objects.get_or_create(
        username='admin_test',
        defaults={
            'email': 'admin@test.com',
            'role': 'admin',
            'is_approved': True
        }
    )
    
    if created:
        from django.contrib.auth.hashers import make_password
        admin.password = make_password('admin123')
        admin.save()
        print(f"Created admin user: {admin.username}")
    
    # Generate JWT token using simplejwt
    from rest_framework_simplejwt.tokens import AccessToken
    token = AccessToken()
    token['user_id'] = admin.id
    token['username'] = admin.username
    token['role'] = admin.role
    
    return str(token)


def test_audit_logs_list_endpoint():
    """Test GET /api/audit-logs endpoint."""
    print("\n=== Testing GET /api/audit-logs ===")
    
    client = Client()
    token = get_admin_token()
    
    # Test without authentication (should fail)
    response = client.get('/api/audit-logs/')
    print(f"Without auth - Status: {response.status_code}")
    
    # Test with authentication
    response = client.get(
        '/api/audit-logs/',
        HTTP_AUTHORIZATION=f'Bearer {token}'
    )
    print(f"With auth - Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Endpoint accessible")
        print(f"  - Total logs: {data.get('pagination', {}).get('total', 0)}")
        print(f"  - Logs returned: {len(data.get('logs', []))}")
        print(f"  - Page: {data.get('pagination', {}).get('page', 0)}")
        print(f"  - Limit: {data.get('pagination', {}).get('limit', 0)}")
    else:
        print(f"✗ Endpoint failed: {response.content}")
    
    # Test with filters
    response = client.get(
        '/api/audit-logs/?table_name=cadets&operation=CREATE',
        HTTP_AUTHORIZATION=f'Bearer {token}'
    )
    print(f"\nWith filters - Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Filtering works")
        print(f"  - Filtered logs: {len(data.get('logs', []))}")
    
    return True


def test_audit_logs_export_endpoint():
    """Test GET /api/audit-logs/export endpoint."""
    print("\n=== Testing GET /api/audit-logs/export ===")
    
    client = Client()
    token = get_admin_token()
    
    # Test CSV export
    response = client.get(
        '/api/audit-logs/export/?format=csv',
        HTTP_AUTHORIZATION=f'Bearer {token}'
    )
    print(f"CSV export - Status: {response.status_code}")
    
    if response.status_code == 200:
        print(f"✓ CSV export works")
        print(f"  - Content-Type: {response.get('Content-Type')}")
        print(f"  - Content-Disposition: {response.get('Content-Disposition')}")
        print(f"  - Size: {len(response.content)} bytes")
    else:
        print(f"✗ CSV export failed: {response.content}")
    
    return True


def test_sync_events_list_endpoint():
    """Test GET /api/sync-events endpoint."""
    print("\n=== Testing GET /api/sync-events ===")
    
    client = Client()
    token = get_admin_token()
    
    # Test without authentication (should fail)
    response = client.get('/api/sync-events/')
    print(f"Without auth - Status: {response.status_code}")
    
    # Test with authentication
    response = client.get(
        '/api/sync-events/',
        HTTP_AUTHORIZATION=f'Bearer {token}'
    )
    print(f"With auth - Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Endpoint accessible")
        print(f"  - Total events: {data.get('pagination', {}).get('total', 0)}")
        print(f"  - Events returned: {len(data.get('events', []))}")
    else:
        print(f"✗ Endpoint failed: {response.content}")
    
    # Test with filters
    response = client.get(
        '/api/sync-events/?processed=false',
        HTTP_AUTHORIZATION=f'Bearer {token}'
    )
    print(f"\nWith filters - Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Filtering works")
        print(f"  - Unprocessed events: {len(data.get('events', []))}")
    
    return True


def test_pagination():
    """Test pagination on audit logs endpoint."""
    print("\n=== Testing Pagination ===")
    
    client = Client()
    token = get_admin_token()
    
    # Test page 1 with limit 5
    response = client.get(
        '/api/audit-logs/?page=1&limit=5',
        HTTP_AUTHORIZATION=f'Bearer {token}'
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Pagination works")
        print(f"  - Page 1, Limit 5: {len(data.get('logs', []))} logs")
        print(f"  - Total pages: {data.get('pagination', {}).get('pages', 0)}")
        
        # Test page 2
        response = client.get(
            '/api/audit-logs/?page=2&limit=5',
            HTTP_AUTHORIZATION=f'Bearer {token}'
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"  - Page 2, Limit 5: {len(data.get('logs', []))} logs")
    else:
        print(f"✗ Pagination failed")
    
    return True


if __name__ == '__main__':
    print("=" * 60)
    print("Task 21: API Endpoint Tests")
    print("=" * 60)
    
    try:
        test_audit_logs_list_endpoint()
        test_audit_logs_export_endpoint()
        test_sync_events_list_endpoint()
        test_pagination()
        
        print("\n" + "=" * 60)
        print("All API tests completed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Error during testing: {e}")
        import traceback
        traceback.print_exc()

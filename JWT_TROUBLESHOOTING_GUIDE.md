# JWT Token Validation Troubleshooting Guide

## Overview
This guide helps diagnose and resolve JWT token validation errors in the MSU-SND RGMS system.

## Common Error Codes

### 1. `token_invalid_signature`
**Cause**: Token was signed with a different secret key than the one used for validation.

**Solutions**:
- Verify `DJANGO_SECRET_KEY` environment variable is set correctly in Render
- Check that the same secret key is used across all services
- Clear browser cache/localStorage to remove old tokens
- Log out and log in again to get a new token

**Diagnostic Commands**:
```bash
# Check JWT configuration
curl https://msu-snd-rgms-1.onrender.com/api/jwt-diagnostic

# Test token flow
curl -X POST https://msu-snd-rgms-1.onrender.com/api/test-token-flow \
  -H "Content-Type: application/json" \
  -d '{"username": "msu-sndrotc_admin"}'
```

### 2. `token_expired`
**Cause**: Token has exceeded its lifetime (24 hours for access tokens).

**Solutions**:
- Use the refresh token to get a new access token
- Implement automatic token refresh in frontend
- Log in again to get new tokens

**Frontend Implementation**:
```javascript
// Automatic token refresh
const refreshToken = async () => {
  const refresh = localStorage.getItem('refresh');
  const response = await axios.post('/api/auth/refresh', { refresh });
  localStorage.setItem('token', response.data.token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
};
```

### 3. `token_malformed`
**Cause**: Token format is incorrect or corrupted.

**Solutions**:
- Check Authorization header format: `Bearer <token>`
- Verify token is not truncated or modified
- Clear browser cache and log in again

### 4. `token_blacklisted`
**Cause**: Token has been explicitly revoked (after logout).

**Solutions**:
- Log in again to get a new token
- This is expected behavior after logout

### 5. `token_not_found`
**Cause**: No Authorization header provided in request.

**Solutions**:
- Ensure frontend sends Authorization header with all API requests
- Check that token is stored in localStorage
- Verify axios interceptor is configured correctly

## Clock Skew Issues

**Symptoms**:
- Tokens rejected immediately after creation
- "Token is not yet valid" errors
- Intermittent authentication failures

**Solutions**:
1. **Server-side**: Ensure NTP is configured
   ```bash
   # Check system time
   date
   
   # Sync with NTP (if you have server access)
   sudo ntpdate -s time.nist.gov
   ```

2. **Application-side**: Leeway is configured (60 seconds)
   - Check `SIMPLE_JWT['LEEWAY']` in settings
   - This allows 60 seconds of clock skew tolerance

3. **Client-side**: Check browser time
   - Ensure client system clock is accurate
   - Check timezone settings

## Diagnostic Endpoints

### 1. JWT Configuration Check
```bash
GET /api/jwt-diagnostic
```
Returns:
- Environment variables status
- Secret key configuration
- Whether keys match between Django and JWT

### 2. Deep Authentication Trace
```bash
POST /api/deep-auth-trace/
Content-Type: application/json

{
  "username": "msu-sndrotc_admin",
  "password": "admingrading@2026"
}
```
Returns:
- 11-step authentication trace
- Password verification status
- Token creation and validation results
- Custom user lookup status

### 3. Diagnostic Login
```bash
POST /api/diagnostic-login/
Content-Type: application/json

{
  "username": "msu-sndrotc_admin",
  "password": "admingrading@2026"
}
```
Returns:
- Detailed login logs
- Token generation status
- Immediate token validation results

## Frontend Error Handling

### Recommended Implementation

```javascript
// axios interceptor for token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      const errorCode = error.response?.data?.error;
      
      // Handle different error codes
      switch (errorCode) {
        case 'token_expired':
          // Try to refresh token
          originalRequest._retry = true;
          try {
            const refresh = localStorage.getItem('refresh');
            const response = await axios.post('/api/auth/refresh', { refresh });
            localStorage.setItem('token', response.data.token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.clear();
            window.location.href = '/login';
          }
          break;
          
        case 'token_invalid_signature':
        case 'token_malformed':
        case 'token_blacklisted':
          // Clear tokens and redirect to login
          localStorage.clear();
          window.location.href = '/login';
          break;
          
        case 'token_not_found':
          // No token provided, redirect to login
          window.location.href = '/login';
          break;
          
        default:
          // Generic error handling
          console.error('Authentication error:', error.response?.data);
      }
    }
    
    return Promise.reject(error);
  }
);
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Token Validation Failure Rate**
   - Alert if > 5% of requests fail with 401
   - Check logs for error patterns

2. **Token Expiration Rate**
   - Monitor `token_expired` errors
   - May indicate refresh logic issues

3. **Invalid Signature Rate**
   - Alert if > 1% of requests
   - May indicate secret key mismatch

### Log Analysis

```bash
# Search for JWT errors in Render logs
# Look for patterns like:
grep "JWT" logs.txt | grep "ERROR"
grep "token_invalid" logs.txt
grep "Invalid JWT token" logs.txt
```

## Post-Deployment Verification

### 1. Test Token Generation
```bash
# Create admin account
curl https://msu-snd-rgms-1.onrender.com/api/emergency-admin

# Test login
curl -X POST https://msu-snd-rgms-1.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "msu-sndrotc_admin", "password": "admingrading@2026"}'
```

### 2. Test Token Validation
```bash
# Get token from login response
TOKEN="<access_token_from_login>"

# Test authenticated endpoint
curl https://msu-snd-rgms-1.onrender.com/api/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Token Refresh
```bash
# Get refresh token from login response
REFRESH="<refresh_token_from_login>"

# Test refresh endpoint
curl -X POST https://msu-snd-rgms-1.onrender.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh\": \"$REFRESH\"}"
```

## Security Best Practices

1. **Secret Key Management**
   - Never commit secret keys to version control
   - Use environment variables for all secrets
   - Rotate secret keys periodically (requires re-login for all users)

2. **Token Lifetime**
   - Access tokens: 24 hours (current setting)
   - Refresh tokens: 7 days (current setting)
   - Adjust based on security requirements

3. **Token Storage**
   - Store tokens in localStorage (current implementation)
   - Consider httpOnly cookies for enhanced security
   - Never log tokens in production

4. **HTTPS Only**
   - Always use HTTPS in production
   - Tokens should never be transmitted over HTTP

## Common Issues and Solutions

### Issue: "Token is invalid" immediately after login
**Diagnosis**: Secret key mismatch between token creation and validation
**Solution**: 
1. Check `/api/jwt-diagnostic` - ensure `keys_match: true`
2. Verify `DJANGO_SECRET_KEY` in Render environment variables
3. Restart the application after changing environment variables

### Issue: Intermittent authentication failures
**Diagnosis**: Clock skew between client and server
**Solution**:
1. Check system time on both client and server
2. Verify `LEEWAY` is set to 60 seconds in JWT config
3. Ensure NTP is configured on server

### Issue: Token works in Postman but not in browser
**Diagnosis**: CORS or Authorization header issues
**Solution**:
1. Check CORS configuration in `production.py`
2. Verify Authorization header is being sent from browser
3. Check browser console for CORS errors

### Issue: Token validation fails after deployment
**Diagnosis**: Environment variable not set in new deployment
**Solution**:
1. Verify all environment variables in Render dashboard
2. Check that `DJANGO_SECRET_KEY` matches previous deployment
3. If key changed, all users must log in again

## Contact and Support

For persistent issues:
1. Check Render logs for detailed error messages
2. Use diagnostic endpoints to gather information
3. Review this troubleshooting guide
4. Contact system administrator with:
   - Error message and error code
   - Request ID from error response
   - Steps to reproduce
   - Output from diagnostic endpoints

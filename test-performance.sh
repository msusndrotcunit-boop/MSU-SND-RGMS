#!/bin/bash

# Performance Testing Script
# Tests the optimizations and measures improvements

echo "========================================="
echo "Performance Optimization Test Suite"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:5000}"
echo "Testing against: $BASE_URL"
echo ""

# Test 1: Database Index Migration
echo "Test 1: Database Index Migration"
echo "---------------------------------"
if [ -f "server/migrations/create_performance_indexes.js" ]; then
    echo -e "${GREEN}✓${NC} Migration script exists"
    echo "Run: node server/migrations/create_performance_indexes.js"
else
    echo -e "${RED}✗${NC} Migration script not found"
fi
echo ""

# Test 2: API Response Time
echo "Test 2: API Response Time"
echo "-------------------------"
echo "Testing /api/health endpoint..."

# Create curl format file
cat > /tmp/curl-format.txt << 'EOF'
time_namelookup:  %{time_namelookup}s\n
time_connect:  %{time_connect}s\n
time_starttransfer:  %{time_starttransfer}s\n
time_total:  %{time_total}s\n
EOF

RESPONSE_TIME=$(curl -w "@/tmp/curl-format.txt" -o /dev/null -s "$BASE_URL/api/health" | grep "time_total" | awk '{print $2}' | sed 's/s//')
RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

echo "Response time: ${RESPONSE_MS}ms"

if (( $(echo "$RESPONSE_MS < 500" | bc -l) )); then
    echo -e "${GREEN}✓${NC} Response time is good (< 500ms)"
elif (( $(echo "$RESPONSE_MS < 1000" | bc -l) )); then
    echo -e "${YELLOW}⚠${NC} Response time is acceptable (< 1000ms)"
else
    echo -e "${RED}✗${NC} Response time is slow (> 1000ms)"
fi
echo ""

# Test 3: Compression
echo "Test 3: Response Compression"
echo "----------------------------"
CONTENT_ENCODING=$(curl -s -I "$BASE_URL/api/health" | grep -i "content-encoding" | awk '{print $2}' | tr -d '\r')

if [ -n "$CONTENT_ENCODING" ]; then
    echo -e "${GREEN}✓${NC} Compression enabled: $CONTENT_ENCODING"
else
    echo -e "${YELLOW}⚠${NC} Compression not detected (may be disabled for small responses)"
fi
echo ""

# Test 4: Cache Headers
echo "Test 4: Cache Headers"
echo "--------------------"
X_CACHE=$(curl -s -I "$BASE_URL/api/health" | grep -i "x-cache" | awk '{print $2}' | tr -d '\r')
X_RESPONSE_TIME=$(curl -s -I "$BASE_URL/api/health" | grep -i "x-response-time" | awk '{print $2}' | tr -d '\r')

if [ -n "$X_RESPONSE_TIME" ]; then
    echo -e "${GREEN}✓${NC} X-Response-Time header present: $X_RESPONSE_TIME"
else
    echo -e "${RED}✗${NC} X-Response-Time header missing"
fi

if [ -n "$X_CACHE" ]; then
    echo -e "${GREEN}✓${NC} X-Cache header present: $X_CACHE"
else
    echo -e "${YELLOW}⚠${NC} X-Cache header not present (may not be cached endpoint)"
fi
echo ""

# Test 5: Frontend Build
echo "Test 5: Frontend Build Optimization"
echo "-----------------------------------"
if [ -f "client/vite.config.js" ]; then
    if grep -q "manualChunks" client/vite.config.js; then
        echo -e "${GREEN}✓${NC} Manual chunk splitting configured"
    else
        echo -e "${RED}✗${NC} Manual chunk splitting not found"
    fi
    
    if grep -q "terserOptions" client/vite.config.js; then
        echo -e "${GREEN}✓${NC} Terser minification configured"
    else
        echo -e "${RED}✗${NC} Terser minification not found"
    fi
else
    echo -e "${RED}✗${NC} vite.config.js not found"
fi
echo ""

# Test 6: IndexedDB Enhancements
echo "Test 6: IndexedDB Enhancements"
echo "------------------------------"
if [ -f "client/src/utils/db.js" ]; then
    if grep -q "cacheWithTimestamp" client/src/utils/db.js; then
        echo -e "${GREEN}✓${NC} Timestamp caching implemented"
    else
        echo -e "${RED}✗${NC} Timestamp caching not found"
    fi
    
    if grep -q "cleanupStaleCache" client/src/utils/db.js; then
        echo -e "${GREEN}✓${NC} Stale cache cleanup implemented"
    else
        echo -e "${RED}✗${NC} Stale cache cleanup not found"
    fi
    
    if grep -q "addToSyncQueue" client/src/utils/db.js; then
        echo -e "${GREEN}✓${NC} Offline sync queue implemented"
    else
        echo -e "${RED}✗${NC} Offline sync queue not found"
    fi
else
    echo -e "${RED}✗${NC} db.js not found"
fi
echo ""

# Test 7: Performance Monitor
echo "Test 7: Performance Monitor Dashboard"
echo "-------------------------------------"
if [ -f "client/src/pages/admin/PerformanceMonitor.jsx" ]; then
    echo -e "${GREEN}✓${NC} Performance Monitor component exists"
else
    echo -e "${RED}✗${NC} Performance Monitor component not found"
fi

if [ -f "server/routes/metrics.js" ]; then
    echo -e "${GREEN}✓${NC} Metrics API endpoint exists"
else
    echo -e "${RED}✗${NC} Metrics API endpoint not found"
fi
echo ""

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo ""
echo "Next Steps:"
echo "1. Run database index migration:"
echo "   cd server && node migrations/create_performance_indexes.js"
echo ""
echo "2. Build frontend for production:"
echo "   cd client && npm run build"
echo ""
echo "3. Monitor performance:"
echo "   Navigate to /admin/performance in your browser"
echo ""
echo "4. Check server logs for performance metrics:"
echo "   Look for [PERF] and [CACHE] log entries"
echo ""

# Cleanup
rm -f /tmp/curl-format.txt

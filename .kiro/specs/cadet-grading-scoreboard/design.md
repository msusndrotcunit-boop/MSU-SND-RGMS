# Design Document: Cadet Grading Scoreboard Display

## Overview

The Cadet Grading Scoreboard Display feature provides cadets with a comprehensive, real-time view of their academic and behavioral performance through their account dashboard. The system integrates with existing backend grading APIs and displays attendance records, aptitude scores (merit/demerit points), subject proficiency grades, and an overall transmuted grade with remarks.

The implementation leverages the existing React-based frontend (using React Router, Axios, Tailwind CSS) and Node.js/Express backend with SQLite database. The scoreboard uses a stale-while-revalidate caching strategy with IndexedDB for offline support and Server-Sent Events (SSE) for real-time updates.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Cadet Dashboard (React)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Scoreboard  │  │   Attendance │  │ Merit/Demerit│      │
│  │   Summary    │  │    History   │  │    Logs      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Caching Layer (IndexedDB)                 │
│  • Stale-While-Revalidate Strategy                          │
│  • 5-minute TTL for grade data                              │
│  • Offline fallback support                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Express.js)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  GET /api/cadet/my-grades                            │  │
│  │  GET /api/cadet/my-merit-logs                        │  │
│  │  GET /api/attendance/my-history                      │  │
│  │  GET /api/attendance/events (SSE)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Database (SQLite)                         │
│  • cadets table                                             │
│  • grades table                                             │
│  • merit_demerit_logs table                                 │
│  • attendance_records table                                 │
│  • training_days table                                      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Initial Load**: Cadet logs in → Dashboard component mounts → Fetch from cache (if available) → Display cached data → Background fetch from API → Update cache and UI
2. **Real-Time Updates**: SSE connection established → Server broadcasts grade_updated event → Client fetches latest data → Update cache and UI
3. **Manual Refresh**: User clicks refresh button → Force fetch from API → Update cache and UI
4. **Offline Mode**: Network unavailable → Load from IndexedDB cache → Display stale data with offline indicator

## Components and Interfaces

### Frontend Components

#### CadetDashboard Component
**Location**: `client/src/pages/cadet/Dashboard.jsx`

**State Management**:
```javascript
{
  grades: {
    attendanceScore: number,
    attendance_present: number,
    totalTrainingDays: number,
    aptitudeScore: number,
    merit_points: number,
    demerit_points: number,
    lifetime_merit_points: number,
    subjectScore: number,
    prelim_score: number,
    midterm_score: number,
    final_score: number,
    finalGrade: number,
    transmutedGrade: string,
    remarks: string,
    status: string
  },
  logs: Array<MeritDemeritLog>,
  attendanceLogs: {
    items: Array<AttendanceRecord>,
    total: number,
    page: number,
    pageSize: number
  },
  loading: boolean,
  esConnected: boolean
}
```

**Key Methods**:
- `fetchData()`: Initial data load with cache-first strategy
- `refreshAll()`: Force refresh all grading data
- `fetchLogs()`: Fetch merit/demerit logs
- `fetchAttendance()`: Fetch attendance history

#### Scoreboard Sections

1. **Final Assessment Section**
   - Displays numerical final grade (0-100 scale)
   - Displays transmuted grade (1.00-5.00 scale)
   - Shows remarks (PASSED/FAILED/DO/INC)
   - Color-coded: green for passing, red for failing

2. **Subject Proficiency Section**
   - Displays prelim, midterm, and final scores
   - Shows calculated subject score (40% weight)
   - Table format with sticky header

3. **Attendance Section**
   - Displays attendance score (30% weight)
   - Shows present/total days ratio
   - Lists all attendance records with status badges
   - Scrollable table with date and status columns

4. **Merit & Demerit Section**
   - Displays aptitude score (30% weight)
   - Shows merit and demerit point totals
   - Displays lifetime merit achievement
   - Shows ceiling status and wasted points warning
   - Lists all merit/demerit logs with details

### Backend API Endpoints

#### GET /api/cadet/my-grades
**Purpose**: Retrieve comprehensive grading data for authenticated cadet

**Authentication**: JWT required (cadet role)

**Response Schema**:
```javascript
{
  attendance_present: number,
  merit_points: number,
  demerit_points: number,
  lifetime_merit_points: number,
  prelim_score: number,
  midterm_score: number,
  final_score: number,
  status: string,
  totalTrainingDays: number,
  attendanceScore: number,  // 0-30 points
  aptitudeScore: number,    // 0-30 points
  subjectScore: number,     // 0-40 points
  finalGrade: number,       // 0-100 points
  transmutedGrade: string,  // 1.00-5.00 or DO/INC/T
  remarks: string           // PASSED/FAILED/etc
}
```

**Calculation Logic**:
- Attendance Score = (attendance_present / totalTrainingDays) × 30
- Aptitude Score = min(100, max(0, 100 + merit_points - demerit_points)) × 0.3
- Subject Score = ((prelim + midterm + final) / 300) × 40
- Final Grade = attendanceScore + aptitudeScore + subjectScore
- Transmuted Grade = calculated via `calculateTransmutedGrade()` function

#### GET /api/cadet/my-merit-logs
**Purpose**: Retrieve all merit and demerit records for authenticated cadet

**Response Schema**:
```javascript
[
  {
    id: number,
    cadet_id: number,
    type: 'merit' | 'demerit',
    points: number,
    reason: string,
    date_recorded: string,
    recorded_by: string,
    staff_name: string
  }
]
```

#### GET /api/attendance/my-history
**Purpose**: Retrieve attendance records for authenticated cadet

**Query Parameters**:
- `order`: 'asc' | 'desc' (default: 'asc')

**Response Schema**:
```javascript
{
  items: [
    {
      id: number,
      date: string,
      title: string,
      status: 'present' | 'absent' | 'late' | 'excused',
      remarks: string,
      time_in: string,
      time_out: string
    }
  ],
  total: number,
  page: number,
  pageSize: number
}
```

#### GET /api/attendance/events (SSE)
**Purpose**: Real-time event stream for grade and attendance updates

**Event Types**:
- `grade_updated`: Triggered when admin updates grades
- `attendance_updated`: Triggered when attendance is marked

## Data Models

### Grades Table
```sql
CREATE TABLE grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cadet_id INTEGER NOT NULL,
  attendance_present INTEGER DEFAULT 0,
  merit_points INTEGER DEFAULT 0,
  demerit_points INTEGER DEFAULT 0,
  lifetime_merit_points INTEGER DEFAULT 0,
  prelim_score REAL DEFAULT 0,
  midterm_score REAL DEFAULT 0,
  final_score REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (cadet_id) REFERENCES cadets(id)
);
```

### Merit_Demerit_Logs Table
```sql
CREATE TABLE merit_demerit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cadet_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('merit', 'demerit')),
  points INTEGER NOT NULL,
  reason TEXT,
  date_recorded TEXT DEFAULT CURRENT_TIMESTAMP,
  recorded_by INTEGER,
  FOREIGN KEY (cadet_id) REFERENCES cadets(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id)
);
```

### Attendance_Records Table
```sql
CREATE TABLE attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cadet_id INTEGER NOT NULL,
  training_day_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late', 'excused')),
  time_in TEXT,
  time_out TEXT,
  remarks TEXT,
  FOREIGN KEY (cadet_id) REFERENCES cadets(id),
  FOREIGN KEY (training_day_id) REFERENCES training_days(id)
);
```

### IndexedDB Cache Schema
```javascript
{
  storeName: 'dashboard',
  keyPath: 'key',
  structure: {
    key: string,  // 'cadet_grades', 'cadet_logs', 'cadet_attendance'
    data: any,
    timestamp: number
  }
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Grading Data Retrieval on Load
*For any* authenticated cadet user, when the dashboard component mounts, the system should call the `/api/cadet/my-grades` endpoint to retrieve current grading data.

**Validates: Requirements 1.2**

### Property 2: Attendance Display Completeness
*For any* grading data with attendance information, the scoreboard should display both the attendance percentage and the present/total days ratio (e.g., "15 / 20 days").

**Validates: Requirements 2.1, 2.2**

### Property 3: Aptitude Score Calculation
*For any* merit points value M and demerit points value D, the displayed aptitude score should equal `min(100, max(0, 100 + M - D)) × 0.3`, and both merit and demerit values should be displayed numerically.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Subject Score Display
*For any* grading data, all three subject proficiency scores (prelim, midterm, final) should be displayed in the scoreboard.

**Validates: Requirements 4.1**

### Property 5: Overall Grade Calculation
*For any* attendance score A, aptitude score P, and subject score S, the displayed final grade should equal A + P + S.

**Validates: Requirements 5.1, 5.3**

### Property 6: Transmuted Grade Mapping
*For any* final grade value F and status value, the displayed transmuted grade and remarks should match the output of the `calculateTransmutedGrade(F, status)` function.

**Validates: Requirements 5.4**

### Property 7: Refresh Data Freshness
*For any* cached scoreboard state, when the refresh function is triggered, the system should fetch data from the API endpoint (not from cache) and update the displayed values.

**Validates: Requirements 6.2**

### Property 8: Numerical Value Formatting
*For any* numerical score value, the displayed value should be formatted to 2 decimal places (e.g., 85.67, not 85.6666667).

**Validates: Requirements 7.3**

### Property 9: Missing Data Graceful Degradation
*For any* grading data with null or undefined components, the scoreboard should display appropriate default values (0 for scores, "No Data" for remarks) without throwing errors or breaking the layout.

**Validates: Requirements 9.1, 9.2**

## Error Handling

### Frontend Error Handling

1. **Network Failures**
   - Fallback to cached data from IndexedDB
   - Display offline indicator when SSE connection fails
   - Show error toast notifications for failed API calls
   - Graceful degradation: display partial data if available

2. **Authentication Errors**
   - Redirect to login page on 401/403 responses
   - Clear cached data on authentication failure
   - Display appropriate error messages

3. **Data Validation Errors**
   - Validate API response structure before rendering
   - Use default values for missing or malformed data
   - Log validation errors to console for debugging

4. **Component Errors**
   - React Error Boundaries to catch rendering errors
   - Display fallback UI instead of blank screen
   - Log errors for monitoring

### Backend Error Handling

1. **Database Errors**
   - Return default grade structure with zeros on query failure
   - Log database errors for monitoring
   - Ensure response always returns valid JSON structure

2. **Missing Cadet Mapping**
   - Auto-link user to cadet record if possible (by student_id or email)
   - Return 403 with clear message if cadet_id cannot be resolved
   - Log sync events for monitoring

3. **Calculation Errors**
   - Use safe defaults (0) for null/undefined values
   - Clamp calculated values to valid ranges (0-100)
   - Ensure division by zero is handled (e.g., when totalTrainingDays = 0)

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property-based tests verify general correctness across a wide range of inputs.

### Property-Based Testing

**Library**: fast-check (for JavaScript/React)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property reference
- Tag format: `Feature: cadet-grading-scoreboard, Property {N}: {description}`

**Property Test Coverage**:
1. Aptitude score calculation (Property 3)
2. Overall grade calculation (Property 5)
3. Transmuted grade mapping (Property 6)
4. Numerical formatting (Property 8)
5. Missing data handling (Property 9)

### Unit Testing

**Framework**: Jest + React Testing Library

**Unit Test Coverage**:
1. Component rendering with valid data
2. API call on component mount (Property 1)
3. Attendance display format (Property 2)
4. Subject score display (Property 4)
5. Refresh functionality (Property 7)
6. SSE event handling
7. Cache fallback behavior
8. Error boundary behavior
9. Offline mode display

**Edge Cases**:
- Zero training days (division by zero)
- Negative merit/demerit points
- Null/undefined grading data
- Empty attendance logs
- SSE connection failures
- Cache miss scenarios

### Integration Testing

**Scope**:
- End-to-end flow: login → dashboard load → data display
- Real-time update flow: SSE event → data refresh → UI update
- Offline-to-online transition
- Cache invalidation on data updates

**Tools**: Cypress or Playwright for E2E tests

## Implementation Notes

### Performance Considerations

1. **Caching Strategy**
   - Use stale-while-revalidate pattern
   - 5-minute TTL for grade data
   - Cache in IndexedDB for offline support
   - Invalidate cache on SSE events

2. **API Optimization**
   - Backend uses single optimized query instead of multiple queries
   - Reduces database round-trips from 5 to 1 (80% faster)
   - Frontend batches multiple API calls with Promise.allSettled

3. **Rendering Optimization**
   - Use React.memo for expensive components
   - Virtualize long lists (attendance logs, merit/demerit logs)
   - Lazy load historical data sections

### Security Considerations

1. **Authentication**
   - JWT-based authentication required for all endpoints
   - Cadet can only access their own data (enforced by cadet_id from JWT)
   - Auto-linking fallback for missing cadet_id mapping

2. **Data Validation**
   - Validate all API responses on frontend
   - Sanitize user inputs in excuse letter submissions
   - Prevent XSS in displayed text fields

3. **Rate Limiting**
   - Implement rate limiting on API endpoints
   - Throttle SSE reconnection attempts
   - Debounce refresh button clicks

### Accessibility

1. **Semantic HTML**
   - Use proper table structure for data tables
   - Use heading hierarchy (h1, h2, h3)
   - Use semantic elements (section, article, nav)

2. **ARIA Labels**
   - Add aria-labels to icon buttons
   - Use aria-live regions for real-time updates
   - Provide screen reader announcements for grade changes

3. **Keyboard Navigation**
   - Ensure all interactive elements are keyboard accessible
   - Provide focus indicators
   - Support tab navigation through sections

4. **Color Contrast**
   - Ensure sufficient contrast for text and backgrounds
   - Don't rely solely on color to convey information
   - Provide text labels in addition to color coding

### Browser Compatibility

- Support modern browsers (Chrome, Firefox, Safari, Edge)
- Graceful degradation for older browsers
- Polyfills for IndexedDB and SSE if needed
- Progressive Web App (PWA) support for offline functionality

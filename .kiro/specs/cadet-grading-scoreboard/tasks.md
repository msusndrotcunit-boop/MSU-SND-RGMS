# Implementation Plan: Cadet Grading Scoreboard Display

## Overview

This implementation plan focuses on enhancing the existing cadet dashboard to ensure all grading components are properly displayed, calculated, and tested. The existing implementation already has most features in place, so this plan focuses on verification, testing, and any missing enhancements.

## Tasks

- [x] 1. Verify and enhance scoreboard data fetching
  - Review existing API integration in `client/src/pages/cadet/Dashboard.jsx`
  - Ensure all three endpoints are properly called: `/api/cadet/my-grades`, `/api/cadet/my-merit-logs`, `/api/attendance/my-history`
  - Verify cache-first strategy with stale-while-revalidate pattern
  - Ensure SSE connection for real-time updates is working
  - _Requirements: 1.1, 1.2, 6.1, 6.2_

- [ ]* 1.1 Write property test for data fetching on mount
  - **Property 1: Grading Data Retrieval on Load**
  - **Validates: Requirements 1.2**

- [ ] 2. Verify attendance display components
  - [x] 2.1 Review attendance section rendering in Dashboard component
    - Verify attendance percentage calculation and display
    - Ensure present/total days ratio is shown
    - Check that attendance history table displays all records
    - Verify status badges (present, absent, late, excused) are color-coded
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.2 Write property test for attendance display
    - **Property 2: Attendance Display Completeness**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.3 Write unit tests for attendance section
    - Test rendering with valid attendance data
    - Test empty attendance logs display
    - Test status badge color mapping
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. Verify aptitude score calculation and display
  - [x] 3.1 Review merit/demerit section in Dashboard component
    - Verify merit points display as positive values
    - Verify demerit points display
    - Check aptitude score calculation: `min(100, max(0, 100 + merit - demerit)) × 0.3`
    - Verify lifetime merit points display
    - Check ceiling status warning display
    - Ensure visual distinction between merit and demerit
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.2 Write property test for aptitude calculation
    - **Property 3: Aptitude Score Calculation**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 3.3 Write unit tests for merit/demerit section
    - Test rendering with various merit/demerit combinations
    - Test ceiling warning display (when rawAptitude > 100)
    - Test lifetime merit achievement display
    - Test merit/demerit logs table rendering
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Verify subject proficiency display
  - [x] 4.1 Review subject proficiency section in Dashboard component
    - Verify prelim, midterm, and final scores are displayed
    - Check subject score calculation: `((prelim + midterm + final) / 300) × 40`
    - Ensure table format with proper headers
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 4.2 Write property test for subject score display
    - **Property 4: Subject Score Display**
    - **Validates: Requirements 4.1**

  - [ ]* 4.3 Write unit tests for subject proficiency section
    - Test rendering with various score combinations
    - Test table structure and headers
    - Test score formatting
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Verify overall grade calculation and display
  - [x] 5.1 Review final assessment section in Dashboard component
    - Verify final grade calculation: `attendanceScore + aptitudeScore + subjectScore`
    - Check numerical grade display (0-100 scale)
    - Verify transmuted grade display (1.00-5.00 scale)
    - Check remarks display (PASSED/FAILED/DO/INC)
    - Verify color coding (green for passing, red for failing)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.2 Write property test for overall grade calculation
    - **Property 5: Overall Grade Calculation**
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 5.3 Write property test for transmuted grade mapping
    - **Property 6: Transmuted Grade Mapping**
    - **Validates: Requirements 5.4**

  - [ ]* 5.4 Write unit tests for final assessment section
    - Test rendering with various grade combinations
    - Test color coding logic
    - Test transmuted grade display
    - Test remarks display
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Checkpoint - Ensure all display tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Verify real-time update functionality
  - [x] 7.1 Review SSE connection implementation
    - Verify EventSource connection to `/api/attendance/events`
    - Check handling of `grade_updated` events
    - Check handling of `attendance_updated` events
    - Verify automatic reconnection on connection loss
    - Ensure connection status indicator updates correctly
    - _Requirements: 6.1, 6.2_

  - [ ]* 7.2 Write unit tests for SSE event handling
    - Test grade_updated event triggers data refresh
    - Test attendance_updated event triggers attendance refresh
    - Test connection status indicator updates
    - Test reconnection logic
    - _Requirements: 6.1, 6.2_

- [ ] 8. Verify refresh functionality
  - [x] 8.1 Review manual refresh implementation
    - Verify refresh button triggers API calls
    - Check that cache is bypassed on manual refresh
    - Ensure all sections update after refresh
    - _Requirements: 6.2_

  - [ ]* 8.2 Write property test for refresh data freshness
    - **Property 7: Refresh Data Freshness**
    - **Validates: Requirements 6.2**

- [ ] 9. Verify UI organization and formatting
  - [x] 9.1 Review scoreboard layout and styling
    - Verify distinct sections for each grading component
    - Check section labels and headers
    - Verify visual hierarchy (overall grade most prominent)
    - Check responsive design for mobile devices
    - _Requirements: 7.1, 7.2, 7.4_

  - [ ]* 9.2 Write property test for numerical formatting
    - **Property 8: Numerical Value Formatting**
    - **Validates: Requirements 7.3**

  - [ ]* 9.3 Write unit tests for UI organization
    - Test section rendering and labels
    - Test responsive layout
    - Test visual hierarchy
    - _Requirements: 7.1, 7.4_

- [ ] 10. Implement and test missing data handling
  - [x] 10.1 Review error handling and default values
    - Verify default values for missing data (0 for scores, "No Data" for remarks)
    - Check layout stability with missing data
    - Verify "Not Available" or "Pending" indicators
    - Test calculation with partial data
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 10.2 Write property test for missing data handling
    - **Property 9: Missing Data Graceful Degradation**
    - **Validates: Requirements 9.1, 9.2**

  - [ ]* 10.3 Write unit tests for error scenarios
    - Test rendering with null grades data
    - Test rendering with undefined fields
    - Test rendering with empty arrays
    - Test API error handling
    - Test cache fallback behavior
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 11. Verify caching and offline support
  - [x] 11.1 Review IndexedDB caching implementation
    - Verify cache writes on successful API calls
    - Check cache reads on component mount
    - Verify 5-minute TTL implementation
    - Test offline mode with cached data
    - Ensure offline indicator displays correctly
    - _Requirements: 6.2_

  - [ ]* 11.2 Write unit tests for caching behavior
    - Test cache write after API success
    - Test cache read on mount
    - Test cache TTL expiration
    - Test offline fallback
    - _Requirements: 6.2_

- [ ] 12. Add historical data display (optional enhancement)
  - [ ] 12.1 Implement performance trends visualization
    - Add chart component for grade trends over time
    - Fetch historical grade data from backend
    - Display trends for current academic term
    - Use recharts library for visualization
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 12.2 Write unit tests for historical data display
    - Test chart rendering with historical data
    - Test date range filtering
    - Test empty historical data handling
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 13. Final checkpoint - Integration testing
  - [ ]* 13.1 Write integration tests for complete flow
    - Test login → dashboard load → data display
    - Test SSE event → data refresh → UI update
    - Test offline → online transition
    - Test cache invalidation on updates
  
  - [ ] 13.2 Manual testing checklist
    - Verify all sections display correctly on different screen sizes
    - Test real-time updates by having admin update grades
    - Test offline mode by disconnecting network
    - Test refresh button functionality
    - Verify accessibility with screen reader
    - Check keyboard navigation
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Most implementation already exists in `client/src/pages/cadet/Dashboard.jsx`
- Focus is on verification, testing, and minor enhancements
- Property tests should use fast-check library with minimum 100 iterations
- Each property test must be tagged with: `Feature: cadet-grading-scoreboard, Property {N}: {description}`
- Historical data display (Task 12) is an optional enhancement
- Backend API endpoints already exist and are functional

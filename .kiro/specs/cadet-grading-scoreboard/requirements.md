# Requirements Document

## Introduction

The Cadet Grading Scoreboard Display feature provides cadets with a comprehensive view of their academic and behavioral performance through their account dashboard. The system displays attendance records, aptitude scores (merit and demerit points), subject proficiency grades, and an overall ranking, enabling cadets to track their progress and performance in real-time.

## Glossary

- **Cadet**: A student user who logs into the system to view their performance data
- **Scoreboard**: The dashboard display showing all grading components and overall performance
- **Attendance_Score**: A percentage or numerical representation of a cadet's attendance record
- **Merit_Points**: Positive points awarded for good behavior or achievements
- **Demerit_Points**: Negative points assigned for disciplinary issues or rule violations
- **Aptitude_Score**: The net score calculated from merit and demerit points
- **Subject_Proficiency**: Grade or score for individual academic subjects
- **Overall_Grade**: A combined ranking or grade calculated from attendance, aptitude, and subject proficiency
- **Grading_System**: The backend system that manages and calculates all grading components
- **Staff_User**: Administrative or teaching staff who enter and update grades

## Requirements

### Requirement 1: Display Scoreboard on Login

**User Story:** As a cadet, I want to see my grading scoreboard when I log into my account, so that I can immediately view my current performance status.

#### Acceptance Criteria

1. WHEN a cadet successfully logs into their account, THE Scoreboard SHALL be displayed on the dashboard
2. WHEN the scoreboard loads, THE Grading_System SHALL retrieve the cadet's current grading data
3. THE Scoreboard SHALL display within 2 seconds of successful authentication

### Requirement 2: Display Attendance Information

**User Story:** As a cadet, I want to view my attendance score, so that I can track my attendance record.

#### Acceptance Criteria

1. THE Scoreboard SHALL display the cadet's current Attendance_Score as a percentage
2. WHEN attendance data exists, THE Scoreboard SHALL show the number of days present and total days
3. THE Scoreboard SHALL display attendance information in a clearly labeled section

### Requirement 3: Display Aptitude Scores

**User Story:** As a cadet, I want to see my merit and demerit points, so that I can understand my behavioral performance.

#### Acceptance Criteria

1. THE Scoreboard SHALL display Merit_Points as a positive numerical value
2. THE Scoreboard SHALL display Demerit_Points as a numerical value
3. THE Scoreboard SHALL calculate and display the net Aptitude_Score from merit and demerit points
4. THE Scoreboard SHALL clearly distinguish between positive merit points and demerit points through visual formatting

### Requirement 4: Display Subject Proficiency

**User Story:** As a cadet, I want to view my grades for each subject, so that I can track my academic performance across different courses.

#### Acceptance Criteria

1. THE Scoreboard SHALL display Subject_Proficiency scores for all enrolled subjects
2. WHEN displaying subject scores, THE Scoreboard SHALL include the subject name and corresponding grade
3. THE Scoreboard SHALL organize subject proficiency data in a structured list or table format

### Requirement 5: Calculate and Display Overall Grade

**User Story:** As a cadet, I want to see my overall grade or ranking, so that I can understand my combined performance across all grading components.

#### Acceptance Criteria

1. THE Grading_System SHALL calculate the Overall_Grade from attendance, aptitude, and subject proficiency scores
2. THE Scoreboard SHALL display the calculated Overall_Grade prominently
3. WHEN any grading component is updated, THE Grading_System SHALL recalculate the Overall_Grade
4. THE Scoreboard SHALL display the ranking or grade classification based on the Overall_Grade

### Requirement 6: Real-Time Grade Updates

**User Story:** As a cadet, I want my scoreboard to reflect grade changes immediately or near-immediately, so that I always see current information.

#### Acceptance Criteria

1. WHEN a Staff_User updates any grading component, THE Grading_System SHALL update the cadet's data within 5 seconds
2. WHEN the cadet refreshes the scoreboard view, THE Scoreboard SHALL display the most current grading data
3. THE Grading_System SHALL maintain data consistency across all grading components during updates

### Requirement 7: Clear and Organized Display

**User Story:** As a cadet, I want the scoreboard to be easy to read and understand, so that I can quickly comprehend my performance status.

#### Acceptance Criteria

1. THE Scoreboard SHALL organize grading components into distinct, labeled sections
2. THE Scoreboard SHALL use consistent formatting and typography throughout the display
3. THE Scoreboard SHALL display numerical values with appropriate precision and units
4. THE Scoreboard SHALL use visual hierarchy to emphasize the Overall_Grade

### Requirement 8: Historical Data Display

**User Story:** As a cadet, I want to view trends in my performance over time, so that I can see how my grades have changed.

#### Acceptance Criteria

1. WHERE historical data tracking is enabled, THE Scoreboard SHALL display performance trends over time
2. WHERE historical data is displayed, THE Scoreboard SHALL show data for at least the current academic term
3. WHERE trend visualization is implemented, THE Scoreboard SHALL use charts or graphs to represent historical data

### Requirement 9: Handle Missing or Incomplete Data

**User Story:** As a cadet, I want the scoreboard to handle situations where some grades haven't been entered yet, so that I can still view available information.

#### Acceptance Criteria

1. WHEN a grading component has no data, THE Scoreboard SHALL display a clear indicator such as "Not Available" or "Pending"
2. WHEN calculating Overall_Grade with missing components, THE Grading_System SHALL use only available data or indicate incomplete calculation
3. THE Scoreboard SHALL maintain layout consistency even when some data is missing

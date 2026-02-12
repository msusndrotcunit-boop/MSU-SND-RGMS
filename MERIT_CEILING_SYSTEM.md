# Merit/Demerit 100-Point Ceiling System

## Overview
The ROTC Grading Management System implements a 100-point ceiling for merit/demerit aptitude scoring with lifetime achievement tracking.

## System Rules

### 1. Base Points
- All cadets start with **100 base merit points** at orientation
- This represents the starting aptitude score

### 2. Point Adjustments
- **Demerits**: Subtract from the base 100 points
- **Merits**: Add back to the score BUT cannot exceed 100 ceiling

### 3. Ceiling System
- **Maximum Score**: 100 points (ceiling)
- **Minimum Score**: 0 points (floor)
- **Formula**: `min(100, max(0, 100 + merit_points - demerit_points))`

### 4. Ceiling Behavior
- If a cadet has 100 points and receives merits → **No change** (already at ceiling)
- Excess merit points beyond 100 are tracked separately as "lifetime merit points"

## Database Schema

### `grades` Table Columns
- `merit_points` - Current active merit points (capped at 100 contribution)
- `demerit_points` - Current demerit points
- `lifetime_merit_points` - **NEW**: Total merits earned across entire ROTC career (unlimited)

## Implementation Details

### Backend Calculation (3 locations)
1. **Cadet Dashboard** (`server/routes/cadet.js` line ~94)
2. **Admin Analytics** (`server/routes/admin.js` line ~1210)
3. **Admin Cadet List** (`server/routes/admin.js` line ~1558)

All use the same formula:
```javascript
// Aptitude Calculation with 100-point ceiling system:
// - All cadets start with 100 base points
// - Demerits subtract from the base
// - Merits add back BUT cannot exceed 100 ceiling
// - Formula: min(100, 100 + merits - demerits)
// - This means if a cadet has 100 points and gets merits, no change occurs (already at ceiling)
let rawAptitude = 100 + (merit_points || 0) - (demerit_points || 0);
if (rawAptitude > 100) rawAptitude = 100; // Ceiling: Cannot exceed 100
if (rawAptitude < 0) rawAptitude = 0;     // Floor: Cannot go below 0
const aptitudeScore = rawAptitude * 0.3;  // 30% weight in final grade
```

### Lifetime Merit Tracking

#### When Merit Points Are Added (POST /api/admin/merit-logs)
```javascript
// Updates BOTH current merit_points AND lifetime_merit_points
UPDATE grades SET 
    merit_points = merit_points + points,
    lifetime_merit_points = COALESCE(lifetime_merit_points, 0) + points
WHERE cadet_id = ?
```

#### When Merit Points Are Deleted (DELETE /api/admin/merit-logs/:id)
```javascript
// Only affects current merit_points, keeps lifetime history intact
UPDATE grades SET 
    merit_points = merit_points - points
WHERE cadet_id = ?
// Note: lifetime_merit_points is NOT reduced
```

## Use Cases

### Example 1: Cadet at Ceiling
- Current Merit: 100 points
- Receives: +10 merit points
- **Result**: 
  - Active Merit: 100 (no change, at ceiling)
  - Lifetime Merit: 110 (tracked for recognition)
  - Wasted Points: 10 (shown in UI)

### Example 2: Cadet with Demerits
- Current Merit: 100 points
- Current Demerit: 0 points
- Receives: -20 demerit points
- **Result**:
  - Active Merit: 100
  - Active Demerit: 20
  - Raw Aptitude: 100 + 100 - 20 = 80
  - Aptitude Score: 80 × 0.3 = 24 points (out of 30)

### Example 3: Recovery from Demerits
- Current Merit: 100 points
- Current Demerit: 30 points
- Raw Aptitude: 70 (below ceiling)
- Receives: +15 merit points
- **Result**:
  - Active Merit: 115
  - Active Demerit: 30
  - Raw Aptitude: 100 + 115 - 30 = 85 (capped at 100 would be if merits alone)
  - Actual: 85 points (not at ceiling yet)

## Future Enhancements (Planned)

### Phase 1: UI Display ✅ (Backend Ready)
- Show both "Current Merit: 100/100" and "Lifetime Merit: 150"
- Display warning when merit points are wasted due to ceiling
- Add badge/indicator for cadets at ceiling

### Phase 2: Recognition System
- Certificate generation for every 50 lifetime merit points
- "Honor Roll" based on lifetime achievements
- Year-end awards using lifetime totals

### Phase 3: Analytics
- Track how many merit points are "wasted" system-wide
- Identify top performers by lifetime merit
- Semester-by-semester achievement tracking

## Migration

Run the migration to add the `lifetime_merit_points` column:
```bash
cd server
node migrations/add_lifetime_merit_points.js
```

This will:
1. Add `lifetime_merit_points` column to `grades` table
2. Initialize existing cadets with their current `merit_points` value
3. Future merit additions will update both columns

## API Response Changes

### GET /api/cadet/my-grades
Now includes:
```json
{
  "merit_points": 100,
  "demerit_points": 20,
  "lifetime_merit_points": 150,
  "aptitudeScore": 24,
  ...
}
```

## Benefits

1. **Recognition**: All achievements are tracked, even when at ceiling
2. **Motivation**: Cadets see their total contributions over time
3. **Awards**: Lifetime totals can be used for honors and certificates
4. **Transparency**: Clear indication when points are "wasted" due to ceiling
5. **Fairness**: Consistent 100-point ceiling prevents score inflation

## Notes

- The DELETE endpoint intentionally does NOT reduce lifetime_merit_points to preserve achievement history
- Lifetime points are only for recognition, they don't affect grade calculations
- The 100-point ceiling applies to the aptitude calculation, not to the stored merit_points value

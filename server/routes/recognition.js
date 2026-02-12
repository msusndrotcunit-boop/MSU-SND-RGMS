const express = require('express');
const db = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Recognition System for Merit Achievement
 * 
 * Tracks and awards cadets based on lifetime merit points:
 * - Bronze: 50+ lifetime merits
 * - Silver: 100+ lifetime merits  
 * - Gold: 150+ lifetime merits
 * - Platinum: 200+ lifetime merits
 */

// Get recognition levels for a cadet
router.get('/cadet/:cadetId/achievements', authenticateToken, async (req, res) => {
    const { cadetId } = req.params;
    
    try {
        // Get lifetime merit points
        const gradeRow = await new Promise((resolve, reject) => {
            db.get(
                `SELECT lifetime_merit_points, merit_points FROM grades WHERE cadet_id = ?`,
                [cadetId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!gradeRow) {
            return res.json({
                lifetimeMerit: 0,
                achievements: [],
                nextMilestone: { level: 'Bronze', pointsNeeded: 50 }
            });
        }

        const lifetimeMerit = gradeRow.lifetime_merit_points || gradeRow.merit_points || 0;
        
        // Define achievement levels
        const levels = [
            { level: 'Bronze', threshold: 50, icon: '🥉', color: '#CD7F32' },
            { level: 'Silver', threshold: 100, icon: '🥈', color: '#C0C0C0' },
            { level: 'Gold', threshold: 150, icon: '🥇', color: '#FFD700' },
            { level: 'Platinum', threshold: 200, icon: '💎', color: '#E5E4E2' }
        ];

        // Calculate achieved levels
        const achievements = levels
            .filter(l => lifetimeMerit >= l.threshold)
            .map(l => ({
                ...l,
                earnedAt: lifetimeMerit,
                earnedDate: new Date().toISOString() // TODO: Track actual earn date
            }));

        // Find next milestone
        const nextLevel = levels.find(l => lifetimeMerit < l.threshold);
        const nextMilestone = nextLevel 
            ? { ...nextLevel, pointsNeeded: nextLevel.threshold - lifetimeMerit }
            : null;

        res.json({
            lifetimeMerit,
            achievements,
            nextMilestone,
            rank: achievements.length > 0 ? achievements[achievements.length - 1].level : 'Cadet'
        });

    } catch (err) {
        console.error('Error fetching achievements:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get top performers (leaderboard)
router.get('/leaderboard', authenticateToken, async (req, res) => {
    const { limit = 10 } = req.query;
    
    try {
        const sql = `
            SELECT 
                c.id,
                c.first_name,
                c.last_name,
                c.rank,
                c.company,
                c.platoon,
                g.lifetime_merit_points,
                g.merit_points,
                g.demerit_points
            FROM cadets c
            INNER JOIN grades g ON g.cadet_id = c.id
            WHERE (c.is_archived IS FALSE OR c.is_archived IS NULL)
            ORDER BY g.lifetime_merit_points DESC
            LIMIT ?
        `;

        db.all(sql, [parseInt(limit)], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });
            
            const leaderboard = rows.map((row, index) => {
                const lifetimeMerit = row.lifetime_merit_points || row.merit_points || 0;
                let badge = null;
                
                if (lifetimeMerit >= 200) badge = { level: 'Platinum', icon: '💎' };
                else if (lifetimeMerit >= 150) badge = { level: 'Gold', icon: '🥇' };
                else if (lifetimeMerit >= 100) badge = { level: 'Silver', icon: '🥈' };
                else if (lifetimeMerit >= 50) badge = { level: 'Bronze', icon: '🥉' };
                
                return {
                    rank: index + 1,
                    cadetId: row.id,
                    name: `${row.rank || ''} ${row.last_name}, ${row.first_name}`.trim(),
                    company: row.company,
                    platoon: row.platoon,
                    lifetimeMerit,
                    currentMerit: row.merit_points,
                    demerits: row.demerit_points,
                    badge
                };
            });

            res.json(leaderboard);
        });

    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get system-wide recognition statistics
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_cadets,
                    SUM(CASE WHEN lifetime_merit_points >= 50 THEN 1 ELSE 0 END) as bronze_count,
                    SUM(CASE WHEN lifetime_merit_points >= 100 THEN 1 ELSE 0 END) as silver_count,
                    SUM(CASE WHEN lifetime_merit_points >= 150 THEN 1 ELSE 0 END) as gold_count,
                    SUM(CASE WHEN lifetime_merit_points >= 200 THEN 1 ELSE 0 END) as platinum_count,
                    AVG(lifetime_merit_points) as avg_lifetime_merit,
                    MAX(lifetime_merit_points) as max_lifetime_merit,
                    SUM(CASE WHEN (100 + merit_points - demerit_points) > 100 THEN (100 + merit_points - demerit_points - 100) ELSE 0 END) as total_wasted_points
                FROM grades g
                INNER JOIN cadets c ON c.id = g.cadet_id
                WHERE (c.is_archived IS FALSE OR c.is_archived IS NULL)
            `;
            
            db.get(sql, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            totalCadets: stats.total_cadets || 0,
            achievementCounts: {
                bronze: stats.bronze_count || 0,
                silver: stats.silver_count || 0,
                gold: stats.gold_count || 0,
                platinum: stats.platinum_count || 0
            },
            averageLifetimeMerit: Math.round(stats.avg_lifetime_merit || 0),
            maxLifetimeMerit: stats.max_lifetime_merit || 0,
            totalWastedPoints: stats.total_wasted_points || 0
        });

    } catch (err) {
        console.error('Error fetching recognition stats:', err);
        res.status(500).json({ message: err.message });
    }
});

// Generate certificate data for a cadet
router.get('/cadet/:cadetId/certificate/:level', authenticateToken, async (req, res) => {
    const { cadetId, level } = req.params;
    
    try {
        // Get cadet info
        const cadet = await new Promise((resolve, reject) => {
            db.get(
                `SELECT c.*, g.lifetime_merit_points 
                 FROM cadets c
                 LEFT JOIN grades g ON g.cadet_id = c.id
                 WHERE c.id = ?`,
                [cadetId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!cadet) {
            return res.status(404).json({ message: 'Cadet not found' });
        }

        const lifetimeMerit = cadet.lifetime_merit_points || 0;
        const levelThresholds = {
            'Bronze': 50,
            'Silver': 100,
            'Gold': 150,
            'Platinum': 200
        };

        const threshold = levelThresholds[level];
        if (!threshold || lifetimeMerit < threshold) {
            return res.status(400).json({ 
                message: `Cadet has not achieved ${level} level (requires ${threshold} lifetime merits, has ${lifetimeMerit})` 
            });
        }

        // Generate certificate data
        const certificateData = {
            level,
            cadetName: `${cadet.rank || ''} ${cadet.first_name} ${cadet.last_name}`.trim(),
            lifetimeMerit,
            threshold,
            company: cadet.company,
            platoon: cadet.platoon,
            issuedDate: new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            certificateNumber: `ROTC-${level.toUpperCase()}-${cadetId}-${Date.now()}`
        };

        res.json(certificateData);

    } catch (err) {
        console.error('Error generating certificate:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

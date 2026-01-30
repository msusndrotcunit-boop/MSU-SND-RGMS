const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function seedCadet() {
    const client = await pool.connect();
    try {
        console.log('Connecting to DB...');
        
        await client.query('BEGIN');

        // 1. Insert Cadet
        const cadetQuery = `
            INSERT INTO cadets (
                student_id, first_name, last_name, email, rank, course, 
                year_level, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8
            ) RETURNING id;
        `;
        
        // Minimal required fields based on schema
        const cadetValues = [
            '2024-0001', 'Juan', 'Dela Cruz', 'juan@example.com', 'CDT', 'BSCS',
            '1', 'Ongoing'
        ];

        console.log('Inserting cadet...');
        const cadetRes = await client.query(cadetQuery, cadetValues);
        const cadetId = cadetRes.rows[0].id;
        console.log('Cadet inserted with ID:', cadetId);

        // 2. Insert User
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const userQuery = `
            INSERT INTO users (
                username, password, role, cadet_id, is_approved, email
            ) VALUES (
                $1, $2, $3, $4, $5, $6
            ) RETURNING id;
        `;
        
        const userValues = [
            'juan2024', hashedPassword, 'cadet', cadetId, 1, 'juan@example.com'
        ];

        console.log('Inserting user...');
        await client.query(userQuery, userValues);
        console.log('User inserted successfully. Username: juan2024, Password: password123');

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error seeding cadet:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seedCadet();

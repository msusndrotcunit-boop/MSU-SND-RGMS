const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

console.log('Connecting to:', connectionString.replace(/:[^:@]*@/, ':****@'));

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkData() {
  try {
    const client = await pool.connect();
    console.log('Connected successfully!');
    
    // Check tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\nTables found:', tablesRes.rows.map(r => r.table_name).join(', '));
    
    if (tablesRes.rows.some(r => r.table_name === 'cadets')) {
      const cadetsRes = await client.query('SELECT COUNT(*) FROM cadets');
      console.log(`\nTotal Cadets: ${cadetsRes.rows[0].count}`);
    } else {
      console.log('\nTable "cadets" does not exist.');
    }

    if (tablesRes.rows.some(r => r.table_name === 'users')) {
      const usersRes = await client.query('SELECT COUNT(*) FROM users');
      console.log(`Total Users: ${usersRes.rows[0].count}`);
    } else {
        console.log('Table "users" does not exist.');
    }

    client.release();
  } catch (err) {
    console.error('Error connecting or querying:', err);
  } finally {
    pool.end();
  }
}

checkData();

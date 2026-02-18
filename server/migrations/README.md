# Database Migrations

This directory contains database migration scripts to update the schema.

## Add Religion and Birthdate Columns

The `religion` and `birthdate` columns were added to the `cadets` table. If you're getting an error that these columns don't exist, you need to run this migration.

### Option 1: Run the Node.js Script (Recommended)

This will automatically detect your database type and add the columns:

```bash
node server/migrations/run-add-columns.js
```

### Option 2: Run SQL Directly on Render

If you're using PostgreSQL on Render:

1. Go to your Render dashboard
2. Navigate to your PostgreSQL database
3. Click on "Connect" and choose "External Connection" or use the Render Shell
4. Run the SQL commands from `add_religion_birthdate_columns.sql`

Or use the Render CLI:

```bash
# Connect to your database
render psql <your-database-name>

# Then paste the contents of add_religion_birthdate_columns.sql
```

### Option 3: Automatic Migration on Server Start

The columns should be added automatically when the server starts, as the `database.js` file includes ALTER TABLE statements. If this doesn't work, use Option 1 or 2.

## Verifying the Migration

After running the migration, you can verify the columns exist:

**PostgreSQL:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cadets' 
AND column_name IN ('religion', 'birthdate');
```

**SQLite:**
```sql
PRAGMA table_info(cadets);
```

You should see both `religion` and `birthdate` columns listed.

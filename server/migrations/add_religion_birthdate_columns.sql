-- Migration: Add religion and birthdate columns to cadets table
-- Run this on your PostgreSQL database on Render

-- Add religion column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cadets' AND column_name = 'religion'
    ) THEN
        ALTER TABLE cadets ADD COLUMN religion TEXT;
        RAISE NOTICE 'Added religion column to cadets table';
    ELSE
        RAISE NOTICE 'religion column already exists in cadets table';
    END IF;
END $$;

-- Add birthdate column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cadets' AND column_name = 'birthdate'
    ) THEN
        ALTER TABLE cadets ADD COLUMN birthdate TEXT;
        RAISE NOTICE 'Added birthdate column to cadets table';
    ELSE
        RAISE NOTICE 'birthdate column already exists in cadets table';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cadets' 
AND column_name IN ('religion', 'birthdate')
ORDER BY column_name;

/*
  # Restructure Proposal-Client Relationship

  1. New Tables
    - `proposal_clients` - Junction table for many-to-many relationship between proposals and clients
  2. Data Migration
    - Migrate existing proposal client data to clients table
    - Create relationships in junction table
  3. Security
    - Enable RLS on proposal_clients table
    - Add policies for proposal client management
  4. Functions
    - Update proposal naming functions to work with new structure
*/

-- First, migrate existing data to clients table if it doesn't exist
DO $$
DECLARE
    proposal_row RECORD;
    new_client_id UUID;
BEGIN
    FOR proposal_row IN SELECT DISTINCT p.first_name, p.last_name, p.email, p.user_id FROM proposals p WHERE p.client_id IS NULL
    LOOP
        -- Check if client already exists
        SELECT c.id INTO new_client_id 
        FROM clients c
        WHERE c.email = proposal_row.email AND c.user_id = proposal_row.user_id;
        
        -- If not exists, create client
        IF new_client_id IS NULL THEN
            INSERT INTO clients (user_id, first_name, last_name, email, phone, company, notes)
            VALUES (
                proposal_row.user_id,
                proposal_row.first_name,
                proposal_row.last_name,
                proposal_row.email,
                '',
                '',
                'Auto-migrated from proposal data'
            )
            RETURNING id INTO new_client_id;
        END IF;
        
        -- Update proposals to link to client
        UPDATE proposals 
        SET client_id = new_client_id
        WHERE first_name = proposal_row.first_name 
        AND last_name = proposal_row.last_name 
        AND email = proposal_row.email 
        AND user_id = proposal_row.user_id
        AND client_id IS NULL;
    END LOOP;
END $$;

-- Create proposal_clients junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS proposal_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(proposal_id, client_id)
);

-- Migrate existing client_id relationships to junction table
INSERT INTO proposal_clients (proposal_id, client_id, is_primary)
SELECT p.id, p.client_id, true
FROM proposals p
WHERE p.client_id IS NOT NULL
ON CONFLICT (proposal_id, client_id) DO NOTHING;

-- Enable RLS on proposal_clients
ALTER TABLE proposal_clients ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for proposal_clients
CREATE POLICY "Users can manage their proposal clients"
  ON proposal_clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proposals p 
      WHERE p.id = proposal_clients.proposal_id 
      AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p 
      WHERE p.id = proposal_clients.proposal_id 
      AND p.user_id = auth.uid()
    )
  );

-- Add updated_at trigger for proposal_clients
CREATE TRIGGER update_proposal_clients_updated_at
    BEFORE UPDATE ON proposal_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS proposal_clients_proposal_id_idx ON proposal_clients(proposal_id);
CREATE INDEX IF NOT EXISTS proposal_clients_client_id_idx ON proposal_clients(client_id);
CREATE INDEX IF NOT EXISTS proposal_clients_primary_idx ON proposal_clients(proposal_id, is_primary) WHERE is_primary = true;

-- Update the sync_proposal_client_data function to work with new structure
CREATE OR REPLACE FUNCTION sync_proposal_client_data()
RETURNS TRIGGER AS $$
DECLARE
    primary_client_record RECORD;
BEGIN
    -- Get the primary client for this proposal
    SELECT c.first_name, c.last_name, c.email INTO primary_client_record
    FROM clients c
    JOIN proposal_clients pc ON pc.client_id = c.id
    WHERE pc.proposal_id = NEW.id AND pc.is_primary = true
    LIMIT 1;
    
    -- If we have a primary client, update the proposal name if not set
    IF primary_client_record.first_name IS NOT NULL THEN
        IF NEW.name IS NULL OR NEW.name = '' THEN
            NEW.name := 'Proposal for ' || primary_client_record.first_name || ' ' || primary_client_record.last_name || ' - ' || to_char(NEW.created_at, 'Mon DD, YYYY');
        END IF;
        
        -- Update the cached client fields (we'll remove these in the next step)
        NEW.first_name := primary_client_record.first_name;
        NEW.last_name := primary_client_record.last_name;
        NEW.email := primary_client_record.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now we can safely remove the redundant columns from proposals
-- But first, let's make them nullable and remove the NOT NULL constraints
ALTER TABLE proposals ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE proposals ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE proposals ALTER COLUMN email DROP NOT NULL;

-- Drop the old trigger that was expecting these fields
DROP TRIGGER IF EXISTS sync_proposal_client_data_trigger ON proposals;

-- Create a new simpler version that just handles naming
CREATE OR REPLACE FUNCTION set_proposal_name()
RETURNS TRIGGER AS $$
DECLARE
    primary_client_record RECORD;
BEGIN
    -- Only set name if it's empty
    IF NEW.name IS NULL OR NEW.name = '' THEN
        -- Try to get primary client info
        SELECT c.first_name, c.last_name INTO primary_client_record
        FROM clients c
        JOIN proposal_clients pc ON pc.client_id = c.id
        WHERE pc.proposal_id = NEW.id AND pc.is_primary = true
        LIMIT 1;
        
        IF primary_client_record.first_name IS NOT NULL THEN
            NEW.name := 'Proposal for ' || primary_client_record.first_name || ' ' || primary_client_record.last_name || ' - ' || to_char(COALESCE(NEW.created_at, now()), 'Mon DD, YYYY');
        ELSE
            NEW.name := 'Proposal - ' || to_char(COALESCE(NEW.created_at, now()), 'Mon DD, YYYY');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add the new trigger
CREATE TRIGGER set_proposal_name_trigger
    BEFORE INSERT OR UPDATE ON proposals
    FOR EACH ROW
    EXECUTE FUNCTION set_proposal_name();
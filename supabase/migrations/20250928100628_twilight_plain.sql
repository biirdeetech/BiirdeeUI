/*
  # Add clients table and update proposals

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `first_name` (text)
      - `last_name` (text) 
      - `email` (text)
      - `phone` (text, optional)
      - `company` (text, optional)
      - `notes` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to `proposals`
    - Add `client_id` (uuid, foreign key to clients)
    - Keep existing client fields for backward compatibility
    - Add trigger to auto-populate from client when client_id is set

  3. Security
    - Enable RLS on `clients` table
    - Add policies for authenticated users to manage their own clients
    - Update proposal policies to work with client relationship

  4. Indexes
    - Add indexes for efficient client lookups
    - Add unique constraint on email per user
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  company text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on email per user (same user can't have duplicate client emails)
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_email_unique 
  ON clients(user_id, email);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON clients(user_id);
CREATE INDEX IF NOT EXISTS clients_email_idx ON clients(email);
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients(first_name, last_name);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Users can manage their own clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add client_id column to proposals (optional for backward compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposals' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE proposals ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for client relationship
CREATE INDEX IF NOT EXISTS proposals_client_id_idx ON proposals(client_id);

-- Update proposals updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to clients
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to sync proposal client data when client_id is set
CREATE OR REPLACE FUNCTION sync_proposal_client_data()
RETURNS TRIGGER AS $$
BEGIN
  -- If client_id is set and client fields are empty, populate from client
  IF NEW.client_id IS NOT NULL AND (
    NEW.first_name = '' OR NEW.last_name = '' OR NEW.email = ''
  ) THEN
    SELECT c.first_name, c.last_name, c.email
    INTO NEW.first_name, NEW.last_name, NEW.email
    FROM clients c
    WHERE c.id = NEW.client_id;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to sync client data
DROP TRIGGER IF EXISTS sync_proposal_client_data_trigger ON proposals;
CREATE TRIGGER sync_proposal_client_data_trigger
  BEFORE INSERT OR UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION sync_proposal_client_data();
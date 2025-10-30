/*
  # Add multiple clients support to itineraries

  1. New Tables
    - `itinerary_clients`
      - `id` (uuid, primary key)
      - `itinerary_id` (uuid, foreign key to itineraries)
      - `client_id` (uuid, foreign key to clients)
      - `is_primary` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes
    - Remove direct `client_id` from itineraries table (will be handled through junction table)
    - Add indexes for performance
    - Add unique constraint to prevent duplicate client assignments

  3. Security
    - Enable RLS on `itinerary_clients` table
    - Add policies for authenticated users to manage their itinerary clients
    - Add policy for admin users to manage all itinerary clients
*/

-- Create itinerary_clients junction table
CREATE TABLE IF NOT EXISTS itinerary_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(itinerary_id, client_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS itinerary_clients_itinerary_id_idx ON itinerary_clients(itinerary_id);
CREATE INDEX IF NOT EXISTS itinerary_clients_client_id_idx ON itinerary_clients(client_id);
CREATE INDEX IF NOT EXISTS itinerary_clients_primary_idx ON itinerary_clients(itinerary_id, is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE itinerary_clients ENABLE ROW LEVEL SECURITY;

-- Policies for itinerary_clients
CREATE POLICY "Users can manage their itinerary clients"
  ON itinerary_clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM itineraries i
      WHERE i.id = itinerary_clients.itinerary_id
      AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM itineraries i
      WHERE i.id = itinerary_clients.itinerary_id
      AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage all itinerary clients"
  ON itinerary_clients
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Add trigger for updated_at
CREATE TRIGGER update_itinerary_clients_updated_at
  BEFORE UPDATE ON itinerary_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing data (if any itineraries have client_id set)
DO $$
BEGIN
  -- Insert existing client relationships into the new junction table
  INSERT INTO itinerary_clients (itinerary_id, client_id, is_primary)
  SELECT id, client_id, true
  FROM itineraries 
  WHERE client_id IS NOT NULL
  ON CONFLICT (itinerary_id, client_id) DO NOTHING;
END $$;

-- Remove the old client_id column from itineraries (keep it for now for compatibility)
-- ALTER TABLE itineraries DROP COLUMN IF EXISTS client_id;
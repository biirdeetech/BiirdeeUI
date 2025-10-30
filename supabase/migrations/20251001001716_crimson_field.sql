/*
  # Create Itinerary Builder Tables

  1. New Tables
    - `itineraries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `client_id` (uuid, foreign key to clients, nullable)
      - `name` (text, required)
      - `description` (text, optional)
      - `share_link` (text, unique, auto-generated)
      - `status` (text, default 'draft')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `itinerary_bookings`
      - `id` (uuid, primary key)
      - `itinerary_id` (uuid, foreign key to itineraries)
      - `airtable_record_id` (text, Airtable record ID)
      - `booking_name` (text)
      - `sales_agent_email` (text)
      - `booking_status` (text)
      - `class` (text)
      - `sales_price` (numeric)
      - `pnr` (text)
      - `from_airport` (text)
      - `to_airport` (text)
      - `airline_carrier` (text)
      - `start_date` (date)
      - `booking_notes` (text, agent notes for this itinerary)
      - `itinerary_order` (integer, display order)
      - `raw_airtable_data` (jsonb, full Airtable record)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own itineraries
    - Add policies for public access to shared itineraries
    
  3. Triggers
    - Add updated_at triggers for both tables
*/

-- Create itineraries table
CREATE TABLE IF NOT EXISTS itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text DEFAULT '',
  share_link text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'::text),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create itinerary_bookings table
CREATE TABLE IF NOT EXISTS itinerary_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid REFERENCES itineraries(id) ON DELETE CASCADE NOT NULL,
  airtable_record_id text NOT NULL,
  booking_name text NOT NULL,
  sales_agent_email text NOT NULL,
  booking_status text,
  class text,
  sales_price numeric(10,2),
  pnr text,
  from_airport text,
  to_airport text,
  airline_carrier text,
  start_date date,
  booking_notes text DEFAULT '',
  itinerary_order integer DEFAULT 0 NOT NULL,
  raw_airtable_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS itineraries_user_id_idx ON itineraries(user_id);
CREATE INDEX IF NOT EXISTS itineraries_client_id_idx ON itineraries(client_id);
CREATE INDEX IF NOT EXISTS itineraries_share_link_idx ON itineraries(share_link);
CREATE INDEX IF NOT EXISTS itinerary_bookings_itinerary_id_idx ON itinerary_bookings(itinerary_id);
CREATE INDEX IF NOT EXISTS itinerary_bookings_airtable_record_id_idx ON itinerary_bookings(airtable_record_id);
CREATE INDEX IF NOT EXISTS itinerary_bookings_order_idx ON itinerary_bookings(itinerary_id, itinerary_order);

-- Enable RLS
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_bookings ENABLE ROW LEVEL SECURITY;

-- Itineraries policies
CREATE POLICY "Users can manage their own itineraries"
  ON itineraries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read access via share_link"
  ON itineraries
  FOR SELECT
  TO anon
  USING (true);

-- Itinerary bookings policies
CREATE POLICY "Users can manage their own itinerary bookings"
  ON itinerary_bookings
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM itineraries i 
    WHERE i.id = itinerary_bookings.itinerary_id 
    AND i.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM itineraries i 
    WHERE i.id = itinerary_bookings.itinerary_id 
    AND i.user_id = auth.uid()
  ));

CREATE POLICY "Public read access for itinerary bookings via share_link"
  ON itinerary_bookings
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM itineraries i 
    WHERE i.id = itinerary_bookings.itinerary_id
  ));

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_itineraries_updated_at'
  ) THEN
    CREATE TRIGGER update_itineraries_updated_at 
      BEFORE UPDATE ON itineraries 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_itinerary_bookings_updated_at'
  ) THEN
    CREATE TRIGGER update_itinerary_bookings_updated_at 
      BEFORE UPDATE ON itinerary_bookings 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
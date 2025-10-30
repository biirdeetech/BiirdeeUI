/*
  # Add Admin RLS Policies

  1. New Policies
    - Admin access policies for clients, proposals, and itineraries tables
    - Allow admin users to view and manage all records regardless of user_id
  
  2. Security
    - Uses is_biirdee_email() function to verify admin access
    - Admin emails: tech@biirdee.com, var@biirdee.com, eric@biirdee.com
    - Policies are permissive and take precedence over existing user policies
  
  3. Changes
    - Adds admin policies to clients, proposals, itineraries, proposal_clients, proposal_options, and itinerary_bookings tables
    - Maintains existing user-level security while adding admin override
*/

-- First, create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN auth.email() IN ('tech@biirdee.com', 'var@biirdee.com', 'eric@biirdee.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies for clients table
CREATE POLICY "Admin can manage all clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Admin policies for proposals table  
CREATE POLICY "Admin can manage all proposals"
  ON proposals
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Admin policies for itineraries table
CREATE POLICY "Admin can manage all itineraries"
  ON itineraries
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Admin policies for proposal_clients table
CREATE POLICY "Admin can manage all proposal clients"
  ON proposal_clients
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Admin policies for proposal_options table
CREATE POLICY "Admin can manage all proposal options"
  ON proposal_options
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Admin policies for itinerary_bookings table
CREATE POLICY "Admin can manage all itinerary bookings"
  ON itinerary_bookings
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());
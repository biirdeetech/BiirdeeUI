/*
  # Create Required Database Functions

  1. Database Functions
    - `uid()` - Returns the current authenticated user ID
    - `is_biirdee_email()` - Validates email domain restriction
    - `update_updated_at_column()` - Trigger function for updated_at timestamps
    - `set_default_proposal_name()` - Auto-generates proposal names
    - `update_proposal_total()` - Updates proposal totals from options

  2. Security
    - Ensures RLS policies work correctly
    - Enables proper user isolation
    - Validates email domain restrictions

  This migration creates all the missing database functions that RLS policies depend on.
*/

-- Function to get current authenticated user ID
CREATE OR REPLACE FUNCTION uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid
  );
$$;

-- Function to check if email belongs to biirdee.com domain
CREATE OR REPLACE FUNCTION is_biirdee_email(email_address text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT email_address LIKE '%@biirdee.com';
$$;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to set default proposal name
CREATE OR REPLACE FUNCTION set_default_proposal_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set name if it's empty
  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := NEW.first_name || ' ' || NEW.last_name || ' - ' || to_char(NEW.created_at, 'Mon DD, YYYY');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to update proposal total from options
CREATE OR REPLACE FUNCTION update_proposal_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the proposal total_price based on visible options
  UPDATE proposals 
  SET total_price = COALESCE((
    SELECT SUM(selected_price)
    FROM proposal_options
    WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id)
    AND is_hidden = false
  ), 0)
  WHERE id = COALESCE(NEW.proposal_id, OLD.proposal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Test the functions work
DO $$
BEGIN
  -- Test uid() function
  IF uid() IS NOT NULL THEN
    RAISE NOTICE 'uid() function works: %', uid();
  ELSE 
    RAISE NOTICE 'uid() function returns NULL (expected if no auth user)';
  END IF;
  
  -- Test email validation
  IF is_biirdee_email('test@biirdee.com') = true THEN
    RAISE NOTICE 'is_biirdee_email() function works correctly';
  ELSE
    RAISE WARNING 'is_biirdee_email() function not working';
  END IF;
END $$;
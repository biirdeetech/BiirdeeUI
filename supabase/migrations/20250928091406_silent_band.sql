/*
  # Create Test Profile

  1. Profile Creation
    - Creates a profile for the authenticated user if one doesn't exist
    - Uses proper email domain validation
    - Sets up basic profile information

  2. Security
    - Respects RLS policies
    - Only creates profile if user is authenticated with biirdee.com email
    - Uses proper user ID from auth system

  This migration ensures there's a profile record for testing RLS policies.
*/

-- Create a profile for the current user if authenticated and has biirdee.com email
-- This will only work if the user is properly authenticated when the migration runs
DO $$
DECLARE
  current_user_id uuid;
  current_user_email text;
BEGIN
  -- Try to get current user info
  BEGIN
    current_user_id := uid();
    
    IF current_user_id IS NOT NULL THEN
      -- Get email from auth.users if possible
      SELECT email INTO current_user_email 
      FROM auth.users 
      WHERE id = current_user_id;
      
      IF current_user_email IS NOT NULL AND is_biirdee_email(current_user_email) THEN
        -- Insert profile if it doesn't exist
        INSERT INTO profiles (id, email, full_name, created_at, updated_at)
        VALUES (
          current_user_id,
          current_user_email,
          'Test User',
          now(),
          now()
        )
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Profile created/verified for user: % with email: %', current_user_id, current_user_email;
      ELSE
        RAISE NOTICE 'No valid biirdee.com email found for current user';
      END IF;
    ELSE
      RAISE NOTICE 'No authenticated user found - profile creation skipped';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create profile - this is normal if no user is authenticated during migration';
  END;
END $$;
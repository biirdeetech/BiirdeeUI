/*
  # Restrict authentication to Biirdee.com emails only

  1. Security Updates
    - Add email domain validation trigger
    - Update RLS policies to enforce domain restriction
    - Add function to validate Biirdee.com emails only

  2. Database Functions
    - Create email validation function
    - Update user creation trigger with domain check

  3. Row Level Security
    - Enforce email domain restrictions at database level
*/

-- Function to validate Biirdee.com email addresses
CREATE OR REPLACE FUNCTION public.is_biirdee_email(email_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if email ends with @biirdee.com
  RETURN email_address ILIKE '%@biirdee.com';
END;
$$;

-- Updated trigger function with email domain validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get the email from the new user
  user_email := NEW.email;
  
  -- Log the attempt
  RAISE LOG 'handle_new_user: Processing new user with ID % and email %', NEW.id, user_email;
  
  -- Check if email is from Biirdee.com domain
  IF NOT public.is_biirdee_email(user_email) THEN
    RAISE LOG 'handle_new_user: Rejecting user with non-Biirdee email: %', user_email;
    RAISE EXCEPTION 'Access restricted to Biirdee.com email addresses only';
  END IF;
  
  -- Log successful validation
  RAISE LOG 'handle_new_user: Email domain validated for: %', user_email;
  
  -- Create profile for valid Biirdee user
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      avatar_url,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      user_email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
      NEW.raw_user_meta_data->>'avatar_url',
      NOW(),
      NOW()
    );
    
    RAISE LOG 'handle_new_user: Successfully created profile for user %', NEW.id;
    
  EXCEPTION WHEN others THEN
    RAISE LOG 'handle_new_user: Failed to create profile for user %: %', NEW.id, SQLERRM;
    RAISE;
  END;
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Add RLS policy to enforce email domain at database level
DROP POLICY IF EXISTS "Biirdee email domain restriction" ON public.profiles;
CREATE POLICY "Biirdee email domain restriction"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_biirdee_email(email));

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_biirdee_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_biirdee_email(text) TO service_role;
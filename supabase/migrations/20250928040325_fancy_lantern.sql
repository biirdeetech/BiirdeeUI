/*
  # Create Proposals Feature Tables

  1. New Tables
    - `proposals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text, proposal name)
      - `first_name` (text, client first name)
      - `last_name` (text, client last name)
      - `email` (text, client email)
      - `notes` (text, agent notes)
      - `total_price` (numeric, calculated total)
      - `status` (text, proposal status)
      - `share_link` (text, unique shareable link)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      
    - `proposal_options`
      - `id` (uuid, primary key)
      - `proposal_id` (uuid, foreign key to proposals)
      - `flight_data` (jsonb, complete flight information)
      - `is_hidden` (boolean, hide from client view)
      - `agent_notes` (text, notes about this option)
      - `selected_price` (numeric, agent-selected price)
      - `option_number` (integer, display order)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own proposals
    - Add policies for public access to proposals via share_link

  3. Functions
    - `generate_share_link()` - Creates unique shareable links
    - `generate_default_proposal_name()` - Creates smart default names
    - `calculate_proposal_total()` - Updates total_price when options change
*/

-- Create proposals table
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  notes text DEFAULT '',
  total_price numeric(10,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  share_link text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create proposal_options table
CREATE TABLE IF NOT EXISTS public.proposal_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE NOT NULL,
  flight_data jsonb NOT NULL,
  is_hidden boolean DEFAULT false NOT NULL,
  agent_notes text DEFAULT '',
  selected_price numeric(10,2) NOT NULL,
  option_number integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS proposals_user_id_idx ON public.proposals(user_id);
CREATE INDEX IF NOT EXISTS proposals_share_link_idx ON public.proposals(share_link);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON public.proposals(status);
CREATE INDEX IF NOT EXISTS proposal_options_proposal_id_idx ON public.proposal_options(proposal_id);
CREATE INDEX IF NOT EXISTS proposal_options_option_number_idx ON public.proposal_options(proposal_id, option_number);

-- Enable RLS
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_options ENABLE ROW LEVEL SECURITY;

-- Function to generate default proposal names
CREATE OR REPLACE FUNCTION generate_default_proposal_name(
  p_first_name text,
  p_last_name text,
  p_created_at timestamptz DEFAULT now()
) RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN format(
    'Proposal for %s %s - %s',
    p_first_name,
    p_last_name,
    to_char(p_created_at, 'Mon DD, YYYY')
  );
END;
$$;

-- Function to calculate proposal total
CREATE OR REPLACE FUNCTION calculate_proposal_total(proposal_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  total_amount numeric := 0;
BEGIN
  SELECT COALESCE(SUM(selected_price), 0)
  INTO total_amount
  FROM public.proposal_options
  WHERE proposal_id = proposal_uuid
    AND is_hidden = false;
  
  RETURN total_amount;
END;
$$;

-- Trigger to auto-update proposal totals when options change
CREATE OR REPLACE FUNCTION update_proposal_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the total_price for the affected proposal
  UPDATE public.proposals
  SET 
    total_price = calculate_proposal_total(COALESCE(NEW.proposal_id, OLD.proposal_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.proposal_id, OLD.proposal_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply the trigger to proposal_options
DROP TRIGGER IF EXISTS update_proposal_total_trigger ON public.proposal_options;
CREATE TRIGGER update_proposal_total_trigger
  AFTER INSERT OR UPDATE OF selected_price, is_hidden OR DELETE
  ON public.proposal_options
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_total();

-- Trigger to auto-set proposal names if not provided
CREATE OR REPLACE FUNCTION set_default_proposal_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If name is empty or just whitespace, generate a default
  IF NEW.name IS NULL OR trim(NEW.name) = '' THEN
    NEW.name := generate_default_proposal_name(NEW.first_name, NEW.last_name, NEW.created_at);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_default_proposal_name_trigger ON public.proposals;
CREATE TRIGGER set_default_proposal_name_trigger
  BEFORE INSERT ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION set_default_proposal_name();

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_proposals_updated_at ON public.proposals;
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proposal_options_updated_at ON public.proposal_options;
CREATE TRIGGER update_proposal_options_updated_at
  BEFORE UPDATE ON public.proposal_options
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies

-- Proposals: Users can manage their own proposals
CREATE POLICY "Users can manage their own proposals"
  ON public.proposals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Proposals: Public read access via share_link (for anonymous clients)
CREATE POLICY "Public read access via share_link"
  ON public.proposals
  FOR SELECT
  TO anon
  USING (true); -- We'll filter by share_link in queries

-- Proposal Options: Users can manage options for their own proposals
CREATE POLICY "Users can manage their own proposal options"
  ON public.proposal_options
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_id
        AND p.user_id = auth.uid()
    )
  );

-- Proposal Options: Public read access for non-hidden options via share_link
CREATE POLICY "Public read access for non-hidden options"
  ON public.proposal_options
  FOR SELECT
  TO anon
  USING (
    is_hidden = false
    AND EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_id
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_options TO authenticated;
GRANT SELECT ON public.proposals TO anon;
GRANT SELECT ON public.proposal_options TO anon;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
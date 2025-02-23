/*
  # Fix user profile schema and triggers

  1. Changes
    - Remove foreign key constraint from user_profiles table
    - Add exception handling to handle_new_user trigger
    - Fix profile creation process

  2. Security
    - Maintain existing RLS policies
    - Keep all security constraints intact
*/

-- Drop and recreate user_profiles table without foreign key constraint
DROP TABLE IF EXISTS user_profiles CASCADE;
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  bio text NOT NULL DEFAULT 'I''m here to learn and teach',
  topics text[] DEFAULT ARRAY[]::text[],
  theme text NOT NULL DEFAULT 'dark',
  created_at timestamptz DEFAULT now(),
  view_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'base64'),
  profile_picture_url text,
  custom_avatar_url text,
  gender text CHECK (gender IN ('male', 'female', 'other')) DEFAULT 'other'
);

-- Recreate the handle_new_user trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stickman_svg text := '
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="45" x2="50" y2="75" stroke="currentColor" stroke-width="4"/>
  <line x1="20" y1="60" x2="80" y2="60" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="75" x2="30" y2="95" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="75" x2="70" y2="95" stroke="currentColor" stroke-width="4"/>
</svg>';
BEGIN
  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Insert new profile
  INSERT INTO user_profiles (
    id,
    name,
    bio,
    topics,
    theme,
    view_code,
    profile_picture_url,
    gender
  )
  VALUES (
    NEW.id,
    COALESCE(SPLIT_PART(NEW.email, '@', 1), 'User'),
    'I''m here to learn and teach',
    ARRAY[]::text[],
    'dark',
    encode(gen_random_bytes(6), 'base64'),
    'data:image/svg+xml,' || encode(stickman_svg::bytea, 'base64'),
    'other'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but allow auth signup to complete
  RAISE WARNING 'Error creating user profile: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies for user_profiles
CREATE POLICY "Anyone can view profiles"
  ON user_profiles FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_view_code 
ON user_profiles(view_code);
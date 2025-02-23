-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  sender text NOT NULL,
  created_at timestamptz DEFAULT now(),
  group_id uuid
);

-- Groups and members
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'New Group',
  description text DEFAULT '',
  topics text[] DEFAULT ARRAY[]::text[],
  max_members integer DEFAULT 100,
  invite_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'base64'),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  is_creator boolean NOT NULL DEFAULT false,
  PRIMARY KEY (group_id, user_id)
);

-- User profiles with all columns
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  topic text NOT NULL,
  jitsi_link text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_email(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION handle_group_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM messages WHERE group_id = OLD.id;
  DELETE FROM meetings WHERE group_id = OLD.id;
  DELETE FROM group_members WHERE group_id = OLD.id;
  RETURN OLD;
END;
$$;

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
  INSERT INTO public.user_profiles (
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
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Triggers
DROP TRIGGER IF EXISTS before_group_delete ON groups;
CREATE TRIGGER before_group_delete
  BEFORE DELETE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION handle_group_deletion();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Storage Policies
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Drop existing policies first
DROP POLICY IF EXISTS "Group members can read messages" ON messages;
DROP POLICY IF EXISTS "Group members can send messages" ON messages;
DROP POLICY IF EXISTS "Anyone can read group data" ON groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON groups;
DROP POLICY IF EXISTS "Group members can update group settings" ON groups;
DROP POLICY IF EXISTS "Group creators can delete groups" ON groups;
DROP POLICY IF EXISTS "Members can read group_members" ON group_members;
DROP POLICY IF EXISTS "Authenticated users can join groups" ON group_members;
DROP POLICY IF EXISTS "Anyone can view profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Group members can view meetings" ON meetings;
DROP POLICY IF EXISTS "Group members can create meetings" ON meetings;

-- Table Policies
CREATE POLICY "Group members can read messages"
  ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = messages.group_id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Group members can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = messages.group_id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Anyone can read group data"
  ON groups FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Group members can update group settings"
  ON groups FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = id
    AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Group creators can delete groups"
  ON groups FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = id
    AND user_id = auth.uid()
    AND is_creator = true
  ));

CREATE POLICY "Members can read group_members"
  ON group_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can join groups"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Group members can view meetings"
  ON meetings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = meetings.group_id
    AND user_id = auth.uid()
  ));

CREATE POLICY "Group members can create meetings"
  ON meetings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = meetings.group_id
    AND user_id = auth.uid()
  ));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_view_code 
ON user_profiles(view_code);

-- Enable realtime
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_email TO authenticated;
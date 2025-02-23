export interface Message {
  id: string;
  text: string;
  sender: string;
  displayName?: string;
  created_at: string;
  group_id: string;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthError {
  message: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  topics: string[];
  max_members: number;
  invite_code: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  users: {
    email: string;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  bio: string;
  topics: string[];
  created_at: string;
  view_code: string;
  profile_picture_url: string;
  custom_avatar_url?: string;
  gender: 'male' | 'female' | 'other';
}

export interface Meeting {
  id: string;
  group_id: string;
  topic: string;
  jitsi_link: string;
  scheduled_for: string;
  created_by: string;
  created_at: string;
}
import React, { useState, useEffect } from 'react';
import { Menu, Plus, Users, LogOut, UserCircle, X, Search } from 'lucide-react';
import { supabase, signOut, retryOperation } from '../lib/supabase';
import { Group, UserProfile } from '../types';
import { CreateGroupModal } from './CreateGroupModal';
import { Profile } from './Profile';
import { JoinGroupModal } from './JoinGroupModal';
import { FindPersonModal } from './FindPersonModal';

interface DashboardProps {
  userId: string;
  onGroupSelect: (groupId: string) => void;
}

export function Dashboard({ userId, onGroupSelect }: DashboardProps) {
  const [createdGroups, setCreatedGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFindPersonOpen, setIsFindPersonOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchGroups();
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const maxRetries = 3;
      let retryCount = 0;
      let profile = null;

      while (retryCount < maxRetries && !profile) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(); // Use maybeSingle instead of single to handle null case

        if (!error && data) {
          profile = data;
          break;
        }

        // If profile doesn't exist, create it
        if (retryCount === 0 && !data) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            const defaultProfile: Partial<UserProfile> = {
              id: userId,
              name: userData.user.email?.split('@')[0] || 'User',
              bio: "I'm here to learn and teach",
              topics: [],
              theme: 'dark',
              gender: 'other',
              profile_picture_url: `data:image/svg+xml,${encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                  <circle cx="50" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4"/>
                  <line x1="50" y1="45" x2="50" y2="75" stroke="currentColor" stroke-width="4"/>
                  <line x1="20" y1="60" x2="80" y2="60" stroke="currentColor" stroke-width="4"/>
                  <line x1="50" y1="75" x2="30" y2="95" stroke="currentColor" stroke-width="4"/>
                  <line x1="50" y1="75" x2="70" y2="95" stroke="currentColor" stroke-width="4"/>
                </svg>
              `)}`
            };

            const { data: newProfile, error: insertError } = await supabase
              .from('user_profiles')
              .insert([defaultProfile])
              .select()
              .single();

            if (!insertError && newProfile) {
              profile = newProfile;
              break;
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        retryCount++;
      }

      if (profile) {
        setProfile(profile);
        document.body.className = profile.theme || 'dark';
        setError(null);
      } else {
        throw new Error('Could not fetch or create profile');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile. Please refresh the page.');
    }
  };

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data: memberGroups, error: memberError } = await retryOperation(() =>
        supabase
          .from('group_members')
          .select('group_id, is_creator')
          .eq('user_id', userId)
      );

      if (memberError) throw memberError;

      const createdGroupIds = memberGroups
        .filter(mg => mg.is_creator)
        .map(mg => mg.group_id);

      const joinedGroupIds = memberGroups
        .filter(mg => !mg.is_creator)
        .map(mg => mg.group_id);

      if (createdGroupIds.length > 0) {
        const { data: createdGroupsData, error: createdGroupsError } = await retryOperation(() =>
          supabase
            .from('groups')
            .select('*')
            .in('id', createdGroupIds)
        );

        if (createdGroupsError) throw createdGroupsError;
        setCreatedGroups(createdGroupsData || []);
      } else {
        setCreatedGroups([]);
      }

      if (joinedGroupIds.length > 0) {
        const { data: joinedGroupsData, error: joinedGroupsError } = await retryOperation(() =>
          supabase
            .from('groups')
            .select('*')
            .in('id', joinedGroupIds)
        );

        if (joinedGroupsError) throw joinedGroupsError;
        setJoinedGroups(joinedGroupsData || []);
      } else {
        setJoinedGroups([]);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (name: string, description: string, topics: string[], maxMembers: number) => {
    const inviteCode = Array.from(Array(12), () => 
      Math.floor(Math.random() * 36).toString(36)
    ).join('');

    const { data: group, error: createError } = await supabase
      .from('groups')
      .insert([{ 
        name, 
        description, 
        topics, 
        invite_code: inviteCode,
        max_members: maxMembers
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating group:', createError);
      return;
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert([{ 
        group_id: group.id, 
        user_id: userId,
        is_creator: true 
      }]);

    if (memberError) {
      console.error('Error joining group:', memberError);
      return;
    }

    await fetchGroups();
    setIsCreateModalOpen(false);
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleCopyInviteCode = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode);
  };

  const renderGroupList = (groups: Group[], isCreated: boolean) => {
    if (groups.length === 0) {
      return (
        <div className="bg-white rounded-lg p-8 text-center relative overflow-hidden shadow-sm border border-gray-100">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-10" 
            style={{ 
              backgroundImage: isCreated 
                ? 'url(https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80)'
                : 'url(https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&q=80)'
            }}
          />
          <div className="relative z-10">
            <Users size={48} className="text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {isCreated ? 'No Created Groups' : 'No Joined Groups'}
            </h2>
            <p className="text-gray-600 mb-4">
              {isCreated 
                ? 'Create your first group to start collaborating!'
                : 'Join a group using an invite code to start learning together!'}
            </p>
            <button
              onClick={() => isCreated ? setIsCreateModalOpen(true) : setIsJoinModalOpen(true)}
              className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-all transform hover:scale-105 hover:shadow-lg"
            >
              {isCreated ? 'Create a Group' : 'Join a Group'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map(group => (
          <div
            key={group.id}
            onClick={() => onGroupSelect(group.id)}
            className="group bg-white rounded-lg overflow-hidden hover:shadow-xl transition-all transform hover:scale-[1.02] cursor-pointer border border-gray-100"
          >
            <div 
              className="h-32 bg-cover bg-center relative"
              style={{ 
                backgroundImage: `url(https://source.unsplash.com/featured/400x200/?${group.topics[0] || 'study'})` 
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
              <h3 className="absolute bottom-4 left-4 text-xl font-semibold text-white">{group.name}</h3>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4 line-clamp-2 h-12">{group.description}</p>
              {group.topics.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {group.topics.map((topic, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-pink-100 text-pink-600 text-sm rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Users size={16} />
                  <span>{group.max_members}</span>
                </div>
                {isCreated && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyInviteCode(group.invite_code);
                    }}
                    className="flex items-center gap-1 hover:text-pink-500 transition-colors"
                  >
                    <Plus size={16} />
                    <span>Copy Code</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const MenuDropdown = () => {
    if (!isMenuOpen) return null;

    return (
      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg overflow-hidden z-50 border border-gray-100">
        <button
          onClick={() => {
            setIsProfileOpen(true);
            setIsMenuOpen(false);
          }}
          className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <UserCircle size={20} />
          Profile
        </button>
        <button
          onClick={() => {
            setIsCreateModalOpen(true);
            setIsMenuOpen(false);
          }}
          className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Create Group
        </button>
        <button
          onClick={() => {
            setIsFindPersonOpen(true);
            setIsMenuOpen(false);
          }}
          className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Search size={20} />
          Find Person
        </button>
        <button
          onClick={handleSignOut}
          className="w-full px-4 py-3 text-left text-red-500 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-700">Loading your groups...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div 
        className="h-64 bg-cover bg-center relative"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80)' 
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-gray-50" />
        <div className="absolute inset-x-0 bottom-0 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="text-6xl">👋</div>
                <div className="ml-1">
                  <h1 className="text-3xl font-bold text-gray-800">
                    Welcome, {profile?.name || 'newcomer'}!
                  </h1>
                  <p className="text-gray-600 mt-1">Ready to learn and collaborate?</p>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {isMenuOpen ? (
                    <X size={24} className="text-gray-700" />
                  ) : (
                    <Menu size={24} className="text-gray-700" />
                  )}
                </button>
                <MenuDropdown />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12">
        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-8 border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-12">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Created Groups</h2>
            {renderGroupList(createdGroups, true)}
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Joined Groups</h2>
            {renderGroupList(joinedGroups, false)}
          </div>
        </div>
      </div>

      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateGroup}
      />

      <JoinGroupModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        userId={userId}
        onJoinSuccess={() => fetchGroups()}
      />

      <Profile
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={userId}
        userEmail={profile?.email || ''}
        onProfileUpdate={handleProfileUpdate}
      />

      <FindPersonModal
        isOpen={isFindPersonOpen}
        onClose={() => setIsFindPersonOpen(false)}
      />
    </div>
  );
}
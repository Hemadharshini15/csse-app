import React, { useState } from 'react';
import { X, Search, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, Group } from '../types';

interface FindPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FindPersonModal({ isOpen, onClose }: FindPersonModalProps) {
  const [viewCode, setViewCode] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProfile(null);
    setGroups([]);
    setLoading(true);

    try {
      // Find user profile by view code
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('view_code', viewCode)
        .single();

      if (profileError) throw new Error('User not found');
      setProfile(profileData);

      // Get user's groups
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', profileData.id);

      if (!memberError && memberData.length > 0) {
        const groupIds = memberData.map(m => m.group_id);
        const { data: groupsData } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);

        setGroups(groupsData || []);
      }
    } catch (err) {
      console.error('Error finding person:', err);
      setError(err instanceof Error ? err.message : 'Failed to find person');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-pink-400 to-pink-500">
          <h2 className="text-xl font-semibold text-white">Find a Person</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={viewCode}
                onChange={(e) => setViewCode(e.target.value)}
                placeholder="Enter view-me code"
                className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors flex items-center gap-2"
              >
                <Search size={20} />
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {error && (
            <div className="text-red-500 text-sm p-3 bg-red-50 rounded-lg mb-4">
              {error}
            </div>
          )}

          {profile && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <img
                  src={profile.profile_picture_url}
                  alt={profile.name}
                  className="w-20 h-20 rounded-full"
                />
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">{profile.name}</h3>
                  <p className="text-gray-600">{profile.bio}</p>
                </div>
              </div>

              {profile.topics.length > 0 && (
                <div>
                  <h4 className="text-gray-800 font-medium mb-2">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.topics.map((topic, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-pink-100 text-pink-600 text-sm rounded"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {groups.length > 0 && (
                <div>
                  <h4 className="text-gray-800 font-medium mb-2">Groups</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        className="bg-white p-4 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-gray-800 font-medium">{group.name}</h5>
                          <div className="flex items-center text-gray-500 text-sm">
                            <Users size={16} className="mr-1" />
                            {group.max_members}
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2">
                          {group.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
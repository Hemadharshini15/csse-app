import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Group, GroupMember } from '../types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onExitGroup?: () => void;
}

function Settings({ isOpen, onClose, groupId, onExitGroup }: SettingsProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [topics, setTopics] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchGroupData();
      fetchMembers();
    }
  }, [isOpen, groupId]);

  const fetchGroupData = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) {
      console.error('Error fetching group:', error);
      return;
    }

    setGroup(data);
    setTopics(data.topics.join(', '));

    // Check if current user is the creator
    const { data: memberData } = await supabase
      .from('group_members')
      .select('is_creator')
      .eq('group_id', groupId)
      .eq('user_id', userData.user.id)
      .single();

    setIsCreator(!!memberData?.is_creator);
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        user_id,
        joined_at,
        is_creator
      `)
      .eq('group_id', groupId);

    if (error) {
      console.error('Error fetching members:', error);
      return;
    }

    const membersWithEmails = await Promise.all(
      data.map(async (member) => {
        const { data: email } = await supabase
          .rpc('get_user_email', { user_id: member.user_id });
        return {
          ...member,
          users: { email: email || 'Unknown User' }
        };
      })
    );

    setMembers(membersWithEmails);
  };

  const handleSave = async () => {
    if (!group) return;
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('groups')
        .update({
          name: group.name,
          description: group.description,
          topics: topics.split(',').map(t => t.trim()).filter(t => t),
          max_members: group.max_members
        })
        .eq('id', groupId);

      if (error) throw error;
      onClose();
    } catch (err) {
      console.error('Error updating group:', err);
      setError('Failed to update group settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group || deleteConfirmName !== group.name) {
      setError('Please enter the exact group name to confirm deletion');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      onExitGroup?.();
      onClose();
    } catch (err) {
      console.error('Error deleting group:', err);
      setError('Failed to delete the group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-2xl bg-[#2B2D31] rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-[#1E1F22] flex items-center justify-between bg-gradient-to-r from-[#5865F2] to-[#7289DA] sticky top-0">
          <div className="flex items-center gap-3">
            <SettingsIcon className="text-white" size={24} />
            <h2 className="text-xl font-semibold text-white">Group Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-[#B9BBBE] mb-2">Name</label>
            <input
              type="text"
              value={group.name}
              onChange={(e) => setGroup({ ...group, name: e.target.value })}
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              disabled={!isCreator}
            />
          </div>

          <div>
            <label className="block text-[#B9BBBE] mb-2">Description</label>
            <textarea
              value={group.description}
              onChange={(e) => setGroup({ ...group, description: e.target.value })}
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2] h-24 resize-none"
              disabled={!isCreator}
            />
          </div>

          <div>
            <label className="block text-[#B9BBBE] mb-2">Topics (comma-separated)</label>
            <input
              type="text"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              disabled={!isCreator}
            />
          </div>

          <div>
            <label className="block text-[#B9BBBE] mb-2">Max Members</label>
            <input
              type="number"
              value={group.max_members}
              onChange={(e) => setGroup({ ...group, max_members: parseInt(e.target.value) })}
              min="1"
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              disabled={!isCreator}
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-[#B9BBBE]" />
              <label className="text-[#B9BBBE]">Members ({members.length}/{group.max_members})</label>
            </div>
            <div className="bg-[#383A40] rounded-lg p-4 max-h-48 overflow-y-auto">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-[#DCDDDE]">
                    {member.users.email}
                    {member.is_creator && (
                      <span className="ml-2 text-xs text-[#5865F2]">(Creator)</span>
                    )}
                  </span>
                  <span className="text-[#B9BBBE] text-sm">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-[#ED4245] text-sm p-3 bg-[#ED4245]/10 rounded-lg">
              {error}
            </div>
          )}

          {isCreator && (
            <div className="pt-6 border-t border-[#1E1F22]">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-3 bg-[#ED4245] text-white rounded-lg hover:bg-[#C03537] transition-colors flex items-center justify-center gap-2"
                disabled={loading}
              >
                <AlertTriangle size={20} />
                Delete Group
              </button>

              {showDeleteConfirm && (
                <div className="mt-4 p-4 bg-[#383A40] rounded-lg">
                  <h3 className="text-white font-semibold mb-2">Delete Group</h3>
                  <p className="text-[#B9BBBE] mb-4">
                    This action cannot be undone. Please type the group name to confirm deletion:
                  </p>
                  
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder={group.name}
                    className="w-full px-4 py-2 bg-[#2B2D31] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ED4245] mb-4"
                  />

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmName('');
                        setError(null);
                      }}
                      className="px-4 py-2 text-[#DCDDDE] hover:text-white transition-colors"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteGroup}
                      className="px-4 py-2 bg-[#ED4245] text-white rounded-lg hover:bg-[#C03537] transition-colors"
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Delete Group'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#1E1F22] flex justify-end gap-3 sticky bottom-0 bg-[#2B2D31]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#DCDDDE] hover:text-white transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          {isCreator && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;

export { Settings }
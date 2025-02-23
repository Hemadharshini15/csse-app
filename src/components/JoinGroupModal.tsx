import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onJoinSuccess: () => void;
}

export function JoinGroupModal({ isOpen, onClose, userId, onJoinSuccess }: JoinGroupModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Find the group with this invite code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();

      if (groupError) throw new Error('Invalid invite code');
      if (!group) throw new Error('Group not found');

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        throw new Error('You are already a member of this group');
      }

      // Get user's name from profile
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', userId)
        .single();

      const userName = userProfile?.name || 'Someone';

      // Join the group
      const { error: joinError } = await supabase
        .from('group_members')
        .insert([{
          group_id: group.id,
          user_id: userId,
          is_creator: false
        }]);

      if (joinError) throw joinError;

      // Send welcome message
      const welcomeMessage = `👋 ${userName} has joined the group. Say hi!`;
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          text: welcomeMessage,
          sender: 'system',
          group_id: group.id
        }]);

      if (messageError) {
        console.error('Error sending welcome message:', messageError);
      }

      onJoinSuccess();
      onClose();
    } catch (err) {
      console.error('Error joining group:', err);
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md bg-[#2B2D31] rounded-lg shadow-xl">
        <div className="p-4 border-b border-[#1E1F22] flex items-center justify-between bg-gradient-to-r from-[#5865F2] to-[#7289DA]">
          <h2 className="text-xl font-semibold text-white">Join Group</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[#B9BBBE] mb-2">Invite Code</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter 12-character invite code"
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              pattern="[a-zA-Z0-9]{12}"
              maxLength={12}
              required
            />
          </div>

          {error && (
            <div className="text-[#ED4245] text-sm p-3 bg-[#ED4245]/10 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[#DCDDDE] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
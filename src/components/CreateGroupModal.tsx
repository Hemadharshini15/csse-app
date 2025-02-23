import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, topics: string[], maxMembers: number) => void;
}

export function CreateGroupModal({ isOpen, onClose, onCreate }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topics, setTopics] = useState('');
  const [maxMembers, setMaxMembers] = useState(100);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    onCreate(
      name.trim(),
      description.trim(),
      topics.split(',').map(t => t.trim()).filter(Boolean),
      maxMembers
    );
    
    // Reset form
    setName('');
    setDescription('');
    setTopics('');
    setMaxMembers(100);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md bg-[#2B2D31] rounded-lg shadow-xl">
        <div className="p-4 border-b border-[#1E1F22] flex items-center justify-between bg-gradient-to-r from-[#5865F2] to-[#7289DA]">
          <h2 className="text-xl font-semibold text-white">Create New Group</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[#B9BBBE] mb-2">
              Group Name <span className="text-[#ED4245]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              required
              maxLength={50}
              placeholder="Enter group name"
            />
          </div>

          <div>
            <label className="block text-[#B9BBBE] mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2] h-24 resize-none"
              maxLength={500}
              placeholder="Enter group description"
            />
          </div>

          <div>
            <label className="block text-[#B9BBBE] mb-2">Topics (Optional, comma-separated)</label>
            <input
              type="text"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              placeholder="gaming, music, technology"
            />
          </div>

          <div>
            <label className="block text-[#B9BBBE] mb-2">Maximum Members</label>
            <input
              type="number"
              value={maxMembers}
              onChange={(e) => setMaxMembers(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-2 bg-[#383A40] text-[#DCDDDE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              min="1"
              max="1000"
              required
            />
            <p className="text-[#B9BBBE] text-sm mt-1">Minimum: 1, Maximum: 1000</p>
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
              className="px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
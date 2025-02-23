import React, { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Meeting } from '../types';
import { supabase } from '../lib/supabase';

interface MeetingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

export function MeetingsModal({ isOpen, onClose, groupId }: MeetingsModalProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchMeetings();
    }
  }, [isOpen, groupId]);

  const fetchMeetings = async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('group_id', groupId)
      .order('scheduled_for', { ascending: true });

    if (!error && data) {
      setMeetings(data);
    }
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-2xl bg-[#2B2D31] rounded-lg shadow-xl">
        <div className="p-4 border-b border-[#1E1F22] flex items-center justify-between bg-gradient-to-r from-[#5865F2] to-[#7289DA]">
          <h2 className="text-xl font-semibold text-white">All Meetings</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {meetings.length === 0 ? (
            <p className="text-center text-[#B9BBBE]">No meetings scheduled</p>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-[#383A40] p-4 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-white font-semibold mb-1">{meeting.topic}</h3>
                    <p className="text-[#B9BBBE] text-sm">
                      {formatDateTime(meeting.scheduled_for)}
                    </p>
                  </div>
                  <a
                    href={meeting.jitsi_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors"
                  >
                    <ExternalLink size={20} />
                    Join Meet
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
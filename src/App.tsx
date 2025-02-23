import React, { useState, useEffect } from 'react';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { Auth } from './components/Auth';
import { Settings } from './components/Settings';
import { Dashboard } from './components/Dashboard';
import { Message, UserProfile, Group } from './types';
import { MessageSquare, Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ScheduleMeetModal } from './components/ScheduleMeetModal';
import { MeetingsModal } from './components/MeetingsModal';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<Group | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScheduleMeetOpen, setIsScheduleMeetOpen] = useState(false);
  const [isMeetingsOpen, setIsMeetingsOpen] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkInviteLink();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkInviteLink();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkInviteLink = async () => {
    const path = window.location.pathname;
    if (path.startsWith('/invite/')) {
      const inviteCode = path.split('/invite/')[1];
      if (inviteCode) {
        await handleInviteCode(inviteCode);
      }
    }
  };

  const handleInviteCode = async (inviteCode: string) => {
    try {
      // Find the group with this invite code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();

      if (groupError) throw groupError;
      if (!group) throw new Error('Invalid invite code');

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', session?.user?.id)
        .single();

      if (existingMember) {
        setGroupId(group.id);
        // Update URL without the invite code
        window.history.replaceState({}, '', '/');
        return;
      }

      // Join the group
      const { error: joinError } = await supabase
        .from('group_members')
        .insert([{
          group_id: group.id,
          user_id: session?.user?.id,
          is_creator: false
        }]);

      if (joinError) throw joinError;

      // Update URL and navigate to the group
      window.history.replaceState({}, '', '/');
      setGroupId(group.id);
    } catch (err) {
      console.error('Error handling invite:', err);
      setError('Invalid or expired invite link');
      window.history.replaceState({}, '', '/');
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchMessages();
      fetchGroupInfo();
      subscribeToMessages();
    } else {
      setGroupInfo(null);
    }
  }, [groupId]);

  useEffect(() => {
    if (messages.length > 0) {
      const userIds = [...new Set(messages
        .filter(m => m.sender !== 'system')
        .map(m => m.sender)
      )];
      if (userIds.length > 0) {
        fetchUserProfiles(userIds);
      }
    }
  }, [messages]);

  const fetchGroupInfo = async () => {
    if (!groupId) return;

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) {
      console.error('Error fetching group info:', error);
      return;
    }

    setGroupInfo(data);
  };

  const fetchUserProfiles = async (userIds: string[]) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds);

    if (error) {
      console.error('Error fetching user profiles:', error);
      return;
    }

    if (data) {
      const profiles = data.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, UserProfile>);
      setUserProfiles(prev => ({ ...prev, ...profiles }));
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((current) => [...current, newMessage]);
          if (!userProfiles[newMessage.sender]) {
            fetchUserProfiles([newMessage.sender]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (text: string) => {
    if (!session?.user || !groupId) return;

    const { error } = await supabase.from('messages').insert([
      {
        text,
        sender: session.user.id,
        group_id: groupId,
      },
    ]);

    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleScheduleMeet = async (topic: string, scheduledFor: Date) => {
    if (!session?.user || !groupId) return;

    const jitsiLink = `https://meet.jit.si/${topic}_${Math.random().toString(36).substring(2, 32)}`;

    const { error: meetingError } = await supabase
      .from('meetings')
      .insert([{
        group_id: groupId,
        topic,
        jitsi_link: jitsiLink,
        scheduled_for: scheduledFor.toISOString(),
        created_by: session.user.id
      }]);

    if (meetingError) {
      console.error('Error creating meeting:', meetingError);
      return;
    }

    const messageText = `New meeting scheduled: "${topic}" on ${scheduledFor.toLocaleString()}\nJoin here: <a href="${jitsiLink}" target="_blank" class="text-[#5865F2] hover:underline">Join Meeting</a>`;

    const { error: messageError } = await supabase
      .from('messages')
      .insert([{
        text: messageText,
        sender: 'system',
        group_id: groupId
      }]);

    if (messageError) {
      console.error('Error sending meeting message:', messageError);
    }

    setIsScheduleMeetOpen(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Auth onAuthSuccess={() => {}} />
      </div>
    );
  }

  if (!groupId) {
    return (
      <Dashboard
        userId={session.user.id}
        onGroupSelect={setGroupId}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-pink-400 to-pink-500">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGroupId(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <MessageSquare className="text-white" size={24} />
          <h1 className="text-xl font-semibold text-white">{groupInfo?.name || 'Loading...'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <SettingsIcon size={20} className="text-white" />
          </button>
        </div>
      </div>
      
      <MessageList 
        messages={messages} 
        currentUser={session.user.id} 
        userProfiles={userProfiles}
      />
      <MessageInput 
        onSendMessage={handleSendMessage}
        onScheduleMeet={() => setIsScheduleMeetOpen(true)}
      />

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        groupId={groupId}
        onExitGroup={() => setGroupId(null)}
      />

      <ScheduleMeetModal
        isOpen={isScheduleMeetOpen}
        onClose={() => setIsScheduleMeetOpen(false)}
        onSchedule={handleScheduleMeet}
      />

      <MeetingsModal
        isOpen={isMeetingsOpen}
        onClose={() => setIsMeetingsOpen(false)}
        groupId={groupId}
      />
    </div>
  );
}

export default App;
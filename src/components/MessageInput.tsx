import React, { useState } from 'react';
import { Send, Video } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onScheduleMeet: () => void;
}

export function MessageInput({ onSendMessage, onScheduleMeet }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#5865F2] border-none"
        />
        <button
          type="button"
          onClick={onScheduleMeet}
          className="p-3 rounded-lg bg-[#5865F2] text-white hover:bg-[#4752C4] transition-colors"
        >
          <Video size={20} />
        </button>
        <button
          type="submit"
          className="p-3 rounded-lg bg-[#5865F2] text-white hover:bg-[#4752C4] transition-colors"
        >
          <Send size={20} />
        </button>
      </div>
    </form>
  );
}
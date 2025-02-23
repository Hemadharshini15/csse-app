import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';

interface ScheduleMeetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (topic: string, scheduledFor: Date) => void;
}

export function ScheduleMeetModal({ isOpen, onClose, onSchedule }: ScheduleMeetModalProps) {
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const scheduledFor = new Date(`${date}T${time}`);
    const now = new Date();

    if (scheduledFor <= now) {
      alert('Please select a future date and time');
      return;
    }

    onSchedule(topic, scheduledFor);
    setTopic('');
    setDate('');
    setTime('');
  };

  // Get current date and time
  const now = new Date();
  const minDate = now.toISOString().split('T')[0];
  
  // Round current time to next 15 minutes
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(minutes);
  now.setSeconds(0);
  const minTime = now.toTimeString().slice(0, 5);

  // Generate time options in 15-minute increments
  const generateTimeOptions = () => {
    const options = [];
    const today = date === minDate;
    let hour = 0;
    let minute = 0;

    while (hour < 24) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      if (!today || timeString >= minTime) {
        options.push(timeString);
      }
      minute += 15;
      if (minute === 60) {
        minute = 0;
        hour += 1;
      }
    }
    return options;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md bg-[#2B2D31] rounded-lg shadow-xl">
        <div className="p-4 border-b border-[#1E1F22] flex items-center justify-between bg-gradient-to-r from-[#5865F2] to-[#7289DA]">
          <h2 className="text-xl font-semibold text-white">Schedule a Meet</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[#B9BBBE] mb-2">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-2 bg-[#383A40] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
              required
            />
          </div>

          <div>
            <label className="block text-[#B9BBBE] mb-2">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 text-[#B9BBBE]" size={20} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minDate}
                className="w-full pl-11 pr-4 py-2 bg-[#383A40] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[#B9BBBE] mb-2">Time</label>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 text-[#B9BBBE]" size={20} />
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full pl-11 pr-4 py-2 bg-[#383A40] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5865F2] appearance-none"
                required
              >
                <option value="">Select time</option>
                {generateTimeOptions().map((timeOption) => (
                  <option key={timeOption} value={timeOption}>
                    {timeOption}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
              Schedule Meet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
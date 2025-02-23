import React, { useState, useEffect, useRef } from 'react';
import { UserCircle, X, Copy, Check, Camera, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface ProfileProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  onProfileUpdate?: (profile: UserProfile) => void;
}

const STICKMAN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="45" x2="50" y2="75" stroke="currentColor" stroke-width="4"/>
  <line x1="20" y1="60" x2="80" y2="60" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="75" x2="30" y2="95" stroke="currentColor" stroke-width="4"/>
  <line x1="50" y1="75" x2="70" y2="95" stroke="currentColor" stroke-width="4"/>
</svg>
`;

export function Profile({ isOpen, onClose, userId, userEmail, onProfileUpdate }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfile>({
    id: userId,
    name: userEmail.split('@')[0],
    bio: "I'm here to learn and teach",
    topics: [],
    created_at: new Date().toISOString(),
    view_code: '',
    profile_picture_url: `data:image/svg+xml,${encodeURIComponent(STICKMAN_SVG)}`,
    gender: 'other'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchProfile();
  }, [isOpen, userId]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          name: profile.name,
          bio: profile.bio,
          topics: profile.topics,
          gender: profile.gender,
          profile_picture_url: profile.custom_avatar_url || 
            `data:image/svg+xml,${encodeURIComponent(STICKMAN_SVG)}`,
          custom_avatar_url: profile.custom_avatar_url
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onProfileUpdate?.(data);
      }
      onClose();
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyViewCode = () => {
    navigator.clipboard.writeText(profile.view_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed');
      return;
    }

    try {
      // Create a canvas to resize the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = async () => {
        // Set canvas dimensions to 1000x1000
        canvas.width = 1000;
        canvas.height = 1000;

        if (ctx) {
          // Calculate dimensions to maintain aspect ratio and center the image
          const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;

          // Fill with white background
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the image centered and scaled
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          // Convert to blob
          canvas.toBlob(async (blob) => {
            if (blob) {
              const fileName = `${userId}-${Date.now()}.jpg`;
              const { data, error } = await supabase.storage
                .from('avatars')
                .upload(fileName, blob, {
                  contentType: 'image/jpeg',
                  upsert: true
                });

              if (error) throw error;

              const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

              setProfile(prev => ({
                ...prev,
                custom_avatar_url: publicUrl,
                profile_picture_url: publicUrl
              }));
            }
          }, 'image/jpeg', 0.9);
        }
      };

      img.src = URL.createObjectURL(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const handleRemoveCustomAvatar = () => {
    setProfile(prev => ({
      ...prev,
      custom_avatar_url: undefined,
      profile_picture_url: `data:image/svg+xml,${encodeURIComponent(STICKMAN_SVG)}`
    }));
  };

  const handleGenderChange = (newGender: UserProfile['gender']) => {
    setProfile(prev => ({ ...prev, gender: newGender }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-pink-400 to-pink-500">
          <div className="flex items-center gap-3">
            <UserCircle className="text-white" size={24} />
            <h2 className="text-xl font-semibold text-white">Your Profile</h2>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto border border-gray-100">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                    {profile.custom_avatar_url ? (
                      <img
                        src={profile.custom_avatar_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 text-gray-400" dangerouslySetInnerHTML={{ __html: STICKMAN_SVG }} />
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="absolute -bottom-2 -right-2 flex gap-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
                      title="Upload custom photo"
                    >
                      <Camera size={16} />
                    </button>
                    {profile.custom_avatar_url && (
                      <button
                        onClick={handleRemoveCustomAvatar}
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        title="Remove custom photo"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{profile.name}</h3>
                  <p className="text-gray-500 text-sm">Member since {new Date(profile.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-gray-700">Gender</label>
                <div className="flex gap-4">
                  {(['male', 'female', 'other'] as const).map((gender) => (
                    <button
                      key={gender}
                      onClick={() => handleGenderChange(gender)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        profile.gender === gender
                          ? 'bg-pink-500 text-white border-pink-500'
                          : 'border-gray-200 text-gray-600 hover:border-pink-500'
                      }`}
                    >
                      {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500 h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Topics of Interest</label>
                <input
                  type="text"
                  value={profile.topics.join(', ')}
                  onChange={(e) => setProfile({
                    ...profile,
                    topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="gaming, music, technology"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Your View-Me Code</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={profile.view_code}
                    readOnly
                    className="flex-1 px-4 py-2 rounded-lg border bg-gray-50"
                  />
                  <button
                    onClick={handleCopyViewCode}
                    className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  Share this code with others so they can find and view your profile
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
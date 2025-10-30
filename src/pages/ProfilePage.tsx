import React, { useState, useEffect } from 'react';
import { User, Save, ArrowLeft, Mail, Calendar, Camera } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';

const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || ''
      });
    }
  }, [profile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/sign-in');
    }
  }, [user, loading, navigate]);

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {

      console.log('💾 Saving profile for user:', user.id);
      console.log('💾 Profile data to save:', formData);
      
      console.log('🔍 Making profile update query...');
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;

      console.log('✅ Profile saved successfully');
      await refreshProfile();
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      console.error('❌ Profile save error details:', JSON.stringify(error, null, 2));
      
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === '42501' || error.message?.includes('permission denied') || 
            error.message?.includes('RLS') || error.message?.includes('policy')) {
          alert('Database permission issue: Unable to save profile changes. Please contact support.');
        } else {
          alert(`Failed to update profile: ${error.message || 'Unknown error'}`);
        }
      } else {
        alert('Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || ''
      });
    }
    setEditing(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading profile...</p>
          
          {/* Emergency escape hatch */}
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-sm text-gray-500 hover:text-gray-300 underline"
          >
            Skip to Home Page
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // If user exists but no profile, show a creation form or basic info
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="px-4 sm:px-6 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <User className="h-12 w-12 text-accent-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Welcome!</h2>
              <p className="text-gray-300 mb-4">
                Your account is set up. You can start using the application.
              </p>
              <div className="bg-gray-850 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Signed in as:</p>
                <p className="text-white font-medium">{user.email}</p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="mt-6 bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Go to Flight Search
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <User className="h-6 w-6 text-accent-400" />
            <h1 className="text-2xl font-bold text-white">Profile</h1>
          </div>
          <p className="text-gray-400">Manage your account settings</p>
        </div>
        
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-lg">
            {/* Profile Header */}
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="w-20 h-20 rounded-full"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-accent-600 rounded-full flex items-center justify-center">
                      <User className="h-10 w-10 text-white" />
                    </div>
                  )}
                  {editing && (
                    <button className="absolute bottom-0 right-0 bg-accent-600 hover:bg-accent-700 text-white p-1.5 rounded-full transition-colors">
                      <Camera className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white">
                    {profile.full_name || 'User'}
                  </h2>
                  <p className="text-gray-400">{profile.email}</p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    Member since {formatDate(profile.created_at)}
                  </div>
                </div>
                <div>
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-success-600 hover:bg-success-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Details */}
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-accent-500"
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <div className="bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-white">
                      {profile.full_name || 'Not set'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Role
                  </label>
                  <div className="bg-gray-850 border border-gray-700 rounded-lg px-3 py-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      profile.role === 'admin' 
                        ? 'bg-accent-500 text-white' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {profile.role === 'admin' ? 'Administrator' : 'Agent'}
                    </span>
                    {profile.role === 'admin' && (
                      <span className="ml-2 text-sm text-gray-400">
                        Full system access
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </label>
                  <div className="bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-gray-400">
                    {profile.email}
                    <span className="text-xs ml-2">(Cannot be changed)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Account Details
                  </label>
                  <div className="bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Created:</span>
                      <span className="text-white">{formatDate(profile.created_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Last updated:</span>
                      <span className="text-white">{formatDate(profile.updated_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">User ID:</span>
                      <span className="text-white font-mono text-xs">{profile.id}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
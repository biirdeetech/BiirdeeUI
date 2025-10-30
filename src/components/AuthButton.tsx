import React, { useState } from 'react';
import { LogIn, LogOut, User, ChevronDown, FileText, Route } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const AuthButton: React.FC = () => {
  const { user, signInWithGoogle, signOut, loading, profile } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  
  const isAdmin = profile?.role === 'admin';

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowDropdown(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const goToProfile = () => {
    navigate('/profile');
    setShowDropdown(false);
  };

  if (loading) {
    return (
      <div className="w-8 h-8 bg-gray-700 animate-pulse rounded-full"></div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
      >
        <LogIn className="h-4 w-4" />
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-medium transition-colors"
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Profile"
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 bg-accent-600 rounded-full flex items-center justify-center">
            <User className="h-3 w-3 text-white" />
          </div>
        )}
        <span className="hidden sm:block">
          {profile?.full_name || user.email?.split('@')[0] || 'User'}
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-48">
          <div className="p-3 border-b border-gray-700">
            <div className="text-white font-medium">
              {profile?.full_name || 'User'}
              {isAdmin && (
                <span className="ml-2 bg-accent-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  ADMIN
                </span>
              )}
            </div>
            <div className="text-gray-400 text-sm">
              {user.email}
            </div>
          </div>
          
          <div className="py-2">
            <button
              onClick={goToProfile}
              className="w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Profile
            </button>
            
            {isAdmin && (
              <button
                onClick={() => {
                  navigate('/admin/routes');
                  setShowDropdown(false);
                }}
                className="w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Route className="h-4 w-4" />
                Admin Routes
              </button>
            )}
            
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthButton;
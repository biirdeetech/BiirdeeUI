import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, LogIn, Shield, Users, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Navigation from '../components/Navigation';

const SignInPage: React.FC = () => {
  const { user, signInWithGoogle, loading, clearAllAuthData } = useAuth();
  const navigate = useNavigate();

  // Redirect if already signed in (but allow access to sign-in page for everyone)
  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async () => {
    try {
      console.log('🔐 Initiating Google sign-in...');
      await signInWithGoogle();
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      alert('Sign-in failed. Please try again.');
    }
  };

  const handleClearData = async () => {
    if (confirm('This will clear all stored authentication data and refresh the page. Continue?')) {
      try {
        console.log('🧹 Emergency data clear initiated...');
        await clearAllAuthData();
        
        // Additional nuclear cleanup for stuck states
        try {
          // Clear all storage completely
          localStorage.clear();
          sessionStorage.clear();
          
          // Clear indexed DB if it exists
          if ('indexedDB' in window) {
            indexedDB.deleteDatabase('supabase-auth-token');
          }
          
          console.log('✅ Nuclear cleanup completed');
        } catch (cleanupError) {
          console.warn('⚠️ Additional cleanup failed:', cleanupError);
        }
        
      } catch (error) {
        console.error('❌ Emergency clear failed:', error);
      }
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
            <p className="text-gray-300">Loading...</p>
            
            {/* Emergency reset button for stuck users */}
            <button
              onClick={handleClearData}
              className="mt-4 text-sm text-gray-500 hover:text-gray-300 underline"
            >
              Stuck? Click here to reset
            </button>
            
            {/* Debug/Reset option */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <button
                onClick={handleClearData}
                className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Having trouble? Clear all data and reset
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't redirect away from sign-in page - let anyone access it
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="flex items-center justify-center px-4 sm:px-6 py-24">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="bg-accent-600 p-3 rounded-lg">
                <Plane className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-neutral-100">Biirdee Pro</h1>
                <p className="text-sm text-gray-400">Advanced Flight Search</p>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Sign in to continue
            </h2>
            <p className="text-gray-400">
              Access advanced flight search tools and proposal management
            </p>
          </div>

          {/* Sign In Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="space-y-6">
              {/* Features List */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="bg-success-600 p-1.5 rounded">
                    <Search className="h-3 w-3 text-white" />
                  </div>
                  Advanced flight search with ITA Matrix integration
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="bg-blue-600 p-1.5 rounded">
                    <Shield className="h-3 w-3 text-white" />
                  </div>
                  Fake round trip and skiplag strategies
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="bg-accent-600 p-1.5 rounded">
                    <Users className="h-3 w-3 text-white" />
                  </div>
                  Client proposal and quote management
                </div>
              </div>

              {/* Domain Restriction Notice */}
              <div className="bg-accent-500/10 border border-accent-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-accent-400" />
                  <span className="text-sm font-medium text-accent-400">Restricted Access</span>
                </div>
                <p className="text-xs text-gray-300">
                  This application is restricted to users with @biirdee.com email addresses only.
                </p>
              </div>

              {/* Sign In Button */}
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="h-4 w-4" />
                Sign in with Google
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to use this tool responsibly and in accordance with airline terms of service.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignInPage;
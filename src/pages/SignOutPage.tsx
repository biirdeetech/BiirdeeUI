import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Navigation from '../components/Navigation';

const SignOutPage: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto sign out if user is logged in
    if (!loading && user && !signingOut && !signedOut) {
      handleSignOut();
    }
  }, [user, loading, signingOut, signedOut]);

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);
    
    try {
      console.log('🚪 Signing out user...');
      await signOut();
      console.log('✅ Sign out successful');
      setSignedOut(true);
      
      // Redirect to sign-in page after a brief delay
      setTimeout(() => {
        navigate('/sign-in');
      }, 2000);
    } catch (err) {
      console.error('❌ Sign out failed:', err);
      setError('Failed to sign out. Please try again.');
      setSigningOut(false);
    }
  };

  const handleManualSignOut = () => {
    if (!signingOut) {
      handleSignOut();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <Loader className="h-8 w-8 text-accent-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-300">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Already signed out state
  if (!user && !signingOut) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="flex items-center justify-center px-4 sm:px-6 py-24">
          <div className="max-w-md w-full text-center">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
              <CheckCircle className="h-12 w-12 text-success-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Already signed out
              </h2>
              <p className="text-gray-400 mb-6">
                You are not currently signed in.
              </p>
              <button
                onClick={() => navigate('/sign-in')}
                className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Signing out state
  if (signingOut) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="flex items-center justify-center px-4 sm:px-6 py-24">
          <div className="max-w-md w-full text-center">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
              <Loader className="h-12 w-12 text-accent-400 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Signing out...
              </h2>
              <p className="text-gray-400">
                Please wait while we sign you out securely.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Successfully signed out state
  if (signedOut) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="flex items-center justify-center px-4 sm:px-6 py-24">
          <div className="max-w-md w-full text-center">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
              <CheckCircle className="h-12 w-12 text-success-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Signed out successfully
              </h2>
              <p className="text-gray-400 mb-6">
                You have been signed out of your account. Redirecting to sign in...
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader className="h-4 w-4 animate-spin" />
                Redirecting...
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Signed in state - show manual sign out option
  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />
      <main className="flex items-center justify-center px-4 sm:px-6 py-24">
        <div className="max-w-md w-full text-center">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <LogOut className="h-12 w-12 text-accent-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Sign out of your account
            </h2>
            <p className="text-gray-400 mb-6">
              Are you sure you want to sign out? You'll need to sign in again to access your account.
            </p>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSignOut}
                disabled={signingOut}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignOutPage;
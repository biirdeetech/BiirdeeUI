import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plane, FileText, Search, Users, Map, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import AuthButton from './AuthButton';

const Navigation: React.FC = () => {
  const { user, profile, isDevMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = profile?.role === 'admin';

  // Navigation items for authenticated users
  const authenticatedNavItems = [
    { path: '/', label: 'Search', icon: Search },
    { path: '/proposals', label: 'Proposals', icon: FileText },
    { path: '/clients', label: 'Clients', icon: Users },
    { path: '/itineraries', label: 'Itineraries', icon: Map },
  ];

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors duration-200">
      <div className="w-full px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button
            onClick={() => navigate(user ? '/' : '/sign-in')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="bg-accent-600 p-2 rounded-lg">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Biirdee Pro</h1>
                {isDevMode && (
                  <span className="bg-yellow-500 text-black px-2 py-0.5 rounded text-xs font-bold">
                    DEV
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Flight Search & Proposals</p>
            </div>
          </button>

          {/* Navigation Links */}
          <div className="flex items-center space-x-8">
            {user && authenticatedNavItems.map((item) => {
              const Icon = item.icon; 
              const isActive = location.pathname === item.path ||
                (item.path === '/' && location.pathname === '/search');

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {isAdmin && (item.path === '/proposals' || item.path === '/clients' || item.path === '/itineraries') && (
                    <span className="bg-accent-500 text-white px-1.5 py-0.5 rounded-full text-xs font-medium">
                      ALL
                    </span>
                  )}
                </button>
              );
            })}
            
            {/* Sign Out Link - visible to all users */}
            {/* Emergency Reset - always visible for stuck users */}
            {!user && (
              <button
                onClick={() => {
                  if (confirm('Clear all data and reset the app? This will sign you out and clear all stored data.')) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/sign-in';
                  }
                }}
                className="text-xs text-gray-500 hover:text-gray-300 underline"
              >
                Reset App
              </button>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Auth Button */}
          <AuthButton />
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { NotificationProvider } from './hooks/useNotification';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import HacksPage from './pages/HacksPage';
import ProfilePage from './pages/ProfilePage';
import ProposalsPage from './pages/ProposalsPage';
import SignInPage from './pages/SignInPage';
import SignOutPage from './pages/SignOutPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailsPage from './pages/ClientDetailsPage';
import ProposalDetailPage from './pages/ProposalDetailPage';
import PublicProposalPage from './pages/PublicProposalPage';
import ItinerariesPage from './pages/ItinerariesPage';
import ItineraryBuilderPage from './pages/ItineraryBuilderPage';
import PublicItineraryPage from './pages/PublicItineraryPage';
import AdminRoutesPage from './pages/AdminRoutesPage';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-4">Something went wrong</h2>
            <p className="text-gray-400 mb-4">Please refresh the page and try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/hacks" element={<HacksPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/proposals" element={<ProposalsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:clientId" element={<ClientDetailsPage />} />
              <Route path="/proposals/:proposalId" element={<ProposalDetailPage />} />
              <Route path="/itineraries" element={<ItinerariesPage />} />
              <Route path="/itineraries/builder" element={<ItineraryBuilderPage />} />
              <Route path="/itinerary/:shareLink" element={<PublicItineraryPage />} />
              <Route path="/admin/routes" element={<AdminRoutesPage />} />
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/sign-out" element={<SignOutPage />} />
              <Route path="/proposal/:shareLink" element={<PublicProposalPage />} />
              {/* Catch all - redirect to sign-in */}
              <Route path="*" element={<Navigate to="/sign-in" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;
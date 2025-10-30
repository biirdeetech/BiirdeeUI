import React from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Search, Zap, Target, Globe, ArrowRight, Sparkles, TrendingUp, Shield, Star, CloudLightning as Lightning, Rocket } from 'lucide-react';
import SearchForm from '../components/SearchForm';
import Navigation from '../components/Navigation';
import DatabaseTest from '../components/DatabaseTest';
import { useAuth } from '../hooks/useAuth';

const HomePage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/sign-in');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
            <p className="text-gray-300">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large floating orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-r from-accent-600/20 to-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-20 right-10 w-80 h-80 bg-gradient-to-r from-blue-600/15 to-cyan-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-1/4 w-72 h-72 bg-gradient-to-r from-purple-600/15 to-pink-500/15 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-gradient-to-r from-indigo-600/20 to-violet-500/20 rounded-full blur-3xl animate-pulse delay-3000"></div>
        
        {/* Floating particles */}
        <div className="absolute top-32 left-1/3 w-3 h-3 bg-gradient-to-r from-accent-400 to-orange-400 rounded-full animate-ping delay-500 shadow-lg shadow-accent-400/50"></div>
        <div className="absolute top-48 right-1/3 w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-ping delay-1000 shadow-lg shadow-blue-400/50"></div>
        <div className="absolute bottom-32 left-1/2 w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-ping delay-1500 shadow-lg shadow-purple-400/50"></div>
        <div className="absolute top-64 left-2/3 w-1.5 h-1.5 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-ping delay-2000"></div>
        <div className="absolute bottom-48 right-1/4 w-2 h-2 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full animate-ping delay-2500"></div>
        
        {/* Animated grid pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        
        {/* Moving light beams */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-400/50 to-transparent animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-20">
          {/* Logo Animation */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="relative">
              {/* Pulsing glow rings */}
              <div className="absolute inset-0 bg-gradient-to-r from-accent-600 to-orange-500 rounded-2xl blur-xl opacity-60 animate-pulse"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-accent-600 to-orange-500 rounded-2xl blur-2xl opacity-40 animate-pulse delay-500 scale-110"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-accent-600 to-orange-500 rounded-2xl blur-3xl opacity-20 animate-pulse delay-1000 scale-125"></div>
              
              <div className="relative bg-gradient-to-r from-accent-600 via-orange-500 to-accent-700 p-6 rounded-2xl shadow-2xl transform hover:scale-110 hover:rotate-3 transition-all duration-500 group">
                <Plane className="h-10 w-10 text-white group-hover:animate-bounce" />
                
                {/* Orbiting elements */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full animate-spin" style={{animation: 'orbit 3s linear infinite'}}></div>
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-spin" style={{animation: 'orbit 4s linear infinite reverse'}}></div>
              </div>
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-accent-200 to-accent-400 bg-clip-text text-transparent animate-pulse">
                Biirdee Pro
              </h1>
              <p className="text-accent-400 font-semibold tracking-wider text-lg bg-gradient-to-r from-accent-400 to-orange-400 bg-clip-text text-transparent">
                Advanced Flight Search & Routing
              </p>
            </div>
          </div>
          
          <div className="space-y-8 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-200 bg-clip-text text-transparent drop-shadow-lg">
                Find Premium Flight Deals
              </span>
              <br />
              <span className="bg-gradient-to-r from-accent-400 via-orange-500 to-red-500 bg-clip-text text-transparent animate-pulse">
                with Advanced Strategies
              </span>
          </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Discover <span className="text-accent-400 font-bold bg-accent-500/20 px-2 py-1 rounded">hidden city tickets</span>, 
              <span className="text-blue-400 font-bold bg-blue-500/20 px-2 py-1 rounded"> fake round trips</span>, and 
              <span className="text-purple-400 font-bold bg-purple-500/20 px-2 py-1 rounded"> premium routing strategies</span> 
              that travel hackers use to save thousands on flights.
            </p>
            
            {/* Enhanced Animated Stats */}
            <div className="flex items-center justify-center gap-12 mt-12">
              <div className="text-center group cursor-pointer">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-accent-500 to-orange-500 rounded-lg blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                  <div className="relative text-3xl font-bold bg-gradient-to-r from-accent-400 to-orange-400 bg-clip-text text-transparent group-hover:scale-125 transition-transform duration-500">$50K+</div>
                </div>
                <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Client Savings</div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-accent-400 to-orange-400 mx-auto mt-2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className="w-px h-12 bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>
              <div className="text-center group cursor-pointer">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                  <div className="relative text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent group-hover:scale-125 transition-transform duration-500">500+</div>
                </div>
                <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Routes Found</div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 mx-auto mt-2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className="w-px h-12 bg-gradient-to-b from-transparent via-gray-600 to-transparent"></div>
              <div className="text-center group cursor-pointer">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                  <div className="relative text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent group-hover:scale-125 transition-transform duration-500">98%</div>
                </div>
                <div className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Success Rate</div>
                <div className="w-8 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400 mx-auto mt-2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>

            {/* Floating achievement badges */}
            <div className="flex items-center justify-center gap-6 mt-12">
              <div className="group flex items-center gap-2 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-full px-4 py-2 hover:from-yellow-500/20 hover:to-amber-500/20 transition-all duration-300">
                <Star className="h-4 w-4 text-yellow-400 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-sm font-medium text-yellow-400">Award Winning</span>
              </div>
              <div className="group flex items-center gap-2 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-full px-4 py-2 hover:from-green-500/20 hover:to-emerald-500/20 transition-all duration-300">
                <Lightning className="h-4 w-4 text-green-400 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-sm font-medium text-green-400">Lightning Fast</span>
              </div>
              <div className="group flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-full px-4 py-2 hover:from-blue-500/20 hover:to-indigo-500/20 transition-all duration-300">
                <Rocket className="h-4 w-4 text-blue-400 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
                <span className="text-sm font-medium text-blue-400">Next Generation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Form */}
        <div className="mb-24 relative">
          {/* Glow effect behind search form */}
          <div className="absolute inset-0 bg-gradient-to-r from-accent-600/20 via-blue-600/20 to-purple-600/20 rounded-3xl blur-2xl animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-l from-orange-600/10 via-pink-600/10 to-indigo-600/10 rounded-3xl blur-xl animate-pulse delay-1000"></div>
          
          <div className="relative transform hover:scale-[1.02] transition-transform duration-300">
          <SearchForm />
          </div>
        </div>
        
        {/* Database Test */}
        <div className="mb-16">
          <DatabaseTest />
        </div>

        {/* Features */}
        <div className="space-y-16">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="relative">
                <Sparkles className="h-6 w-6 text-accent-400 animate-spin" />
                <div className="absolute inset-0 bg-accent-400 rounded-full blur-lg opacity-50 animate-pulse"></div>
              </div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-100 to-accent-300 bg-clip-text text-transparent">
                Powerful Strategies
              </h3>
              <div className="relative">
                <Sparkles className="h-6 w-6 text-purple-400 animate-spin" style={{ animationDirection: 'reverse' }} />
                <div className="absolute inset-0 bg-purple-400 rounded-full blur-lg opacity-50 animate-pulse delay-500"></div>
              </div>
            </div>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Advanced routing techniques used by <span className="text-accent-400 font-semibold">travel professionals</span> to unlock 
              <span className="text-green-400 font-semibold"> hidden savings</span> and 
              <span className="text-blue-400 font-semibold"> premium access</span>
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            {/* Fake Round Trip Card */}
            <div className="group bg-gradient-to-br from-gray-900/90 via-gray-850/80 to-gray-900/90 backdrop-blur-sm border border-gray-800 hover:border-success-500/60 rounded-2xl p-8 text-center transform hover:scale-110 hover:-translate-y-4 transition-all duration-500 shadow-xl hover:shadow-success-500/30 hover:shadow-2xl relative overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-success-600/5 via-transparent to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-success-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-success-600 to-green-500 rounded-3xl blur-xl opacity-50 group-hover:opacity-90 group-hover:scale-110 transition-all duration-500"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-success-600 to-green-500 rounded-3xl blur-2xl opacity-30 group-hover:opacity-60 group-hover:scale-125 transition-all duration-700"></div>
                <div className="relative bg-gradient-to-r from-success-600 via-green-500 to-success-700 p-6 rounded-3xl shadow-2xl group-hover:shadow-success-500/50 transform group-hover:rotate-6 transition-all duration-500">
                  <Target className="h-10 w-10 text-white group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-success-300 transition-colors duration-300">
                Fake Round Trip
              </h3>
              <p className="text-gray-400 leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
                Book round trip flights with <span className="text-success-400 font-semibold">throwaway returns</span> to access lower one-way pricing on premium routes.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3 text-success-400 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                <TrendingUp className="h-4 w-4" />
                <span className="font-bold">Save up to 60%</span>
                <div className="w-2 h-2 bg-success-400 rounded-full animate-ping"></div>
              </div>
            </div>

            {/* Skiplag Strategy Card */}
            <div className="group bg-gradient-to-br from-gray-900/90 via-gray-850/80 to-gray-900/90 backdrop-blur-sm border border-gray-800 hover:border-blue-500/60 rounded-2xl p-8 text-center transform hover:scale-110 hover:-translate-y-4 transition-all duration-500 shadow-xl hover:shadow-blue-500/30 hover:shadow-2xl relative overflow-hidden delay-100">
              {/* Animated background pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-cyan-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute bottom-0 right-0 w-full h-px bg-gradient-to-l from-transparent via-blue-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl blur-xl opacity-50 group-hover:opacity-90 group-hover:scale-110 transition-all duration-500"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl blur-2xl opacity-30 group-hover:opacity-60 group-hover:scale-125 transition-all duration-700"></div>
                <div className="relative bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-700 p-6 rounded-3xl shadow-2xl group-hover:shadow-blue-500/50 transform group-hover:-rotate-6 transition-all duration-500">
                  <Zap className="h-10 w-10 text-white group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-300" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-blue-300 transition-colors duration-300">
                Skiplag Strategy
              </h3>
              <p className="text-gray-400 leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
                Find <span className="text-blue-400 font-semibold">hidden city tickets</span> by booking flights to destinations beyond your actual stop.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3 text-blue-400 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                <Shield className="h-4 w-4" />
                <span className="font-bold">Smart routing</span>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
              </div>
            </div>

            {/* Premium Routes Card */}
            <div className="group bg-gradient-to-br from-gray-900/90 via-gray-850/80 to-gray-900/90 backdrop-blur-sm border border-gray-800 hover:border-purple-500/60 rounded-2xl p-8 text-center transform hover:scale-110 hover:-translate-y-4 transition-all duration-500 shadow-xl hover:shadow-purple-500/30 hover:shadow-2xl relative overflow-hidden delay-200">
              {/* Animated background pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-transparent to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-0 right-0 w-full h-px bg-gradient-to-l from-purple-400/50 via-pink-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-500 rounded-3xl blur-xl opacity-50 group-hover:opacity-90 group-hover:scale-110 transition-all duration-500"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-500 rounded-3xl blur-2xl opacity-30 group-hover:opacity-60 group-hover:scale-125 transition-all duration-700"></div>
                <div className="relative bg-gradient-to-r from-purple-600 via-pink-500 to-purple-700 p-6 rounded-3xl shadow-2xl group-hover:shadow-purple-500/50 transform group-hover:rotate-3 transition-all duration-500">
                  <Globe className="h-10 w-10 text-white group-hover:scale-110 group-hover:rotate-45 transition-transform duration-300" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-purple-300 transition-colors duration-300">
                Premium Routes
              </h3>
              <p className="text-gray-400 leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
                Access <span className="text-purple-400 font-semibold">business and first class</span> deals on premium carriers with advanced fare class searches.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3 text-purple-400 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                <Sparkles className="h-4 w-4" />
                <span className="font-bold">Luxury access</span>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="relative bg-gradient-to-r from-accent-600/20 via-blue-600/20 to-purple-600/20 border border-gray-700/50 rounded-3xl p-12 text-center backdrop-blur-sm overflow-hidden group hover:from-accent-600/30 hover:via-blue-600/30 hover:to-purple-600/30 transition-all duration-500">
            {/* Animated background elements */}
            <div className="absolute inset-0 bg-gradient-to-r from-accent-600/10 via-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-l from-accent-400 via-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="relative">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="relative">
                  <Sparkles className="h-8 w-8 text-accent-400 animate-spin" />
                  <div className="absolute inset-0 bg-accent-400 rounded-full blur-lg opacity-50 animate-pulse"></div>
                </div>
                <h3 className="text-4xl font-bold bg-gradient-to-r from-white via-accent-300 to-purple-400 bg-clip-text text-transparent">
                  Ready to Save Thousands?
                </h3>
                <div className="relative">
                  <Sparkles className="h-8 w-8 text-purple-400 animate-spin" style={{ animationDirection: 'reverse' }} />
                  <div className="absolute inset-0 bg-purple-400 rounded-full blur-lg opacity-50 animate-pulse delay-500"></div>
                </div>
              </div>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                Start searching with our <span className="text-accent-400 font-bold">advanced flight hacking tools</span> and discover routes that 
                <span className="text-blue-400 font-bold"> traditional search engines</span> can't find.
              </p>
              <button
                onClick={() => document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' })}
                className="group/btn relative bg-gradient-to-r from-accent-600 via-orange-500 to-accent-700 hover:from-accent-500 hover:via-orange-400 hover:to-accent-600 text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-accent-500/40 transform hover:scale-110 hover:-translate-y-2 transition-all duration-500 flex items-center gap-4 mx-auto overflow-hidden"
              >
                {/* Button background animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
                
                <div className="relative flex items-center gap-4">
                  <Rocket className="h-6 w-6 group-hover/btn:rotate-12 group-hover/btn:scale-110 transition-transform duration-300" />
                  <span>Start Searching</span>
                  <ArrowRight className="h-6 w-6 group-hover/btn:translate-x-2 group-hover/btn:scale-110 transition-transform duration-300" />
                </div>
                
                {/* Sparkle effects */}
                <div className="absolute top-0 left-0 w-2 h-2 bg-white rounded-full opacity-0 group-hover/btn:opacity-100 group-hover/btn:animate-ping"></div>
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-white rounded-full opacity-0 group-hover/btn:opacity-100 group-hover/btn:animate-ping delay-200"></div>
              </button>
            </div>
          </div>
        </div>
      </main>
      </div>
  );
};

export default HomePage;
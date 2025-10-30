import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Plus, Map, User, Calendar, ExternalLink, Eye, CreditCard as Edit, Trash2, Plane, DollarSign, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';

interface Itinerary {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  share_link: string;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  booking_count?: number;
  total_value?: number;
}

const ItinerariesPage: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isAdmin = profile?.role === 'admin';

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
    }
  }, [user, authLoading, navigate]);

  // Fetch itineraries
  const fetchItineraries = async () => {
    if (!user) return;

    try {
      // Build query with conditional user filtering for admin access
      let query = supabase
        .from('itineraries')
        .select(`
            *,
            clients(id, first_name, last_name, email),
            itinerary_bookings(sales_price)
        `);
      
      // Apply user filter only if not admin
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Transform to add booking count and total value
      const itinerariesWithStats = (data || []).map(itinerary => ({
        ...itinerary,
        client: itinerary.clients,
        booking_count: itinerary.itinerary_bookings?.length || 0,
        total_value: itinerary.itinerary_bookings?.reduce((sum: number, booking: any) => 
          sum + (booking.sales_price || 0), 0) || 0,
        clients: undefined,
        itinerary_bookings: undefined
      }));

      setItineraries(itinerariesWithStats);
    } catch (error) {
      console.error('Error fetching itineraries:', error);
      setItineraries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchItineraries();
    }
  }, [user]);

  // Filter itineraries based on search query
  const filteredItineraries = itineraries.filter(itinerary =>
    itinerary.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    itinerary.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (itinerary.client && 
      `${itinerary.client.first_name} ${itinerary.client.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (itinerary.client?.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDeleteItinerary = async (itineraryId: string) => {
    if (!confirm('Are you sure you want to delete this itinerary? This will remove all associated bookings.')) return;

    try {
      const { error } = await supabase
        .from('itineraries')
        .delete()
        .eq('id', itineraryId);

      if (error) throw error;
      
      await fetchItineraries();
    } catch (error) {
      console.error('Error deleting itinerary:', error);
      alert('Failed to delete itinerary');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-300';
      case 'sent': return 'bg-blue-500/20 text-blue-400';
      case 'accepted': return 'bg-success-500/20 text-success-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getShareUrl = (shareLink: string) => {
    return `${window.location.origin}/itinerary/${shareLink}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading itineraries...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />

      <main className="px-4 sm:px-6 py-8">
        <div className="w-full">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Map className="h-6 w-6 text-accent-400" />
              <h1 className="text-2xl font-bold text-white">Itineraries</h1>
              {isAdmin && (
                <span className="bg-accent-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  ADMIN VIEW - ALL ITINERARIES
                </span>
              )}
            </div>
            <p className="text-gray-400">
              {isAdmin ? 'Build and manage all client itineraries in the system' : 'Build and manage client itineraries with Airtable bookings'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search itineraries by name, description, or client..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:border-accent-500"
                />
              </div>
            </div>
            <button
              onClick={() => navigate('/itineraries/builder')}
              className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Itinerary
            </button>
          </div>

          {/* Itineraries List */}
          {filteredItineraries.length === 0 ? (
            <div className="text-center py-12">
              <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {searchQuery ? 'No itineraries found' : 'No itineraries yet'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchQuery 
                  ? 'Try adjusting your search criteria'
                  : 'Create your first itinerary to get started'
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={() => navigate('/itineraries/builder')}
                  className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Create First Itinerary
                </button>
              )}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-850 border-b border-gray-800">
                    <tr>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Itinerary</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Client</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Status</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Bookings</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Created</th>
                      <th className="text-right text-gray-300 font-medium py-4 px-6">Total Value</th>
                      <th className="text-center text-gray-300 font-medium py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItineraries.map((itinerary, index) => (
                      <tr key={itinerary.id} className={`border-b border-gray-800 hover:bg-gray-850 transition-colors cursor-pointer ${
                        index === filteredItineraries.length - 1 ? 'border-b-0' : ''
                      }`}
                          onClick={() => navigate(`/itineraries/builder?edit=${itinerary.id}`)}>
                        <td className="py-4 px-6">
                          <div>
                            <div className="text-white font-medium">{itinerary.name}</div>
                            {itinerary.description && (
                              <div className="text-sm text-gray-400 mt-1 truncate max-w-xs">
                                {itinerary.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {itinerary.clients && itinerary.clients.length > 0 ? (
                            <div>
                              <div className="text-white font-medium flex items-center gap-2">
                                {(() => {
                                  const primary = itinerary.clients.find(c => c.is_primary) || itinerary.clients[0];
                                  const additional = itinerary.clients.length - 1;
                                  return (
                                    <>
                                      {primary.first_name} {primary.last_name}
                                      {additional > 0 && (
                                        <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs">
                                          +{additional} more
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              <div className="text-sm text-gray-400">
                                {(itinerary.clients.find(c => c.is_primary) || itinerary.clients[0]).email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500">No clients assigned</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(itinerary.status)}`}>
                            {itinerary.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Plane className="h-4 w-4 text-accent-400" />
                            <span className="text-white font-medium">
                              {itinerary.booking_count}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-white">{formatDate(itinerary.created_at)}</div>
                          <div className="text-xs text-gray-400">
                            Updated {formatDate(itinerary.updated_at)}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-lg font-semibold text-white">
                            {formatPrice(itinerary.total_value || 0)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(getShareUrl(itinerary.share_link), '_blank');
                              }}
                              className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                              title="Preview itinerary"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(getShareUrl(itinerary.share_link));
                                alert('Share link copied to clipboard!');
                              }}
                              className="p-2 text-gray-400 hover:text-accent-400 hover:bg-gray-700 rounded transition-colors"
                              title="Copy share link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItinerary(itinerary.id);
                              }}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                              title="Delete itinerary"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );

};

export default ItinerariesPage;
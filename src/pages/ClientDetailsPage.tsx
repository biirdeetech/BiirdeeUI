import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ArrowLeft, User, Mail, Phone, Building, FileText, Calendar, CreditCard as Edit, Plane, DollarSign, Eye, ExternalLink, Map } from 'lucide-react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';
import { useNotification } from '../hooks/useNotification';

interface Client {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface Proposal {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  notes: string;
  total_price: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  share_link: string;
  created_at: string;
  updated_at: string;
  option_count?: number;
  creator?: {
    full_name: string;
    email: string;
  };
}

interface Itinerary {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  share_link: string;
  created_at: string;
  updated_at: string;
  booking_count?: number;
  total_value?: number;
  creator?: {
    full_name: string;
    email: string;
  };
}

const ClientDetailsPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [availableProposals, setAvailableProposals] = useState<Proposal[]>([]);
  const [availableItineraries, setAvailableItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddToProposal, setShowAddToProposal] = useState(false);
  const [showAddToItinerary, setShowAddToItinerary] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const isAdmin = profile?.role === 'admin';

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
    }
  }, [user, authLoading, navigate]);

  // Fetch client and proposals
  const fetchClientData = async () => {
    if (!clientId) return;

    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) {
        if (clientError.code === 'PGRST116') {
          setError('Client not found.');
        } else {
          throw clientError;
        }
        return;
      }

      setClient(clientData);

      // Fetch proposals for this client with option counts and creator info
      const { data: proposalsData, error: proposalsError } = await supabase
        .from('proposals')
        .select(`
          *,
          proposal_options(count),
          proposal_clients!inner(client_id)
        `)
        .eq('proposal_clients.client_id', clientId)
        .order('updated_at', { ascending: false });

      if (proposalsError) throw proposalsError;

      // Fetch itineraries for this client with booking counts and creator info
      const { data: itinerariesData, error: itinerariesError } = await supabase
        .from('itineraries')
        .select(`
          *,
          itinerary_bookings(sales_price),
          profiles!itineraries_user_id_fkey(full_name, email)
        `)
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

      if (itinerariesError) throw itinerariesError;

      // Get unique user IDs from proposals
      const userIds = [...new Set((proposalsData || []).map(p => p.user_id))];
      
      // Fetch creator information separately
      let creatorsData = [];
      if (userIds.length > 0) {
        const { data: creators, error: creatorsError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (!creatorsError) {
          creatorsData = creators || [];
        }
      }

      // Transform to add option_count and creator info
      const proposalsWithCounts = (proposalsData || []).map(proposal => {
        const creator = creatorsData.find(c => c.id === proposal.user_id);
        return {
          ...proposal,
          option_count: proposal.proposal_options?.[0]?.count || 0,
          creator: creator ? {
            full_name: creator.full_name,
            email: creator.email
          } : undefined,
          proposal_options: undefined
        };
      });

      // Transform itineraries to add booking count, total value and creator info
      const itinerariesWithCounts = (itinerariesData || []).map(itinerary => ({
        ...itinerary,
        booking_count: itinerary.itinerary_bookings?.length || 0,
        total_value: itinerary.itinerary_bookings?.reduce((sum: number, booking: any) => 
          sum + (booking.sales_price || 0), 0) || 0,
        creator: itinerary.profiles ? {
          full_name: itinerary.profiles.full_name,
          email: itinerary.profiles.email
        } : null,
        profiles: undefined,
        itinerary_bookings: undefined
      }));

      setProposals(proposalsWithCounts);
      setItineraries(itinerariesWithCounts);

      // Fetch available proposals (not already assigned to this client)
      const proposalIds = (proposalsData || []).map(p => p.id);
      let availableProposalsQuery = supabase
        .from('proposals')
        .select('id, name, status, updated_at')
        .not('id', 'in', proposalIds.length > 0 ? proposalIds : ['00000000-0000-0000-0000-000000000000']);
      
      if (!isAdmin) {
        availableProposalsQuery = availableProposalsQuery.eq('user_id', user.id);
      }
      
      const { data: availableProposalsData } = await availableProposalsQuery
        .order('updated_at', { ascending: false });
      
      setAvailableProposals(availableProposalsData || []);

      // Fetch available itineraries (not already assigned to this client)
      const itineraryIds = (itinerariesData || []).map(i => i.id);
      let availableItinerariesQuery = supabase
        .from('itineraries')
        .select('id, name, status, updated_at')
        .not('id', 'in', itineraryIds.length > 0 ? itineraryIds : ['00000000-0000-0000-0000-000000000000']);
      
      if (!isAdmin) {
        availableItinerariesQuery = availableItinerariesQuery.eq('user_id', user.id);
      }
      
      const { data: availableItinerariesData } = await availableItinerariesQuery
        .order('updated_at', { ascending: false });
      
      setAvailableItineraries(availableItinerariesData || []);

    } catch (error) {
      console.error('Error fetching client data:', error);
      setError('Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchClientData();
    }
  }, [clientId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
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
    return `${window.location.origin}/proposal/${shareLink}`;
  };

  const addClientToProposal = async (proposalId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('proposal_clients')
        .insert({
          proposal_id: proposalId,
          client_id: clientId!,
          is_primary: false // Add as secondary client
        });

      if (error) throw error;
      
      setShowAddToProposal(false);
      await fetchClientData();
      showNotification('success', 'Client Added', 'Client has been added to the proposal successfully');
    } catch (error) {
      console.error('Error adding client to proposal:', error);
      alert('Failed to add client to proposal');
    } finally {
      setSaving(false);
    }
  };

  const addClientToItinerary = async (itineraryId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('itinerary_clients')
        .insert({
          itinerary_id: itineraryId,
          client_id: clientId!,
          is_primary: false // Add as secondary client
        });

      if (error) throw error;
      
      setShowAddToItinerary(false);
      await fetchClientData();
      showNotification('success', 'Client Added', 'Client has been added to the itinerary successfully');
    } catch (error) {
      console.error('Error adding client to itinerary:', error);
      alert('Failed to add client to itinerary');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="px-4 sm:px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Client Not Found</h2>
              <p className="text-gray-400 mb-6">{error || 'The client you are looking for does not exist.'}</p>
              <button
                onClick={() => navigate('/clients')}
                className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Clients
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-950">
      <Navigation />

      <main className="px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/clients')}
              className="flex items-center gap-2 text-accent-400 hover:text-accent-300 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Clients
            </button>
          </div>

          {/* Client Header */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-6">
                <div className="bg-accent-600 p-4 rounded-lg">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {client.first_name} {client.last_name}
                  </h1>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.company && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span>{client.company}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-300">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Client since {formatDate(client.created_at)}</span>
                    </div>
                  </div>

                  {client.notes && (
                    <div className="bg-gray-850 rounded-lg p-4 max-w-2xl">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Notes</h3>
                      <p className="text-gray-300">{client.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => navigate(`/clients?edit=${client.id}`)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Client
              </button>
            </div>
          </div>

          {/* Proposals Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg mb-8">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Proposals ({proposals.length})
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    All proposals created for this client
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/proposals?new=true&client=${client.id}`)}
                  className="bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  New Proposal
                </button>
                <button
                  onClick={() => setShowAddToProposal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add to Existing
                </button>
              </div>
            </div>

            {proposals.length === 0 ? (
              <div className="p-12 text-center">
                <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No proposals yet</h3>
                <p className="text-gray-400 mb-6">
                  Create the first proposal for {client.first_name}
                </p>
                <button
                  onClick={() => navigate(`/proposals?new=true&client=${client.id}`)}
                  className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Create First Proposal
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-850 border-b border-gray-800">
                    <tr>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Proposal</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Status</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Created By</th>
                      <th className="text-right text-gray-300 font-medium py-4 px-6">Total</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Options</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Updated</th>
                      <th className="text-center text-gray-300 font-medium py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.map((proposal, index) => (
                      <tr key={proposal.id} className={`border-b border-gray-800 hover:bg-gray-850 transition-colors ${
                        index === proposals.length - 1 ? 'border-b-0' : ''
                      }`}>
                        <td className="py-4 px-6">
                          <div>
                            <div className="text-white font-medium">{proposal.name}</div>
                            {proposal.notes && (
                              <div className="text-sm text-gray-400 mt-1 truncate max-w-xs">
                                {proposal.notes}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(proposal.status)}`}>
                            {proposal.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {proposal.creator ? (
                            <div>
                              <div className="text-white font-medium">
                                {proposal.creator.full_name || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-400">
                                {proposal.creator.email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-lg font-semibold text-white">
                            {formatPrice(proposal.total_price)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Plane className="h-4 w-4 text-accent-400" />
                            <span className="text-white font-medium">
                              {proposal.option_count}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-white">{formatDate(proposal.updated_at)}</div>
                          <div className="text-xs text-gray-400">
                            Created {formatDate(proposal.created_at)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => window.open(getShareUrl(proposal.share_link), '_blank')}
                              className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                              title="Preview proposal"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(getShareUrl(proposal.share_link));
                                // You could add a toast notification here
                                alert('Share link copied to clipboard!');
                              }}
                              className="p-2 text-gray-400 hover:text-accent-400 hover:bg-gray-800 rounded transition-colors"
                              title="Copy share link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/proposals?edit=${proposal.id}`)}
                              className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors"
                              title="Edit proposal"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Itineraries Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Map className="h-5 w-5" />
                    Itineraries ({itineraries.length})
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    All itineraries created for this client
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/itineraries/builder?client=${client.id}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Map className="h-4 w-4" />
                  New Itinerary
                </button>
                <button
                  onClick={() => setShowAddToItinerary(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add to Existing
                </button>
              </div>
            </div>

            {itineraries.length === 0 ? (
              <div className="p-12 text-center">
                <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No itineraries yet</h3>
                <p className="text-gray-400 mb-6">
                  Create the first itinerary for {client.first_name}
                </p>
                <button
                  onClick={() => navigate(`/itineraries/builder?client=${client.id}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Create First Itinerary
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-850 border-b border-gray-800">
                    <tr>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Itinerary</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Status</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Bookings</th>
                      <th className="text-right text-gray-300 font-medium py-4 px-6">Total Value</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Updated</th>
                      <th className="text-center text-gray-300 font-medium py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itineraries.map((itinerary, index) => (
                      <tr key={itinerary.id} className={`border-b border-gray-800 hover:bg-gray-850 transition-colors ${
                        index === itineraries.length - 1 ? 'border-b-0' : ''
                      }`}>
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
                          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(itinerary.status)}`}>
                            {itinerary.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Plane className="h-4 w-4 text-blue-400" />
                            <span className="text-white font-medium">
                              {itinerary.booking_count}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-lg font-semibold text-white">
                            {formatPrice(itinerary.total_value || 0)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-white">{formatDate(itinerary.updated_at)}</div>
                          <div className="text-xs text-gray-400">
                            Created {formatDate(itinerary.created_at)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => window.open(`${window.location.origin}/itinerary/${itinerary.share_link}`, '_blank')}
                              className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                              title="Preview itinerary"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/itinerary/${itinerary.share_link}`);
                                alert('Share link copied to clipboard!');
                              }}
                              className="p-2 text-gray-400 hover:text-accent-400 hover:bg-gray-800 rounded transition-colors"
                              title="Copy share link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/itineraries/builder?edit=${itinerary.id}`)}
                              className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors"
                              title="Edit itinerary"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      </div>

      {/* Add to Existing Proposal Modal */}
      {showAddToProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Add to Existing Proposal</h3>
                  <p className="text-sm text-gray-400">Add {client.first_name} {client.last_name} to a proposal</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddToProposal(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {availableProposals.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No available proposals</p>
                  <p className="text-sm text-gray-500">This client is already assigned to all your proposals</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300 mb-4">
                    Select a proposal to add {client.first_name} as an additional client:
                  </p>
                  {availableProposals.map((proposal) => (
                    <button
                      key={proposal.id}
                      onClick={() => addClientToProposal(proposal.id)}
                      disabled={saving}
                      className="w-full text-left p-4 bg-gray-850 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">{proposal.name}</div>
                          <div className="text-sm text-gray-400">
                            Status: <span className="capitalize">{proposal.status}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Updated {formatDate(proposal.updated_at)}
                          </div>
                        </div>
                        <div className="text-blue-400">
                          <Plus className="h-5 w-5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-800 mt-6">
                <button
                  onClick={() => setShowAddToProposal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to Existing Itinerary Modal */}
      {showAddToItinerary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="bg-green-600 p-2 rounded-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Add to Existing Itinerary</h3>
                  <p className="text-sm text-gray-400">Add {client.first_name} {client.last_name} to an itinerary</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddToItinerary(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {availableItineraries.length === 0 ? (
                <div className="text-center py-8">
                  <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No available itineraries</p>
                  <p className="text-sm text-gray-500">This client is already assigned to all your itineraries</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300 mb-4">
                    Select an itinerary to add {client.first_name} as an additional client:
                  </p>
                  {availableItineraries.map((itinerary) => (
                    <button
                      key={itinerary.id}
                      onClick={() => addClientToItinerary(itinerary.id)}
                      disabled={saving}
                      className="w-full text-left p-4 bg-gray-850 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white font-medium">{itinerary.name}</div>
                          <div className="text-sm text-gray-400">
                            Status: <span className="capitalize">{itinerary.status}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Updated {formatDate(itinerary.updated_at)}
                          </div>
                        </div>
                        <div className="text-green-400">
                          <Plus className="h-5 w-5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-800 mt-6">
                <button
                  onClick={() => setShowAddToItinerary(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientDetailsPage;
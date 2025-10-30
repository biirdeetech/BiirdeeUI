import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { ArrowLeft, FileText, User, Mail, Calendar, ExternalLink, Eye, DollarSign, Plane, Plus, EyeOff, Trash2, Save, Phone, Building, Users, Search, Crown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';
import { formatPrice } from '../utils/priceFormatter';

interface Proposal {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  notes: string;
  total_price: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  share_link: string;
  created_at: string;
  updated_at: string;
  clients?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company: string;
    is_primary: boolean;
  }>;
}

interface ProposalOption {
  id: string;
  proposal_id: string;
  flight_data: any;
  is_hidden: boolean;
  agent_notes: string;
  selected_price: number;
  option_number: number;
  created_at: string;
  updated_at: string;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  created_at: string;
}

const ProposalDetailPage: React.FC = () => {
  const { proposalId } = useParams<{ proposalId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [options, setOptions] = useState<ProposalOption[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  
  // New client form data
  const [newClientData, setNewClientData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: ''
  });
  
  const isAdmin = profile?.role === 'admin';

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
    }
  }, [user, authLoading, navigate]);

  // Fetch proposal and options
  const fetchProposalData = async () => {
    if (!proposalId) return;

    try {
      // Fetch proposal with clients
      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          *,
          proposal_clients(
            client_id,
            is_primary,
            clients(id, first_name, last_name, email, phone, company)
          )
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError) {
        if (proposalError.code === 'PGRST116') {
          setError('Proposal not found.');
        } else {
          throw proposalError;
        }
        return;
      }

      // Transform the data to flatten client information
      const transformedProposal = {
        ...proposalData,
        clients: proposalData.proposal_clients?.map((pc: any) => ({
          id: pc.clients.id,
          first_name: pc.clients.first_name,
          last_name: pc.clients.last_name,
          email: pc.clients.email,
          phone: pc.clients.phone,
          company: pc.clients.company,
          is_primary: pc.is_primary
        })) || [],
        proposal_clients: undefined
      };

      setProposal(transformedProposal);

      // Fetch proposal options
      const { data: optionsData, error: optionsError } = await supabase
        .from('proposal_options')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('option_number', { ascending: true });

      if (optionsError) throw optionsError;
      setOptions(optionsData || []);

      // Fetch all available clients for adding
      // Apply user filter only if not admin  
      const isAdmin = user.email && ['tech@biirdee.com', 'var@biirdee.com', 'eric@biirdee.com'].includes(user.email);
      
      let clientQuery = supabase
        .from('clients')
        .select('id, first_name, last_name, email, phone, company, created_at');
        
      if (!isAdmin) {
        clientQuery = clientQuery.eq('user_id', user.id);
      }
      
      const { data: allClientsData, error: clientsError } = await clientQuery
        .order('first_name', { ascending: true });

      if (clientsError) throw clientsError;
      setAllClients(allClientsData || []);

    } catch (error) {
      console.error('Error fetching proposal data:', error);
      setError('Failed to load proposal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (proposalId && user) {
      fetchProposalData();
    }
  }, [proposalId, user]);

  const updateOption = async (optionId: string, updates: Partial<ProposalOption>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('proposal_options')
        .update(updates)
        .eq('id', optionId);

      if (error) throw error;
      
      // Refresh options
      await fetchProposalData();
    } catch (error) {
      console.error('Error updating option:', error);
      alert('Failed to update option');
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm('Are you sure you want to delete this option?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('proposal_options')
        .delete()
        .eq('id', optionId);

      if (error) throw error;
      
      // Refresh options
      await fetchProposalData();
    } catch (error) {
      console.error('Error deleting option:', error);
      alert('Failed to delete option');
    } finally {
      setSaving(false);
    }
  };

  const addClientToProposal = async (clientId: string) => {
    setSaving(true);
    try {
      // Check if client is already added
      const isAlreadyAdded = proposal?.clients?.some(c => c.id === clientId);
      if (isAlreadyAdded) {
        alert('Client is already added to this proposal');
        return;
      }

      // Add client to proposal
      const { error } = await supabase
        .from('proposal_clients')
        .insert({
          proposal_id: proposalId!,
          client_id: clientId,
          is_primary: proposal?.clients?.length === 0 // First client becomes primary
        });

      if (error) throw error;
      
      setShowAddClient(false);
      setClientSearchQuery('');
      await fetchProposalData();
      showNotification('success', 'Client Added', 'Client has been added to the proposal successfully');
    } catch (error) {
      console.error('Error adding client to proposal:', error);
      alert('Failed to add client to proposal');
    } finally {
      setSaving(false);
    }
  };

  const removeClientFromProposal = async (clientId: string) => {
    if (!confirm('Are you sure you want to remove this client from the proposal?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('proposal_clients')
        .delete()
        .eq('proposal_id', proposalId!)
        .eq('client_id', clientId);

      if (error) throw error;
      
      await fetchProposalData();
      showNotification('success', 'Client Removed', 'Client has been removed from the proposal');
    } catch (error) {
      console.error('Error removing client from proposal:', error);
      alert('Failed to remove client from proposal');
    } finally {
      setSaving(false);
    }
  };

  const setPrimaryClient = async (clientId: string) => {
    setSaving(true);
    try {
      // Remove primary status from all clients
      const { error: removeError } = await supabase
        .from('proposal_clients')
        .update({ is_primary: false })
        .eq('proposal_id', proposalId!);

      if (removeError) throw removeError;

      // Set new primary client
      const { error: setPrimaryError } = await supabase
        .from('proposal_clients')
        .update({ is_primary: true })
        .eq('proposal_id', proposalId!)
        .eq('client_id', clientId);

      if (setPrimaryError) throw setPrimaryError;
      
      await fetchProposalData();
      showNotification('success', 'Primary Client Updated', 'Primary client has been changed successfully');
    } catch (error) {
      console.error('Error setting primary client:', error);
      alert('Failed to set primary client');
    } finally {
      setSaving(false);
    }
  };

  const createNewClient = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...newClientData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add the new client to the proposal
      await addClientToProposal(data.id);
      
      setShowCreateClient(false);
      setNewClientData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: ''
      });
      showNotification('success', 'Client Created & Added', `${data.first_name} ${data.last_name} has been created and added to the proposal`);
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  const getFlightSummary = (flightData: any) => {
    if (!flightData || !flightData.slices || flightData.slices.length === 0) {
      return 'No flight data';
    }

    const firstSlice = flightData.slices[0];
    const lastSlice = flightData.slices[flightData.slices.length - 1];
    
    const origin = firstSlice.origin?.code || 'Unknown';
    const destination = lastSlice.destination?.code || 'Unknown';
    
    if (flightData.slices.length === 1) {
      return `${origin} → ${destination}`;
    } else if (flightData.slices.length === 2) {
      return `${origin} ⇄ ${destination}`;
    } else {
      return `${origin} → ... → ${destination} (${flightData.slices.length} segments)`;
    }
  };

  const getCarrierInfo = (flightData: any) => {
    if (!flightData || !flightData.slices || flightData.slices.length === 0) {
      return 'Unknown';
    }

    const firstSlice = flightData.slices[0];
    if (firstSlice.segments && firstSlice.segments.length > 0) {
      return firstSlice.segments[0].carrier?.shortName || 'Unknown';
    }
    
    return 'Unknown';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
    return `${window.location.origin}/proposal/${shareLink}`;
  };

  const getPrimaryClient = () => {
    return proposal?.clients?.find(c => c.is_primary) || proposal?.clients?.[0];
  };

  const getClientDisplay = () => {
    const primary = getPrimaryClient();
    const clientCount = proposal?.clients?.length || 0;
    
    if (!primary) {
      return {
        name: proposal?.first_name && proposal?.last_name 
          ? `${proposal.first_name} ${proposal.last_name}` 
          : 'Unknown Client',
        email: proposal?.email || 'No email',
        additional: 0
      };
    }
    
    return {
      name: `${primary.first_name} ${primary.last_name}`,
      email: primary.email,
      additional: clientCount - 1
    };
  };

  // Filter available clients (not already added to proposal)
  const availableClients = allClients.filter(client => 
    !proposal?.clients?.some(pc => pc.id === client.id) &&
    (client.first_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.last_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.email.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.company.toLowerCase().includes(clientSearchQuery.toLowerCase()))
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="px-4 sm:px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h2>
              <p className="text-gray-400 mb-6">{error || 'The proposal you are looking for does not exist.'}</p>
              <button
                onClick={() => navigate('/proposals')}
                className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Proposals
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const clientDisplay = getClientDisplay();

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />

      <main className="px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/proposals')}
              className="flex items-center gap-2 text-accent-400 hover:text-accent-300 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Proposals
            </button>
          </div>

          {/* Proposal Header */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-accent-600 p-3 rounded-lg">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">{proposal.name}</h1>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(proposal.status)}`}>
                        {proposal.status}
                      </span>
                      <span className="text-gray-400 text-sm">Created {formatDate(proposal.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Client Information
                      <button
                        onClick={() => setShowAddClient(true)}
                        className="ml-auto bg-blue-600 hover:bg-blue-700 text-white p-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    </h3>
                    
                    {/* Compact Client List */}
                    <div className="space-y-2">
                      {proposal.clients && proposal.clients.length > 0 ? (
                        proposal.clients
                          .sort((a, b) => {
                            // Primary client first, then alphabetical
                            if (a.is_primary && !b.is_primary) return -1;
                            if (!a.is_primary && b.is_primary) return 1;
                            return a.first_name.localeCompare(b.first_name);
                          })
                          .map((client) => (
                          <div key={client.id} className="bg-gray-850 border border-gray-700 rounded p-2 group hover:border-gray-600 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  client.is_primary ? 'bg-accent-600 text-white' : 'bg-gray-600 text-gray-300'
                                }`}>
                                  {client.is_primary ? <Crown className="h-3 w-3" /> : client.first_name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-white font-medium text-sm truncate">
                                    {client.first_name} {client.last_name}
                                  </div>
                                  <div className="text-xs text-gray-400 truncate">
                                    {client.email}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!client.is_primary && (
                                  <button
                                    onClick={() => setPrimaryClient(client.id)}
                                    className="p-1 text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded transition-colors"
                                    title="Set as primary client"
                                  >
                                    <Crown className="h-3 w-3" />
                                  </button>
                                )}
                                
                                {proposal.clients && proposal.clients.length > 1 && (
                                  <button
                                    onClick={() => removeClientFromProposal(client.id)}
                                    className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                    title="Remove client from proposal"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-3 text-gray-400 text-sm">
                          No clients assigned
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-white mb-3">Proposal Details</h3>
                    {proposal.notes && (
                      <div className="bg-gray-850 rounded-lg p-3 mb-3">
                        <p className="text-gray-300">{proposal.notes}</p>
                      </div>
                    )}
                    <div className="space-y-2 text-sm text-gray-400">
                      <div>Updated: {formatDate(proposal.updated_at)}</div>
                      <div className="flex items-center gap-2">
                        <span>Share Link:</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(getShareUrl(proposal.share_link));
                            alert('Share link copied to clipboard!');
                          }}
                          className="text-accent-400 hover:text-accent-300 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Copy
                        </button>
                        <button
                          onClick={() => window.open(getShareUrl(proposal.share_link), '_blank')}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-right ml-6">
                <div className="text-3xl font-bold text-white mb-2">
                  {formatPrice(proposal.total_price)}
                </div>
                <div className="text-gray-400">Total Price</div>
              </div>
            </div>
          </div>

          {/* Flight Options */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Plane className="h-5 w-5" />
                    Flight Options ({options.length})
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Manage flight options for this proposal
                  </p>
                </div>
                <button
                  onClick={() => navigate('/search')}
                  className="bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Flight Option
                </button>
              </div>
            </div>

            {options.length === 0 ? (
              <div className="p-12 text-center">
                <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No flight options yet</h3>
                <p className="text-gray-400 mb-6">
                  Add flight options from search results to build this proposal.
                </p>
                <button
                  onClick={() => navigate('/search')}
                  className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Search Flights
                </button>
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {options.map((option, index) => (
                    <div key={option.id} className="bg-gray-850 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-accent-600 text-white px-2 py-1 rounded text-sm font-medium">
                              Option {option.option_number}
                            </span>
                            <span className="text-gray-300 font-medium">
                              {getCarrierInfo(option.flight_data)}
                            </span>
                            <span className="text-gray-400">
                              {getFlightSummary(option.flight_data)}
                            </span>
                            {option.is_hidden && (
                              <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                                Hidden
                              </span>
                            )}
                          </div>
                          
                          {option.agent_notes && (
                            <p className="text-sm text-gray-300 mb-3">{option.agent_notes}</p>
                          )}
                          
                          {/* Enhanced Flight Details */}
                          {option.flight_data?.slices && option.flight_data.slices.length > 0 && (
                            <div className="mt-4 space-y-3">
                              {option.flight_data.slices.map((slice: any, sliceIndex: number) => (
                                <div key={sliceIndex} className="bg-gray-800 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-4 flex-1">
                                      {/* Departure */}
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-white">
                                          {(() => {
                                            if (!slice.departure) return 'N/A';
                                            const date = new Date(slice.departure);
                                            return date.toLocaleTimeString('en-US', {
                                              hour: 'numeric',
                                              minute: '2-digit',
                                              hour12: true
                                            });
                                          })()}
                                        </div>
                                        <div className="text-sm font-medium text-accent-400">
                                          {slice.origin?.code || 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {slice.origin?.name || 'Unknown Airport'}
                                        </div>
                                      </div>

                                      {/* Flight Path */}
                                      <div className="flex-1 px-3">
                                        <div className="flex items-center gap-2 text-gray-300">
                                          <div className="flex-1 border-t-2 border-gray-600"></div>
                                          <Plane className="h-4 w-4" />
                                          <div className="flex-1 border-t-2 border-gray-600"></div>
                                        </div>
                                        <div className="text-center text-sm text-gray-300 mt-1">
                                          {slice.flights?.join(', ') || 'N/A'}
                                        </div>
                                        <div className="text-center text-xs text-gray-400 mt-1">
                                          {(() => {
                                            if (!slice.duration) return 'Duration N/A';
                                            const hours = Math.floor(slice.duration / 60);
                                            const minutes = slice.duration % 60;
                                            return `${hours}h ${minutes}m`;
                                          })()}
                                        </div>
                                        {slice.stops && slice.stops.length > 0 && (
                                          <div className="text-center text-xs text-gray-500 mt-1">
                                            Stop: {slice.stops.map((stop: any) => stop.code).join(', ')}
                                          </div>
                                        )}
                                      </div>

                                      {/* Arrival */}
                                      <div className="text-center">
                                        <div className="text-lg font-semibold text-white">
                                          {(() => {
                                            if (!slice.arrival) return 'N/A';
                                            // Extract time directly from ISO string
                                            const timeMatch = slice.arrival.match(/T(\d{2}):(\d{2})/);
                                            if (timeMatch) {
                                              const hours = parseInt(timeMatch[1]);
                                              const minutes = parseInt(timeMatch[2]);
                                              const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                                              const ampm = hours >= 12 ? 'PM' : 'AM';
                                              const minutesStr = minutes.toString().padStart(2, '0');
                                              return `${hour12}:${minutesStr} ${ampm}`;
                                            }
                                            return 'N/A';
                                          })()}
                                          {(() => {
                                            if (!slice.departure || !slice.arrival) return null;
                                            const depDate = new Date(slice.departure);
                                            const arrDate = new Date(slice.arrival);
                                            const depDay = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate());
                                            const arrDay = new Date(arrDate.getFullYear(), arrDate.getMonth(), arrDate.getDate());
                                            const diffTime = arrDay.getTime() - depDay.getTime();
                                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                                            if (diffDays > 0) {
                                              return <span className="text-xs text-accent-400 ml-1">+{diffDays}</span>;
                                            }
                                            return null;
                                          })()}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {(() => {
                                            if (!slice.arrival) return 'N/A';
                                            const date = new Date(slice.arrival);
                                            return date.toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric'
                                            });
                                          })()}
                                        </div>
                                        <div className="text-sm font-medium text-accent-400">
                                          {slice.destination?.code || 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {slice.destination?.name || 'Unknown Airport'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Flight Metadata */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <span className="text-gray-400 font-medium">Date:</span>
                                      <div className="text-white">
                                        {slice.departure ? new Date(slice.departure).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric'
                                        }) : 'N/A'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-medium">Cabin:</span>
                                      <div className="text-white">
                                        {slice.cabins?.join(', ') || 'N/A'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-medium">Aircraft:</span>
                                      <div className="text-white">
                                        {slice.segments?.[0]?.legs?.[0]?.aircraft?.shortName || 'N/A'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 font-medium">Booking:</span>
                                      <div className="text-white font-mono">
                                        {slice.segments?.[0]?.pricings?.[0]?.bookingClass || 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-xl font-bold text-white">
                            {formatPrice(option.selected_price)}
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Selected Price
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="number"
                              value={option.selected_price}
                              onChange={(e) => updateOption(option.id, { selected_price: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:border-accent-500"
                              min="0"
                              step="50"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Agent Notes
                          </label>
                          <input
                            type="text"
                            value={option.agent_notes}
                            onChange={(e) => updateOption(option.id, { agent_notes: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:border-accent-500"
                            placeholder="Internal notes..."
                          />
                        </div>

                        <div className="flex items-end gap-2">
                          <button
                            onClick={() => updateOption(option.id, { is_hidden: !option.is_hidden })}
                            className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                              option.is_hidden
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            }`}
                          >
                            {option.is_hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {option.is_hidden ? 'Hidden' : 'Visible'}
                          </button>
                          
                          <button
                            onClick={() => deleteOption(option.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                            title="Delete option"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Flight Data Preview */}
                      <div className="mt-4 p-3 bg-gray-800 rounded text-xs text-gray-400 font-mono">
                        <details>
                          <summary className="cursor-pointer hover:text-gray-300">View flight data</summary>
                          <pre className="mt-2 overflow-x-auto">
                            {JSON.stringify(option.flight_data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <div className="text-gray-300">
                      <span className="font-medium">{options.length}</span> flight option{options.length !== 1 ? 's' : ''}
                      <span className="mx-2">•</span>
                      <span className="font-medium">{options.filter(o => !o.is_hidden).length}</span> visible to client
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Proposal Total</div>
                      <div className="text-2xl font-bold text-white">
                        {formatPrice(proposal.total_price)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Add Client to Proposal</h3>
                  <p className="text-sm text-gray-400">Select from existing clients or create a new one</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddClient(false);
                  setClientSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Search and Create */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    placeholder="Search clients by name, email, or company..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => setShowCreateClient(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  New Client
                </button>
              </div>

              {/* Create New Client Form */}
              {showCreateClient && (
                <div className="bg-gray-850 border border-gray-700 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Create New Client
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      value={newClientData.first_name}
                      onChange={(e) => setNewClientData({...newClientData, first_name: e.target.value})}
                      placeholder="First Name *"
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-400"
                      required
                    />
                    <input
                      type="text"
                      value={newClientData.last_name}
                      onChange={(e) => setNewClientData({...newClientData, last_name: e.target.value})}
                      placeholder="Last Name *"
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-400"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="email"
                      value={newClientData.email}
                      onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                      placeholder="Email *"
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-400"
                      required
                    />
                    <input
                      type="tel"
                      value={newClientData.phone}
                      onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                      placeholder="Phone"
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-400"
                    />
                  </div>
                  <input
                    type="text"
                    value={newClientData.company}
                    onChange={(e) => setNewClientData({...newClientData, company: e.target.value})}
                    placeholder="Company"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={createNewClient}
                      disabled={saving || !newClientData.first_name || !newClientData.last_name || !newClientData.email}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-colors"
                    >
                      {saving ? 'Creating...' : 'Create & Add Client'}
                    </button>
                    <button
                      onClick={() => setShowCreateClient(false)}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Available Clients */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">Available Clients</h4>
                
                {availableClients.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">
                      {clientSearchQuery ? 'No clients found matching your search' : 'All clients are already added to this proposal'}
                    </p>
                    {!clientSearchQuery && (
                      <button
                        onClick={() => setShowCreateClient(true)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium transition-colors"
                      >
                        Create New Client
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-3">
                    {availableClients.map((client) => (
                      <div key={client.id} className="bg-gray-850 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="bg-blue-600 p-2 rounded-lg">
                                <User className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="text-white font-semibold">
                                  {client.first_name} {client.last_name}
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div className="space-y-2">
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
                              </div>
                              <div className="space-y-2">
                                {client.company && (
                                  <div className="flex items-center gap-2 text-gray-300">
                                    <Building className="h-4 w-4 text-gray-400" />
                                    <span>{client.company}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-gray-300">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span>Since {new Date(client.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => addClientToProposal(client.id)}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            {saving ? 'Adding...' : 'Add Client'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalDetailPage;
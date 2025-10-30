import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, User, Mail, Calendar, ExternalLink, Eye, CreditCard as Edit, Trash2, Plane } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';
import ProposalForm from '../components/ProposalForm';
import ProposalOptionsManager from '../components/ProposalOptionsManager';

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
    is_primary: boolean;
  }>;
}

const ProposalsPage: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth(); 
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showOptionsManager, setShowOptionsManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isAdmin = profile?.role === 'admin';

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
    }
  }, [user, authLoading, navigate]);

  // Fetch proposals
  const fetchProposals = async () => {
    if (!user) return;
    

    try {
      // Fetch proposals with their associated clients - modify query for admin access
      let proposalsQuery = supabase
        .from('proposals')
        .select(`
          *,
          proposal_clients(
            client_id,
            is_primary,
            clients(id, first_name, last_name, email)
          )
        `);
      
      // Apply user filter only if not admin
      if (!isAdmin) {
        proposalsQuery = proposalsQuery.eq('user_id', user.id);
      }
      
      const { data, error } = await proposalsQuery
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform the data to flatten client information
      const transformedData = (data || []).map(proposal => ({
        ...proposal,
        clients: proposal.proposal_clients?.map((pc: any) => ({
          id: pc.clients.id,
          first_name: pc.clients.first_name,
          last_name: pc.clients.last_name,
          email: pc.clients.email,
          is_primary: pc.is_primary
        })) || [],
        // For backwards compatibility, set the primary client info
        first_name: proposal.proposal_clients?.find((pc: any) => pc.is_primary)?.clients?.first_name || null,
        last_name: proposal.proposal_clients?.find((pc: any) => pc.is_primary)?.clients?.last_name || null,
        email: proposal.proposal_clients?.find((pc: any) => pc.is_primary)?.clients?.email || null,
        proposal_clients: undefined, // Remove the raw data
      }));
      
      setProposals(transformedData);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProposals();
    }
  }, [user]);

  // Filter proposals based on search query
  const filteredProposals = proposals.filter(proposal => 
    proposal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (proposal.first_name && proposal.first_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (proposal.last_name && proposal.last_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (proposal.email && proposal.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (proposal.clients && proposal.clients.some(client => 
      client.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
    ))
  );

  const getPrimaryClient = (proposal: Proposal) => {
    return proposal.clients?.find(c => c.is_primary) || proposal.clients?.[0];
  };

  const getClientDisplay = (proposal: Proposal) => {
    const primary = getPrimaryClient(proposal);
    const clientCount = proposal.clients?.length || 0;
    
    if (!primary) {
      return {
        name: proposal.first_name && proposal.last_name 
          ? `${proposal.first_name} ${proposal.last_name}` 
          : 'Unknown Client',
        email: proposal.email || 'No email',
        additional: 0
      };
    }
    
    return {
      name: `${primary.first_name} ${primary.last_name}`,
      email: primary.email,
      additional: clientCount - 1
    };
  };

  const handleCreateProposal = () => {
    setSelectedProposal(null);
    setShowCreateForm(true);
  };

  const handleEditProposal = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowCreateForm(true);
  };

  const handleDeleteProposal = async (proposalId: string) => {
    if (!confirm('Are you sure you want to delete this proposal?')) return;

    try {
      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', proposalId);

      if (error) throw error;
      
      // Refresh proposals list
      await fetchProposals();
      showNotification('success', 'Proposal Deleted', 'Proposal has been deleted successfully');
    } catch (error) {
      console.error('Error deleting proposal:', error);
      alert('Failed to delete proposal');
    }
  };

  const handleFormClose = () => {
    setShowCreateForm(false);
    setSelectedProposal(null);
    fetchProposals(); // Refresh the list
  };

  const handleManageOptions = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowOptionsManager(true);
  };

  const handleOptionsManagerClose = () => {
    setShowOptionsManager(false);
    setSelectedProposal(null);
    fetchProposals(); // Refresh the list
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
    return `${window.location.origin}/proposal/${shareLink}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading proposals...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="px-4 sm:px-6 py-8">
        <div className="w-full">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-6 w-6 text-accent-400" />
              <h1 className="text-2xl font-bold text-white">Proposals</h1>
              {isAdmin && (
                <span className="bg-accent-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  ADMIN VIEW - ALL PROPOSALS
                </span>
              )}
            </div>
            <p className="text-gray-400">
              {isAdmin ? 'Manage all flight proposals and client quotes in the system' : 'Manage your flight proposals and client quotes'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search proposals by name, client, or email..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:border-accent-500"
              />
            </div>
            <button
              onClick={handleCreateProposal}
              className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Proposal
            </button>
          </div>

          {/* Proposals List */}
          {filteredProposals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {searchQuery ? 'No proposals found' : 'No proposals yet'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchQuery 
                  ? 'Try adjusting your search criteria'
                  : 'Create your first proposal to get started'
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreateProposal}
                  className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Create First Proposal
                </button>
              )}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-850 border-b border-gray-800">
                    <tr>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Proposal</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Client</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Status</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Created</th>
                      <th className="text-right text-gray-300 font-medium py-4 px-6">Total</th>
                      <th className="text-center text-gray-300 font-medium py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProposals.map((proposal, index) => (
                      <tr key={proposal.id} className={`border-b border-gray-800 hover:bg-gray-850 transition-colors cursor-pointer ${
                        index === filteredProposals.length - 1 ? 'border-b-0' : ''
                      }`}
                          onClick={() => navigate(`/proposals/${proposal.id}`)}>
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
                          {(() => {
                            const clientDisplay = getClientDisplay(proposal);
                            return (
                              <div>
                                <div className="text-white font-medium flex items-center gap-2">
                                  {clientDisplay.name}
                                  {clientDisplay.additional > 0 && (
                                    <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs">
                                      +{clientDisplay.additional} more
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400">{clientDisplay.email}</div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(proposal.status)}`}>
                            {proposal.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-white">{formatDate(proposal.created_at)}</div>
                          <div className="text-xs text-gray-400">
                            Updated {formatDate(proposal.updated_at)}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-lg font-semibold text-white">
                            {formatPrice(proposal.total_price)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleManageOptions(proposal)}
                              className="p-2 text-gray-400 hover:text-accent-400 hover:bg-gray-700 rounded transition-colors"
                              title="View proposal details"
                            >
                              <Plane className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(getShareUrl(proposal.share_link), '_blank');
                              }}
                              className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                              title="Preview proposal"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProposal(proposal.id);
                              }}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                              title="Delete proposal"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          
                          {/* Share Link Row */}
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <ExternalLink className="h-3 w-3 text-gray-500" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(getShareUrl(proposal.share_link));
                                alert('Share link copied to clipboard!');
                              }}
                              className="text-xs text-gray-500 hover:text-accent-400 transition-colors"
                            >
                              Copy Link
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

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <ProposalForm
          proposal={selectedProposal}
          onClose={handleFormClose}
        />
      )}

      {/* Proposal Options Manager Modal */}
      {showOptionsManager && selectedProposal && (
        <ProposalOptionsManager
          proposal={selectedProposal}
          onClose={handleOptionsManagerClose}
        />
      )}
    </div>
  );
};

export default ProposalsPage;
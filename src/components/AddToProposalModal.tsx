import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Plus, Loader, Search, User, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { FlightSolution, GroupedFlight } from '../types/flight';
import ClientSelectionDropdown from './ClientSelectionDropdown';

interface Proposal {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
}

interface AddToProposalModalProps {
  flight: FlightSolution | GroupedFlight;
  onClose: () => void;
}

const AddToProposalModal: React.FC<AddToProposalModalProps> = ({ flight, onClose }) => {
  const { user, profile } = useAuth();
  const { showNotification } = useNotification();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentNotes, setAgentNotes] = useState('');
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [proposalSearchQuery, setProposalSearchQuery] = useState('');
  const [showCreateProposal, setShowCreateProposal] = useState(false);

  // New proposal form data
  const [newProposalData, setNewProposalData] = useState({
    name: '',
    notes: ''
  });
  
  const isAdmin = profile?.role === 'admin';

  // Get flight data based on type
  const isGroupedFlight = 'outboundSlice' in flight;
  const flightPrice = isGroupedFlight 
    ? (flight as GroupedFlight).returnOptions[0]?.displayTotal || 0
    : (flight as FlightSolution).displayTotal || 0;

  useEffect(() => {
    setSelectedPrice(flightPrice);
  }, [flightPrice]);

  // Fetch user's proposals and clients
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch proposals
        let proposalQuery = supabase
          .from('proposals')
          .select('id, name, first_name, last_name, email, status');
        
        // Apply user filter only if not admin
        if (!isAdmin) {
          proposalQuery = proposalQuery.eq('user_id', user.id);
        }
        
        const { data: proposalData, error: proposalError } = await proposalQuery
          .order('updated_at', { ascending: false });

        if (proposalError) throw proposalError;

        let finalQuery = supabase
          .from('clients')
          .select('id, first_name, last_name, email, phone, company');
          
        if (!isAdmin) {
          finalQuery = finalQuery.eq('user_id', user.id);
        }
        
        const { data: clientData, error: clientError } = await finalQuery
          .order('updated_at', { ascending: false });

        if (clientError) throw clientError;

        setProposals(proposalData || []);
        setClients(clientData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setProposals([]);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Filter proposals based on search query
  const filteredProposals = proposals.filter(proposal => {
    const searchText = proposalSearchQuery.toLowerCase();
    return (
      proposal.name.toLowerCase().includes(searchText) ||
      proposal.first_name.toLowerCase().includes(searchText) ||
      proposal.last_name.toLowerCase().includes(searchText) ||
      proposal.email.toLowerCase().includes(searchText) ||
      `${proposal.first_name} ${proposal.last_name}`.toLowerCase().includes(searchText)
    );
  });

  const handleCreateClient = async (clientData: any) => {
    if (!user) throw new Error('User not authenticated');
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...clientData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add to clients list
      setClients([data, ...clients]);
      setSelectedClientId(data.id);
      showNotification('success', 'Client Created', `${data.first_name} ${data.last_name} has been created successfully`);
    } catch (error) {
      console.error('Error creating client:', error);
      throw new Error('Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProposal = async () => {
    if (!user || !selectedClientId) return;

    setSaving(true);
    try {
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (!selectedClient) throw new Error('Client not found');

      const { data, error } = await supabase
        .from('proposals')
        .insert({
          user_id: user.id,
          name: newProposalData.name || `Proposal for ${selectedClient.first_name} ${selectedClient.last_name}`,
          notes: newProposalData.notes,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      // Create the proposal-client relationship
      const { error: relationshipError } = await supabase
        .from('proposal_clients')
        .insert({
          proposal_id: data.id,
          client_id: selectedClientId,
          is_primary: true
        });

      if (relationshipError) throw relationshipError;

      // Add flight to the new proposal
      await addFlightToProposal(data.id);
    } catch (error) {
      console.error('Error creating proposal:', error);
      alert('Failed to create proposal');
    } finally {
      setSaving(false);
    }
  };

  const addFlightToProposal = async (proposalId: string) => {
    try {
      // Get the next option number for this proposal
      const { data: existingOptions } = await supabase
        .from('proposal_options')
        .select('option_number')
        .eq('proposal_id', proposalId)
        .order('option_number', { ascending: false })
        .limit(1);

      const nextOptionNumber = (existingOptions?.[0]?.option_number || 0) + 1;

      // Add flight to proposal
      const { error } = await supabase
        .from('proposal_options')
        .insert({
          proposal_id: proposalId,
          flight_data: flight,
          agent_notes: agentNotes,
          selected_price: selectedPrice,
          option_number: nextOptionNumber,
          is_hidden: false
        });

      if (error) throw error;

      onClose();
      showNotification('success', 'Flight Added to Proposal', 'Flight option has been added successfully');
    } catch (error) {
      console.error('Error adding flight to proposal:', error);
      alert('Failed to add flight to proposal');
    }
  };

  const handleSave = async () => {
    if (!selectedProposalId || !user) return;
    await addFlightToProposal(selectedProposalId);
  };

  const getFlightSummary = () => {
    if (isGroupedFlight) {
      const grouped = flight as GroupedFlight;
      return `${grouped.outboundSlice.origin.code} ⇄ ${grouped.outboundSlice.destination.code}`;
    } else {
      const regular = flight as FlightSolution;
      const firstSlice = regular.slices[0];
      const lastSlice = regular.slices[regular.slices.length - 1];
      if (regular.slices.length === 1) {
        return `${firstSlice.origin.code} → ${lastSlice.destination.code}`;
      } else {
        return `${firstSlice.origin.code} ⇄ ${lastSlice.destination.code}`;
      }
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <div className="text-center">
            <Loader className="h-8 w-8 text-accent-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-300">Loading proposals...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Add to Proposal</h3>
              <p className="text-sm text-gray-400">{getFlightSummary()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Flight Summary */}
          <div className="bg-gray-850 border border-gray-700 rounded-lg p-4">
            <h4 className="text-lg font-medium text-white mb-2">Flight Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Route:</span>
                <span className="text-white ml-2">{getFlightSummary()}</span>
              </div>
              <div>
                <span className="text-gray-400">Original Price:</span>
                <span className="text-white ml-2">{formatPrice(flightPrice)}</span>
              </div>
            </div>
          </div>

          {/* Add to Existing Proposal */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Add to Existing Proposal</h4>
            
            {/* Proposal Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={proposalSearchQuery}
                onChange={(e) => setProposalSearchQuery(e.target.value)}
                placeholder="Search proposals by name or client..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500"
              />
            </div>

            {filteredProposals.length === 0 && proposalSearchQuery === '' ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No proposals found</p>
                <p className="text-sm text-gray-500">Create a proposal to add flight options</p>
              </div>
            ) : (
              <select
                value={selectedProposalId}
                onChange={(e) => setSelectedProposalId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500"
              >
                <option value="">Choose a proposal...</option>
                {filteredProposals.map((proposal) => (
                  <option key={proposal.id} value={proposal.id}>
                    {proposal.name} - {proposal.first_name} {proposal.last_name} ({proposal.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Create New Proposal */}
          <div className="border-t border-gray-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Create New Proposal</h4>
              <button
                onClick={() => setShowCreateProposal(!showCreateProposal)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Proposal
              </button>
            </div>

            {showCreateProposal && (
              <div className="bg-gray-850 border border-gray-700 rounded-lg p-4 space-y-4">
                {/* Client Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Select Client *</label>
                  <ClientSelectionDropdown
                    clients={clients}
                    selectedClientId={selectedClientId}
                    onSelectClient={setSelectedClientId}
                    onCreateClient={handleCreateClient}
                    saving={saving}
                    placeholder="Choose a client..."
                  />
                </div>

                {/* Proposal Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Proposal Name (Optional)</label>
                  <input
                    type="text"
                    value={newProposalData.name}
                    onChange={(e) => setNewProposalData({...newProposalData, name: e.target.value})}
                    placeholder="Leave empty for auto-generated name"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Proposal Notes</label>
                  <textarea
                    value={newProposalData.notes}
                    onChange={(e) => setNewProposalData({...newProposalData, notes: e.target.value})}
                    placeholder="Internal notes about this proposal..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Flight Configuration */}
          <div className="border-t border-gray-800 pt-6 space-y-4">
            <h4 className="text-lg font-semibold text-white">Flight Configuration</h4>
            
            {/* Selected Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Selected Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={selectedPrice}
                  onChange={(e) => setSelectedPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500"
                  min="0"
                  step="50"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                You can adjust the price for the client (original: {formatPrice(flightPrice)})
              </p>
            </div>

            {/* Agent Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Agent Notes (Optional)
              </label>
              <textarea
                value={agentNotes}
                onChange={(e) => setAgentNotes(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500"
                placeholder="Add notes for the client about this flight option..."
                rows={3}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            
            {showCreateProposal && selectedClientId ? (
              <button
                onClick={handleCreateProposal}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Creating...' : 'Create Proposal & Add Flight'}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !selectedProposalId}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Adding...' : 'Add to Proposal'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddToProposalModal;
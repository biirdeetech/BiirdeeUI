import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Plus, Loader, Search, User, Mail, ChevronDown, Plane, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { FlightSolution, GroupedFlight } from '../types/flight';
import ClientSelectionDropdown from './ClientSelectionDropdown';
import { useProposalContext } from '../contexts/ProposalContext';

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
  selectedMileageFlight?: any;
  pendingItems?: Array<{type: 'flight' | 'aero' | 'award', id: string, data: any}>;
  perCentValue?: number;
  flightCardId?: string;
  onClose: () => void;
  onItemRemoved?: (itemId: string) => void;
}

const AddToProposalModal: React.FC<AddToProposalModalProps> = ({ flight, selectedMileageFlight, pendingItems = [], perCentValue = 0.015, onClose, onItemRemoved, flightCardId = '' }) => {
  const { user, profile } = useAuth();
  const { showNotification } = useNotification();
  const { getProposalCount, addToProposal, lastSelectedProposalId, setLastSelectedProposalId } = useProposalContext();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState(lastSelectedProposalId || '');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentNotes, setAgentNotes] = useState('');
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [proposalSearchQuery, setProposalSearchQuery] = useState('');
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [existingProposalOptions, setExistingProposalOptions] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

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

  // Initialize selectedProposalId from context if available
  useEffect(() => {
    if (lastSelectedProposalId && !selectedProposalId) {
      setSelectedProposalId(lastSelectedProposalId);
    }
  }, [lastSelectedProposalId]);

  // Update context when proposal selection changes
  useEffect(() => {
    if (selectedProposalId) {
      setLastSelectedProposalId(selectedProposalId);
    }
  }, [selectedProposalId, setLastSelectedProposalId]);

  // Fetch existing proposal options when a proposal is selected
  useEffect(() => {
    const fetchProposalOptions = async () => {
      if (!selectedProposalId) {
        setExistingProposalOptions([]);
        return;
      }

      setLoadingOptions(true);
      try {
        const { data, error } = await supabase
          .from('proposal_options')
          .select('*')
          .eq('proposal_id', selectedProposalId)
          .order('option_number', { ascending: true });

        if (error) throw error;
        setExistingProposalOptions(data || []);
      } catch (error) {
        console.error('Error fetching proposal options:', error);
        setExistingProposalOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchProposalOptions();
  }, [selectedProposalId]);

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
      (proposal.email && proposal.email.toLowerCase().includes(searchText)) ||
      `${proposal.first_name} ${proposal.last_name}`.toLowerCase().includes(searchText)
    );
  }).map(proposal => ({
    ...proposal,
    itemCount: getProposalCount(proposal.id)
  }));

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
      setSaving(true);
      
      // Get the next option number for this proposal
      const { data: existingOptions } = await supabase
        .from('proposal_options')
        .select('option_number')
        .eq('proposal_id', proposalId)
        .order('option_number', { ascending: false })
        .limit(1);

      let nextOptionNumber = (existingOptions?.[0]?.option_number || 0) + 1;

      // Prepare items to add - use pendingItems if available, otherwise fallback to single item
      const itemsToAdd = pendingItems.length > 0 ? pendingItems : [
        selectedMileageFlight 
          ? { type: 'aero' as const, id: 'single', data: selectedMileageFlight }
          : { type: 'flight' as const, id: 'flight', data: flight }
      ];

      // Add all items to proposal
      const itemsToInsert = itemsToAdd.map((item) => {
        let flightDataToSave: any;
        
        if (item.type === 'flight') {
          flightDataToSave = item.data;
        } else if (item.type === 'aero' || item.type === 'award') {
          // Mileage/award option - attach to base flight
          flightDataToSave = {
            ...flight,
            selectedMileageOption: item.data,
            mileageDetails: {
              carrier: item.data.carrierCode,
              mileage: item.data.mileage || item.data.miles,
              mileagePrice: item.data.mileagePrice || item.data.tax,
              totalValue: ((item.data.mileage || item.data.miles) * perCentValue) + parseFloat((item.data.mileagePrice || item.data.tax || 0).toString())
            }
          };
        }

        return {
          proposal_id: proposalId,
          flight_data: flightDataToSave,
          agent_notes: agentNotes,
          selected_price: selectedPrice,
          option_number: nextOptionNumber++,
          is_hidden: false
        };
      });

      // Group items: flight + its mileage options as one entry
      const flightItem = itemsToAdd.find(item => item.type === 'flight');
      const mileageItems = itemsToAdd.filter(item => item.type === 'aero' || item.type === 'award');
      
      if (flightItem) {
        // Single entry with flight + all mileage options nested
        const flightDataToSave = {
          ...flightItem.data,
          mileageOptions: mileageItems.map(item => ({
            type: item.type,
            data: item.data,
            mileageDetails: {
              carrier: item.data.carrierCode,
              mileage: item.data.mileage || item.data.miles,
              mileagePrice: item.data.mileagePrice || item.data.tax,
              totalValue: ((item.data.mileage || item.data.miles) * perCentValue) + parseFloat((item.data.mileagePrice || item.data.tax || 0).toString())
            }
          }))
        };

        const { error } = await supabase
          .from('proposal_options')
          .insert({
            proposal_id: proposalId,
            flight_data: flightDataToSave,
            agent_notes: agentNotes,
            selected_price: selectedPrice,
            option_number: nextOptionNumber,
            is_hidden: false
          });

        if (error) throw error;
        
        // Track in context
        if (flightCardId) {
          const itemIds = new Set(['flight', ...mileageItems.map(item => item.id)]);
          addToProposal(flightCardId, proposalId, itemIds);
        }

        // Refresh existing options to show the newly added item
        const { data: refreshedOptions, error: refreshError } = await supabase
          .from('proposal_options')
          .select('*')
          .eq('proposal_id', proposalId)
          .order('option_number', { ascending: true });

        if (!refreshError && refreshedOptions) {
          setExistingProposalOptions(refreshedOptions);
        }
      } else if (mileageItems.length > 0) {
        // Only mileage items (shouldn't happen, but handle it)
        const itemsToInsert = mileageItems.map((item) => ({
          proposal_id: proposalId,
          flight_data: {
            ...flight,
            selectedMileageOption: item.data,
            mileageDetails: {
              carrier: item.data.carrierCode,
              mileage: item.data.mileage || item.data.miles,
              mileagePrice: item.data.mileagePrice || item.data.tax,
              totalValue: ((item.data.mileage || item.data.miles) * perCentValue) + parseFloat((item.data.mileagePrice || item.data.tax || 0).toString())
            }
          },
          agent_notes: agentNotes,
          selected_price: selectedPrice,
          option_number: nextOptionNumber++,
          is_hidden: false
        }));

        const { error } = await supabase
          .from('proposal_options')
          .insert(itemsToInsert);

        if (error) throw error;

        // Refresh existing options
        const { data: refreshedOptions } = await supabase
          .from('proposal_options')
          .select('*')
          .eq('proposal_id', proposalId)
          .order('option_number', { ascending: true });
        
        if (refreshedOptions) {
          setExistingProposalOptions(refreshedOptions);
        }
      }

      // Refresh existing options one more time to ensure we have the latest
      const { data: finalOptions } = await supabase
        .from('proposal_options')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('option_number', { ascending: true });
      
      if (finalOptions) {
        setExistingProposalOptions(finalOptions);
      }

      showNotification('success', 'Items Added to Proposal', `Flight and ${mileageItems.length} mileage option${mileageItems.length !== 1 ? 's' : ''} added successfully`);
      
      // Clear pending items after successful save so they don't show in "New Items to Add"
      if (onItemRemoved) {
        const itemsToRemove = flightItem 
          ? ['flight', ...mileageItems.map(item => item.id)]
          : mileageItems.map(item => item.id);
        itemsToRemove.forEach(id => {
          onItemRemoved(id);
        });
      }
      
      // Don't close the modal - keep it open so user can see all items including the newly added one
      // The modal will show existing items in "Already in Proposal" and empty "New Items to Add"
    } catch (error) {
      console.error('Error adding items to proposal:', error);
      alert('Failed to add items to proposal');
    } finally {
      setSaving(false);
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

  // Group items: flight + mileage options
  const flightItem = pendingItems.find(item => item.type === 'flight') || (!selectedMileageFlight && pendingItems.length === 0 ? { type: 'flight' as const, id: 'flight', data: flight } : null);
  const mileageItems = pendingItems.length > 0 
    ? pendingItems.filter(item => item.type === 'aero' || item.type === 'award')
    : selectedMileageFlight 
      ? [{ type: 'aero' as const, id: 'single', data: selectedMileageFlight }]
      : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border border-gray-800/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modern Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800/50 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2.5 rounded-xl shadow-lg">
              <Plus className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Add to Proposal</h3>
              <p className="text-xs text-gray-400 mt-0.5">{getFlightSummary()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800/50 p-1.5 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Existing Proposal Items */}
          {selectedProposalId && existingProposalOptions.length > 0 && (
            <div className="bg-gray-800/20 border border-gray-700/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Already in Proposal ({existingProposalOptions.length})</h4>
                {loadingOptions && <Loader className="h-4 w-4 text-gray-400 animate-spin" />}
              </div>
              {existingProposalOptions.map((option, idx) => {
                const flightData = option.flight_data;
                const isGrouped = 'outboundSlice' in flightData;
                const summary = isGrouped
                  ? `${flightData.outboundSlice.origin.code} ⇄ ${flightData.outboundSlice.destination.code}`
                  : flightData.slices?.length === 1
                    ? `${flightData.slices[0].origin.code} → ${flightData.slices[flightData.slices.length - 1].destination.code}`
                    : `${flightData.slices[0].origin.code} ⇄ ${flightData.slices[flightData.slices.length - 1].destination.code}`;
                const price = flightData.displayTotal || 0;
                const mileageOptions = flightData.mileageOptions || [];

                return (
                  <div key={option.id || idx} className="bg-gray-900/30 border border-gray-700/20 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-success-500/10 p-2 rounded-lg border border-success-500/20">
                        <Plane className="h-3.5 w-3.5 text-success-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-success-400">Option {option.option_number}</span>
                          <span className="text-sm font-semibold text-white truncate">{summary}</span>
                        </div>
                        <div className="text-xs font-medium text-gray-400">{formatPrice(price)}</div>
                        {mileageOptions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-700/20">
                            <div className="text-xs text-gray-500 mb-1">{mileageOptions.length} mileage option{mileageOptions.length !== 1 ? 's' : ''}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* New Items to Add */}
          {flightItem && (
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-2">New Items to Add</h4>
              {/* Main Flight */}
              <div className="flex items-start gap-3">
                <div className="bg-blue-500/12 p-2 rounded-lg border border-blue-500/25">
                  <Plane className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">Main Flight</span>
                      <span className="text-sm font-semibold text-white truncate">{getFlightSummary()}</span>
                    </div>
                    {onItemRemoved && (
                      <button
                        onClick={() => onItemRemoved('flight')}
                        className="text-error-400 hover:text-error-300 text-xs px-2 py-1 hover:bg-error-500/10 rounded transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-300">{formatPrice(flightPrice)}</div>
                </div>
              </div>

              {/* Mileage Options Nested */}
              {mileageItems.length > 0 && (
                <div className="ml-11 space-y-2 pt-2 border-t border-gray-700/30">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Mileage Options ({mileageItems.length})</div>
                  {mileageItems.map((item, idx) => {
                    const mileage = item.data.mileage || item.data.miles;
                    const price = item.data.mileagePrice || item.data.tax;
                    const totalValue = (mileage * perCentValue) + parseFloat((price || 0).toString());
                    const carrier = item.data.carrierCode || 'N/A';
                    
                    return (
                      <div key={item.id || idx} className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 flex items-center justify-between group hover:border-gray-600/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-1.5 rounded ${
                            item.type === 'aero' 
                              ? 'bg-warning-500/12 border border-warning-500/25' 
                              : 'bg-purple-500/12 border border-purple-500/25'
                          }`}>
                            <Award className={`h-3.5 w-3.5 ${item.type === 'aero' ? 'text-warning-400' : 'text-purple-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-white">{carrier}</span>
                              {item.data.cabin && (
                                <span className="text-xs text-gray-400">{item.data.cabin}</span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-1.5 text-xs">
                              <span className="text-gray-400">{mileage?.toLocaleString()}</span>
                              <span className="text-gray-500">mi</span>
                              <span className="text-gray-600 mx-1">+</span>
                              <span className="text-gray-400">${typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')).toFixed(2) : price?.toFixed(2)}</span>
                              <span className="text-gray-600 mx-1">=</span>
                              <span className="text-white font-semibold">${totalValue.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        {onItemRemoved && (
                          <button
                            onClick={() => onItemRemoved(item.id)}
                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Add to Existing Proposal */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wide">Select Proposal</h4>
            
            {/* Proposal Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={proposalSearchQuery}
                onChange={(e) => setProposalSearchQuery(e.target.value)}
                placeholder="Search proposals..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
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
                onChange={(e) => {
                  setSelectedProposalId(e.target.value);
                  if (e.target.value) {
                    setLastSelectedProposalId(e.target.value);
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500"
              >
                <option value="">Choose a proposal...</option>
                {filteredProposals.map((proposal) => (
                  <option key={proposal.id} value={proposal.id}>
                    {proposal.name} - {proposal.first_name} {proposal.last_name} ({proposal.status}){proposal.itemCount > 0 ? ` - ${proposal.itemCount} item${proposal.itemCount !== 1 ? 's' : ''} added` : ''}
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
                className="bg-success-600 hover:bg-success-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
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
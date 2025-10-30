import React, { useState, useEffect } from 'react';
import { X, Save, Plane, Plus, Eye, EyeOff, Trash2, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPrice } from '../utils/priceFormatter';

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
}

interface ProposalOption {
  id: string;
  proposal_id: string;
  flight_data: any; // FlightSolution or GroupedFlight
  is_hidden: boolean;
  agent_notes: string;
  selected_price: number;
  option_number: number;
  created_at: string;
  updated_at: string;
}

interface ProposalOptionsManagerProps {
  proposal: Proposal;
  onClose: () => void;
}

const ProposalOptionsManager: React.FC<ProposalOptionsManagerProps> = ({ proposal, onClose }) => {
  const [options, setOptions] = useState<ProposalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch proposal options
  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('proposal_options')
        .select('*')
        .eq('proposal_id', proposal.id)
        .order('option_number', { ascending: true });

      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      console.error('Error fetching proposal options:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, [proposal.id]);

  const updateOption = async (optionId: string, updates: Partial<ProposalOption>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('proposal_options')
        .update(updates)
        .eq('id', optionId);

      if (error) throw error;
      
      // Refresh options
      await fetchOptions();
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
      await fetchOptions();
    } catch (error) {
      console.error('Error deleting option:', error);
      alert('Failed to delete option');
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <div className="text-center">
            <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
            <p className="text-gray-300">Loading options...</p>
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
            <div className="bg-accent-600 p-2 rounded-lg">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Flight Options</h3>
              <p className="text-sm text-gray-400">
                {proposal.name} - {proposal.first_name} {proposal.last_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {options.length === 0 ? (
            <div className="text-center py-12">
              <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">No flight options yet</h4>
              <p className="text-gray-400 mb-6">
                Add flight options from search results or hack results to build this proposal.
              </p>
              <button
                onClick={onClose}
                className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Go to Search
              </button>
            </div>
          ) : (
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
          )}

          {/* Summary */}
          {options.length > 0 && (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalOptionsManager;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { ArrowLeft, Route, Globe, Plus, X, Save, Trash2, Target, Plane, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';

interface RouteConfiguration {
  id: string;
  user_id: string;
  destination_city: string;
  region: 'north_america' | 'europe' | 'asia' | 'south_america' | 'australia';
  strategy_type: 'frt_origins' | 'frt_destinations' | 'skiplag_finals';
  airport_codes: string[];
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface NewConfigForm {
  destination_city: string;
  region: 'north_america' | 'europe' | 'asia' | 'south_america' | 'australia';
  strategy_type: 'frt_origins' | 'frt_destinations' | 'skiplag_finals';
  airport_codes: string[];
  notes: string;
}

const REGIONS = [
  { value: 'north_america', label: 'North America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'south_america', label: 'South America' },
  { value: 'australia', label: 'Australia' }
];

const STRATEGY_TYPES = [
  { value: 'frt_origins', label: 'FRT Return Origins', description: 'Cities to search for fake return flights' },
  { value: 'frt_destinations', label: 'FRT Return Destinations', description: 'Destinations for fake return flights' },
  { value: 'skiplag_finals', label: 'Skiplag Final Cities', description: 'Final destinations for skiplag routing' }
];

// Predefined airports by region
const REGIONAL_AIRPORTS = {
  north_america: ['LAX', 'JFK', 'ORD', 'DFW', 'DEN', 'ATL', 'BOS', 'IAD', 'SFO', 'SEA', 'YVR', 'YYZ', 'MEX'],
  europe: ['LHR', 'CDG', 'FRA', 'AMS', 'MAD', 'FCO', 'MUC', 'VIE', 'ZUR', 'CPH', 'ARN', 'OSL', 'DUB'],
  asia: ['NRT', 'ICN', 'PVG', 'HKG', 'SIN', 'BKK', 'KUL', 'CGK', 'MNL', 'TPE', 'DEL', 'BOM', 'DOH'],
  south_america: ['GRU', 'SCL', 'LIM', 'BOG', 'EZE', 'GIG', 'UIO', 'CCS', 'ASU', 'MVD', 'CWB', 'FOR'],
  australia: ['SYD', 'MEL', 'BNE', 'PER', 'ADL', 'DRW', 'CNS', 'AKL', 'CHC', 'WLG', 'NOU', 'VLI']
};

const AdminRoutesPage: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [configurations, setConfigurations] = useState<RouteConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [newConfig, setNewConfig] = useState<NewConfigForm>({
    destination_city: '',
    region: 'north_america',
    strategy_type: 'frt_origins',
    airport_codes: [],
    notes: ''
  });

  const isAdmin = profile?.role === 'admin';

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Fetch configurations
  const fetchConfigurations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('route_configurations')
        .select('*')
        .order('destination_city', { ascending: true });

      if (error) throw error;
      setConfigurations(data || []);
    } catch (error) {
      console.error('Error fetching route configurations:', error);
      setConfigurations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchConfigurations();
    }
  }, [user, isAdmin]);

  // Filter configurations
  const filteredConfigurations = configurations.filter(config => {
    const matchesSearch = searchQuery === '' || 
      config.destination_city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.airport_codes.some(code => code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      config.notes.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDestination = selectedDestination === '' || config.destination_city === selectedDestination;
    
    return matchesSearch && matchesDestination;
  });

  // Get unique destinations for filter
  const uniqueDestinations = [...new Set(configurations.map(c => c.destination_city))].sort();

  const addAirportCode = (code: string) => {
    const upperCode = code.trim().toUpperCase();
    if (upperCode && !newConfig.airport_codes.includes(upperCode)) {
      setNewConfig({
        ...newConfig,
        airport_codes: [...newConfig.airport_codes, upperCode]
      });
    }
  };

  const removeAirportCode = (code: string) => {
    setNewConfig({
      ...newConfig,
      airport_codes: newConfig.airport_codes.filter(c => c !== code)
    });
  };

  const addRegionalAirports = () => {
    const regionalCodes = REGIONAL_AIRPORTS[newConfig.region] || [];
    const newCodes = regionalCodes.filter(code => !newConfig.airport_codes.includes(code));
    
    setNewConfig({
      ...newConfig,
      airport_codes: [...newConfig.airport_codes, ...newCodes]
    });
  };

  const clearAirportCodes = () => {
    setNewConfig({
      ...newConfig,
      airport_codes: []
    });
  };

  const handleCreateConfig = async () => {
    if (!user || !newConfig.destination_city || newConfig.airport_codes.length === 0) {
      alert('Please fill in destination city and add at least one airport code');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('route_configurations')
        .insert({
          user_id: user.id,
          destination_city: newConfig.destination_city.toUpperCase(),
          region: newConfig.region,
          strategy_type: newConfig.strategy_type,
          airport_codes: newConfig.airport_codes,
          notes: newConfig.notes,
          is_active: true
        });

      if (error) throw error;

      setShowCreateForm(false);
      setNewConfig({
        destination_city: '',
        region: 'north_america',
        strategy_type: 'frt_origins',
        airport_codes: [],
        notes: ''
      });

      await fetchConfigurations();
      showNotification('success', 'Configuration Created', `Route configuration for ${newConfig.destination_city} has been created`);
    } catch (error) {
      console.error('Error creating configuration:', error);
      alert('Failed to create configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleConfigActive = async (configId: string, currentActive: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('route_configurations')
        .update({ is_active: !currentActive })
        .eq('id', configId);

      if (error) throw error;

      await fetchConfigurations();
      showNotification('success', 'Configuration Updated', `Configuration has been ${!currentActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating configuration:', error);
      alert('Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const deleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this route configuration?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('route_configurations')
        .delete()
        .eq('id', configId);

      if (error) throw error;

      await fetchConfigurations();
      showNotification('success', 'Configuration Deleted', 'Route configuration has been deleted');
    } catch (error) {
      console.error('Error deleting configuration:', error);
      alert('Failed to delete configuration');
    } finally {
      setSaving(false);
    }
  };

  const getRegionLabel = (region: string) => {
    return REGIONS.find(r => r.value === region)?.label || region;
  };

  const getStrategyLabel = (strategyType: string) => {
    return STRATEGY_TYPES.find(s => s.value === strategyType)?.label || strategyType;
  };

  const getStrategyColor = (strategyType: string) => {
    switch (strategyType) {
      case 'frt_origins': return 'bg-success-500/20 text-success-400';
      case 'frt_destinations': return 'bg-blue-500/20 text-blue-400';
      case 'skiplag_finals': return 'bg-accent-500/20 text-accent-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="px-4 sm:px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
              <p className="text-gray-400 mb-6">This page is only accessible to administrators.</p>
              <button
                onClick={() => navigate('/')}
                className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />

      <main className="px-4 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 text-accent-400 hover:text-accent-300 transition-colors text-sm font-medium mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </button>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-accent-600 p-3 rounded-lg">
                  <Route className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Admin Routes</h1>
                  <p className="text-gray-400">Configure smart routing for FRT and Skiplag strategies</p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Configuration
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by destination, airport codes, or notes..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-accent-500"
                />
              </div>
              
              <div className="lg:w-48">
                <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Destination</label>
                <select
                  value={selectedDestination}
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:border-accent-500"
                >
                  <option value="">All Destinations</option>
                  {uniqueDestinations.map(dest => (
                    <option key={dest} value={dest}>{dest}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Configurations List */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Route Configurations ({filteredConfigurations.length})
                </h2>
                <div className="text-sm text-gray-400">
                  Active: {filteredConfigurations.filter(c => c.is_active).length}
                </div>
              </div>
            </div>

            {filteredConfigurations.length === 0 ? (
              <div className="p-12 text-center">
                <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No route configurations</h3>
                <p className="text-gray-400 mb-6">
                  {searchQuery || selectedDestination
                    ? 'No configurations match your filters'
                    : 'Create your first route configuration to optimize flight search strategies'
                  }
                </p>
                {!searchQuery && !selectedDestination && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Create First Configuration
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-850 border-b border-gray-800">
                    <tr>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Destination</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Region</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Strategy Type</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Airport Codes</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Status</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Updated</th>
                      <th className="text-center text-gray-300 font-medium py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConfigurations.map((config, index) => (
                      <tr key={config.id} className={`border-b border-gray-800 hover:bg-gray-850 transition-colors ${
                        index === filteredConfigurations.length - 1 ? 'border-b-0' : ''
                      }`}>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="bg-accent-600 p-2 rounded">
                              <Plane className="h-3 w-3 text-white" />
                            </div>
                            <div>
                              <div className="text-white font-medium">{config.destination_city}</div>
                              {config.notes && (
                                <div className="text-sm text-gray-400 truncate max-w-xs">
                                  {config.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-300">{getRegionLabel(config.region)}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStrategyColor(config.strategy_type)}`}>
                            {getStrategyLabel(config.strategy_type)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {config.airport_codes.slice(0, 6).map((code) => (
                              <span key={code} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-mono">
                                {code}
                              </span>
                            ))}
                            {config.airport_codes.length > 6 && (
                              <span className="px-2 py-1 bg-gray-600 text-gray-400 rounded text-xs">
                                +{config.airport_codes.length - 6} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => toggleConfigActive(config.id, config.is_active)}
                            disabled={saving}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              config.is_active
                                ? 'bg-success-500/20 text-success-400 hover:bg-success-500/30'
                                : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                            }`}
                          >
                            {config.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-gray-300">
                            {new Date(config.updated_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => deleteConfig(config.id)}
                              disabled={saving}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                              title="Delete configuration"
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
            )}
          </div>
        </div>
      </main>

      {/* Create Configuration Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="bg-accent-600 p-2 rounded-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Create Route Configuration</h3>
                  <p className="text-sm text-gray-400">Set up smart routing for a destination city</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Configuration */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-white">Basic Configuration</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Destination City *
                    </label>
                    <input
                      type="text"
                      value={newConfig.destination_city}
                      onChange={(e) => setNewConfig({...newConfig, destination_city: e.target.value.toUpperCase()})}
                      placeholder="e.g., CDG, LHR, NRT"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-accent-500 font-mono"
                      maxLength={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Region</label>
                    <select
                      value={newConfig.region}
                      onChange={(e) => setNewConfig({...newConfig, region: e.target.value as any})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-accent-500"
                    >
                      {REGIONS.map(region => (
                        <option key={region.value} value={region.value}>
                          {region.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Strategy Type</label>
                    <select
                      value={newConfig.strategy_type}
                      onChange={(e) => setNewConfig({...newConfig, strategy_type: e.target.value as any})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-accent-500"
                    >
                      {STRATEGY_TYPES.map(strategy => (
                        <option key={strategy.value} value={strategy.value}>
                          {strategy.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {STRATEGY_TYPES.find(s => s.value === newConfig.strategy_type)?.description}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                    <textarea
                      value={newConfig.notes}
                      onChange={(e) => setNewConfig({...newConfig, notes: e.target.value})}
                      placeholder="Optional notes about this configuration..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-accent-500"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Airport Codes Management */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-white">Airport Codes</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={addRegionalAirports}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                      >
                        Add {getRegionLabel(newConfig.region)} Airports
                      </button>
                      <button
                        onClick={clearAirportCodes}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Current Airport Codes */}
                  <div className="min-h-[100px] bg-gray-850 border border-gray-700 rounded-lg p-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {newConfig.airport_codes.map((code) => (
                        <span key={code} className="inline-flex items-center gap-1 px-3 py-1 bg-accent-500/20 text-accent-300 rounded text-sm font-mono">
                          {code}
                          <button
                            onClick={() => removeAirportCode(code)}
                            className="text-accent-300 hover:text-accent-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add airport code (e.g., LAX)"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-accent-500 font-mono"
                        maxLength={3}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addAirportCode(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <span className="text-xs text-gray-500 self-center">
                        Press Enter to add
                      </span>
                    </div>
                  </div>

                  {/* Regional Airports Preview */}
                  <div className="bg-gray-850 border border-gray-700 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-gray-300 mb-3">
                      Available {getRegionLabel(newConfig.region)} Airports
                    </h5>
                    <div className="flex flex-wrap gap-1 text-xs">
                      {REGIONAL_AIRPORTS[newConfig.region].map((code) => (
                        <button
                          key={code}
                          onClick={() => addAirportCode(code)}
                          disabled={newConfig.airport_codes.includes(code)}
                          className={`px-2 py-1 rounded font-mono transition-colors ${
                            newConfig.airport_codes.includes(code)
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-800">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateConfig}
                  disabled={saving || !newConfig.destination_city || newConfig.airport_codes.length === 0}
                  className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Creating...' : 'Create Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRoutesPage;
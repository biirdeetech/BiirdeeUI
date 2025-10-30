import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, FileText, Target, Building, Plus, Trash2, Crown, Search, Phone, Calendar, CreditCard as Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

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
  clients?: Client[];
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
}

interface ProposalFormProps {
  proposal?: Proposal | null;
  onClose: () => void;
}

const ProposalForm: React.FC<ProposalFormProps> = ({ proposal, onClose }) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [currentClients, setCurrentClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [primaryClientId, setPrimaryClientId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClientData, setEditingClientData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    notes: '',
    status: 'draft' as const
  });

  const isEditing = !!proposal;

  // Fetch available clients
  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, first_name, last_name, email, phone, company')
          .eq('user_id', user.id)
          .order('first_name', { ascending: true });

        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };

    fetchClients();
  }, [user]);

  // Fetch proposal clients if editing
  useEffect(() => {
    const fetchProposalClients = async () => {
      if (!proposal) return;

      try {
        const { data: proposalClientsData, error } = await supabase
          .from('proposal_clients')
          .select(`
            client_id,
            is_primary,
            clients(id, first_name, last_name, email, phone, company)
          `)
          .eq('proposal_id', proposal.id);

        if (error) throw error;
        
        const proposalClients = (proposalClientsData || []).map((pc: any) => ({
          id: pc.clients.id,
          first_name: pc.clients.first_name,
          last_name: pc.clients.last_name,
          email: pc.clients.email,
          phone: pc.clients.phone,
          company: pc.clients.company,
          is_primary: pc.is_primary
        }));
        
        setCurrentClients(proposalClients);
        setSelectedClients(proposalClients.map(c => c.id));
        
        const primaryClient = proposalClients.find(c => c.is_primary);
        if (primaryClient) {
          setPrimaryClientId(primaryClient.id);
        }
      } catch (error) {
        console.error('Error fetching proposal clients:', error);
      }
    };

    fetchProposalClients();
  }, [proposal]);

  // Initialize form data
  useEffect(() => {
    if (proposal) {
      setFormData({
        name: proposal.name,
        notes: proposal.notes,
        status: proposal.status
      });
    } else {
      // Reset form for new proposal
      setFormData({
        name: '',
        notes: '',
        status: 'draft'
      });
      setSelectedClients([]);
    }
  }, [proposal]);
  
  // Filter available clients (exclude already selected ones)
  const availableClients = clients.filter(client => 
    !selectedClients.includes(client.id) &&
    (client.first_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.last_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.email.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.company.toLowerCase().includes(clientSearchQuery.toLowerCase()))
  );

  const handleEditClient = (client: Client) => {
    setEditingClientId(client.id);
    setEditingClientData({
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      phone: client.phone,
      company: client.company
    });
  };

  const handleUpdateClient = async () => {
    if (!editingClientId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update(editingClientData)
        .eq('id', editingClientId);

      if (error) throw error;

      // Update the clients list
      setClients(clients.map(client => 
        client.id === editingClientId 
          ? { ...client, ...editingClientData }
          : client
      ));

      // Update current clients if editing an existing proposal
      setCurrentClients(currentClients.map(client =>
        client.id === editingClientId
          ? { ...client, ...editingClientData }
          : client
      ));

      setEditingClientId(null);
      setEditingClientData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: ''
      });
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  const cancelEditClient = () => {
    setEditingClientId(null);
    setEditingClientData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || selectedClients.length === 0) {
      alert('Please select at least one client');
      return;
    }

    setLoading(true);

    try {
      if (isEditing) {
        // Update existing proposal
        const { error } = await supabase
          .from('proposals')
          .update({
            name: formData.name,
            notes: formData.notes,
            status: formData.status
          })
          .eq('id', proposal.id);

        if (error) throw error;

        // Update proposal clients
        // First, remove existing relationships
        const { error: deleteError } = await supabase
          .from('proposal_clients')
          .delete()
          .eq('proposal_id', proposal.id);
          
        if (deleteError) throw deleteError;

        // Add new relationships
        const proposalClientsData = selectedClients.map((clientId, index) => ({
          proposal_id: proposal.id,
          client_id: clientId,
          is_primary: clientId === primaryClientId
        }));

        const { error: clientsError } = await supabase
          .from('proposal_clients')
          .insert(proposalClientsData);

        if (clientsError) throw clientsError;
      } else {
        // Create new proposal
        const { data: proposalData, error } = await supabase
          .from('proposals')
          .insert({
            user_id: user.id,
            name: formData.name,
            notes: formData.notes,
            status: formData.status
          })
          .select()
          .single();

        if (error) throw error;

        // Add proposal clients
        const proposalClientsData = selectedClients.map((clientId, index) => ({
          proposal_id: proposalData.id,
          client_id: clientId,
          is_primary: clientId === primaryClientId
        }));

        const { error: clientsError } = await supabase
          .from('proposal_clients')
          .insert(proposalClientsData);

        if (clientsError) throw clientsError;
      }

      onClose();
    } catch (error) {
      console.error('Error saving proposal:', error);
      alert(`Failed to ${isEditing ? 'update' : 'create'} proposal`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClientSelection = (clientId: string, isSelected: boolean) => {
    if (isSelected) {
      const newSelectedClients = [...selectedClients, clientId];
      setSelectedClients(newSelectedClients);
      
      // Set as primary if it's the first client
      if (newSelectedClients.length === 1) {
        setPrimaryClientId(clientId);
      }
    } else {
      const newSelectedClients = selectedClients.filter(id => id !== clientId);
      setSelectedClients(newSelectedClients);
      
      // If removing primary client, set new primary
      if (clientId === primaryClientId && newSelectedClients.length > 0) {
        setPrimaryClientId(newSelectedClients[0]);
      }
    }
  };
  
  const handleRemoveClient = (clientId: string) => {
    handleClientSelection(clientId, false);
  };
  
  const handleSetPrimary = (clientId: string) => {
    setPrimaryClientId(clientId);
  };
  
  const getClientById = (clientId: string) => {
    const allClients = [...clients, ...currentClients];
    return allClients.find(c => c.id === clientId);
  };
  
  const getSelectedClientsList = () => {
    return selectedClients.map(clientId => getClientById(clientId)).filter(Boolean);
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="bg-accent-600 p-2 rounded-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">
                {isEditing ? 'Edit Proposal' : 'Create New Proposal'}
              </h3>
              <p className="text-sm text-gray-400">
                {isEditing ? 'Update proposal details' : 'Enter client information and proposal details'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Current Clients (for editing) */}
          {isEditing && selectedClients.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-accent-400 mb-6 flex items-center gap-2">
                <User className="h-5 w-5" />
                Current Clients ({selectedClients.length})
              </h4>
              
              <div className="space-y-4 mb-8">
                {getSelectedClientsList().map((client) => (
                  <div key={client.id} className="bg-gray-850 border border-gray-700 rounded-lg p-6">
                    {editingClientId === client.id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="bg-blue-600 p-2 rounded-lg">
                            <Edit className="h-4 w-4 text-white" />
                          </div>
                          <h5 className="text-lg font-medium text-white">Edit Client</h5>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                            <input
                              type="text"
                              value={editingClientData.first_name}
                              onChange={(e) => setEditingClientData({...editingClientData, first_name: e.target.value})}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                            <input
                              type="text"
                              value={editingClientData.last_name}
                              onChange={(e) => setEditingClientData({...editingClientData, last_name: e.target.value})}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                          <input
                            type="email"
                            value={editingClientData.email}
                            onChange={(e) => setEditingClientData({...editingClientData, email: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                            <input
                              type="tel"
                              value={editingClientData.phone}
                              onChange={(e) => setEditingClientData({...editingClientData, phone: e.target.value})}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                            <input
                              type="text"
                              value={editingClientData.company}
                              onChange={(e) => setEditingClientData({...editingClientData, company: e.target.value})}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 pt-4">
                          <button
                            type="button"
                            onClick={handleUpdateClient}
                            disabled={saving}
                            className="bg-success-600 hover:bg-success-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditClient}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode  
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="bg-accent-600 p-2 rounded-lg">
                              <User className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <div className="text-white font-semibold text-lg">
                                {client.first_name} {client.last_name}
                              </div>
                              {client.id === primaryClientId && (
                                <div className="bg-accent-600 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit">
                                  <Crown className="h-3 w-3" />
                                  PRIMARY CLIENT
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-gray-300">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <div>
                                  <div className="text-gray-400 text-xs">Email</div>
                                  <div className="text-white">{client.email}</div>
                                </div>
                              </div>
                              
                              {client.phone && (
                                <div className="flex items-center gap-2 text-gray-300">
                                  <Phone className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <div className="text-gray-400 text-xs">Phone</div>
                                    <div className="text-white">{client.phone}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          
                            <div className="space-y-2">
                              {client.company && (
                                <div className="flex items-center gap-2 text-gray-300">
                                  <Building className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <div className="text-gray-400 text-xs">Company</div>
                                    <div className="text-white">{client.company}</div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2 text-gray-300">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <div>
                                  <div className="text-gray-400 text-xs">Client Since</div>
                                  <div className="text-white">
                                    {new Date(client.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2 ml-4">
                          <button
                            type="button"
                            onClick={() => handleEditClient(client)}
                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                            title="Edit client details"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          {client.id !== primaryClientId && selectedClients.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(client.id)}
                              className="px-3 py-1 text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded transition-colors"
                              title="Set as primary client"
                            >
                              Make Primary
                            </button>
                          )}
                          
                          {selectedClients.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveClient(client.id)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                              title="Remove client from proposal"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Add More Clients */}
          <div>
            <h4 className="text-lg font-semibold text-accent-400 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {isEditing ? 'Add More Clients' : 'Select Clients'}
            </h4>
            
            {/* Client Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  placeholder="Search available clients..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:border-accent-500"
                />
              </div>
            </div>
            
            {!isEditing && selectedClients.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Selected Clients ({selectedClients.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {getSelectedClientsList().map((client) => (
                    <span key={client.id} className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${
                      client.id === primaryClientId ? 'bg-accent-600 text-white' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {client.id === primaryClientId && (
                        <Crown className="h-3 w-3" />
                      )}
                      {client.first_name} {client.last_name}
                      <button
                        type="button"
                        onClick={() => handleClientSelection(client.id, false)}
                        className="hover:bg-white/20 rounded-full p-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto border border-gray-700 rounded-lg">
              {availableClients.length > 0 ? (
                availableClients.map((client) => (
                <div key={client.id} className="flex items-start p-4 hover:bg-gray-800 border-b border-gray-700 last:border-b-0">
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={(e) => handleClientSelection(client.id, e.target.checked)}
                    className="bg-gray-800 border border-gray-600 rounded text-accent-500 focus:ring-accent-500 focus:ring-2 mt-1 mr-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-white font-medium mb-2">
                          {client.first_name} {client.last_name}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Mail className="h-3 w-3" />
                              <span>{client.email}</span>
                            </div>
                            {client.phone && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Phone className="h-3 w-3" />
                                <span>{client.phone}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            {client.company && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <Building className="h-3 w-3" />
                                <span>{client.company}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-400">
                              <Calendar className="h-3 w-3" />
                              <span>Since {new Date(client.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-400">
                  {clientSearchQuery ? (
                    <div>
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No clients found matching "{clientSearchQuery}"</p>
                    </div>
                  ) : selectedClients.length > 0 ? (
                    <div>
                      <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>All available clients are already added</p>
                    </div>
                  ) : (
                    <div>
                      <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No clients available</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            

            <p className="text-xs text-gray-500 mt-2">
              {selectedClients.length === 0 
                ? 'Select at least one client for this proposal.' 
                : `Primary client: ${getClientById(primaryClientId)?.first_name} ${getClientById(primaryClientId)?.last_name}`
              }
            </p>
          </div>

          {/* Proposal Details */}
          <div>
            <h4 className="text-lg font-semibold text-accent-400 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5" />
              Proposal Details
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Proposal Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-accent-500"
                placeholder="Leave empty for auto-generated name"
              />
              <p className="text-xs text-gray-500 mt-1">
                If left empty, a name will be generated based on client info and date
              </p>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-accent-500"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-accent-500"
                placeholder="Internal notes about this proposal..."
                rows={4}
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
            <button
              type="submit"
              disabled={loading}
              className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : (isEditing ? 'Update Proposal' : 'Create Proposal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProposalForm;
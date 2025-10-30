import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Mail, Phone, Building, Search, CreditCard as Edit, Trash2, FileText, Eye, Map } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';

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
  proposal_count?: number;
  itinerary_count?: number;
  creator?: {
    full_name: string;
    email: string;
  };
}

const ClientsPage: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  const isAdmin = profile?.role === 'admin';

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
    }
  }, [user, authLoading, navigate]);

  // Fetch clients with proposal counts
  const fetchClients = async () => {
    if (!user) return;

    try {
      // First, get the basic client data with proposal counts
      let query = supabase
        .from('clients')
        .select(`
          *,
          proposal_clients(count),
          itineraries(count)
        `);
      
      // Apply user filter only if not admin
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }
      
      const { data: clientsData, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      // Get unique user IDs if admin wants creator info
      let creatorsData = [];
      if (isAdmin && clientsData && clientsData.length > 0) {
        const userIds = [...new Set(clientsData.map(c => c.user_id))];
        
        const { data: creators, error: creatorsError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (!creatorsError) {
          creatorsData = creators || [];
        }
      }

      // Transform to add proposal_count, itinerary_count and creator info
      const clientsWithCounts = (clientsData || []).map(client => {
        const creator = isAdmin ? creatorsData.find(c => c.id === client.user_id) : null;
        return {
          ...client,
          proposal_count: client.proposal_clients?.[0]?.count || 0,
          itinerary_count: client.itineraries?.[0]?.count || 0,
          creator: creator ? {
            full_name: creator.full_name,
            email: creator.email
          } : null,
          proposal_clients: undefined,
          itineraries: undefined
        };
      });

      setClients(clientsWithCounts);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user]);

  // Filter clients based on search query
  const filteredClients = clients.filter(client =>
    client.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateClient = () => {
    setSelectedClient(null);
    setShowCreateForm(true);
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setShowCreateForm(true);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? This will not delete their proposals.')) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;
      
      await fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Failed to delete client');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading clients...</p>
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
              <Users className="h-6 w-6 text-accent-400" />
              <h1 className="text-2xl font-bold text-white">Clients</h1>
              {isAdmin && (
                <span className="bg-accent-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  ADMIN VIEW - ALL CLIENTS
                </span>
              )}
            </div>
            <p className="text-gray-400">
              {isAdmin ? 'Manage all client relationships across the system' : 'Manage your client relationships and contact information'}
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
                  placeholder="Search clients by name, email, or company..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:border-accent-500"
                />
              </div>
            </div>
            <button
              onClick={handleCreateClient}
              className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Client
            </button>
          </div>

          {/* Clients List */}
          {filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {searchQuery ? 'No clients found' : 'No clients yet'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchQuery 
                  ? 'Try adjusting your search criteria'
                  : 'Add your first client to get started'
                }
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreateClient}
                  className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Add First Client
                </button>
              )}
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-850 border-b border-gray-800">
                    <tr>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Name</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Contact</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Company</th>
                      {isAdmin && (
                        <th className="text-left text-gray-300 font-medium py-4 px-6">Created By</th>
                      )}
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Activity</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Added</th>
                      <th className="text-center text-gray-300 font-medium py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client, index) => (
                      <tr key={client.id} className={`border-b border-gray-800 hover:bg-gray-850 transition-colors cursor-pointer ${
                        index === filteredClients.length - 1 ? 'border-b-0' : ''
                      }`}
                          onClick={() => navigate(`/clients/${client.id}`)}>
                        <td className="py-4 px-6">
                          <div>
                            <div className="text-white font-medium">
                              {client.first_name} {client.last_name}
                            </div>
                            {client.notes && (
                              <div className="text-sm text-gray-400 mt-1 truncate max-w-xs">
                                {client.notes}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <div className="flex items-center gap-2 text-gray-300 mb-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{client.email}</span>
                            </div>
                            {client.phone && (
                              <div className="flex items-center gap-2 text-gray-300">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span className="text-sm">{client.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {client.company ? (
                            <div className="flex items-center gap-2 text-gray-300">
                              <Building className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{client.company}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-4 px-6">
                            {client.creator ? (
                              <div>
                                <div className="text-white text-sm">
                                  {client.creator.full_name || 'Unknown'}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {client.creator.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">-</span>
                            )}
                          </td>
                        )}
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-accent-400" />
                              <span className="text-white text-sm font-medium">
                                {client.proposal_count} proposal{client.proposal_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Map className="h-3 w-3 text-blue-400" />
                              <span className="text-white text-sm font-medium">
                                {client.itinerary_count} itinerar{client.itinerary_count !== 1 ? 'ies' : 'y'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-white">{formatDate(client.created_at)}</div>
                          <div className="text-xs text-gray-400">
                            Updated {formatDate(client.updated_at)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClient(client);
                              }}
                              className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded transition-colors"
                              title="Edit client"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClient(client.id);
                              }}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                              title="Delete client"
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

      {/* Create/Edit Form Modal - We'll add this component next */}
      {showCreateForm && (
        <ClientForm
          client={selectedClient}
          onClose={() => {
            setShowCreateForm(false);
            setSelectedClient(null);
            fetchClients();
          }}
        />
      )}
    </div>
  );
};

// Simple inline ClientForm component
const ClientForm: React.FC<{ client: Client | null; onClose: () => void }> = ({ client, onClose }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: client?.first_name || '',
    last_name: client?.last_name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    company: client?.company || '',
    notes: client?.notes || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      if (client) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', client.id);
        if (error) throw error;
        showNotification('success', 'Client Updated', `${formData.first_name} ${formData.last_name} has been updated successfully`);
      } else {
        // Create new client
        const { error } = await supabase
          .from('clients')
          .insert({
            ...formData,
            user_id: user.id
          });
        if (error) throw error;
        showNotification('success', 'Client Created', `${formData.first_name} ${formData.last_name} has been added to your clients`);
      }

      onClose();
    } catch (error) {
      console.error('Error saving client:', error);
      alert(`Failed to ${client ? 'update' : 'create'} client`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-xl font-semibold text-white">
            {client ? 'Edit Client' : 'Add New Client'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-800">
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
              className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Saving...' : (client ? 'Update Client' : 'Add Client')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientsPage;
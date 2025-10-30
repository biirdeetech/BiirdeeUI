import React, { useState, useRef, useEffect } from 'react';
import { Search, User, Plus, ChevronDown, Mail, Building, Save, X, Check } from 'lucide-react';

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
}

interface ClientSelectionDropdownProps {
  clients: Client[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  onCreateClient: (clientData: Omit<Client, 'id'>) => Promise<void>;
  saving?: boolean;
  placeholder?: string;
}

const ClientSelectionDropdown: React.FC<ClientSelectionDropdownProps> = ({
  clients,
  selectedClientId,
  onSelectClient,
  onCreateClient,
  saving = false,
  placeholder = "Select a client..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [newClientData, setNewClientData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: ''
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter clients based on search query
  const filteredClients = clients.filter(client => {
    const searchText = searchQuery.toLowerCase();
    return (
      client.first_name.toLowerCase().includes(searchText) ||
      client.last_name.toLowerCase().includes(searchText) ||
      client.email.toLowerCase().includes(searchText) ||
      client.company.toLowerCase().includes(searchText) ||
      `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchText)
    );
  });

  const handleSelectClient = (clientId: string) => {
    onSelectClient(clientId);
    setIsOpen(false);
    setSearchQuery('');
    setShowCreateForm(false);
  };

  const handleCreateClient = async () => {
    if (!newClientData.first_name || !newClientData.last_name || !newClientData.email) {
      return;
    }

    setCreating(true);
    try {
      await onCreateClient(newClientData);
      
      // Reset form
      setNewClientData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: ''
      });
      setShowCreateForm(false);
      setIsOpen(false);
      setSearchQuery('');
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setCreating(false);
    }
  };

  const cancelCreateClient = () => {
    setShowCreateForm(false);
    setNewClientData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      company: ''
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-left text-white focus:border-blue-500 hover:border-gray-600 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-gray-400" />
          {selectedClient ? (
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {selectedClient.first_name} {selectedClient.last_name}
              </span>
              <span className="text-gray-400 text-sm">
                ({selectedClient.email})
              </span>
              {selectedClient.company && (
                <span className="text-gray-500 text-sm">
                  - {selectedClient.company}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Create New Client Form */}
          {showCreateForm ? (
            <div className="p-4 border-b border-gray-700 bg-gray-750">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-4 w-4 text-green-400" />
                <h5 className="font-medium text-white">Create New Client</h5>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newClientData.first_name}
                    onChange={(e) => setNewClientData({...newClientData, first_name: e.target.value})}
                    placeholder="First Name *"
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 text-sm"
                    required
                  />
                  <input
                    type="text"
                    value={newClientData.last_name}
                    onChange={(e) => setNewClientData({...newClientData, last_name: e.target.value})}
                    placeholder="Last Name *"
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 text-sm"
                    required
                  />
                </div>
                
                <input
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                  placeholder="Email *"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 text-sm"
                  required
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                    placeholder="Phone"
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 text-sm"
                  />
                  <input
                    type="text"
                    value={newClientData.company}
                    onChange={(e) => setNewClientData({...newClientData, company: e.target.value})}
                    placeholder="Company"
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 text-sm"
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCreateClient}
                    disabled={creating || !newClientData.first_name || !newClientData.last_name || !newClientData.email}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3" />
                        Create Client
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={cancelCreateClient}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* New Client Button */
            <div className="p-3 border-b border-gray-700 bg-gray-750">
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create New Client
              </button>
            </div>
          )}

          {/* Client List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredClients.length === 0 && !searchQuery ? (
              <div className="p-4 text-center text-gray-400">
                <User className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No clients available</p>
                <p className="text-xs text-gray-500">Create your first client above</p>
              </div>
            ) : filteredClients.length === 0 && searchQuery ? (
              <div className="p-4 text-center text-gray-400">
                <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No clients found</p>
                <p className="text-xs text-gray-500">Try a different search term</p>
              </div>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0 ${
                    client.id === selectedClientId ? 'bg-blue-600/20 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-600 p-1.5 rounded mt-0.5">
                      <User className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-white">
                          {client.first_name} {client.last_name}
                        </div>
                        {client.id === selectedClientId && (
                          <Check className="h-3 w-3 text-blue-400" />
                        )}
                      </div>
                      <div className="text-sm text-gray-400 truncate">
                        <Mail className="h-3 w-3 inline mr-1" />
                        {client.email}
                      </div>
                      {client.company && (
                        <div className="text-xs text-gray-500 truncate">
                          <Building className="h-3 w-3 inline mr-1" />
                          {client.company}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSelectionDropdown;
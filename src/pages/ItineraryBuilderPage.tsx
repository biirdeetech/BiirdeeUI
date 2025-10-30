import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Map, User, Search, Plus, X, Save, Trash2, ExternalLink, Eye, Users, Plane, Calendar, DollarSign, Building, Mail, Phone, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navigation from '../components/Navigation';
import AirtableBookingSearch from '../components/itinerary/AirtableBookingSearch';

interface Itinerary {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  description: string;
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

interface ItineraryBooking {
  id: string;
  itinerary_id: string;
  airtable_record_id: string;
  booking_name: string;
  sales_agent_email: string;
  booking_status: string;
  class: string;
  sales_price: number;
  pnr: string;
  from_airport: string;
  to_airport: string;
  airline_carrier: string;
  start_date: string;
  booking_notes: string;
  itinerary_order: number;
  raw_airtable_data: any;
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

interface AirtableBooking {
  id: string;
  airtable_record_id: string;
  booking_name: string;
  sales_agent_email: string;
  sales_agent_name: string;
  booking_status: string;
  class: string;
  sales_price: number;
  pnr: string;
  from_airport: string;
  to_airport: string;
  airline_carrier: string;
  start_date: string;
  booking_notes: string;
  booking_id: number;
  created_time: string;
  raw_data: any;
}

const ItineraryBuilderPage: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const editId = searchParams.get('edit');
  const preselectedClientId = searchParams.get('client');
  const isEditing = !!editId;
  const isAdmin = profile?.role === 'admin';

  // Core state
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [bookings, setBookings] = useState<ItineraryBooking[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'draft' as const
  });

  // Client management state
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [primaryClientId, setPrimaryClientId] = useState<string>('');
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

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
    }
  }, [user, authLoading, navigate]);

  // Initialize with preselected client
  useEffect(() => {
    if (preselectedClientId && !isEditing) {
      setSelectedClients([preselectedClientId]);
      setPrimaryClientId(preselectedClientId);
    }
  }, [preselectedClientId, isEditing]);

  // Fetch data
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, editId]);

  const fetchData = async () => {
    try {
      // Fetch clients
      let clientsQuery = supabase
        .from('clients')
        .select('*');
      
      if (!isAdmin) {
        clientsQuery = clientsQuery.eq('user_id', user.id);
      }
      
      const { data: clientsData, error: clientsError } = await clientsQuery
        .order('first_name', { ascending: true });

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // If editing, fetch itinerary data
      if (isEditing && editId) {
        const { data: itineraryData, error: itineraryError } = await supabase
          .from('itineraries')
          .select(`
            *,
            itinerary_clients(
              client_id,
              is_primary,
              clients(id, first_name, last_name, email, phone, company)
            )
          `)
          .eq('id', editId)
          .single();

        if (itineraryError) throw itineraryError;

        // Transform data
        const transformedItinerary = {
          ...itineraryData,
          clients: itineraryData.itinerary_clients?.map((ic: any) => ({
            id: ic.clients.id,
            first_name: ic.clients.first_name,
            last_name: ic.clients.last_name,
            email: ic.clients.email,
            phone: ic.clients.phone,
            company: ic.clients.company,
            is_primary: ic.is_primary
          })) || [],
          itinerary_clients: undefined
        };

        setItinerary(transformedItinerary);
        setFormData({
          name: transformedItinerary.name,
          description: transformedItinerary.description,
          status: transformedItinerary.status
        });

        // Set selected clients
        const clientIds = transformedItinerary.clients?.map(c => c.id) || [];
        setSelectedClients(clientIds);
        
        const primaryClient = transformedItinerary.clients?.find(c => c.is_primary);
        if (primaryClient) {
          setPrimaryClientId(primaryClient.id);
        }

        // Fetch bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('itinerary_bookings')
          .select('*')
          .eq('itinerary_id', editId)
          .order('itinerary_order', { ascending: true });

        if (bookingsError) throw bookingsError;
        setBookings(bookingsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
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

  const handleSetPrimary = (clientId: string) => {
    setPrimaryClientId(clientId);
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

      setClients([...clients, data]);
      setSelectedClients([...selectedClients, data.id]);
      
      if (selectedClients.length === 0) {
        setPrimaryClientId(data.id);
      }

      setShowCreateClient(false);
      setNewClientData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: ''
      });
      
      showNotification('success', 'Client Created', `${data.first_name} ${data.last_name} has been created and added`);
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  const handleBookingSelect = async (booking: AirtableBooking) => {
    if (!itinerary?.id) {
      alert('Please save the itinerary first before adding bookings');
      return;
    }

    setSaving(true);
    try {
      // Get next order number
      const nextOrder = Math.max(...bookings.map(b => b.itinerary_order), 0) + 1;

      const { data, error } = await supabase
        .from('itinerary_bookings')
        .insert({
          itinerary_id: itinerary.id,
          airtable_record_id: booking.airtable_record_id,
          booking_name: booking.booking_name,
          sales_agent_email: booking.sales_agent_email,
          booking_status: booking.booking_status,
          class: booking.class,
          sales_price: booking.sales_price,
          pnr: booking.pnr,
          from_airport: booking.from_airport,
          to_airport: booking.to_airport,
          airline_carrier: booking.airline_carrier,
          start_date: booking.start_date,
          booking_notes: booking.booking_notes,
          itinerary_order: nextOrder,
          raw_airtable_data: booking.raw_data
        })
        .select()
        .single();

      if (error) throw error;

      setBookings([...bookings, data]);
      showNotification('success', 'Booking Added', `${booking.booking_name} has been added to the itinerary`);
    } catch (error) {
      console.error('Error adding booking:', error);
      alert('Failed to add booking to itinerary');
    } finally {
      setSaving(false);
    }
  };

  const removeBooking = async (bookingId: string) => {
    if (!confirm('Remove this booking from the itinerary?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('itinerary_bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      setBookings(bookings.filter(b => b.id !== bookingId));
      showNotification('success', 'Booking Removed', 'Booking has been removed from the itinerary');
    } catch (error) {
      console.error('Error removing booking:', error);
      alert('Failed to remove booking');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user || selectedClients.length === 0) {
      alert('Please select at least one client');
      return;
    }

    setSaving(true);
    try {
      let itineraryId = editId;

      if (isEditing) {
        // Update existing itinerary
        const { error } = await supabase
          .from('itineraries')
          .update({
            name: formData.name,
            description: formData.description,
            status: formData.status
          })
          .eq('id', editId);

        if (error) throw error;

        // Update itinerary clients
        const { error: deleteError } = await supabase
          .from('itinerary_clients')
          .delete()
          .eq('itinerary_id', editId);

        if (deleteError) throw deleteError;

        const itineraryClientsData = selectedClients.map(clientId => ({
          itinerary_id: editId!,
          client_id: clientId,
          is_primary: clientId === primaryClientId
        }));

        const { error: clientsError } = await supabase
          .from('itinerary_clients')
          .insert(itineraryClientsData);

        if (clientsError) throw clientsError;
      } else {
        // Create new itinerary
        const { data: itineraryData, error } = await supabase
          .from('itineraries')
          .insert({
            user_id: user.id,
            name: formData.name,
            description: formData.description,
            status: formData.status
          })
          .select()
          .single();

        if (error) throw error;
        itineraryId = itineraryData.id;

        // Add itinerary clients
        const itineraryClientsData = selectedClients.map(clientId => ({
          itinerary_id: itineraryData.id,
          client_id: clientId,
          is_primary: clientId === primaryClientId
        }));

        const { error: clientsError } = await supabase
          .from('itinerary_clients')
          .insert(itineraryClientsData);

        if (clientsError) throw clientsError;

        navigate(`/itineraries/builder?edit=${itineraryData.id}`);
      }

      showNotification('success', 'Itinerary Saved', `Itinerary has been ${isEditing ? 'updated' : 'created'} successfully`);
    } catch (error) {
      console.error('Error saving itinerary:', error);
      alert(`Failed to ${isEditing ? 'update' : 'create'} itinerary`);
    } finally {
      setSaving(false);
    }
  };

  const getClientById = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const getSelectedClientsList = () => {
    return selectedClients.map(clientId => getClientById(clientId)).filter(Boolean);
  };

  const availableClients = clients.filter(client => 
    !selectedClients.includes(client.id) &&
    (client.first_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.last_name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.email.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
     client.company.toLowerCase().includes(clientSearchQuery.toLowerCase()))
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTotalValue = () => {
    return bookings.reduce((sum, booking) => sum + (booking.sales_price || 0), 0);
  };

  const getShareUrl = () => {
    if (!itinerary?.share_link) return '';
    return `${window.location.origin}/itinerary/${itinerary.share_link}`;
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

  if (!user) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <main className="px-4 sm:px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Error Loading Itinerary</h2>
              <p className="text-gray-400 mb-6">{error}</p>
              <button
                onClick={() => navigate('/itineraries')}
                className="bg-accent-600 hover:bg-accent-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Back to Itineraries
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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-accent-600 p-3 rounded-lg">
                  <Map className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {isEditing ? 'Edit Itinerary' : 'Create Itinerary'}
                  </h1>
                  <p className="text-gray-400">
                    {isEditing ? 'Update itinerary details and bookings' : 'Build a new client itinerary with Airtable bookings'}
                  </p>
                </div>
              </div>
              
              {isEditing && itinerary && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.open(getShareUrl(), '_blank')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getShareUrl());
                      showNotification('success', 'Link Copied', 'Share link copied to clipboard');
                    }}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Copy Link
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Itinerary Details */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Itinerary Details</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Itinerary Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Europe Business Trip - John Smith"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-accent-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of the trip..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-accent-500"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-accent-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.name || selectedClients.length === 0}
                    className="w-full bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : (isEditing ? 'Update Itinerary' : 'Create Itinerary')}
                  </button>
                </div>
              </div>

              {/* Client Selection */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Clients ({selectedClients.length})
                  </h3>
                  <button
                    onClick={() => setShowAddClient(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Client
                  </button>
                </div>

                {/* Selected Clients */}
                {selectedClients.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {getSelectedClientsList().map((client) => (
                      <div key={client.id} className="flex items-center justify-between bg-gray-850 border border-gray-700 rounded p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            client.id === primaryClientId ? 'bg-accent-600 text-white' : 'bg-gray-600 text-gray-300'
                          }`}>
                            {client.id === primaryClientId ? <Crown className="h-4 w-4" /> : client.first_name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-white font-medium">
                              {client.first_name} {client.last_name}
                            </div>
                            <div className="text-sm text-gray-400">{client.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {client.id !== primaryClientId && selectedClients.length > 1 && (
                            <button
                              onClick={() => handleSetPrimary(client.id)}
                              className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded transition-colors"
                            >
                              Make Primary
                            </button>
                          )}
                          {selectedClients.length > 1 && (
                            <button
                              onClick={() => handleClientSelection(client.id, false)}
                              className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedClients.length === 0 && (
                  <div className="text-center py-4 text-gray-400">
                    No clients selected. Add at least one client to continue.
                  </div>
                )}
              </div>

              {/* Summary */}
              {bookings.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Total Bookings</div>
                      <div className="text-xl font-bold text-white">{bookings.length}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Total Value</div>
                      <div className="text-xl font-bold text-white">{formatPrice(getTotalValue())}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Bookings */}
            <div className="space-y-6">
              {/* Current Bookings */}
              {bookings.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Current Bookings ({bookings.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {bookings
                      .sort((a, b) => a.itinerary_order - b.itinerary_order)
                      .map((booking, index) => (
                      <div key={booking.id} className="bg-gray-850 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="bg-accent-600 text-white px-2 py-1 rounded text-sm font-medium">
                                #{index + 1}
                              </span>
                              <div>
                                <h4 className="text-white font-semibold">
                                  {booking.booking_name}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                  <span>PNR: {booking.pnr}</span>
                                  <span>•</span>
                                  <span>{booking.booking_status}</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-gray-300">
                                  <Plane className="h-3 w-3 text-gray-400" />
                                  <span>{booking.from_airport} → {booking.to_airport}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-300">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  <span>{formatDate(booking.start_date)}</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-gray-300">
                                  <DollarSign className="h-3 w-3 text-gray-400" />
                                  <span>{formatPrice(booking.sales_price || 0)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-300">
                                  <span className="text-gray-400">Class:</span>
                                  <span>{booking.class}</span>
                                </div>
                              </div>
                            </div>

                            {booking.booking_notes && (
                              <div className="mt-3 p-2 bg-gray-800 rounded text-sm text-gray-300">
                                <span className="text-gray-400">Notes:</span> {booking.booking_notes}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => removeBooking(booking.id)}
                            disabled={saving}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            title="Remove booking"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Bookings */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Add Bookings from Airtable
                </h3>
                
                {!isEditing || !itinerary ? (
                  <div className="text-center py-8">
                    <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">Save the itinerary first to add bookings</p>
                    <p className="text-sm text-gray-500">
                      Complete the itinerary details and client selection above, then save to enable booking management.
                    </p>
                  </div>
                ) : (
                  <AirtableBookingSearch onSelectBooking={handleBookingSelect} />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Add Clients</h3>
                  <p className="text-sm text-gray-400">Select clients for this itinerary</p>
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
                
                <div className="max-h-60 overflow-y-auto border border-gray-700 rounded-lg">
                  {availableClients.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      {clientSearchQuery ? (
                        <div>
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No clients found matching "{clientSearchQuery}"</p>
                        </div>
                      ) : selectedClients.length > 0 ? (
                        <div>
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>All available clients are already added</p>
                        </div>
                      ) : (
                        <div>
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No clients available</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    availableClients.map((client) => (
                      <div key={client.id} className="flex items-start p-4 hover:bg-gray-800 border-b border-gray-700 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client.id)}
                          onChange={(e) => handleClientSelection(client.id, e.target.checked)}
                          className="bg-gray-800 border border-gray-600 rounded text-accent-500 focus:ring-accent-500 focus:ring-2 mt-1 mr-4"
                        />
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
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItineraryBuilderPage;
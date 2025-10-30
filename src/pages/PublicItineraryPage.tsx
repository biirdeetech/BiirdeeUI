import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Map, User, Calendar, DollarSign, Plane, MapPin, Clock, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Itinerary {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string;
  client?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface ItineraryBooking {
  id: string;
  booking_name: string;
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
}

const PublicItineraryPage: React.FC = () => {
  const { shareLink } = useParams<{ shareLink: string }>();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [bookings, setBookings] = useState<ItineraryBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItinerary = async () => {
      if (!shareLink) return;

      try {
        // Fetch itinerary by share link (public access)
        const { data: itineraryData, error: itineraryError } = await supabase
          .from('itineraries')
          .select(`
            *,
            clients(id, first_name, last_name, email)
          `)
          .eq('share_link', shareLink)
          .single();

        if (itineraryError) throw itineraryError;

        const transformedItinerary = {
          ...itineraryData,
          client: itineraryData.clients,
          clients: undefined
        };

        setItinerary(transformedItinerary);

        // Fetch itinerary bookings (public access)
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('itinerary_bookings')
          .select('*')
          .eq('itinerary_id', itineraryData.id)
          .order('itinerary_order', { ascending: true });

        if (bookingsError) throw bookingsError;
        setBookings(bookingsData || []);

      } catch (err) {
        console.error('Error fetching public itinerary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load itinerary');
      } finally {
        setLoading(false);
      }
    };

    fetchItinerary();
  }, [shareLink]);

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
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTotalValue = () => {
    return bookings.reduce((sum, booking) => sum + (booking.sales_price || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading itinerary...</p>
        </div>
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Itinerary Not Found</h2>
            <p className="text-gray-400 mb-6">
              {error || 'The itinerary you\'re looking for doesn\'t exist or may have been removed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-accent-600 p-3 rounded-lg">
              <Map className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Travel Itinerary</h1>
              <p className="text-gray-400">Prepared by Biirdee Pro</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Itinerary Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">
                {itinerary.name}
              </h2>
              
              {itinerary.description && (
                <p className="text-gray-300 mb-4">{itinerary.description}</p>
              )}

              <div className="space-y-3">
                {itinerary.clients && itinerary.clients.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      {itinerary.clients.map((client, index) => (
                        <div key={client.id} className="flex items-center gap-2">
                          <span>{client.first_name} {client.last_name}</span>
                          {client.is_primary && (
                            <span className="bg-accent-600 text-white px-2 py-1 rounded-full text-xs">
                              PRIMARY
                            </span>
                          )}
                          {index < itinerary.clients.length - 1 && <span className="text-gray-500">•</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>Created {formatDate(itinerary.created_at)}</span>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-white mb-2">
                {formatPrice(getTotalValue())}
              </div>
              <div className="text-gray-400">Total Trip Value</div>
              <div className="text-sm text-gray-500 mt-2">
                {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Bookings */}
        {bookings.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
            <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No bookings in itinerary</h3>
            <p className="text-gray-400">
              Bookings are being prepared and will be available soon.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Your Bookings ({bookings.length})
            </h3>
            
            {bookings.map((booking, index) => (
              <div key={booking.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                {/* Booking Header */}
                <div className="bg-gray-850 px-6 py-4 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="bg-accent-600 text-white px-3 py-1 rounded font-medium">
                        #{index + 1}
                      </span>
                      <div>
                        <h4 className="text-white font-semibold">
                          {booking.booking_name}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>PNR: {booking.pnr}</span>
                          <span>•</span>
                          <span>{booking.booking_status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">
                        {formatPrice(booking.sales_price || 0)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {booking.class}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-6 flex-1">
                      {/* Route */}
                      <div className="text-center">
                        <div className="text-xl font-semibold text-white">
                          {booking.from_airport}
                        </div>
                        <div className="text-sm text-gray-400">Departure</div>
                      </div>

                      {/* Flight Path */}
                      <div className="flex-1 px-4">
                        <div className="flex items-center gap-2 text-gray-300">
                          <div className="flex-1 border-t-2 border-gray-600"></div>
                          <Plane className="h-4 w-4" />
                          <div className="flex-1 border-t-2 border-gray-600"></div>
                        </div>
                        <div className="text-center text-sm text-gray-400 mt-2">
                          {booking.airline_carrier}
                        </div>
                      </div>

                      {/* Arrival */}
                      <div className="text-center">
                        <div className="text-xl font-semibold text-white">
                          {booking.to_airport}
                        </div>
                        <div className="text-sm text-gray-400">Arrival</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(booking.start_date)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-300">
                        <span className="text-gray-400">Class:</span>
                        <span>{booking.class}</span>
                      </div>
                    </div>
                  </div>

                  {booking.booking_notes && (
                    <div className="mt-4 p-3 bg-accent-500/10 border border-accent-500/20 rounded">
                      <p className="text-accent-300 text-sm">{booking.booking_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-sm">
            This itinerary is prepared for your upcoming trip. Contact your travel agent for any questions.
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Powered by Biirdee Pro • Travel Management Platform
          </p>
        </div>
      </main>
    </div>
  );
};

export default PublicItineraryPage;
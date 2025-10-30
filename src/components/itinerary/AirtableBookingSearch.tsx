import React, { useState } from 'react';
import { Search, Loader, Plus, Plane, MapPin, Calendar, DollarSign, User } from 'lucide-react';

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

interface AirtableBookingSearchProps {
  onSelectBooking: (booking: AirtableBooking) => void;
}

const AirtableBookingSearch: React.FC<AirtableBookingSearchProps> = ({ onSelectBooking }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AirtableBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchBookings = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-airtable-bookings`;
      
      const response = await fetch(`${apiUrl}?query=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(data.records || []);
      setHasSearched(true);
    } catch (err) {
      console.error('Error searching bookings:', err);
      
      // Try to parse error details from the response
      let errorMessage = 'Failed to search bookings';
      let errorDetails = null;
      
      if (err instanceof Error) {
        console.error('❌ Detailed error information:', err.message);
        errorMessage = err.message;
        
        // Try to extract JSON error details if present
        try {
          const jsonMatch = err.message.match(/\{.*\}/);
          if (jsonMatch) {
            errorDetails = JSON.parse(jsonMatch[0]);
            console.error('❌ Parsed error details:', errorDetails);
          }
        } catch (parseError) {
          console.error('❌ Could not parse error details:', parseError);
        }
      }
      
      // Set comprehensive error message
      if (errorDetails) {
        setError(`${errorDetails.error || errorMessage}\n\nDetails: ${JSON.stringify(errorDetails.debugInfo || errorDetails.details || {}, null, 2)}`);
      } else {
        setError(errorMessage);
      }
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchBookings();
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
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookings by name, PNR, route, or airline..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-accent-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {searchQuery.trim() ? 'Search' : 'Show All'}
        </button>
      </form>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Search Results */}
      {hasSearched && (
        <div className="max-h-96 overflow-y-auto space-y-3">
          {searchResults.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-400">No bookings found</p>
              <p className="text-gray-500 text-sm">Try a different search term</p>
            </div>
          ) : (
            searchResults.map((booking) => (
              <div key={booking.id} className="bg-gray-850 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="bg-blue-600 p-2 rounded">
                        <Plane className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">
                          {booking.booking_name}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span>#{booking.booking_id}</span>
                          <span>•</span>
                          <span>{booking.pnr}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-300">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span>{booking.from_airport} → {booking.to_airport}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span>{formatDate(booking.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-300">
                          <Plane className="h-3 w-3 text-gray-400" />
                          <span>{booking.airline_carrier}</span>
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
                        <div className="flex items-center gap-2 text-gray-300">
                          <User className="h-3 w-3 text-gray-400" />
                          <span>{booking.sales_agent_name}</span>
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
                    onClick={() => onSelectBooking(booking)}
                    className="bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2 ml-4"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AirtableBookingSearch;
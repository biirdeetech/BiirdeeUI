import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plane, Mail, Calendar, DollarSign, FileText, Clock, MapPin, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Proposal {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  notes: string;
  total_price: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  clients?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    is_primary: boolean;
  }>;
}

interface ProposalOption {
  id: string;
  flight_data: any;
  is_hidden: boolean;
  agent_notes: string;
  selected_price: number;
  option_number: number;
}

const PublicProposalPage: React.FC = () => {
  const { shareLink } = useParams<{ shareLink: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [options, setOptions] = useState<ProposalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProposal = async () => {
      if (!shareLink) return;

      try {
        console.log('🔍 Fetching public proposal for share link:', shareLink);
        
        // Fetch proposal by share link with clients (public access)
        const { data: proposalData, error: proposalError } = await supabase
          .from('proposals')
          .select(`
            *,
            proposal_clients(
              client_id,
              is_primary,
              clients(id, first_name, last_name, email)
            )
          `)
          .eq('share_link', shareLink)
          .single();

        if (proposalError) {
          console.error('❌ Error fetching proposal:', proposalError);
          throw proposalError;
        }

        // Transform the client data
        const transformedProposal = {
          ...proposalData,
          clients: proposalData.proposal_clients?.map((pc: any) => ({
            id: pc.clients.id,
            first_name: pc.clients.first_name,
            last_name: pc.clients.last_name,
            email: pc.clients.email,
            is_primary: pc.is_primary
          })) || [],
          proposal_clients: undefined
        };

        console.log('✅ Proposal fetched:', proposalData);
        setProposal(transformedProposal);

        // Fetch visible proposal options (public access)
        const { data: optionsData, error: optionsError } = await supabase
          .from('proposal_options')
          .select('*')
          .eq('proposal_id', proposalData.id)
          .eq('is_hidden', false)
          .order('option_number', { ascending: true });

        if (optionsError) {
          console.error('❌ Error fetching options:', optionsError);
          throw optionsError;
        }

        console.log('✅ Options fetched:', optionsData?.length || 0);
        setOptions(optionsData || []);

      } catch (err) {
        console.error('❌ Public proposal fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load proposal');
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
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
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    try {
      // Extract time portion directly from ISO string (e.g., "2025-10-05T14:30:00+03:00")
      const timeMatch = dateTime.match(/T(\d{2}):(\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        
        // Convert to 12-hour format
        const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const minutesStr = minutes.toString().padStart(2, '0');
        
        return `${hour12}:${minutesStr} ${ampm}`;
      }
      return 'N/A';
    } catch {
      return 'N/A';
    }
  };

  const formatDateOnly = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getDayDifference = (departureDateTime: string, arrivalDateTime: string) => {
    if (!departureDateTime || !arrivalDateTime) return 0;
    const depDate = new Date(departureDateTime);
    const arrDate = new Date(arrivalDateTime);
    
    // Reset time to compare just dates
    const depDay = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate());
    const arrDay = new Date(arrDate.getFullYear(), arrDate.getMonth(), arrDate.getDate());
    
    const diffTime = arrDay.getTime() - depDay.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getFlightSummary = (flightData: any) => {
    if (!flightData || !flightData.slices || flightData.slices.length === 0) {
      return 'Flight details not available';
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
      return `${origin} → ... → ${destination}`;
    }
  };

  const getCarrierInfo = (flightData: any) => {
    if (!flightData || !flightData.slices || flightData.slices.length === 0) {
      return 'Unknown airline';
    }

    const firstSlice = flightData.slices[0];
    if (firstSlice.segments && firstSlice.segments.length > 0) {
      return firstSlice.segments[0].carrier?.shortName || firstSlice.segments[0].carrier?.name || 'Unknown airline';
    }
    
    return 'Unknown airline';
  };

  const getFlightDuration = (flightData: any) => {
    if (!flightData || !flightData.slices || flightData.slices.length === 0) {
      return 'Unknown';
    }

    const totalMinutes = flightData.slices.reduce((sum: number, slice: any) => sum + (slice.duration || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getPrimaryClient = () => {
    return proposal?.clients?.find(c => c.is_primary) || proposal?.clients?.[0];
  };

  const getClientDisplay = () => {
    const primary = getPrimaryClient();
    const clientCount = proposal?.clients?.length || 0;
    
    if (!primary) {
      // Fallback to legacy fields
      return {
        name: proposal?.first_name && proposal?.last_name 
          ? `${proposal.first_name} ${proposal.last_name}` 
          : 'Client',
        email: proposal?.email || 'No email provided',
        additional: 0
      };
    }
    
    return {
      name: `${primary.first_name} ${primary.last_name}`,
      email: primary.email,
      additional: clientCount - 1
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
          <p className="text-gray-300">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Proposal Not Found</h2>
            <p className="text-gray-400 mb-6">
              {error || 'The proposal you\'re looking for doesn\'t exist or may have been removed.'}
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
              <Plane className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                {proposal.name}
              </h2>
              <p className="text-gray-400">Prepared by Biirdee Pro</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Proposal Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
          {(() => {
            const clientDisplay = getClientDisplay();
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {proposal.name}
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-gray-300">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{clientDisplay.name}</span>
                      {clientDisplay.additional > 0 && (
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs ml-2">
                          +{clientDisplay.additional} more client{clientDisplay.additional !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{clientDisplay.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Created {formatDate(proposal.created_at)}</span>
                    </div>
                    {proposal.clients && proposal.clients.length > 1 && (
                      <div className="mt-4 p-3 bg-gray-850 rounded">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">All Clients</h4>
                        <div className="space-y-1">
                          {proposal.clients.map((client, index) => (
                            <div key={client.id} className="text-sm text-gray-400 flex items-center gap-2">
                              <span>{client.first_name} {client.last_name}</span>
                              <span className="text-gray-500">({client.email})</span>
                              {client.is_primary && (
                                <span className="bg-accent-500/20 text-accent-400 px-1.5 py-0.5 rounded text-xs">
                                  PRIMARY
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white mb-2">
                    {formatPrice(proposal.total_price)}
                  </div>
                  <div className="text-gray-400">Total Price</div>
                  {proposal.notes && (
                    <div className="mt-4 p-3 bg-gray-850 rounded text-sm text-gray-300">
                      <strong>Notes:</strong> {proposal.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Flight Options */}
        {options.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
            <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Flight Options Available</h3>
            <p className="text-gray-400">
              Flight options are being prepared and will be available soon.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {options.map((option) => (
              <div key={option.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                {/* Option Header */}
                <div className="bg-gray-850 border-b border-gray-700 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="bg-accent-600 text-white px-3 py-1 rounded font-medium">
                        Option {option.option_number}
                      </span>
                      <div className="text-white font-medium">
                        {getFlightSummary(option.flight_data)}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {getCarrierInfo(option.flight_data)} • {getFlightDuration(option.flight_data)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">
                        {formatPrice(option.selected_price)}
                      </div>
                    </div>
                  </div>
                  {option.agent_notes && (
                    <div className="mt-3 p-3 bg-accent-500/10 border border-accent-500/20 rounded">
                      <p className="text-accent-300 text-sm">{option.agent_notes}</p>
                    </div>
                  )}
                </div>

                {/* Flight Details */}
                <div className="p-6">
                  {option.flight_data?.slices?.map((slice: any, sliceIndex: number) => (
                    <div key={sliceIndex} className={sliceIndex > 0 ? 'border-t border-gray-700 pt-6 mt-6' : ''}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4 lg:gap-6 flex-1">
                          {/* Departure */}
                          <div className="text-center">
                            <div className="text-lg lg:text-2xl font-semibold text-white">
                              {formatTime(slice.departure)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatDateOnly(slice.departure)}
                            </div>
                            <div className="text-sm font-medium text-accent-400">{slice.origin?.code}</div>
                            <div className="text-xs text-gray-400 hidden lg:block">
                              {slice.origin?.name}
                            </div>
                          </div>

                          {/* Flight Path */}
                          <div className="flex-1 px-4">
                            <div className="flex items-center gap-2 text-gray-300">
                              <div className="flex-1 border-t-2 border-gray-600"></div>
                              <Plane className="h-4 w-4" />
                              <div className="flex-1 border-t-2 border-gray-600"></div>
                            </div>
                            <div className="text-center text-sm text-gray-300 mt-2">
                              {slice.flights?.join(', ') || 'Flight info not available'}
                            </div>
                            <div className="text-center text-xs text-gray-400 mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatDuration(slice.duration)}
                            </div>
                            {slice.stops && slice.stops.length > 0 && (
                              <div className="text-center text-xs text-gray-500 mt-1">
                                <MapPin className="h-3 w-3 inline mr-1" />
                                Stop: {slice.stops.map((stop: any) => stop.code).join(', ')}
                              </div>
                            )}
                          </div>

                          {/* Arrival */}
                          <div className="text-center">
                            <div className="text-lg lg:text-2xl font-semibold text-white">
                              {formatTime(slice.arrival)}
                              {(() => {
                                const dayDiff = getDayDifference(slice.departure, slice.arrival);
                                if (dayDiff > 0) {
                                  return <span className="text-xs text-accent-400 ml-1">+{dayDiff}</span>;
                                }
                                return null;
                              })()}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatDateOnly(slice.arrival)}
                            </div>
                            <div className="text-sm font-medium text-accent-400">
                              {slice.destination?.code}
                            </div>
                            <div className="text-xs text-gray-400 hidden lg:block">
                              {slice.destination?.name}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Flight Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-gray-400 font-medium">Date:</span>
                          <div className="text-white">
                            {slice.departure ? new Date(slice.departure).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">Cabin:</span>
                          <div className="text-white">
                            {slice.cabins?.join(', ') || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">Aircraft:</span>
                          <div className="text-white">
                            {slice.segments?.[0]?.legs?.[0]?.aircraft?.shortName || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 font-medium">Booking:</span>
                          <div className="text-white font-mono">
                            {slice.segments?.[0]?.pricings?.[0]?.bookingClass || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-sm">
            This proposal is valid for a limited time. Contact your travel agent for booking assistance.
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Powered by Biirdee Pro • Advanced Flight Search & Proposals
          </p>
        </div>
      </main>
    </div>
  );
};

export default PublicProposalPage;
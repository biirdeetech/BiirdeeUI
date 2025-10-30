import React, { useState, useMemo } from 'react';
import { Eye, Loader, X, Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import ITAMatrixService from '../../services/itaMatrixApi';
import AddHackToProposalModal from './AddHackToProposalModal';

interface HackResult {
  type: 'frt' | 'skiplag';
  route: string;
  outbound: {
    flight: string;
    departure: string;
    time: string;
  };
  return?: {
    flight: string;
    departure: string;
    time: string;
    origin: string;
    destination: string;
  };
  continuation?: {
    flight: string;
    departure: string;
    time: string;
    destination: string;
  };
  price: string;
  savings: string;
  airline: string;
  finalCity?: string;
  totalAmount: number;
  solutionId?: string;
  sessionInfo?: {
    session: string;
    solutionSet: string;
  };
}

interface HackResultsTableProps {
  searchResults: HackResult[];
}

const HackResultsTable: React.FC<HackResultsTableProps> = ({ searchResults }) => {
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddToProposal, setShowAddToProposal] = useState(false);
  const [selectedHackResult, setSelectedHackResult] = useState<HackResult | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage] = useState(10);

  // Filter state
  const [strategyFilter, setStrategyFilter] = useState<'all' | 'frt' | 'skiplag'>('all');
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
  const [minSavingsFilter, setMinSavingsFilter] = useState<string>('');
  const [airlineFilter, setAirlineFilter] = useState<string>('');

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleShowDetails = async (result: HackResult) => {
    if (!result.solutionId || !result.sessionInfo) {
      alert('Details not available for this result');
      return;
    }

    setLoadingDetails(result.solutionId);
    setSelectedDetails(null);
    setShowDetailsModal(true);

    try {
      const details = await ITAMatrixService.getFlightDetails(
        result.solutionId,
        result.sessionInfo.session,
        result.sessionInfo.solutionSet
      );
      setSelectedDetails(details);
    } catch (error) {
      console.error('Failed to fetch details:', error);
      alert('Failed to fetch flight details');
    } finally {
      setLoadingDetails(null);
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedDetails(null);
  };

  const handleAddToProposal = (result: HackResult) => {
    setSelectedHackResult(result);
    setShowAddToProposal(true);
  };

  const closeAddToProposalModal = () => {
    setShowAddToProposal(false);
    setSelectedHackResult(null);
  };

  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    let filtered = [...searchResults];

    // Apply strategy filter
    if (strategyFilter !== 'all') {
      filtered = filtered.filter(result => result.type === strategyFilter);
    }

    // Apply price filter
    if (maxPriceFilter) {
      const maxPrice = parseFloat(maxPriceFilter);
      filtered = filtered.filter(result => {
        const price = parseFloat(result.price.replace(/[^0-9.]/g, ''));
        return price <= maxPrice;
      });
    }

    // Apply savings filter
    if (minSavingsFilter) {
      const minSavings = parseFloat(minSavingsFilter);
      filtered = filtered.filter(result => {
        const savings = parseFloat(result.savings.replace(/[^0-9.]/g, ''));
        return savings >= minSavings;
      });
    }

    // Apply airline filter
    if (airlineFilter) {
      filtered = filtered.filter(result =>
        result.airline.toLowerCase().includes(airlineFilter.toLowerCase())
      );
    }

    // Sort by price (ascending)
    filtered.sort((a, b) => {
      const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
      const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
      return priceA - priceB;
    });

    return filtered;
  }, [searchResults, strategyFilter, maxPriceFilter, minSavingsFilter, airlineFilter]);

  // Pagination calculations
  const totalResults = filteredAndSortedResults.length;
  const totalPages = Math.ceil(totalResults / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const currentResults = filteredAndSortedResults.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  if (searchResults.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Search Results</h2>
          <div className="text-sm text-gray-400">
            Showing {startIndex + 1}-{Math.min(endIndex, totalResults)} of {totalResults} results
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-850 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-300">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Strategy</label>
              <select
                value={strategyFilter}
                onChange={(e) => {
                  setStrategyFilter(e.target.value as any);
                  handleFilterChange();
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm focus:border-accent-500"
              >
                <option value="all">All Strategies</option>
                <option value="frt">Fake Round Trip</option>
                <option value="skiplag">Skiplag</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Max Price</label>
              <input
                type="number"
                placeholder="e.g., 1000"
                value={maxPriceFilter}
                onChange={(e) => {
                  setMaxPriceFilter(e.target.value);
                  handleFilterChange();
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm focus:border-accent-500 placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Min Savings</label>
              <input
                type="number"
                placeholder="e.g., 100"
                value={minSavingsFilter}
                onChange={(e) => {
                  setMinSavingsFilter(e.target.value);
                  handleFilterChange();
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm focus:border-accent-500 placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Airline</label>
              <input
                type="text"
                placeholder="e.g., United"
                value={airlineFilter}
                onChange={(e) => {
                  setAirlineFilter(e.target.value);
                  handleFilterChange();
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm focus:border-accent-500 placeholder-gray-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-300 font-medium py-3 px-2">Strategy</th>
                <th className="text-left text-gray-300 font-medium py-3 px-2">Route</th>
                <th className="text-left text-gray-300 font-medium py-3 px-2">Outbound</th>
                <th className="text-left text-gray-300 font-medium py-3 px-2">Details</th>
                <th className="text-right text-gray-300 font-medium py-3 px-2">Price</th>
                <th className="text-right text-gray-300 font-medium py-3 px-2">Savings</th>
                <th className="text-center text-gray-300 font-medium py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentResults.map((result, index) => (
                <tr key={index} className="border-b border-gray-800 hover:bg-gray-850">
                  <td className="py-4 px-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      result.type === 'frt' 
                        ? 'bg-success-500/20 text-success-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {result.type === 'frt' ? 'Fake RT' : 'Skiplag'}
                    </span>
                  </td>
                  <td className="py-4 px-2">
                    <div className="text-white font-medium">{result.route}</div>
                    <div className="text-xs text-gray-400">
                      {result.type === 'frt' ? 'Round Trip' : 'Hidden City'} • {result.airline}
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="text-white font-medium">{result.outbound.flight}</div>
                    <div className="text-sm text-gray-300">{result.outbound.time}</div>
                    <div className="text-xs text-gray-400">{formatDate(result.outbound.departure)}</div>
                  </td>
                  <td className="py-4 px-2">
                    {result.type === 'frt' && result.return ? (
                      <div>
                        <div className="text-white font-medium">{result.return.flight}</div>
                        <div className="text-sm text-gray-300">{result.return.time}</div>
                        <div className="text-xs text-gray-400">
                          {formatDate(result.return.departure)} • {result.return.origin} → {result.return.destination}
                        </div>
                      </div>
                    ) : result.continuation ? (
                      <div>
                        <div className="text-white font-medium">{result.continuation.flight}</div>
                        <div className="text-sm text-gray-300">{result.continuation.time}</div>
                        <div className="text-xs text-gray-400">Skip to {result.finalCity}</div>
                      </div>
                    ) : null}
                  </td>
                  <td className="py-4 px-2 text-right">
                    <div className="text-lg font-semibold text-white">{result.price}</div>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <div className="text-lg font-semibold text-success-400">{result.savings}</div>
                  </td>
                  <td className="py-4 px-2 text-center">
                    <button
                      onClick={() => handleShowDetails(result)}
                      disabled={loadingDetails === result.solutionId}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors mr-2"
                    >
                      {loadingDetails === result.solutionId ? (
                        <Loader className="h-3 w-3 animate-spin" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                      Details
                    </button>
                    <button
                      onClick={() => handleAddToProposal(result)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add to Proposal
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-800">
            <div className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-750 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              {/* Page numbers */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 rounded transition-colors ${
                        currentPage === pageNum
                          ? 'bg-accent-600 text-white'
                          : 'bg-gray-800 hover:bg-gray-750 text-gray-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-750 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-white">Flight Details</h3>
              <button
                onClick={closeDetailsModal}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              {loadingDetails && (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-8 w-8 animate-spin text-accent-400" />
                  <span className="ml-3 text-gray-300">Loading details...</span>
                </div>
              )}
              
              {selectedDetails && (
                <div className="space-y-6">
                  {/* Booking Details */}
                  {selectedDetails.bookingDetails && (
                    <div className="bg-gray-850 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-accent-400 mb-4">Booking Information</h4>
                      
                      {/* Price Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                          <div className="text-sm text-gray-400">Total Price</div>
                          <div className="text-2xl font-bold text-white">
                            {selectedDetails.bookingDetails.displayTotal}
                          </div>
                        </div>
                        {selectedDetails.bookingDetails.ext?.pricePerMile && (
                          <div>
                            <div className="text-sm text-gray-400">Price per Mile</div>
                            <div className="text-xl font-medium text-white">
                              ${selectedDetails.bookingDetails.ext.pricePerMile}/mi
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Fare Calculations */}
                      {selectedDetails.bookingDetails.tickets?.[0]?.pricings?.[0]?.fareCalculations && (
                        <div className="mb-6">
                          <h5 className="text-md font-semibold text-white mb-3">Fare Calculation</h5>
                          <div className="bg-gray-800 rounded p-3">
                            {selectedDetails.bookingDetails.tickets[0].pricings[0].fareCalculations.map((calc: any, index: number) => (
                              <div key={index} className="font-mono text-sm text-gray-300 break-all">
                                {calc.lines?.map((line: string, lineIndex: number) => (
                                  <div key={lineIndex} className="mb-1">{line}</div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Flight Segments */}
                      {selectedDetails.bookingDetails.itinerary?.slices?.map((slice: any, sliceIndex: number) => (
                        <div key={sliceIndex} className="mb-6">
                          <h5 className="text-md font-semibold text-white mb-3">
                            {slice.origin?.code} → {slice.destination?.code}
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <div className="text-sm text-gray-400">Departure</div>
                              <div className="text-lg font-medium text-white">
                                {new Date(slice.departure).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-400">Arrival</div>
                              <div className="text-lg font-medium text-white">
                                {new Date(slice.arrival).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          {/* Segments within slice */}
                          {slice.segments?.map((segment: any, segIndex: number) => (
                            <div key={segIndex} className="bg-gray-800 rounded p-3 mb-2">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <div className="text-gray-400">Flight</div>
                                  <div className="text-white font-medium">
                                    {segment.carrier?.code} {segment.flight?.number}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-400">Aircraft</div>
                                  <div className="text-white">
                                    {segment.legs?.[0]?.aircraft?.shortName || 'N/A'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-400">Booking Class</div>
                                  <div className="text-white font-mono">
                                    {segment.bookingInfos?.[0]?.bookingCode || 'N/A'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-400">Fare Basis</div>
                                  <div className="text-white font-mono text-xs">
                                    {segment.bookingInfos?.[0]?.fareBasis || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add to Proposal Modal */}
      {showAddToProposal && selectedHackResult && (
        <AddHackToProposalModal
          hackResult={selectedHackResult}
          onClose={closeAddToProposalModal}
        />
      )}
    </>
  );
};

export default HackResultsTable;
import React, { useState, useEffect } from 'react';
import { Plus, Clock, Plane, ChevronDown } from 'lucide-react';
import FlightSegmentViewer from './FlightSegmentViewer';

interface AwardOption {
  id: string;
  miles: number;
  tax: number;
  cabin: string;
  segments: any[];
  transferOptions: any[];
  seats: number;
  itineraries: any[];
  price: any;
  data: any;
}

interface AwardCardsProps {
  awardOptions: AwardOption[];
  perCentValue: number;
  onAdd: (award: AwardOption) => void;
  onSelect?: (awardId: string | null) => void;
  selectedAwardId?: string | null;
  formatTimeInOriginTZ: (dateStr: string) => string;
  formatDateInOriginTZ: (dateStr: string) => string;
  originTimezone?: string;
  groupAwards?: (awards: AwardOption[]) => Array<{ primary: AwardOption; alternatives: AwardOption[] }>;
  addedItems?: Set<string>;
  hoveredAddButton?: string | null;
  setHoveredAddButton?: (id: string | null) => void;
}

// Map cabin names to display format
const cabinDisplayMap: Record<string, string> = {
  'COACH': 'Economy',
  'ECONOMY': 'Economy',
  'PREMIUM': 'Premium Economy',
  'PREMIUM_ECONOMY': 'Premium Economy',
  'BUSINESS': 'Business',
  'FIRST': 'First'
};

const AwardCards: React.FC<AwardCardsProps> = ({
  awardOptions,
  perCentValue,
  onAdd,
  onSelect,
  selectedAwardId,
  formatTimeInOriginTZ,
  formatDateInOriginTZ,
  originTimezone,
  groupAwards,
  addedItems = new Set(),
  hoveredAddButton = null,
  setHoveredAddButton
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  if (!awardOptions || awardOptions.length === 0) {
    return null;
  }

  // Group awards by cabin
  const awardsByCabin = new Map<string, AwardOption[]>();
  awardOptions.forEach(award => {
    const cabinKey = award.cabin.toUpperCase();
    if (!awardsByCabin.has(cabinKey)) {
      awardsByCabin.set(cabinKey, []);
    }
    awardsByCabin.get(cabinKey)!.push(award);
  });

  // Define cabin order (premium first, then economy)
  const cabinOrder = ['FIRST', 'BUSINESS', 'PREMIUM_ECONOMY', 'PREMIUM', 'ECONOMY', 'COACH'];
  const availableCabins = Array.from(awardsByCabin.keys()).sort((a, b) => {
    const aIndex = cabinOrder.indexOf(a) !== -1 ? cabinOrder.indexOf(a) : 999;
    const bIndex = cabinOrder.indexOf(b) !== -1 ? cabinOrder.indexOf(b) : 999;
    return aIndex - bIndex;
  });

  // Initialize active cabin tab to first available cabin
  const [activeCabinTab, setActiveCabinTab] = useState<string>('');

  // Set default active tab when availableCabins changes
  useEffect(() => {
    if (availableCabins.length > 0 && (!activeCabinTab || !availableCabins.includes(activeCabinTab))) {
      setActiveCabinTab(availableCabins[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCabins.length, awardOptions.length]); // Update when cabin availability changes

  // Get awards for active cabin
  const activeCabinAwards = activeCabinTab ? awardsByCabin.get(activeCabinTab) || [] : [];

  // Sort by best value (miles * perCentValue + tax) - perCentValue is already in decimal form (0.015 = 1.5 cents)
  const sortedAwards = [...activeCabinAwards].sort((a, b) => {
    const aValue = (a.miles * perCentValue) + a.tax;
    const bValue = (b.miles * perCentValue) + b.tax;
    return aValue - bValue;
  });

  // Group awards if grouping function provided
  const groupedAwards = groupAwards ? groupAwards(sortedAwards) : sortedAwards.map(a => ({ primary: a, alternatives: [] }));

  // Default to cheapest if no selection
  const defaultSelectedId = selectedAwardId || (sortedAwards.length > 0 ? sortedAwards[0].id : null);
  const effectiveSelectedId = selectedAwardId ?? defaultSelectedId;

  return (
    <div className="space-y-3">
      {/* Cabin Tabs */}
      {availableCabins.length > 1 && (
        <div className="flex gap-2 border-b border-gray-700 pb-2 mb-3 overflow-x-auto">
          {availableCabins.map((cabinKey) => {
            const cabinAwards = awardsByCabin.get(cabinKey) || [];
            const cabinDisplay = cabinDisplayMap[cabinKey] || cabinKey;
            const isActive = activeCabinTab === cabinKey;
            
            return (
              <button
                key={cabinKey}
                onClick={() => setActiveCabinTab(cabinKey)}
                className={`px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? cabinKey === 'BUSINESS' || cabinKey === 'FIRST'
                      ? 'bg-purple-500/15 text-purple-400 border-b-2 border-purple-500'
                      : cabinKey === 'PREMIUM' || cabinKey === 'PREMIUM_ECONOMY'
                      ? 'bg-blue-500/15 text-blue-400 border-b-2 border-blue-500'
                      : 'bg-gray-700/40 text-gray-300 border-b-2 border-gray-600'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {cabinDisplay} ({cabinAwards.length})
              </button>
            );
          })}
        </div>
      )}

      {/* Awards List */}
      <div className="max-h-96 overflow-y-auto space-y-3">
      {groupedAwards.map((group, groupIndex) => {
        const award = group.primary;
        const groupKey = `award-group-${groupIndex}`;
        const isExpanded = expandedGroups[groupKey] || false;
        const hasAlternatives = group.alternatives.length > 0;
        const isSelected = effectiveSelectedId === award.id;
        const cashValue = (award.miles * perCentValue) + award.tax;
        const itinerary = award.itineraries?.[0];
        const segments = itinerary?.segments || [];
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];

        // Calculate duration
        let duration = '';
        if (itinerary?.duration) {
          const match = itinerary.duration.match(/PT(\d+)H(\d+)M/);
          if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            duration = `${hours}h ${minutes}m`;
          }
        }

        // Format times
        const depTime = firstSegment?.departure?.at 
          ? formatTimeInOriginTZ(firstSegment.departure.at)
          : '';
        const arrTime = lastSegment?.arrival?.at
          ? formatTimeInOriginTZ(lastSegment.arrival.at)
          : '';
        const depDate = firstSegment?.departure?.at
          ? formatDateInOriginTZ(firstSegment.departure.at)
          : '';

        const stops = itinerary?.numberOfStops || 0;
        const isNonstop = stops === 0;

        // Get carrier code
        const carrierCode = firstSegment?.carrierCode || 'UA';
        const cabinDisplay = cabinDisplayMap[award.cabin.toUpperCase()] || award.cabin;

        return (
          <div
            key={award.id || groupIndex}
            className={`bg-gray-800/30 hover:bg-gray-800/50 rounded-lg border transition-all duration-200 p-3 ${
              isSelected ? 'border-purple-500/40 bg-purple-500/8' : 'border-gray-700/60'
            }`}
          >
            {/* Header: Selection Checkbox + Flight Info + Award Price + Add Button */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
              <div className="flex items-center gap-3 flex-1">
                {/* Selection Checkbox */}
                {onSelect && (
                  <input
                    type="radio"
                    name={`award-selection-${groupIndex}`}
                    checked={isSelected}
                    onChange={() => onSelect(award.id)}
                    className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 focus:ring-purple-500 focus:ring-2"
                  />
                )}
                <img
                  src={`https://www.gstatic.com/flights/airline_logos/35px/${carrierCode}.png`}
                  alt={carrierCode}
                  className="h-5 w-5 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    {segments.map((seg, idx) => (
                      <span key={idx} className="text-sm font-semibold text-white">
                        {seg.carrierCode}{seg.number}
                        {idx < segments.length - 1 && <span className="text-gray-500 mx-1">→</span>}
                      </span>
                    ))}
                    {/* Cabin Badge - only text colored, no background */}
                    <span className={`px-2 py-0.5 text-[10px] font-medium ${
                      award.cabin.toUpperCase() === 'BUSINESS' || award.cabin.toUpperCase() === 'FIRST'
                        ? 'text-purple-400'
                        : award.cabin.toUpperCase() === 'PREMIUM' || award.cabin.toUpperCase() === 'PREMIUM_ECONOMY'
                        ? 'text-blue-400'
                        : 'text-gray-300'
                    }`}>
                      {cabinDisplay}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {isNonstop ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`}
                    {duration && ` • ${duration}`}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <div className="bg-purple-500/12 border border-purple-500/25 rounded px-2 py-1">
                    <span className="text-xs font-bold text-purple-400">{award.miles.toLocaleString()}</span>
                    <span className="text-[10px] text-purple-400/70"> mi</span>
                    <span className="text-xs text-purple-400/60"> + </span>
                    <span className="text-xs font-semibold text-purple-400">${award.tax.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => onAdd(award)}
                    onMouseEnter={() => {
                      const awardId = `award-${award.id}`;
                      if (addedItems.has(awardId) && setHoveredAddButton) {
                        setHoveredAddButton(awardId);
                      }
                    }}
                    onMouseLeave={() => setHoveredAddButton && setHoveredAddButton(null)}
                    className={`px-2 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${
                      addedItems.has(`award-${award.id}`)
                        ? 'bg-green-500/20 hover:bg-red-500/20 text-green-300 hover:text-red-300 border-green-400/30 hover:border-red-400/30'
                        : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-400/30'
                    }`}
                  >
                    {addedItems.has(`award-${award.id}`) ? (
                      <>
                        <span className="text-[10px]">✓</span>
                        {hoveredAddButton === `award-${award.id}` ? 'Remove' : 'Added'}
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3" />
                        Add
                      </>
                    )}
                  </button>
                </div>
                <div className="text-[10px] text-gray-400">
                  Value: ${cashValue.toFixed(2)}
                  {award.seats > 0 && ` • ${award.seats} seats`}
                </div>
              </div>
            </div>

            {/* Flight Route Details */}
            <div className="mt-3 pt-3 border-t border-gray-700">
              <FlightSegmentViewer
                segments={segments.map(seg => ({
                  carrierCode: seg.carrierCode,
                  number: seg.number,
                  departure: seg.departure,
                  arrival: seg.arrival,
                  cabin: award.cabin,
                  duration: seg.duration
                }))}
                layovers={itinerary?.layovers || []}
                formatTime={formatTimeInOriginTZ}
                formatDate={formatDateInOriginTZ}
                showCabin={true}
                compact={false}
              />

              {/* Transfer Options */}
              {award.transferOptions && award.transferOptions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium">Transfer Partners:</span>
                  <div className="flex flex-wrap gap-2">
                    {award.transferOptions.map((option: any, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-purple-500/10 text-purple-300 rounded border border-purple-400/30">
                        {option.program} ({option.points?.toLocaleString() || 'N/A'} pts)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Alternatives Button */}
            {hasAlternatives && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <button
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded border border-gray-600/50 transition-colors"
                >
                  <span className="text-xs font-medium text-gray-300">
                    {group.alternatives.length} similar option{group.alternatives.length !== 1 ? 's' : ''}
                  </span>
                  <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Alternatives List */}
                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    {group.alternatives.map((altAward, altIdx) => {
                      const altItinerary = altAward.itineraries?.[0];
                      const altSegments = altItinerary?.segments || [];
                      const altFirstSegment = altSegments[0];
                      const altLastSegment = altSegments[altSegments.length - 1];
                      const altDepTime = altFirstSegment?.departure?.at ? formatTimeInOriginTZ(altFirstSegment.departure.at) : '';
                      const altArrTime = altLastSegment?.arrival?.at ? formatTimeInOriginTZ(altLastSegment.arrival.at) : '';
                      const altCashValue = (altAward.miles * perCentValue) + altAward.tax;
                      const altCabinDisplay = cabinDisplayMap[altAward.cabin.toUpperCase()] || altAward.cabin;
                      const altIsSelected = effectiveSelectedId === altAward.id;

                      return (
                        <div
                          key={altAward.id || altIdx}
                          className={`flex items-center justify-between px-3 py-2 rounded border transition-colors ${
                            altIsSelected
                              ? 'bg-purple-500/10 border-purple-400/30'
                              : 'bg-gray-800/30 border-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {onSelect && (
                              <input
                                type="radio"
                                name={`award-selection-${groupIndex}`}
                                checked={altIsSelected}
                                onChange={() => onSelect(altAward.id)}
                                className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600 focus:ring-purple-500 focus:ring-2"
                              />
                            )}
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-white">
                                  {altFirstSegment?.departure?.iataCode} → {altLastSegment?.arrival?.iataCode}
                                </span>
                                <span className={`px-1.5 py-0.5 text-[9px] font-medium ${
                                  altAward.cabin.toUpperCase() === 'BUSINESS' || altAward.cabin.toUpperCase() === 'FIRST'
                                    ? 'text-purple-300'
                                    : altAward.cabin.toUpperCase() === 'PREMIUM' || altAward.cabin.toUpperCase() === 'PREMIUM_ECONOMY'
                                    ? 'text-blue-300'
                                    : 'text-gray-300'
                                }`}>
                                  {altCabinDisplay}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {altDepTime} → {altArrTime}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-xs font-bold text-purple-300">{altAward.miles.toLocaleString()} mi</div>
                              <div className="text-[10px] text-gray-400">${altCashValue.toFixed(2)}</div>
                            </div>
                            <button
                              onClick={() => onAdd(altAward)}
                              onMouseEnter={() => {
                                const awardId = `award-${altAward.id}`;
                                if (addedItems.has(awardId) && setHoveredAddButton) {
                                  setHoveredAddButton(awardId);
                                }
                              }}
                              onMouseLeave={() => setHoveredAddButton && setHoveredAddButton(null)}
                              className={`px-2 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${
                                addedItems.has(`award-${altAward.id}`)
                                  ? 'bg-green-500/20 hover:bg-red-500/20 text-green-300 hover:text-red-300 border-green-400/30 hover:border-red-400/30'
                                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-400/30'
                              }`}
                            >
                              {addedItems.has(`award-${altAward.id}`) ? (
                                <>
                                  <span className="text-[10px]">✓</span>
                                  {hoveredAddButton === `award-${altAward.id}` ? 'Remove' : 'Added'}
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3 w-3" />
                                  Add
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default AwardCards;


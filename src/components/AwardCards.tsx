import React, { useState } from 'react';
import { Plus, Clock, Plane, ChevronDown } from 'lucide-react';

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
  groupAwards
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  if (!awardOptions || awardOptions.length === 0) {
    return null;
  }

  // Sort by best value (miles * perCentValue + tax) - perCentValue is already in decimal form (0.015 = 1.5 cents)
  const sortedAwards = [...awardOptions].sort((a, b) => {
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
    <div className="space-y-3 max-h-96 overflow-y-auto">
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
              isSelected ? 'border-purple-500/50 bg-purple-500/10' : 'border-gray-700'
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
                        ? 'text-purple-300'
                        : award.cabin.toUpperCase() === 'PREMIUM' || award.cabin.toUpperCase() === 'PREMIUM_ECONOMY'
                        ? 'text-blue-300'
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
                  <div className="bg-purple-500/15 border border-purple-400/40 rounded px-2 py-1">
                    <span className="text-xs font-bold text-purple-300">{award.miles.toLocaleString()}</span>
                    <span className="text-[10px] text-purple-400/70"> mi</span>
                    <span className="text-xs text-purple-400/60"> + </span>
                    <span className="text-xs font-semibold text-purple-300">${award.tax.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => onAdd(award)}
                    className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded border border-blue-400/30 transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
                <div className="text-[10px] text-gray-400">
                  Value: ${cashValue.toFixed(2)}
                  {award.seats > 0 && ` • ${award.seats} seats`}
                </div>
              </div>
            </div>

            {/* Flight Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <Plane className="h-3 w-3" />
                  <span>{firstSegment?.departure?.iataCode}</span>
                  <span className="text-gray-600">→</span>
                  <span>{lastSegment?.arrival?.iataCode}</span>
                </div>
                {depTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{depTime} {depDate}</span>
                    <span className="text-gray-600">→</span>
                    <span>{arrTime}</span>
                  </div>
                )}
              </div>

              {/* Transfer Options */}
              {award.transferOptions && award.transferOptions.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">Transfer:</span>
                  {award.transferOptions.map((option: any, idx: number) => (
                    <span key={idx} className="text-purple-400">
                      {option.program} ({option.points?.toLocaleString() || 'N/A'})
                      {idx < award.transferOptions.length - 1 && ','}
                    </span>
                  ))}
                </div>
              )}

              {/* Stops/Layovers */}
              {itinerary?.layovers && itinerary.layovers.length > 0 && (
                <div className="text-xs text-gray-500">
                  {itinerary.layovers.map((layover: any, idx: number) => (
                    <span key={idx}>
                      {layover.airport?.code} ({Math.round(layover.durationMinutes / 60)}h {layover.durationMinutes % 60}m)
                      {idx < itinerary.layovers.length - 1 && ', '}
                    </span>
                  ))}
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
                              <div className="flex items-center gap-2">
                                {altSegments.map((seg: any, idx: number) => (
                                  <span key={idx} className="text-xs font-semibold text-white">
                                    {seg.carrierCode}{seg.number}
                                    {idx < altSegments.length - 1 && <span className="text-gray-500 mx-1">→</span>}
                                  </span>
                                ))}
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
                              className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded border border-blue-400/30 transition-colors flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add
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
  );
};

export default AwardCards;


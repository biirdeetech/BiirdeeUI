import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Award } from 'lucide-react';
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

interface AwardNavigatorProps {
  awardOptions: AwardOption[];
  perCentValue: number;
  selectedAwardId?: string | null;
  onSelect: (awardId: string | null) => void;
  formatTimeInOriginTZ: (dateStr: string) => string;
  formatDateInOriginTZ: (dateStr: string) => string;
}

const AwardNavigator: React.FC<AwardNavigatorProps> = ({
  awardOptions,
  perCentValue,
  selectedAwardId,
  onSelect,
  formatTimeInOriginTZ,
  formatDateInOriginTZ
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Sort awards: fewest stops first, then by cash value (lowest first)
  const sortedAwards = [...awardOptions].sort((a, b) => {
    const aItinerary = a.itineraries?.[0];
    const bItinerary = b.itineraries?.[0];
    const aStops = aItinerary?.numberOfStops || 0;
    const bStops = bItinerary?.numberOfStops || 0;

    // First, sort by stops (fewest first)
    if (aStops !== bStops) {
      return aStops - bStops;
    }

    // Then, sort by cash value (lowest first)
    const aCashValue = (a.miles * perCentValue) + a.tax;
    const bCashValue = (b.miles * perCentValue) + b.tax;
    return aCashValue - bCashValue;
  });

  const totalAwards = sortedAwards.length;

  // Sync current index with selected award
  useEffect(() => {
    if (selectedAwardId) {
      const index = sortedAwards.findIndex(a => a.id === selectedAwardId);
      if (index !== -1 && index !== currentIndex) {
        setCurrentIndex(index);
      }
    }
  }, [selectedAwardId, sortedAwards, currentIndex]);

  // Auto-select first award if none selected
  useEffect(() => {
    if (sortedAwards.length > 0 && !selectedAwardId) {
      onSelect(sortedAwards[0].id);
    }
  }, [sortedAwards, selectedAwardId, onSelect]);

  if (totalAwards === 0) {
    return null;
  }

  const currentAward = sortedAwards[currentIndex];

  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : totalAwards - 1;
    setCurrentIndex(newIndex);
    onSelect(sortedAwards[newIndex].id);
  };

  const goToNext = () => {
    const newIndex = currentIndex < totalAwards - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    onSelect(sortedAwards[newIndex].id);
  };

  const cashValue = (currentAward.miles * perCentValue) + currentAward.tax;
  const itinerary = currentAward.itineraries?.[0];
  const stops = itinerary?.numberOfStops || 0;

  return (
    <div className="space-y-3">
      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={goToPrevious}
          disabled={totalAwards <= 1}
          className="p-1.5 bg-gray-800/50 hover:bg-gray-700/50 disabled:bg-gray-800/20 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-gray-700/50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-300" />
        </button>

        <div className="flex-1 flex flex-wrap items-center justify-center gap-2">
          {sortedAwards.map((award, idx) => {
            const awardCashValue = (award.miles * perCentValue) + award.tax;
            const isActive = idx === currentIndex;

            return (
              <button
                key={award.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  onSelect(award.id);
                }}
                className={`px-3 py-1.5 rounded border transition-all text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-gray-800/30 border-gray-700/40 text-gray-400 hover:bg-gray-700/40 hover:border-gray-600/50'
                }`}
              >
                {award.miles.toLocaleString()} mi + ${award.tax.toFixed(2)} @ ${awardCashValue.toFixed(2)}
              </button>
            );
          })}
        </div>

        <button
          onClick={goToNext}
          disabled={totalAwards <= 1}
          className="p-1.5 bg-gray-800/50 hover:bg-gray-700/50 disabled:bg-gray-800/20 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-gray-700/50 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="text-center text-[10px] text-gray-400">
        Option {currentIndex + 1} of {totalAwards}
      </div>

      {/* Selected Award Details */}
      {currentAward && (
        <div className="bg-gray-800/30 rounded-lg border border-gray-700/60 p-3">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-semibold text-yellow-400">Award Flight Details</span>
            </div>
            <div className="text-xs text-gray-400">
              {stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`}
              {currentAward.seats > 0 && ` • ${currentAward.seats} seats`}
            </div>
          </div>

          {/* Flight Segments */}
          {itinerary?.segments && itinerary.segments.length > 0 && (
            <FlightSegmentViewer
              segments={itinerary.segments.map((seg: any) => ({
                carrierCode: seg.carrierCode,
                number: seg.number,
                departure: seg.departure,
                arrival: seg.arrival,
                cabin: currentAward.cabin,
                duration: seg.duration
              }))}
              layovers={itinerary.layovers || []}
              formatTime={formatTimeInOriginTZ}
              formatDate={formatDateInOriginTZ}
              showCabin={true}
              compact={false}
            />
          )}

          {/* Transfer Options */}
          {currentAward.transferOptions && currentAward.transferOptions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-2 text-xs">
              <span className="text-gray-500 font-medium">Transfer Partners:</span>
              <div className="flex flex-wrap gap-2">
                {currentAward.transferOptions.map((option: any, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-purple-500/10 text-purple-300 rounded border border-purple-400/30">
                    {option.program} ({option.points?.toLocaleString() || 'N/A'} pts)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Award Value */}
          <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-xs">
            <span className="text-gray-400">Total Value:</span>
            <div className="flex items-center gap-2">
              <div className="bg-purple-500/12 border border-purple-500/25 rounded px-2 py-1">
                <span className="text-sm font-bold text-purple-400">{currentAward.miles.toLocaleString()}</span>
                <span className="text-[10px] text-purple-400/70"> mi</span>
                <span className="text-sm text-purple-400/60"> + </span>
                <span className="text-sm font-semibold text-purple-400">${currentAward.tax.toFixed(2)}</span>
              </div>
              <span className="text-xs text-gray-400">≈ ${cashValue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AwardNavigator;

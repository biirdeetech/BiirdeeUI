import React, { useState } from 'react';
import { Check, ChevronDown, AlertCircle, Sparkles } from 'lucide-react';
import MileageSegmentTooltip from './MileageSegmentTooltip';

interface GroupedMileageProgram {
  carrierCode: string;
  carrierName: string;
  totalMileage: number;
  totalPrice: number;
  matchType: 'exact' | 'partial' | 'mixed';
  flights: any[];
  segmentCount: number;
  segmentMatches: any[];
  hasIncompleteSegments: boolean;
  cabin?: string;
}

interface MileageSelectorProps {
  programs: GroupedMileageProgram[];
  selectedProgram: string | null;
  onSelect: (carrierCode: string | null) => void;
  sliceIndex: number;
}

const MileageSelector: React.FC<MileageSelectorProps> = ({
  programs,
  selectedProgram,
  onSelect,
  sliceIndex
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredProgram, setHoveredProgram] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);

  // Group programs by match type and cabin
  const exactMatches = programs.filter(p => p.matchType === 'exact');
  const partialMatches = programs.filter(p => p.matchType !== 'exact');

  const selectedProgramData = programs.find(p => p.carrierCode === selectedProgram);

  const handleMouseEnter = (program: GroupedMileageProgram, event: React.MouseEvent<HTMLDivElement>) => {
    setHoveredProgram(program.carrierCode);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top,
      left: rect.right + 8 // 8px gap
    });
  };

  const handleMouseLeave = () => {
    setHoveredProgram(null);
    setTooltipPosition(null);
  };

  const renderProgramOption = (program: GroupedMileageProgram, showCheckbox: boolean = true) => {
    const isSelected = program.carrierCode === selectedProgram;
    const isHovered = program.carrierCode === hoveredProgram;

    return (
      <div
        key={program.carrierCode}
        className="relative group"
        onMouseEnter={(e) => handleMouseEnter(program, e)}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(isSelected ? null : program.carrierCode);
            if (!isSelected) {
              setIsOpen(false);
            }
          }}
          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-700/50 transition-all ${
            isSelected ? 'bg-purple-900/30 border-l-2 border-purple-500' : ''
          }`}
        >
          {/* Checkbox */}
          {showCheckbox && (
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
              isSelected 
                ? 'bg-purple-600 border-purple-600' 
                : 'border-gray-600 bg-gray-800'
            }`}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          )}

          {/* Airline Logo */}
          <img
            src={`https://www.gstatic.com/flights/airline_logos/35px/${program.carrierCode}.png`}
            alt={program.carrierCode}
            className="h-5 w-5 object-contain flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />

          {/* Carrier Code */}
          <span className={`font-semibold ${
            program.matchType === 'exact' ? 'text-green-400' :
            program.matchType === 'mixed' ? 'text-purple-300' : 'text-yellow-300'
          }`}>
            {program.carrierCode}
          </span>

          {/* Cabin Badge */}
          {program.cabin && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
              {program.cabin}
            </span>
          )}

          {/* Mileage */}
          <span className="text-gray-300 ml-auto text-xs">
            {program.totalMileage.toLocaleString()} mi
          </span>

          {/* Price */}
          {program.totalPrice > 0 && (
            <span className="text-gray-400 text-xs">
              + ${program.totalPrice.toFixed(0)}
            </span>
          )}

          {/* Warning Icon */}
          {program.hasIncompleteSegments && (
            <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          )}
        </button>

      </div>
    );
  };

  const hoveredProgramData = programs.find(p => p.carrierCode === hoveredProgram);

  return (
    <div className="relative inline-block">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm ${
          selectedProgramData
            ? 'bg-purple-900/30 border border-purple-500/50 hover:bg-purple-900/40'
            : 'bg-purple-900/20 border border-purple-500/30 hover:bg-purple-900/30'
        }`}
      >
        {selectedProgramData ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-400" />
            <img
              src={`https://www.gstatic.com/flights/airline_logos/35px/${selectedProgramData.carrierCode}.png`}
              alt={selectedProgramData.carrierCode}
              className="h-4 w-4 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="text-white font-medium">{selectedProgramData.carrierCode}</span>
            <span className="text-xs text-gray-400">
              {selectedProgramData.totalMileage.toLocaleString()} mi
            </span>
            {selectedProgramData.totalPrice > 0 && (
              <span className="text-xs text-gray-400">
                + ${selectedProgramData.totalPrice.toFixed(0)}
              </span>
            )}
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-gray-300 font-medium">
              Mile Programs ({programs.length})
            </span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 min-w-[280px] max-w-[320px] max-h-[400px] flex flex-col overflow-visible">
            {/* Exact Matches Section */}
            {exactMatches.length > 0 && (
              <div className="border-b border-gray-700 overflow-visible">
                <div className="px-3 py-2 bg-gray-750 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                    Exact Matches
                  </span>
                  <span className="text-xs text-gray-500">({exactMatches.length})</span>
                </div>
                <div className="max-h-[180px] overflow-y-auto" style={{ overflowX: 'visible' }}>
                  {exactMatches.map(program => renderProgramOption(program))}
                </div>
              </div>
            )}

            {/* Partial Matches Section */}
            {partialMatches.length > 0 && (
              <div className="overflow-visible">
                <div className="px-3 py-2 bg-gray-750 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">
                    Partial Matches
                  </span>
                  <span className="text-xs text-gray-500">({partialMatches.length})</span>
                </div>
                <div className="max-h-[180px] overflow-y-auto" style={{ overflowX: 'visible' }}>
                  {partialMatches.map(program => renderProgramOption(program))}
                </div>
              </div>
            )}

            {/* No Programs */}
            {programs.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                No mileage programs available
              </div>
            )}
          </div>
        </>
      )}

      {/* Tooltip - Rendered outside dropdown with fixed positioning */}
      {hoveredProgramData && tooltipPosition && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          <MileageSegmentTooltip
            segments={hoveredProgramData.segmentMatches.map(sm => ({
              origin: sm.origin,
              destination: sm.destination,
              flightNumber: sm.cheapestFlight?.flightNumber,
              carrier: sm.cheapestFlight?.carrierCode || hoveredProgramData.carrierCode,
              mileage: sm.cheapestFlight?.mileage || 0,
              price: sm.cheapestFlight?.mileagePrice || 0,
              matched: sm.cheapestFlight !== null,
              departure: sm.cheapestFlight?.departure?.at,
              arrival: sm.cheapestFlight?.arrival?.at,
              cabin: sm.cheapestFlight?.cabin,
              aircraft: sm.cheapestFlight?.aircraft?.code,
              date: sm.cheapestFlight?.departure?.at ? new Date(sm.cheapestFlight.departure.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined
            }))}
            totalMileage={hoveredProgramData.totalMileage}
            totalPrice={hoveredProgramData.totalPrice}
            hasIncompleteSegments={hoveredProgramData.hasIncompleteSegments}
          />
        </div>
      )}
    </div>
  );
};

export default MileageSelector;

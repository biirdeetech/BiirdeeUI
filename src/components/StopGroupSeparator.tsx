import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface StopGroupSeparatorProps {
  stopCount: number;
  flightCount: number;
  lowestPrice: number;
  currency?: string;
  isExpanded?: boolean;
  onClick?: () => void;
}

const StopGroupSeparator: React.FC<StopGroupSeparatorProps> = ({
  stopCount,
  flightCount,
  lowestPrice,
  currency = 'USD',
  isExpanded = false,
  onClick
}) => {
  const stopText = stopCount === 0 ? 'Nonstop' : `${stopCount} stop${stopCount > 1 ? 's' : ''}`;

  return (
    <div className="relative flex items-center justify-center py-6">
      <div className="absolute inset-0 flex items-center pointer-events-none">
        <div className="w-full border-t border-gray-800"></div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick?.();
        }}
        className="relative z-10 bg-gray-950 px-6 py-2 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">
            {stopText} - Cheapest
          </span>
          <span className="text-sm text-gray-400">
            {currency}{lowestPrice.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500">
            ({flightCount} option{flightCount !== 1 ? 's' : ''})
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 ml-2" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 ml-2" />
          )}
        </div>
      </button>
    </div>
  );
};

export default StopGroupSeparator;

import React from 'react';

interface StopGroupSeparatorProps {
  stopCount: number;
  flightCount: number;
  lowestPrice: number;
  currency?: string;
}

const StopGroupSeparator: React.FC<StopGroupSeparatorProps> = ({
  stopCount,
  flightCount,
  lowestPrice,
  currency = 'USD'
}) => {
  const stopText = stopCount === 0 ? 'Nonstop' : `${stopCount} stop${stopCount > 1 ? 's' : ''}`;

  return (
    <div className="relative flex items-center justify-center py-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-800"></div>
      </div>
      <div className="relative bg-gray-950 px-6 py-2 rounded-lg border border-gray-800">
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
        </div>
      </div>
    </div>
  );
};

export default StopGroupSeparator;

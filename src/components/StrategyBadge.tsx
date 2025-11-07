import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface StrategyBadgeProps {
  type: 'skiplag' | 'fake-roundtrip';
}

const StrategyBadge: React.FC<StrategyBadgeProps> = ({ type }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const config = {
    skiplag: {
      label: 'Skiplag Mode',
      color: 'from-accent-600 to-accent-700',
      tooltip: 'Hidden City Ticketing: You\'ll exit at your via airport (layover), not the final destination. This can save money but has risks - use carefully!'
    },
    'fake-roundtrip': {
      label: 'Fake Round Trip Mode',
      color: 'from-accent-600 to-accent-700',
      tooltip: 'Throwaway Return: You\'ll only fly the outbound leg. Sometimes roundtrips are cheaper than one-way tickets. You won\'t use the return flight.'
    }
  };

  const { label, color, tooltip } = config[type];

  return (
    <div className="relative inline-block">
      <div
        className="flex items-center gap-1.5 animate-[slam_0.3s_ease-out]"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={`bg-gradient-to-r ${color} text-white px-3 py-1.5 text-sm rounded-lg font-medium shadow-lg`}>
          {label}
        </span>
        <Info className="h-4 w-4 text-gray-400 cursor-help" />
      </div>

      {showTooltip && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 text-xs text-gray-300 animate-[fadeIn_0.2s_ease-out]">
          {tooltip}
          <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-800 border-t border-l border-gray-700 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

export default StrategyBadge;

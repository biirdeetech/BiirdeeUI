import React from 'react';
import { Award, Sparkles } from 'lucide-react';

interface AwardWrapperProps {
  children: React.ReactNode;
  hasAwards: boolean;
  awardCount?: number;
  minMiles?: number;
  minCash?: number;
  currency?: string;
}

/**
 * Opal/Shiny Award Wrapper Component
 *
 * Wraps flight cards with a premium gradient border and glow effect
 * when award availability is detected. Makes awards the primary visual element.
 */
const AwardWrapper: React.FC<AwardWrapperProps> = ({
  children,
  hasAwards,
  awardCount = 0,
  minMiles,
  minCash,
  currency = 'USD'
}) => {
  if (!hasAwards) {
    // No awards - return children as-is
    return <>{children}</>;
  }

  return (
    <div className="relative group">
      {/* Opal Gradient Border & Glow Effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 rounded-lg opacity-75 group-hover:opacity-100 blur-sm transition-opacity duration-300"></div>

      {/* Animated Shimmer Effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-lg animate-[shimmer_3s_ease-in-out_infinite] opacity-0 group-hover:opacity-100"></div>

      {/* Content */}
      <div className="relative">
        {/* Award Badge - Top Right Corner */}
        <div className="absolute -top-2 -right-2 z-20 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg">
          <Sparkles className="h-3 w-3 text-yellow-200 animate-pulse" />
          <Award className="h-3.5 w-3.5 text-white" />
          <span className="text-xs font-bold text-white">
            {awardCount}
          </span>
        </div>

        {/* Award Info Banner - Top of Card */}
        {(minMiles || minCash !== undefined) && (
          <div className="absolute top-0 left-0 right-0 z-10">
            <div className="px-4 py-1.5 bg-gradient-to-r from-purple-500/95 via-pink-500/95 to-amber-500/95 backdrop-blur-sm flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-yellow-200" />
                <span className="text-xs font-bold text-white">AWARD AVAILABLE</span>
              </div>
              <div className="flex items-center gap-3">
                {minMiles && (
                  <div className="text-xs font-semibold text-white">
                    From <span className="text-yellow-200">{minMiles.toLocaleString()}</span> miles
                  </div>
                )}
                {minCash !== undefined && minCash > 0 && (
                  <div className="text-xs font-semibold text-white">
                    + <span className="text-yellow-200">{currency}{Math.round(minCash)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="relative">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AwardWrapper;

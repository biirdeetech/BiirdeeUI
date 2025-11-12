import React from 'react';
import { Loader, Check } from 'lucide-react';

interface StreamingProgressProps {
  isStreaming: boolean;
  currentCount: number;
  totalCount: number;
  isComplete: boolean;
}

const StreamingProgress: React.FC<StreamingProgressProps> = ({
  isStreaming,
  currentCount,
  totalCount,
  isComplete
}) => {
  if (!isStreaming && !isComplete) return null;

  const percentage = totalCount > 0 ? Math.min((currentCount / totalCount) * 100, 100) : 0;

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-4 lg:px-6 py-3">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          {isStreaming && !isComplete && (
            <Loader className="h-4 w-4 text-accent-400 animate-spin flex-shrink-0" />
          )}
          {isComplete && (
            <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
          )}

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-300">
                {isComplete
                  ? 'Search complete'
                  : `Loading flights... ${currentCount} of ${totalCount}`}
              </span>
              <span className="text-xs text-gray-400">
                {percentage.toFixed(0)}%
              </span>
            </div>

            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out ${
                  isComplete
                    ? 'bg-green-500'
                    : 'bg-accent-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamingProgress;

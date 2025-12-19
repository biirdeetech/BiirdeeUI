import React from 'react';
import { Loader, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { SequentialSearchProgress } from '../services/sequentialCabinSearch';

interface CabinSearchProgressProps {
  progress: Record<string, SequentialSearchProgress>;
}

const CabinSearchProgress: React.FC<CabinSearchProgressProps> = ({ progress }) => {
  const cabins = ['COACH', 'PREMIUM-COACH', 'BUSINESS', 'FIRST'];
  const cabinLabels: Record<string, string> = {
    'COACH': 'Economy',
    'PREMIUM-COACH': 'Premium',
    'BUSINESS': 'Business',
    'FIRST': 'First'
  };

  // Don't show if no progress data
  if (!progress || Object.keys(progress).length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-4">
      <div className="text-sm font-semibold text-gray-300 mb-3">Searching Cabins</div>
      <div className="grid grid-cols-4 gap-3">
        {cabins.map(cabin => {
          const cabinProgress = progress[cabin];
          if (!cabinProgress) return null;

          const { status, receivedCount, solutionCount } = cabinProgress;

          let icon;
          let statusColor;
          let statusText;

          switch (status) {
            case 'pending':
              icon = <Clock className="h-4 w-4" />;
              statusColor = 'text-gray-500';
              statusText = 'Pending';
              break;
            case 'streaming':
              icon = <Loader className="h-4 w-4 animate-spin" />;
              statusColor = 'text-blue-400';
              statusText = receivedCount ? `${receivedCount} found` : 'Searching...';
              break;
            case 'complete':
              icon = <CheckCircle className="h-4 w-4" />;
              statusColor = 'text-green-400';
              statusText = `${receivedCount || solutionCount || 0} flights`;
              break;
            case 'error':
              icon = <AlertCircle className="h-4 w-4" />;
              statusColor = 'text-red-400';
              statusText = 'Error';
              break;
            default:
              icon = <Clock className="h-4 w-4" />;
              statusColor = 'text-gray-500';
              statusText = 'Waiting';
          }

          return (
            <div
              key={cabin}
              className={`flex flex-col items-center gap-2 p-3 rounded-md border ${
                status === 'complete'
                  ? 'bg-green-500/5 border-green-500/20'
                  : status === 'streaming'
                  ? 'bg-blue-500/5 border-blue-500/20'
                  : status === 'error'
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-gray-800/30 border-gray-700/30'
              }`}
            >
              <div className={`${statusColor}`}>{icon}</div>
              <div className="text-xs font-medium text-gray-300">
                {cabinLabels[cabin] || cabin}
              </div>
              <div className={`text-[10px] ${statusColor}`}>
                {statusText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CabinSearchProgress;

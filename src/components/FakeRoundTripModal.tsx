import React from 'react';
import { X, ArrowLeft, MapPin } from 'lucide-react';

interface FakeRoundTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToOrigin: () => void;
  onFindNearby: () => void;
  onManual: () => void;
  originCode: string;
}

const FakeRoundTripModal: React.FC<FakeRoundTripModalProps> = ({
  isOpen,
  onClose,
  onReturnToOrigin,
  onFindNearby,
  onManual,
  originCode
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">Set Return Destination</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-400 mb-6">
            Choose where you want the (unused) return flight to go. You won't actually fly this leg.
          </p>

          {/* Option 1: Return to Origin */}
          <button
            onClick={onReturnToOrigin}
            className="w-full p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-accent-600 rounded-lg transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-500/20 rounded-lg group-hover:bg-accent-500/30 transition-colors">
                <ArrowLeft className="h-5 w-5 text-accent-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">Return to Origin</div>
                <div className="text-sm text-gray-400 mt-1">
                  Set return destination to <span className="font-mono text-accent-400">{originCode}</span>
                </div>
              </div>
            </div>
          </button>

          {/* Option 2: Find Nearby */}
          <button
            onClick={onFindNearby}
            className="w-full p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-600 rounded-lg transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                <MapPin className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">Find Nearby Airports</div>
                <div className="text-sm text-gray-400 mt-1">
                  Search for airports near your destination
                </div>
              </div>
            </div>
          </button>

          {/* Option 3: Add Manually */}
          <button
            onClick={onManual}
            className="w-full p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-700 rounded-lg group-hover:bg-gray-600 transition-colors">
                <span className="text-gray-400 group-hover:text-gray-300 text-lg font-semibold">✎</span>
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">Add Manually</div>
                <div className="text-sm text-gray-400 mt-1">
                  I'll enter the return destination myself
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FakeRoundTripModal;

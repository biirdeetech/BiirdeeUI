import React from 'react';
import { X, Plane, Award, DollarSign } from 'lucide-react';
import { MileageDeal } from '../types/flight';

interface MileageDealModalProps {
  deal: MileageDeal | null;
  isOpen: boolean;
  onClose: () => void;
}

const MileageDealModal: React.FC<MileageDealModalProps> = ({ deal, isOpen, onClose }) => {
  if (!isOpen || !deal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-accent-400" />
            Mileage Booking Option
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Airline Info */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-accent-500/10 rounded-lg">
                <Plane className="h-6 w-6 text-accent-400" />
              </div>
              <div>
                <div className="text-sm text-gray-400">Book Through</div>
                <div className="text-lg font-bold text-white">{deal.airline}</div>
                <div className="text-xs text-gray-500">Airline Code: {deal.airlineCode}</div>
              </div>
            </div>
          </div>

          {/* Match Type Badge */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
              <span className="text-sm text-gray-400">Match Type:</span>
              {deal.matchType === 'full' ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full font-medium border border-green-500/30">
                  Full Match
                </span>
              ) : (
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full font-medium border border-yellow-500/30">
                  Partial Match
                </span>
              )}
            </div>
          </div>

          {/* Mileage Cost */}
          <div className="bg-gradient-to-br from-accent-600/20 to-orange-600/20 border border-accent-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-300 mb-1">Required Miles</div>
                <div className="text-3xl font-bold text-accent-400">
                  {deal.mileage.toLocaleString()}
                </div>
              </div>
              <Award className="h-12 w-12 text-accent-400/30" />
            </div>
            {deal.mileagePrice > 0 && (
              <div className="mt-3 pt-3 border-t border-accent-500/20">
                <div className="flex items-center gap-2 text-gray-300">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Plus ${deal.mileagePrice.toFixed(2)} in taxes/fees</span>
                </div>
              </div>
            )}
          </div>

          {/* Cabin Classes */}
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">Available Cabins</div>
            <div className="flex flex-wrap gap-2">
              {deal.cabins.map((cabin, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg"
                >
                  {cabin}
                </span>
              ))}
            </div>
          </div>

          {/* Match Type Description */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 leading-relaxed">
              {deal.matchType === 'full' ? (
                <>
                  <strong className="text-green-400">Full Match:</strong> This flight exactly matches
                  the route, dates, and cabin class you specified. You can book this directly through
                  {' '}{deal.airline}'s loyalty program.
                </>
              ) : (
                <>
                  <strong className="text-yellow-400">Partial Match:</strong> This option has some
                  differences from your search criteria (e.g., different routing, cabin class, or timing).
                  Review the details carefully before booking through {deal.airline}'s loyalty program.
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default MileageDealModal;

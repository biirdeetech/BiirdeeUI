import React from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { MileageCalculationResult } from '../utils/mileageCalculator';

interface MileageCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculation: MileageCalculationResult;
  perCentValue: number;
}

const MileageCalculationModal: React.FC<MileageCalculationModalProps> = ({
  isOpen,
  onClose,
  calculation,
  perCentValue
}) => {
  if (!isOpen) return null;

  const strategyLabels = {
    'nonstop': 'Nonstop Direct Flights',
    'full-segment': 'Full Route Coverage (with stops)',
    'pieced': 'Connected Segments',
    'none': 'No Coverage'
  };

  const strategyDescriptions = {
    'nonstop': 'Best option: Direct nonstop flights found for entire journey',
    'full-segment': 'Good option: Flights covering full route with layovers',
    'pieced': 'Viable option: Multiple segments connected to form complete route',
    'none': 'No mileage options available'
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Mileage Calculation Breakdown</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Strategy Badge */}
          <div className="mb-6">
            <div className="flex items-start gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className={`p-2 rounded-full ${
                calculation.strategy === 'nonstop' ? 'bg-green-500/20' :
                calculation.strategy === 'full-segment' ? 'bg-blue-500/20' :
                'bg-yellow-500/20'
              }`}>
                {calculation.strategy === 'nonstop' ? (
                  <Check className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className={`h-5 w-5 ${
                    calculation.strategy === 'full-segment' ? 'text-blue-400' : 'text-yellow-400'
                  }`} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">
                  {strategyLabels[calculation.strategy]}
                </h3>
                <p className="text-sm text-gray-400">
                  {strategyDescriptions[calculation.strategy]}
                </p>
              </div>
            </div>
          </div>

          {/* Segments */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Flight Segments</h3>
            <div className="space-y-2">
              {calculation.segments.map((segment, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-white">
                        {segment.origin} → {segment.destination}
                      </span>
                      {segment.isNonstop && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                          Nonstop
                        </span>
                      )}
                    </div>
                    {segment.flightNumber && (
                      <span className="text-xs text-gray-400">
                        {segment.carrier} {segment.flightNumber}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Miles:</span>
                      <span className="ml-2 font-semibold text-white">
                        {segment.mileage.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Taxes:</span>
                      <span className="ml-2 font-semibold text-white">
                        ${segment.price.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Cabin:</span>
                      <span className="ml-2 font-semibold text-white">
                        {segment.cabin}
                      </span>
                    </div>
                  </div>

                  {segment.exactMatch && (
                    <div className="mt-2 text-xs text-green-400">
                      ✓ Exact match with cash flight
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Calculation */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-lg p-6 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Total Calculation</h3>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Miles</span>
                <span className="font-semibold text-white">
                  {calculation.totalMileage.toLocaleString()} miles
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Miles Value</span>
                <span className="text-sm text-gray-500">
                  {calculation.totalMileage.toLocaleString()} × ${perCentValue.toFixed(3)}
                </span>
                <span className="font-semibold text-white">
                  ${(calculation.totalMileage * perCentValue).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Taxes & Fees</span>
                <span className="font-semibold text-white">
                  ${calculation.totalPrice.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-gray-600 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-white">Total Cash Equivalent</span>
                  <span className="text-2xl font-bold text-green-400">
                    ${calculation.totalValue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 mt-4 p-3 bg-gray-900/50 rounded border border-gray-700">
              <strong>Note:</strong> Mileage value calculated at ${perCentValue.toFixed(3)} per mile.
              Actual value may vary based on program and redemption. Taxes and fees are estimated
              and may change at booking.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-850 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MileageCalculationModal;

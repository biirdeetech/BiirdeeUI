import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Code, Copy, Check } from 'lucide-react';

interface V2EnrichmentViewerProps {
  enrichmentData: Map<string, any[]>;
  carrierCode?: string;
  onClose?: () => void;
}

const V2EnrichmentViewer: React.FC<V2EnrichmentViewerProps> = ({ 
  enrichmentData, 
  carrierCode,
  onClose 
}) => {
  const [expandedCarriers, setExpandedCarriers] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleCarrier = (carrier: string) => {
    setExpandedCarriers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(carrier)) {
        newSet.delete(carrier);
      } else {
        newSet.add(carrier);
      }
      return newSet;
    });
  };

  // Filter by carrier if specified
  const carriersToShow = carrierCode 
    ? (enrichmentData.has(carrierCode) ? [carrierCode] : [])
    : Array.from(enrichmentData.keys());

  if (enrichmentData.size === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Code className="h-5 w-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">
              V2 Enrichment Data {carrierCode && `- ${carrierCode}`}
            </h2>
            <span className="text-sm text-gray-400">
              ({enrichmentData.size} carrier{enrichmentData.size !== 1 ? 's' : ''})
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {carriersToShow.map((carrier) => {
            const data = enrichmentData.get(carrier);
            if (!data || data.length === 0) return null;

            const isExpanded = expandedCarriers.has(carrier);
            const jsonString = JSON.stringify(data, null, 2);

            return (
              <div key={carrier} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {/* Carrier Header */}
                <button
                  onClick={() => toggleCarrier(carrier)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <span className="text-purple-400 font-bold">{carrier}</span>
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">{carrier}</div>
                      <div className="text-xs text-gray-400">
                        {data.length} solution{data.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(jsonString, carrier);
                      }}
                      className="p-2 hover:bg-gray-700 rounded transition-colors"
                      title="Copy JSON"
                    >
                      {copied === carrier ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* JSON Content */}
                {isExpanded && (
                  <div className="border-t border-gray-700 p-4 bg-gray-950">
                    <pre className="text-xs text-gray-300 overflow-x-auto font-mono">
                      <code>{jsonString}</code>
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>
              Total: {Array.from(enrichmentData.values()).reduce((sum, arr) => sum + arr.length, 0)} solutions
            </div>
            <div className="text-xs">
              Use this data to build UI components
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default V2EnrichmentViewer;


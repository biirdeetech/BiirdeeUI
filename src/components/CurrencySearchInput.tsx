import React, { useState, useEffect, useRef } from 'react';
import { Search, DollarSign } from 'lucide-react';
import { Currency, searchCurrencies } from '../utils/currencies';

interface CurrencySearchInputProps {
  value: Currency | null;
  onChange: (currency: Currency) => void;
  placeholder?: string;
  label?: string;
}

const CurrencySearchInput: React.FC<CurrencySearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search currency...',
  label
}) => {
  const [inputValue, setInputValue] = useState(value?.displayName || '');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCurrencies, setFilteredCurrencies] = useState<Currency[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value?.displayName || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const results = searchCurrencies(newValue);
    setFilteredCurrencies(results);
    setIsOpen(true);
  };

  const handleSelectCurrency = (currency: Currency) => {
    setInputValue(currency.displayName);
    onChange(currency);
    setIsOpen(false);
  };

  const handleFocus = () => {
    const results = searchCurrencies(inputValue);
    setFilteredCurrencies(results);
    setIsOpen(true);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full px-3 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
        />
        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      </div>

      {isOpen && filteredCurrencies.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {filteredCurrencies.map((currency) => (
            <button
              key={currency.code}
              onClick={() => handleSelectCurrency(currency)}
              className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors flex items-center justify-between border-b border-gray-700 last:border-b-0"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-white">
                  {currency.displayName}
                </div>
              </div>
              <div className="text-xs font-mono bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                {currency.code}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CurrencySearchInput;

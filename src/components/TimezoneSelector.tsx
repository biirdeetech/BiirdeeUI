import React, { useMemo } from 'react';
import { Globe } from 'lucide-react';

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
}

const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({ value, onChange }) => {
  const timezones = useMemo(() => {
    return [
      { value: 'Pacific/Midway', label: '(UTC-11:00) Midway Island, American Samoa' },
      { value: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii' },
      { value: 'America/Anchorage', label: '(UTC-09:00) Alaska' },
      { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time (US & Canada)' },
      { value: 'America/Phoenix', label: '(UTC-07:00) Arizona' },
      { value: 'America/Denver', label: '(UTC-07:00) Mountain Time (US & Canada)' },
      { value: 'America/Chicago', label: '(UTC-06:00) Central Time (US & Canada)' },
      { value: 'America/New_York', label: '(UTC-05:00) Eastern Time (US & Canada)' },
      { value: 'America/Caracas', label: '(UTC-04:00) Caracas, La Paz' },
      { value: 'America/Halifax', label: '(UTC-04:00) Atlantic Time (Canada)' },
      { value: 'America/St_Johns', label: '(UTC-03:30) Newfoundland' },
      { value: 'America/Sao_Paulo', label: '(UTC-03:00) Brasilia, Buenos Aires' },
      { value: 'Atlantic/Azores', label: '(UTC-01:00) Azores' },
      { value: 'UTC', label: '(UTC+00:00) Universal Coordinated Time' },
      { value: 'Europe/London', label: '(UTC+00:00) London, Dublin, Edinburgh' },
      { value: 'Europe/Paris', label: '(UTC+01:00) Paris, Amsterdam, Berlin' },
      { value: 'Europe/Athens', label: '(UTC+02:00) Athens, Istanbul, Cairo' },
      { value: 'Europe/Moscow', label: '(UTC+03:00) Moscow, St. Petersburg' },
      { value: 'Asia/Dubai', label: '(UTC+04:00) Abu Dhabi, Dubai, Muscat' },
      { value: 'Asia/Karachi', label: '(UTC+05:00) Islamabad, Karachi' },
      { value: 'Asia/Kolkata', label: '(UTC+05:30) Mumbai, Kolkata, New Delhi' },
      { value: 'Asia/Dhaka', label: '(UTC+06:00) Dhaka, Almaty' },
      { value: 'Asia/Bangkok', label: '(UTC+07:00) Bangkok, Hanoi, Jakarta' },
      { value: 'Asia/Shanghai', label: '(UTC+08:00) Beijing, Hong Kong, Singapore' },
      { value: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo, Seoul, Osaka' },
      { value: 'Australia/Sydney', label: '(UTC+10:00) Sydney, Melbourne' },
      { value: 'Pacific/Auckland', label: '(UTC+12:00) Auckland, Wellington' },
      { value: 'Pacific/Tongatapu', label: '(UTC+13:00) Nuku\'alofa' },
    ];
  }, []);

  const userTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }, []);

  const displayValue = value || userTimezone;
  const selectedTimezone = timezones.find(tz => tz.value === displayValue);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
        <Globe className="h-4 w-4" />
        Display Timezone
      </label>
      <select
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value={userTimezone}>
          {selectedTimezone ? selectedTimezone.label : `Browser Default (${userTimezone})`}
        </option>
        <option disabled>──────────────</option>
        {timezones.map(tz => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500">
        All flight times will be shown in this timezone
      </p>
    </div>
  );
};

export default TimezoneSelector;

export const getDefaultBookingClasses = (cabin: string): string[] => {
  switch (cabin) {
    case 'FIRST':
      return ['F', 'A', 'P'];
    case 'BUSINESS':
      return ['C', 'J', 'D', 'I', 'Z'];
    case 'PREMIUM-COACH':
    case 'PREMIUM_COACH':
      return ['W', 'R', 'G', 'P'];
    case 'COACH':
      return ['Y', 'B', 'H', 'K', 'M', 'L', 'G', 'V', 'S', 'N', 'Q', 'O', 'T', 'E', 'X'];
    default:
      return [];
  }
};

export const bookingClassesToExt = (classes: string[]): string => {
  if (classes.length === 0) return '';
  return 'f ' + classes.map(c => `bc=${c.toLowerCase()}`).join('|');
};

export const extToBookingClasses = (ext: string): string[] => {
  if (!ext) return [];
  const matches = ext.match(/bc=([a-z])/gi);
  if (!matches) return [];
  return matches.map(m => m.replace(/bc=/i, '').toUpperCase());
};

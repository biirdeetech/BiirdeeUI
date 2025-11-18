export const getDefaultBookingClasses = (cabin: string): string[] => {
  switch (cabin) {
    case 'FIRST':
      return ['F', 'A', 'P'];
    case 'BUSINESS':
      return ['C', 'J', 'D', 'I', 'Z'];
    case 'PREMIUM-COACH':
    case 'PREMIUM_COACH':
      return ['W', 'R', 'G', 'P', 'T', 'S'];
    case 'COACH':
      return [
         'Y','B','M','H','K','L','Q','V','S','N','T','R','O','E','X','U','G','Z'
        ];
    default:
      return [];
  }
};

export const bookingClassesToExt = (classes: string[]): string => {
  if (!classes || classes.length === 0) return '';

  // Deduplicate + sort-like grouping for predictable output
  const unique = Array.from(new Set(classes.map(c => c.toUpperCase())));

  // ITA wants lowercase inside the brackets
  const bracket = unique.map(c => c.toLowerCase()).join('');

  return `f bc=C:~[${bracket}]`;
};

export const extToBookingClasses = (ext: string): string[] => {
  if (!ext) return [];

  // CASE 1 — New syntax: bc=C:~[abc]
  const newSyntaxMatch = ext.match(/bc=C:~\[([a-z]+)\]/i);
  if (newSyntaxMatch) {
    const letters = newSyntaxMatch[1].split('');
    return letters.map(l => l.toUpperCase());
  }

  // CASE 2 — Legacy syntax: bc=y|bc=h etc
  const legacyMatches = ext.match(/bc=([a-z])/gi);
  if (legacyMatches) {
    return legacyMatches.map(m => m.replace(/bc=/i, '').toUpperCase());
  }

  return [];
};

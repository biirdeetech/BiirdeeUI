/**
 * Smart Cabin Grouping Strategy
 *
 * Groups flights by identical flight characteristics, showing different cabins as options.
 *
 * Rules:
 * 1. Group by: airline + route + departure time + flight numbers + segments
 * 2. One flight can have max 4 unique cabin entries (Economy, Premium, Business, First)
 * 3. If more than 4 entries exist for same route/time, they become "price options" or "time options"
 * 4. Each cabin can only appear once per flight group
 */

import { FlightSolution, GroupedFlight } from '../types/flight';

export interface CabinOption {
  cabin: string;
  cabinDisplay: string;
  price: number;
  currency: string;
  flight: FlightSolution;
  priceOptions?: FlightSolution[]; // Multiple prices for same cabin
}

export interface GroupedFlightByCabin {
  // Flight identity
  flightNumbers: string[];
  airline: string;
  airlineCode: string;
  departure: string; // ISO timestamp normalized to minute
  arrival: string;
  route: string; // e.g., "SFO-HND" or "SFO-SEA-HND"
  stops: number;
  duration: string;

  // Cabin options (max 4: Economy, Premium, Business, First)
  cabinOptions: Map<string, CabinOption>;

  // Metadata
  primaryFlight: FlightSolution; // Cheapest or first available
  allFlights: FlightSolution[]; // All flights in this group

  // Code-share metadata
  isParentCodeShare?: boolean; // True if this is a parent code-share
  isChildCodeShare?: boolean; // True if this is a child code-share partner
  codeSharePartners?: GroupedFlightByCabin[]; // Other code-share partners
}

/**
 * Normalize departure time to minute precision (removes seconds/milliseconds)
 */
function normalizeDepartureToMinute(departure: string): string {
  if (!departure) return '';
  return departure.substring(0, 16); // YYYY-MM-DDTHH:MM
}

/**
 * Get flight numbers from flight solution
 */
function getFlightNumbers(flight: FlightSolution): string[] {
  if (!flight.slices || flight.slices.length === 0) return [];
  return flight.slices.flatMap(slice => slice.flights || []);
}

/**
 * Get airline code from flight
 */
function getAirlineCode(flight: FlightSolution): string {
  if (!flight.slices || flight.slices.length === 0) return '';
  const firstFlight = flight.slices[0].flights?.[0] || '';
  const match = firstFlight.match(/^([A-Z]+)/);
  return match ? match[1] : '';
}

/**
 * Get route signature (e.g., "SFO-HND" or "SFO-SEA-HND" for connections)
 */
function getRouteSignature(flight: FlightSolution): string {
  if (!flight.slices || flight.slices.length === 0) return '';

  const origins = flight.slices.map(slice => slice.origin?.code || '');
  const destination = flight.slices[flight.slices.length - 1].destination?.code || '';

  return [...origins, destination].join('-');
}

/**
 * Get cabin display name
 */
function getCabinDisplay(cabin: string): string {
  const cabinMap: Record<string, string> = {
    'COACH': 'Economy',
    'PREMIUM-COACH': 'Premium Economy',
    'BUSINESS': 'Business',
    'FIRST': 'First'
  };
  return cabinMap[cabin] || cabin;
}

/**
 * Normalize cabin code to standard format
 */
function normalizeCabinCode(cabin: string): string {
  const normalized: Record<string, string> = {
    'COACH': 'COACH',
    'ECONOMY': 'COACH',
    'PREMIUM-COACH': 'PREMIUM-COACH',
    'PREMIUM_ECONOMY': 'PREMIUM-COACH',
    'PREMIUM': 'PREMIUM-COACH',
    'BUSINESS': 'BUSINESS',
    'FIRST': 'FIRST'
  };
  return normalized[cabin.toUpperCase()] || cabin;
}

/**
 * Create unique flight fingerprint for grouping
 * Groups by: airline + route + departure time + flight numbers
 */
function createFlightFingerprint(flight: FlightSolution): string {
  const airlineCode = getAirlineCode(flight);
  const route = getRouteSignature(flight);
  const departure = normalizeDepartureToMinute(flight.slices[0]?.departure || '');
  const flightNumbers = getFlightNumbers(flight).join(',');

  return `${airlineCode}|${route}|${departure}|${flightNumbers}`;
}

/**
 * Get primary cabin from flight
 */
function getPrimaryCabin(flight: FlightSolution): string {
  if (!flight.slices || flight.slices.length === 0) return 'COACH';
  const cabin = flight.slices[0].cabins?.[0] || 'COACH';
  return normalizeCabinCode(cabin);
}

/**
 * Group flights by cabin - Smart grouping that shows different cabins as options
 */
export function groupFlightsByCabin(flights: FlightSolution[]): GroupedFlightByCabin[] {
  console.log(`🔄 CabinGrouping: Starting with ${flights.length} flights`);

  // Step 1: Group by flight fingerprint
  const fingerprintMap = new Map<string, FlightSolution[]>();

  flights.forEach(flight => {
    const fingerprint = createFlightFingerprint(flight);

    if (!fingerprintMap.has(fingerprint)) {
      fingerprintMap.set(fingerprint, []);
    }

    fingerprintMap.get(fingerprint)!.push(flight);
  });

  console.log(`📦 CabinGrouping: Grouped into ${fingerprintMap.size} unique flights`);

  // Step 2: For each flight group, organize by cabin
  const groupedFlights: GroupedFlightByCabin[] = [];

  fingerprintMap.forEach((flightList, fingerprint) => {
    // Get flight identity from first flight
    const firstFlight = flightList[0];
    const airlineCode = getAirlineCode(firstFlight);
    const route = getRouteSignature(firstFlight);
    const departure = normalizeDepartureToMinute(firstFlight.slices[0]?.departure || '');
    const arrival = firstFlight.slices[firstFlight.slices.length - 1]?.arrival || '';
    const flightNumbers = getFlightNumbers(firstFlight);
    const stops = Math.max(...firstFlight.slices.map(s => s.stops?.length || 0));
    const duration = firstFlight.slices.reduce((total, slice) => {
      const d = slice.duration || '';
      return total + d;
    }, '');

    // Get airline name (fallback to code if not available)
    const airline = firstFlight.slices[0]?.airline || airlineCode;

    // Group by cabin
    const cabinMap = new Map<string, FlightSolution[]>();

    flightList.forEach(flight => {
      const cabin = getPrimaryCabin(flight);

      if (!cabinMap.has(cabin)) {
        cabinMap.set(cabin, []);
      }

      cabinMap.get(cabin)!.push(flight);
    });

    // Create cabin options
    const cabinOptions = new Map<string, CabinOption>();

    cabinMap.forEach((cabinFlights, cabin) => {
      // Sort by price (cheapest first)
      cabinFlights.sort((a, b) => (a.displayTotal || 0) - (b.displayTotal || 0));

      const primaryFlight = cabinFlights[0];
      const priceOptions = cabinFlights.slice(1); // Additional price options for same cabin

      cabinOptions.set(cabin, {
        cabin,
        cabinDisplay: getCabinDisplay(cabin),
        price: primaryFlight.displayTotal || 0,
        currency: primaryFlight.currency || 'USD',
        flight: primaryFlight,
        priceOptions: priceOptions.length > 0 ? priceOptions : undefined
      });
    });

    // Find cheapest flight overall as primary
    const allFlights = flightList;
    allFlights.sort((a, b) => (a.displayTotal || 0) - (b.displayTotal || 0));
    const primaryFlight = allFlights[0];

    groupedFlights.push({
      flightNumbers,
      airline,
      airlineCode,
      departure,
      arrival,
      route,
      stops,
      duration,
      cabinOptions,
      primaryFlight,
      allFlights
    });

    // Log grouping details
    console.log(`✅ ${airlineCode} ${flightNumbers.join(',')} @ ${departure.split('T')[1]}`);
    console.log(`   Route: ${route}, Cabins: ${Array.from(cabinOptions.keys()).join(', ')}`);
    cabinOptions.forEach((option, cabin) => {
      const priceOpts = option.priceOptions?.length || 0;
      console.log(`   - ${cabin}: $${option.price}${priceOpts > 0 ? ` (+${priceOpts} price options)` : ''}`);
    });
  });

  console.log(`✅ CabinGrouping: Final ${groupedFlights.length} grouped flights`);

  return groupedFlights;
}

/**
 * Get all standard cabin codes in order
 */
export function getStandardCabins(): string[] {
  return ['COACH', 'PREMIUM-COACH', 'BUSINESS', 'FIRST'];
}

/**
 * Extract flight number digits from a flight string
 * Examples: "AA123" -> 123, "AA1234" -> 1234
 */
function extractFlightNumberDigits(flightStr: string): number {
  const match = flightStr.match(/(\d+)$/);
  return match ? match[1].length : 0;
}

/**
 * Create code-share fingerprint (route + time, ignoring airline)
 * Used to detect flights that are code-shares of each other
 */
function createCodeShareFingerprint(flight: FlightSolution): string {
  const route = getRouteSignature(flight);
  const departure = normalizeDepartureToMinute(flight.slices[0]?.departure || '');
  const arrival = normalizeDepartureToMinute(flight.slices[flight.slices.length - 1]?.arrival || '');

  // Include segment details to ensure same physical flight
  const segmentDetails = flight.slices.flatMap(slice =>
    slice.segments?.map(seg => `${seg.origin?.code}-${seg.destination?.code}`) || []
  ).join('|');

  return `${route}|${departure}|${arrival}|${segmentDetails}`;
}

/**
 * Detect code-share relationships and mark parent/child
 */
export function detectCodeShares(groupedFlights: GroupedFlightByCabin[]): GroupedFlightByCabin[] {
  console.log(`🔗 CodeShare: Detecting code-shares among ${groupedFlights.length} flights`);

  // Group by code-share fingerprint
  const codeShareMap = new Map<string, GroupedFlightByCabin[]>();

  groupedFlights.forEach(flight => {
    const fingerprint = createCodeShareFingerprint(flight.primaryFlight);

    if (!codeShareMap.has(fingerprint)) {
      codeShareMap.set(fingerprint, []);
    }

    codeShareMap.get(fingerprint)!.push(flight);
  });

  // Process code-share groups
  const result: GroupedFlightByCabin[] = [];
  let codeShareCount = 0;

  codeShareMap.forEach((flights, fingerprint) => {
    if (flights.length <= 1) {
      // No code-shares, add as-is
      result.push(flights[0]);
      return;
    }

    // Multiple flights = code-share relationship
    codeShareCount += flights.length;
    console.log(`✈️  Code-share group: ${flights.map(f => f.airlineCode).join(', ')}`);

    // Determine parent vs children
    // Parent = flight with fewer digits in flight number (3-digit vs 4-digit)
    // If same digits, use alphabetically first airline code
    flights.sort((a, b) => {
      const aDigits = extractFlightNumberDigits(a.flightNumbers[0] || '');
      const bDigits = extractFlightNumberDigits(b.flightNumbers[0] || '');

      if (aDigits !== bDigits) {
        return aDigits - bDigits; // Fewer digits first (parent)
      }

      // Same digits, sort by airline code
      return a.airlineCode.localeCompare(b.airlineCode);
    });

    const parent = flights[0];
    const children = flights.slice(1);

    // Mark parent
    parent.isParentCodeShare = true;
    parent.codeSharePartners = children;

    // Mark children
    children.forEach(child => {
      child.isChildCodeShare = true;
      child.codeSharePartners = [parent, ...children.filter(c => c !== child)];
    });

    console.log(`   Parent: ${parent.airlineCode} ${parent.flightNumbers.join(',')}`);
    console.log(`   Partners: ${children.map(c => `${c.airlineCode} ${c.flightNumbers.join(',')}`).join(', ')}`);

    // Add all to result (parent and children)
    result.push(parent, ...children);
  });

  console.log(`✅ CodeShare: Found ${codeShareCount} code-share flights`);

  return result;
}

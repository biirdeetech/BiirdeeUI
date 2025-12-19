/**
 * Flight signature utilities for matching and merging flights from different cabin searches
 */

export interface CabinPrice {
  cabin: string;
  price: number;
  currency: string;
  bookingClasses?: string[];
}

export interface FlightWithCabins {
  baseFlightId: string;
  cabinPrices: Record<string, CabinPrice>;
  [key: string]: any;
}

/**
 * Generate a unique signature for a flight based on route and schedule
 * This signature is used to identify the same physical flight across different cabin searches
 */
export function generateFlightSignature(flight: any): string {
  // Extract slices (most common structure from API)
  const slices = flight.slices || flight.itinerary?.slices || [];

  if (slices.length === 0) {
    console.warn('⚠️ generateFlightSignature: No slices found in flight:', flight.id);
    return `unknown-${flight.id || Math.random()}`;
  }

  // Create signature from ALL slices (for multi-leg trips)
  const routeParts: string[] = [];

  slices.forEach((slice: any) => {
    // Add origin
    const origin = slice.origin?.code || slice.origin || '';
    routeParts.push(origin);

    // Add flight numbers (e.g., ["AS211"] or multiple for connections)
    const flights = slice.flights || [];
    flights.forEach((flightNum: string) => {
      routeParts.push(flightNum);
    });

    // Add departure time (HH:MM)
    const departureTime = slice.departure || '';
    const timeOnly = departureTime.split('T')[1]?.substring(0, 5) || departureTime.substring(0, 5);
    routeParts.push(timeOnly);

    // Add destination
    const destination = slice.destination?.code || slice.destination || '';
    routeParts.push(destination);
  });

  const signature = routeParts.join('-');
  return signature;
}

/**
 * Merge flights from multiple cabin searches by flight signature
 * Returns a map of unique flights with cabin price data
 */
export function mergeFlightsByCabin(
  flightsByCabin: Record<string, any[]>
): Map<string, FlightWithCabins> {
  const mergedFlights = new Map<string, FlightWithCabins>();

  console.log(`🔀 mergeFlightsByCabin: Starting merge with cabins:`, Object.keys(flightsByCabin));

  Object.entries(flightsByCabin).forEach(([cabin, flights]) => {
    console.log(`🔀 mergeFlightsByCabin: Processing ${cabin} with ${flights.length} flights`);

    flights.forEach((flight, idx) => {
      const signature = generateFlightSignature(flight);

      // Log first few signatures for debugging
      if (idx < 3) {
        console.log(`🔀 mergeFlightsByCabin: ${cabin} flight ${idx} signature:`, signature);
      }

      const cabinPrice: CabinPrice = {
        cabin,
        price: flight.totalAmount || flight.displayTotal || 0,
        currency: flight.currency || 'USD',
        bookingClasses: flight.bookingClasses || []
      };

      if (mergedFlights.has(signature)) {
        // Add cabin price to existing flight
        const existing = mergedFlights.get(signature)!;
        existing.cabinPrices[cabin] = cabinPrice;
      } else {
        // Create new merged flight entry
        const mergedFlight: FlightWithCabins = {
          ...flight,
          baseFlightId: signature,
          cabinPrices: { [cabin]: cabinPrice }
        };
        mergedFlights.set(signature, mergedFlight);
      }
    });

    console.log(`🔀 mergeFlightsByCabin: After processing ${cabin}, total unique flights:`, mergedFlights.size);
  });

  console.log(`🔀 mergeFlightsByCabin: Final merge complete, returning ${mergedFlights.size} unique flights`);
  return mergedFlights;
}

/**
 * Get the best (lowest) price across all cabins for a flight
 */
export function getBestPrice(flight: FlightWithCabins): CabinPrice | null {
  if (!flight.cabinPrices || Object.keys(flight.cabinPrices).length === 0) return null;

  let bestPrice: CabinPrice | null = null;

  Object.values(flight.cabinPrices).forEach(cabinPrice => {
    if (!bestPrice || cabinPrice.price < bestPrice.price) {
      bestPrice = cabinPrice;
    }
  });

  return bestPrice;
}

/**
 * Get cabin-specific price for a flight
 */
export function getCabinPrice(flight: FlightWithCabins, cabin: string): CabinPrice | null {
  return flight.cabinPrices?.[cabin] || null;
}

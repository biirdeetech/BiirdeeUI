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
  // Extract segments
  const segments = flight.segments || flight.slices?.[0]?.segments || [];

  if (segments.length === 0) {
    return `unknown-${flight.id || Math.random()}`;
  }

  // Create signature from:
  // 1. Route (origin -> destination through all segments)
  // 2. Flight numbers
  // 3. Departure times
  const routeParts: string[] = [];

  segments.forEach((seg: any, idx: number) => {
    // Origin airport
    if (idx === 0) {
      routeParts.push(seg.origin || seg.originCode || '');
    }

    // Flight number (carrier + number)
    const flightNumber = seg.flightNumber || seg.flight?.number || '';
    const carrier = seg.carrier || seg.carrierCode || seg.operatingCarrier || '';
    routeParts.push(`${carrier}${flightNumber}`);

    // Departure time (HH:MM)
    const departureTime = seg.departureTime || seg.departure?.time || '';
    const timeOnly = departureTime.split('T')[1]?.substring(0, 5) || departureTime;
    routeParts.push(timeOnly);

    // Destination airport
    routeParts.push(seg.destination || seg.destinationCode || '');
  });

  return routeParts.join('-');
}

/**
 * Merge flights from multiple cabin searches by flight signature
 * Returns a map of unique flights with cabin price data
 */
export function mergeFlightsByCabin(
  flightsByCabin: Record<string, any[]>
): Map<string, FlightWithCabins> {
  const mergedFlights = new Map<string, FlightWithCabins>();

  Object.entries(flightsByCabin).forEach(([cabin, flights]) => {
    flights.forEach(flight => {
      const signature = generateFlightSignature(flight);

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
  });

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

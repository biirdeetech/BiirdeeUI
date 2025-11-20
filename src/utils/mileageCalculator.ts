/**
 * Utility functions for intelligent mileage calculation and segment selection
 */

export interface MileageSegment {
  origin: string;
  destination: string;
  mileage: number;
  price: number;
  cabin: string;
  flightNumber?: string;
  carrier?: string;
  matchType?: string;
  exactMatch?: boolean;
  isNonstop?: boolean;
  segments?: any[]; // For multi-segment routes
}

export interface MileageCalculationResult {
  totalMileage: number;
  totalPrice: number;
  totalValue: number;
  segments: MileageSegment[];
  strategy: 'nonstop' | 'full-segment' | 'pieced' | 'none';
  cabin: string;
}

/**
 * Find the best mileage option for a single slice
 * Priority: 1. Nonstop 2. Full segment 3. Pieced segments
 */
export const findBestMileageForSlice = (
  slice: any,
  perCentValue: number = 0.015
): MileageCalculationResult | null => {
  if (!slice.mileageBreakdown || !Array.isArray(slice.mileageBreakdown)) {
    return null;
  }

  const origin = slice.origin.code;
  const destination = slice.destination.code;

  // Collect all available mileage flights from all breakdowns
  const allFlights: any[] = [];
  slice.mileageBreakdown.forEach((breakdown: any) => {
    if (breakdown.allMatchingFlights && Array.isArray(breakdown.allMatchingFlights)) {
      allFlights.push(...breakdown.allMatchingFlights.map((f: any) => ({
        ...f,
        breakdown: breakdown
      })));
    }
  });

  if (allFlights.length === 0) {
    return null;
  }

  // Parse price helper
  const parsePrice = (priceStr: any): number => {
    if (typeof priceStr === 'number') return priceStr;
    if (typeof priceStr === 'string') {
      const cleaned = priceStr.replace(/[A-Z]+\s*/g, '').trim();
      let price = parseFloat(cleaned) || 0;
      // Simple currency conversion (AUD to USD approximation)
      if (priceStr.includes('AUD')) {
        price = price * 0.65;
      }
      return price;
    }
    return 0;
  };

  // Calculate value helper
  const calculateValue = (mileage: number, price: number): number => {
    return (mileage * perCentValue) + price;
  };

  // Strategy 1: Find nonstop flights (direct from origin to destination)
  const nonstopFlights = allFlights.filter((f: any) => {
    const fOrigin = f.departure?.iataCode || f.breakdown?.origin;
    const fDestination = f.arrival?.iataCode || f.breakdown?.destination;
    const stops = f.numberOfStops || 0;
    return fOrigin === origin && fDestination === destination && stops === 0;
  });

  if (nonstopFlights.length > 0) {
    // Group by cabin and find best value per cabin
    const cabinGroups = new Map<string, any>();
    nonstopFlights.forEach((f: any) => {
      const cabin = f.cabin || 'UNKNOWN';
      const mileage = f.mileage || 0;
      const price = parsePrice(f.mileagePrice);
      const value = calculateValue(mileage, price);

      if (!cabinGroups.has(cabin) || value < cabinGroups.get(cabin).value) {
        cabinGroups.set(cabin, {
          flight: f,
          mileage,
          price,
          value,
          cabin
        });
      }
    });

    // Return the best overall value across all cabins
    const best = Array.from(cabinGroups.values()).reduce((min, curr) =>
      curr.value < min.value ? curr : min
    );

    return {
      totalMileage: best.mileage,
      totalPrice: best.price,
      totalValue: best.value,
      cabin: best.cabin,
      strategy: 'nonstop',
      segments: [{
        origin,
        destination,
        mileage: best.mileage,
        price: best.price,
        cabin: best.cabin,
        flightNumber: best.flight.flightNumber,
        carrier: best.flight.carrierCode || best.flight.operatingCarrier,
        matchType: best.flight.matchType,
        exactMatch: best.flight.exactMatch,
        isNonstop: true
      }]
    };
  }

  // Strategy 2: Find full segment flights (may have stops but cover full route)
  const fullSegmentFlights = allFlights.filter((f: any) => {
    const fOrigin = f.departure?.iataCode || f.breakdown?.origin;
    const fDestination = f.arrival?.iataCode || f.breakdown?.destination;
    return fOrigin === origin && fDestination === destination;
  });

  if (fullSegmentFlights.length > 0) {
    const cabinGroups = new Map<string, any>();
    fullSegmentFlights.forEach((f: any) => {
      const cabin = f.cabin || 'UNKNOWN';
      const mileage = f.mileage || 0;
      const price = parsePrice(f.mileagePrice);
      const value = calculateValue(mileage, price);

      if (!cabinGroups.has(cabin) || value < cabinGroups.get(cabin).value) {
        cabinGroups.set(cabin, {
          flight: f,
          mileage,
          price,
          value,
          cabin
        });
      }
    });

    const best = Array.from(cabinGroups.values()).reduce((min, curr) =>
      curr.value < min.value ? curr : min
    );

    return {
      totalMileage: best.mileage,
      totalPrice: best.price,
      totalValue: best.value,
      cabin: best.cabin,
      strategy: 'full-segment',
      segments: [{
        origin,
        destination,
        mileage: best.mileage,
        price: best.price,
        cabin: best.cabin,
        flightNumber: best.flight.flightNumber,
        carrier: best.flight.carrierCode || best.flight.operatingCarrier,
        matchType: best.flight.matchType,
        exactMatch: best.flight.exactMatch,
        isNonstop: false,
        segments: best.flight.segments
      }]
    };
  }

  // Strategy 3: Piece together segments to form complete route
  // This is more complex - we need to find connecting flights
  const segmentsByOrigin = new Map<string, any[]>();
  allFlights.forEach((f: any) => {
    const fOrigin = f.departure?.iataCode || f.breakdown?.origin;
    if (!segmentsByOrigin.has(fOrigin)) {
      segmentsByOrigin.set(fOrigin, []);
    }
    segmentsByOrigin.get(fOrigin)!.push(f);
  });

  // Try to find a path from origin to destination
  const findPath = (currentOrigin: string, targetDestination: string, visited: Set<string>): any[] | null => {
    if (currentOrigin === targetDestination) {
      return [];
    }

    if (visited.has(currentOrigin)) {
      return null; // Avoid cycles
    }

    visited.add(currentOrigin);
    const availableSegments = segmentsByOrigin.get(currentOrigin) || [];

    for (const segment of availableSegments) {
      const segmentDest = segment.arrival?.iataCode || segment.breakdown?.destination;

      if (segmentDest === targetDestination) {
        // Found direct connection
        return [segment];
      }

      // Try to continue path
      const restOfPath = findPath(segmentDest, targetDestination, new Set(visited));
      if (restOfPath !== null) {
        return [segment, ...restOfPath];
      }
    }

    return null;
  };

  const path = findPath(origin, destination, new Set());

  if (path && path.length > 0) {
    // Calculate total for this pieced route
    let totalMileage = 0;
    let totalPrice = 0;
    const segments: MileageSegment[] = [];
    const cabins = new Set<string>();

    path.forEach((f: any) => {
      const mileage = f.mileage || 0;
      const price = parsePrice(f.mileagePrice);
      totalMileage += mileage;
      totalPrice += price;
      cabins.add(f.cabin || 'UNKNOWN');

      segments.push({
        origin: f.departure?.iataCode || f.breakdown?.origin,
        destination: f.arrival?.iataCode || f.breakdown?.destination,
        mileage,
        price,
        cabin: f.cabin || 'UNKNOWN',
        flightNumber: f.flightNumber,
        carrier: f.carrierCode || f.operatingCarrier,
        matchType: f.matchType,
        exactMatch: f.exactMatch,
        isNonstop: false
      });
    });

    return {
      totalMileage,
      totalPrice,
      totalValue: calculateValue(totalMileage, totalPrice),
      cabin: Array.from(cabins).join('/'),
      strategy: 'pieced',
      segments
    };
  }

  return null;
};

/**
 * Calculate best mileage for multiple slices (e.g., round trip)
 */
export const calculateBestMileageForTrip = (
  slices: any[],
  perCentValue: number = 0.015
): MileageCalculationResult | null => {
  const sliceResults: MileageCalculationResult[] = [];

  for (const slice of slices) {
    const result = findBestMileageForSlice(slice, perCentValue);
    if (!result) {
      // If any slice has no mileage data, return null
      return null;
    }
    sliceResults.push(result);
  }

  if (sliceResults.length === 0) {
    return null;
  }

  // Aggregate results
  const totalMileage = sliceResults.reduce((sum, r) => sum + r.totalMileage, 0);
  const totalPrice = sliceResults.reduce((sum, r) => sum + r.totalPrice, 0);
  const allSegments = sliceResults.flatMap(r => r.segments);
  const cabins = [...new Set(sliceResults.map(r => r.cabin))].join('/');

  // Determine overall strategy (worst case)
  const strategyPriority = { 'nonstop': 0, 'full-segment': 1, 'pieced': 2, 'none': 3 };
  const worstStrategy = sliceResults.reduce((worst, curr) =>
    strategyPriority[curr.strategy] > strategyPriority[worst.strategy] ? curr : worst
  ).strategy;

  return {
    totalMileage,
    totalPrice,
    totalValue: (totalMileage * perCentValue) + totalPrice,
    segments: allSegments,
    strategy: worstStrategy,
    cabin: cabins
  };
};

// Flight search parameters
export interface FlightSearchParams {
  tripType: 'oneWay' | 'roundTrip' | 'multiCity';
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  cabin: 'COACH' | 'PREMIUM_COACH' | 'BUSINESS' | 'FIRST';
  passengers: number;
  maxStops?: number;
  extraStops?: number;
  flexibility?: number;
  // Multi-city specific fields
  slices?: FlightSliceParams[];
  // Pagination options
  pageSize?: number;
  pageNum?: number;
  // ITA Matrix options
  allowAirportChanges?: boolean;
  showOnlyAvailable?: boolean;
  // Aero options
  aero?: boolean;
  airlines?: string;
  strict_airline_match?: boolean;
  time_tolerance?: number;
  strict_leg_match?: boolean;
  summary?: boolean;
}

export interface FlightSliceParams {
  origins: string[];
  destinations: string[];
  departDate: string;
  cabin: 'COACH' | 'PREMIUM_COACH' | 'BUSINESS' | 'FIRST';
  flexibility?: number;
  via?: string;
  routing?: string;
  ext?: string;
  routingRet?: string;
  extRet?: string;
  returnFlexibility?: number;
  nonstop?: boolean;
}

// API response types
export interface SearchResponse {
  solutionList?: {
    solutions?: FlightSolution[];
  };
  session?: string;
  solutionSet?: string;
  solutionCount?: number;
  pagination?: {
    current: number;
    count: number;
  };
}

export interface MileageDeal {
  airline: string;
  airlineCode: string;
  mileage: number;
  mileagePrice: number;
  matchType: 'full' | 'partial';
  cabins: string[];
}

export interface FlightSolution {
  id: string;
  totalAmount: number;
  displayTotal: number;
  slices: FlightSlice[];
  ext: {
    pricePerMile: number;
  };
  totalMileage?: number;
  totalMileagePrice?: number;
  fullyEnriched?: boolean;
  matchType?: 'exact' | 'partial' | 'none';
  mileageDeals?: MileageDeal[];
}

export interface GroupedFlight {
  outboundSlice: FlightSlice;
  returnOptions: {
    returnSlice: FlightSlice;
    totalAmount: number;
    displayTotal: number;
    ext: {
      pricePerMile: number;
    };
    originalFlightId: string;
  }[];
  carrier: Carrier;
  isNonstop: boolean;
}

export interface FlightSlice {
  origin: Airport;
  destination: Airport;
  departure: string;
  arrival: string;
  duration: number;
  flights: string[];
  cabins: string[];
  stops?: Airport[];
  segments: FlightSegment[];
}

export interface FlightSegment {
  carrier: Carrier;
  marketingCarrier: string;
  pricings: Pricing[];
}

export interface Pricing {
  fareBasis: string;
  bookingClass: string;
}

export interface Airport {
  code: string;
  name: string;
}

export interface Carrier {
  code: string;
  name: string;
  shortName: string;
}
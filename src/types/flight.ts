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
  // Date controls
  departureDateType?: 'depart' | 'arrive';
  departureDateModifier?: '0' | '1' | '10' | '11' | '2' | '22'; // 0=exact, 1=+/-1, 10=+1, 11=-1, 2=+/-2, 22=-2
  departureDatePreferredTimes?: number[]; // 0=<8am, 1=8-11am, 2=11am-2pm, 3=2-5pm, 4=5-9pm, 5=>9pm
  returnDateType?: 'depart' | 'arrive';
  returnDateModifier?: '0' | '1' | '10' | '11' | '2' | '22';
  returnDatePreferredTimes?: number[];
  // Per-slice ITA Matrix options
  maxStops?: number;
  extraStops?: number;
  allowAirportChanges?: boolean;
  showOnlyAvailable?: boolean;
  // Per-slice Aero options
  aero?: boolean;
  fetchSummary?: boolean;
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

export interface MileageBreakdownFlight {
  flightNumber: string;
  carrierCode: string;
  operatingCarrier: string;
  departure: {
    iataCode: string;
    at: string;
    timezone: string | null;
  };
  arrival: {
    iataCode: string;
    at: string;
    timezone: string | null;
  };
  mileage: number;
  mileagePrice: number;
  matchType: string;
  exactMatch: boolean;
  carrierMatch: boolean;
  routeMatch: boolean;
}

export interface MileageBreakdown {
  flightNumber: string;
  carrier: string;
  origin: string;
  destination: string;
  date: string;
  mileage: number;
  mileagePrice: number;
  matched: boolean;
  exactMatch: boolean;
  carrierMatch: boolean;
  routeMatch: boolean;
  allMatchingFlights?: MileageBreakdownFlight[];
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
  mileage?: number;
  mileagePrice?: number;
  mileageBreakdown?: MileageBreakdown[];
  mileageEnriched?: boolean;
  matchType?: string;
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
import { FlightSearchParams, SearchResponse } from '../types/flight';
import { generateCommandLine } from '../utils/fareClasses';

// Store session information for booking details requests
interface SessionInfo {
  session: string;
  solutionSet: string;
}

export interface Location {
  displayName: string;
  type: string;
  code: string;
  cityCode: string;
  cityName: string;
  salesCityCode?: string;
  salesCityName?: string;
  latLng?: {
    latitude: number;
    longitude: number;
  };
  timezone?: string;
  distance?: {
    measurementValue?: number;
    unit?: string;
  };
}

export interface LocationSearchResult {
  locations: Location[];
}

class ITAMatrixService {
  private static instance: ITAMatrixService;
  private baseUrl = 'https://content-alkalimatrix-pa.googleapis.com/v1/search';
  private summaryUrl = 'https://content-alkalimatrix-pa.googleapis.com/v1/summarize';
  private locationBaseUrl = 'https://content-alkalimatrix-pa.googleapis.com';
  private apiKey = 'AIzaSyBH1mte6BdKzvf0c2mYprkyvfHCRWmfX7g';
  private sessionInfo: SessionInfo | null = null;

  static getInstance(): ITAMatrixService {
    if (!ITAMatrixService.instance) {
      ITAMatrixService.instance = new ITAMatrixService();
    }
    return ITAMatrixService.instance;
  }

  getSessionInfo(): SessionInfo | null {
    return this.sessionInfo;
  }

  private buildSearchRequest(params: FlightSearchParams): any {
    console.log('🔧 ITAMatrixService: Building search request for:', params);

    const slices: any[] = [];
    
    if (params.slices && params.slices.length > 0) {
      // Use individual slice data (works for all trip types)
      params.slices.forEach(slice => {
        let currentSliceRouteLanguage = '';
        
        // Add via airport to route language
        if (slice.via && slice.via.trim()) {
          currentSliceRouteLanguage += slice.via.trim();
        }
        
        // Add nonstop flag to route language
        if (slice.nonstop) {
          currentSliceRouteLanguage += currentSliceRouteLanguage ? ' N' : 'N';
        }

        slices.push({
          origins: slice.origins,
          destinations: slice.destinations,
          date: slice.departDate,
          isArrivalDate: false,
          ...(slice.flexibility && slice.flexibility > 0 && {
            dateModifier: {
              minus: slice.flexibility,
              plus: slice.flexibility
            }
          }),
          commandLine: generateCommandLine(slice.cabin, params.maxStops),
          ...(currentSliceRouteLanguage && { routeLanguage: currentSliceRouteLanguage }),
          filter: {
            warnings: {
              values: []
            }
          },
          selected: false
        });
      });
    } else {
      // Handle one-way and round-trip
      // Main outbound slice
      let outboundRouteLanguage = '';
      if (params.slices && params.slices[0]) {
        const firstSlice = params.slices[0];
        if (firstSlice.via && firstSlice.via.trim()) {
          outboundRouteLanguage += firstSlice.via.trim();
        }
        if (firstSlice.nonstop) {
          outboundRouteLanguage += outboundRouteLanguage ? ' N' : 'N';
        }
      }
      
      slices.push({
        origins: params.slices?.[0]?.origins || [params.origin],
        destinations: params.slices?.[0]?.destinations || [params.destination],
        date: params.departDate,
        isArrivalDate: false,
        ...(params.slices?.[0]?.flexibility && params.slices[0].flexibility > 0 && {
          dateModifier: {
            minus: params.slices[0].flexibility,
            plus: params.slices[0].flexibility
          }
        }),
        commandLine: generateCommandLine(params.cabin, params.maxStops),
        ...(outboundRouteLanguage && { routeLanguage: outboundRouteLanguage }),
        filter: {
          warnings: {
            values: []
          }
        },
        selected: false
      });

      // Add return slice for round trip
      if (params.tripType === 'roundTrip' && params.returnDate) {
        let returnRouteLanguage = '';
        if (params.slices && params.slices[1]) {
          const secondSlice = params.slices[1];
          if (secondSlice.via && secondSlice.via.trim()) {
            returnRouteLanguage = secondSlice.via.trim();
          }
          if (secondSlice.nonstop) {
            returnRouteLanguage = returnRouteLanguage ? returnRouteLanguage + ' N' : 'N';
          }
        }
        
        slices.push({
          origins: params.slices?.[1]?.origins || [params.destination],
          destinations: params.slices?.[1]?.destinations || [params.origin],
          date: params.returnDate,
          isArrivalDate: false,
          ...(params.slices?.[1]?.flexibility && params.slices[1].flexibility > 0 && {
            dateModifier: {
              minus: params.slices[1].flexibility,
              plus: params.slices[1].flexibility
            }
          }),
          commandLine: generateCommandLine(params.cabin, params.maxStops),
          ...(returnRouteLanguage && { routeLanguage: returnRouteLanguage }),
          filter: {
            warnings: {
              values: []
            }
          },
          selected: false
        });
      }
    }

    return {
      summarizers: ["solutionList"],
      inputs: {
        page: { current: 1, size: 500 },
        pax: { adults: params.passengers },
        slices: slices,
        firstDayOfWeek: "SUNDAY",
        internalUser: false,
        sliceIndex: 0,
        sorts: "default",
        checkAvailability: false,
        currency: "USD",
        salesCity: "NYC",
        cabin: "COACH",
        maxStopCount: params.maxStops || 2
      },
      summarizerSet: "wholeTrip",
      name: "specificDatesSlice",
      bgProgramResponse: "none"
    };
  }

  async searchFlights(params: FlightSearchParams): Promise<SearchResponse> {
    console.log('🛫 ITAMatrixService: Starting flight search with params:', params);

    try {
      const requestBody = this.buildSearchRequest(params);
      console.log('📡 ITAMatrixService: Request body:', JSON.stringify(requestBody, null, 2));

      const url = `${this.baseUrl}?key=${this.apiKey}&alt=json`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log('📥 ITAMatrixService: Raw response:', responseText);

      if (!response.ok) {
        console.error('❌ ITAMatrixService: API request failed:', response.status);
        console.error('❌ ITAMatrixService: Error details:', responseText);
        throw new Error(`API request failed: ${response.status} . ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('✅ ITAMatrixService: Parsed response:', data);

      // Store session information for later use
      if (data.session && data.solutionSet) {
        this.sessionInfo = {
          session: data.session,
          solutionSet: data.solutionSet
        };
        console.log('💾 ITAMatrixService: Stored session info:', this.sessionInfo);
      }

      return this.transformGoogleResponse(data);
    } catch (error) {
      console.error('❌ ITAMatrixService: API request failed:', error);
      throw error;
    }
  }

  private transformGoogleResponse(googleResponse: any): SearchResponse {
    console.log('🔄 ITAMatrixService: Transforming Google response');
    
    // Transform the actual Google response to match our expected structure
    if (!googleResponse || !googleResponse.solutionList) {
      console.log('⚠️ ITAMatrixService: No solutionList in response');
      return {
        solutionList: {
          solutions: []
        }
      };
    }

    const solutions = googleResponse.solutionList.solutions || [];
    console.log(`✅ ITAMatrixService: Transforming ${solutions.length} solutions`);

    // Helper to extract numeric value and currency from strings like "PKR651625" or "USD1234"
    const extractPrice = (priceStr: string | undefined): number => {
      if (!priceStr) return 0;
      // Remove any currency code (3 letter prefix) and parse the number
      const numericStr = priceStr.replace(/^[A-Z]{3}/, '');
      return parseFloat(numericStr) || 0;
    };

    const extractCurrency = (priceStr: string | undefined): string => {
      if (!priceStr) return 'USD';
      // Extract the first 3 uppercase letters as currency code
      const match = priceStr.match(/^[A-Z]{3}/);
      return match ? match[0] : 'USD';
    };

    // Transform each solution to match our FlightSolution interface
    const transformedSolutions = solutions.map((solution: any) => {
      const itinerary = solution.itinerary || {};
      const slices = itinerary.slices || [];

      return {
        id: solution.id,
        totalAmount: extractPrice(solution.ext?.price),
        displayTotal: extractPrice(solution.displayTotal),
        currency: extractCurrency(solution.displayTotal || solution.ext?.price),
        slices: slices.map((slice: any) => ({
          origin: slice.origin || { code: '', name: '' },
          destination: slice.destination || { code: '', name: '' },
          departure: slice.departure || '',
          arrival: slice.arrival || '',
          duration: slice.duration || 0,
          flights: slice.flights || [],
          cabins: slice.cabins || [],
          stops: slice.stops || null,
          segments: slice.segments?.map((seg: any) => ({
            carrier: seg.carrier || itinerary.singleCarrier || { code: '', name: '', shortName: '' },
            marketingCarrier: itinerary.singleCarrier?.code || '',
            pricings: seg.pricings || []
          })) || []
        })),
        ext: {
          pricePerMile: extractPrice(solution.ext?.pricePerMile)
        }
      };
    });

    return {
      solutionList: {
        solutions: transformedSolutions
      }
    };
  }

  async getFlightDetails(solutionId: string, session?: string, solutionSet?: string): Promise<any> {
    console.log('🔍 ITAMatrixService: Fetching flight details for solution:', solutionId);

    const sessionToUse = session || this.sessionInfo?.session;
    const solutionSetToUse = solutionSet || this.sessionInfo?.solutionSet;
    
    if (!sessionToUse || !solutionSetToUse) {
      throw new Error('No session information available. Please perform a search first.');
    }

    try {
      const requestBody = {
        summarizers: ["bookingDetails"],
        inputs: {
          solution: `${solutionSetToUse}/${solutionId}`
        },
        summarizerSet: "viewDetails",
        solutionSet: solutionSetToUse,
        session: sessionToUse
      };

      console.log('📡 ITAMatrixService: Booking details request:', JSON.stringify(requestBody, null, 2));

      const url = `${this.summaryUrl}?key=${this.apiKey}&alt=json`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log('📥 ITAMatrixService: Booking details raw response:', responseText);

      if (!response.ok) {
        console.error('❌ ITAMatrixService: Booking details request failed:', response.status);
        console.error('❌ ITAMatrixService: Error details:', responseText);
        throw new Error(`Booking details request failed: ${response.status}. ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('✅ ITAMatrixService: Booking details parsed response:', data);

      return data;
    } catch (error) {
      console.error('❌ ITAMatrixService: Booking details request failed:', error);
      throw error;
    }
  }

  async searchLocations(params: {
    locationType?: 'CITIES_AND_AIRPORTS' | 'SALES_CITIES';
    partialName?: string;
    locationCode?: string;
    pageSize?: number;
  }): Promise<LocationSearchResult> {
    const {
      locationType = 'CITIES_AND_AIRPORTS',
      partialName,
      locationCode,
      pageSize = 10
    } = params;

    let url: string;
    if (locationCode) {
      url = `${this.locationBaseUrl}/v1/locationTypes/airportOrMultiAirportCity/locationCodes/${locationCode}?key=${this.apiKey}`;
    } else if (partialName) {
      const encodedName = encodeURIComponent(partialName);
      url = `${this.locationBaseUrl}/v1/locationTypes/${locationType}/partialNames/${encodedName}/locations?pageSize=${pageSize}&key=${this.apiKey}`;
    } else {
      throw new Error('Either partialName or locationCode must be provided');
    }

    try {
      console.log('🔍 ITAMatrixService: Searching locations:', { locationType, partialName, locationCode });
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Location search failed: ${response.status}`);
      }

      const data = await response.json();

      // When searching by locationCode, the API returns a single object, not { locations: [...] }
      if (locationCode && !data.locations) {
        const result = { locations: [data] };
        console.log('✅ ITAMatrixService: Found location:', data.code);
        return result;
      }

      console.log('✅ ITAMatrixService: Found', data.locations?.length || 0, 'locations');
      return data;
    } catch (error) {
      console.error('❌ ITAMatrixService: Location search failed:', error);
      throw error;
    }
  }

  async geoSearch(params: {
    center: string;
    radiusMiles: number;
    pageSize?: number;
  }): Promise<LocationSearchResult> {
    const { center, radiusMiles } = params;

    try {
      console.log('📍 ITAMatrixService: Step 1 - Getting lat/long for:', center);

      // First, get the lat/long for the center airport
      const locationResult = await this.searchLocations({
        locationCode: center,
        locationType: 'CITIES_AND_AIRPORTS'
      });

      if (!locationResult.locations || locationResult.locations.length === 0) {
        throw new Error(`Could not find location data for ${center}`);
      }

      const location = locationResult.locations[0];
      if (!location.latLng) {
        throw new Error(`No lat/lng data available for ${center}`);
      }

      const { latitude, longitude } = location.latLng;
      console.log('📍 ITAMatrixService: Step 2 - Searching airports near', { latitude, longitude, radiusMiles });

      // Now do the geosearch with lat/long
      const url = `${this.locationBaseUrl}/v1/geosearch/findairportsnearcoords?key=${this.apiKey}&alt=json`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-alkali-application-key': 'applications/matrix',
          'x-alkali-auth-apps-namespace': 'alkali_v2',
          'x-alkali-auth-entities-namespace': 'alkali_v2',
          'X-JavaScript-User-Agent': 'google-api-javascript-client/1.1.0',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Goog-Encode-Response-If-Executable': 'base64'
        },
        body: JSON.stringify({
          latitude: latitude,
          longitude: longitude,
          radius: radiusMiles,
          units: 'MI'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ITAMatrixService: Geo search failed:', response.status, errorText);
        throw new Error(`Geo search failed: ${response.status}`);
      }

      const data = await response.json();

      // Sort by distance (airports without distance come first, then sorted by distance)
      if (data.locations) {
        data.locations.sort((a: Location, b: Location) => {
          const distA = a.distance?.measurementValue ?? 0;
          const distB = b.distance?.measurementValue ?? 0;
          return distA - distB;
        });
      }

      console.log('✅ ITAMatrixService: Found', data.locations?.length || 0, 'nearby airports');
      return data;
    } catch (error) {
      console.error('❌ ITAMatrixService: Geo search failed:', error);
      throw error;
    }
  }
}

export default ITAMatrixService.getInstance();
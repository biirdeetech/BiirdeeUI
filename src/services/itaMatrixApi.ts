import { FlightSearchParams, SearchResponse } from '../types/flight';
import { generateCommandLine } from '../utils/fareClasses';

// Store session information for booking details requests
interface SessionInfo {
  session: string;
  solutionSet: string;
}

class ITAMatrixService {
  private static instance: ITAMatrixService;
  private baseUrl = 'https://content-alkalimatrix-pa.googleapis.com/v1/search';
  private summaryUrl = 'https://content-alkalimatrix-pa.googleapis.com/v1/summarize';
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

    // Transform each solution to match our FlightSolution interface
    const transformedSolutions = solutions.map((solution: any) => {
      const itinerary = solution.itinerary || {};
      const slices = itinerary.slices || [];
      
      return {
        id: solution.id,
        totalAmount: parseFloat(solution.ext?.price?.replace('USD', '') || '0'),
        displayTotal: parseFloat(solution.displayTotal?.replace('USD', '') || '0'),
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
          pricePerMile: parseFloat(solution.ext?.pricePerMile?.replace('USD', '') || '0')
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
}

export default ITAMatrixService.getInstance();
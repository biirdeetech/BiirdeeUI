import { FlightSearchParams, SearchResponse } from '../types/flight';

interface BiirdeeSlice {
  origin: string[];
  dest: string[];
  routing?: string;
  ext?: string;
  routingRet?: string;
  extRet?: string;
  dates: {
    searchDateType: 'specific';
    departureDate: string;
    departureDateType: 'depart' | 'arrive';
    departureDateModifier: string;
    departureDatePreferredTimes: number[];
    returnDate?: string;
    returnDateType?: 'depart' | 'arrive';
    returnDateModifier?: string;
    returnDatePreferredTimes?: number[];
  };
}

interface BiirdeeRequest {
  type: 'one-way' | 'round-trip' | 'multi-city';
  slices: BiirdeeSlice[];
  options: {
    cabin: string;
    stops: string;
    extraStops: string;
    allowAirportChanges: string;
    showOnlyAvailable: string;
    pageSize: number;
    currency?: {
      displayName: string;
      code: string;
    };
    salesCity?: {
      code: string;
      name: string;
    };
  };
  pax: {
    adults: string;
    seniors?: string;
    youth?: string;
    children?: string;
    infantsInLap?: string;
    infantsInSeat?: string;
  };
}

class BiirdeeService {
  private static instance: BiirdeeService;
  private baseUrl = 'https://nodejs-production-ae342.up.railway.app/api/v3/flights/ita-matrix';

  static getInstance(): BiirdeeService {
    if (!BiirdeeService.instance) {
      BiirdeeService.instance = new BiirdeeService();
    }
    return BiirdeeService.instance;
  }

  private mapCabinClass(cabin?: string): string {
    const cabinMap: Record<string, string> = {
      'economy': 'COACH',
      'premium economy': 'PREMIUM-COACH',
      'business': 'BUSINESS',
      'first': 'FIRST'
    };
    return cabinMap[cabin?.toLowerCase() || 'economy'] || 'COACH';
  }

  private mapMaxStops(maxStops?: number): string {
    if (maxStops === undefined || maxStops === null || maxStops < 0) {
      return '-1';
    }
    return String(maxStops);
  }

  private mapFlexibility(flexibility?: number): string {
    if (!flexibility || flexibility === 0) return '0';
    if (flexibility === 1) return '11';
    if (flexibility === 2) return '22';
    if (flexibility === 3) return '33';
    return '0';
  }

  private buildBiirdeeRequest(params: FlightSearchParams): BiirdeeRequest {
    console.log('🔧 BiirdeeService: Building request for:', params);

    const slices: BiirdeeSlice[] = [];

    if (params.slices && params.slices.length > 0) {
      // Keep all slices separate (including round-trip as multi-city)
      params.slices.forEach((slice, index) => {
        const biirdeeSlice: BiirdeeSlice = {
          origin: slice.origins,
          dest: slice.destinations,
          dates: {
            searchDateType: 'specific',
            departureDate: slice.departDate,
            departureDateType: 'depart',
            departureDateModifier: this.mapFlexibility(slice.flexibility),
            departureDatePreferredTimes: [],
            returnDateType: 'depart',
            returnDateModifier: '0',
            returnDatePreferredTimes: []
          }
        };

        if (slice.routing) {
          biirdeeSlice.routing = slice.routing;
        } else if (slice.via) {
          biirdeeSlice.routing = slice.via;
        }

        if (slice.ext) {
          biirdeeSlice.ext = slice.ext;
        }

        slices.push(biirdeeSlice);
      });
    } else {
      const outboundSlice: BiirdeeSlice = {
        origin: [params.origin],
        dest: [params.destination],
        dates: {
          searchDateType: 'specific',
          departureDate: params.departDate,
          departureDateType: 'depart',
          departureDateModifier: this.mapFlexibility(params.slices?.[0]?.flexibility),
          departureDatePreferredTimes: [],
          returnDateType: 'depart',
          returnDateModifier: '0',
          returnDatePreferredTimes: []
        }
      };

      if (params.slices?.[0]?.routing) {
        outboundSlice.routing = params.slices[0].routing;
      } else if (params.slices?.[0]?.via) {
        outboundSlice.routing = params.slices[0].via;
      }

      if (params.slices?.[0]?.ext) {
        outboundSlice.ext = params.slices[0].ext;
      }

      slices.push(outboundSlice);

      if (params.tripType === 'roundTrip' && params.returnDate) {
        // For round-trip, create a separate return slice
        const returnSlice: BiirdeeSlice = {
          origin: [params.destination],
          dest: [params.origin],
          dates: {
            searchDateType: 'specific',
            departureDate: params.returnDate,
            departureDateType: 'depart',
            departureDateModifier: this.mapFlexibility(params.slices?.[1]?.flexibility),
            departureDatePreferredTimes: [],
            returnDateType: 'depart',
            returnDateModifier: '0',
            returnDatePreferredTimes: []
          }
        };

        if (params.slices?.[1]?.routing) {
          returnSlice.routing = params.slices[1].routing;
        } else if (params.slices?.[1]?.via) {
          returnSlice.routing = params.slices[1].via;
        }

        if (params.slices?.[1]?.ext) {
          returnSlice.ext = params.slices[1].ext;
        }

        slices.push(returnSlice);
      }
    }

    const tripType = params.tripType === 'roundTrip' ? 'multi-city' :
                     params.tripType === 'multiCity' ? 'multi-city' : 'one-way';

    const request: BiirdeeRequest = {
      type: tripType,
      slices: slices,
      options: {
        cabin: 'COACH',
        stops: this.mapMaxStops(params.maxStops),
        extraStops: this.mapMaxStops(params.maxStops),
        allowAirportChanges: 'true',
        showOnlyAvailable: 'true',
        pageSize: 500
      },
      pax: {
        adults: String(params.passengers || 1)
      }
    };

    return request;
  }

  async searchFlights(params: FlightSearchParams): Promise<SearchResponse> {
    console.log('🛫 BiirdeeService: Starting flight search with params:', params);

    try {
      const requestBody = this.buildBiirdeeRequest(params);
      console.log('📡 BiirdeeService: Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log('📥 BiirdeeService: Raw response:', responseText);

      if (!response.ok) {
        console.error('❌ BiirdeeService: API request failed:', response.status);
        console.error('❌ BiirdeeService: Error details:', responseText);
        throw new Error(`API request failed: ${response.status}. ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('✅ BiirdeeService: Parsed response:', data);

      return this.transformBiirdeeResponse(data);
    } catch (error) {
      console.error('❌ BiirdeeService: API request failed:', error);
      throw error;
    }
  }

  private transformBiirdeeResponse(biirdeeResponse: any): SearchResponse {
    console.log('🔄 BiirdeeService: Transforming Biirdee response');

    if (!biirdeeResponse || !biirdeeResponse.data || !biirdeeResponse.data.solutionList) {
      console.log('⚠️ BiirdeeService: No solutionList in response');
      return {
        solutionList: {
          solutions: []
        }
      };
    }

    const solutions = biirdeeResponse.data.solutionList.solutions || [];
    console.log(`✅ BiirdeeService: Transforming ${solutions.length} solutions`);

    const transformedSolutions = solutions.map((solution: any) => {
      const itinerary = solution.itinerary || {};
      const slices = itinerary.slices || [];
      const carriers = itinerary.carriers || [];

      return {
        id: solution.id,
        totalAmount: parseFloat(solution.ext?.price?.replace('USD', '').trim() || '0'),
        displayTotal: parseFloat(solution.displayTotal?.replace('USD', '').trim() || '0'),
        slices: slices.map((slice: any) => {
          const segments = slice.segments || [];
          const flights = slice.flights || [];

          const defaultCarrier = itinerary.singleCarrier || carriers[0] || { code: '', name: '', shortName: '' };

          const transformedSegments = segments.length > 0
            ? segments.map((seg: any, index: number) => {
                const carrierForSegment = carriers[index] || carriers[0] || itinerary.singleCarrier || { code: '', name: '', shortName: '' };

                return {
                  carrier: {
                    code: carrierForSegment.code || '',
                    name: carrierForSegment.name || carrierForSegment.shortName || '',
                    shortName: carrierForSegment.shortName || carrierForSegment.name || ''
                  },
                  marketingCarrier: carrierForSegment.code || '',
                  pricings: seg.pricings || []
                };
              })
            : flights.map((_: any, index: number) => {
                const carrierForSegment = carriers[index] || carriers[0] || itinerary.singleCarrier || { code: '', name: '', shortName: '' };

                return {
                  carrier: {
                    code: carrierForSegment.code || '',
                    name: carrierForSegment.name || carrierForSegment.shortName || '',
                    shortName: carrierForSegment.shortName || carrierForSegment.name || ''
                  },
                  marketingCarrier: carrierForSegment.code || '',
                  pricings: []
                };
              });

          return {
            origin: slice.origin || { code: '', name: '' },
            destination: slice.destination || { code: '', name: '' },
            departure: slice.departure || '',
            arrival: slice.arrival || '',
            duration: slice.duration || 0,
            flights: flights,
            cabins: slice.cabins || [],
            stops: slice.stops || [],
            segments: transformedSegments.length > 0 ? transformedSegments : [{
              carrier: defaultCarrier,
              marketingCarrier: defaultCarrier.code || '',
              pricings: []
            }]
          };
        }),
        ext: {
          pricePerMile: parseFloat(solution.ext?.pricePerMile?.replace('USD', '').trim() || '0')
        }
      };
    });

    return {
      solutionList: {
        solutions: transformedSolutions
      },
      session: biirdeeResponse.data.session,
      solutionSet: biirdeeResponse.data.solutionSet
    };
  }
}

export default BiirdeeService.getInstance();

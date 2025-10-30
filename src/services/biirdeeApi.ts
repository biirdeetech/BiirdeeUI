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

  private buildBiirdeeRequest(params: FlightSearchParams): any {
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

    const request: any = {
      type: tripType,
      slices: slices,
      options: {
        cabin: 'COACH',
        stops: this.mapMaxStops(params.maxStops),
        extraStops: this.mapMaxStops(params.maxStops),
        allowAirportChanges: 'true',
        showOnlyAvailable: 'true',
        pageSize: params.pageSize || 25,
        pageNum: params.pageNum || 1,
        // Aero options
        aero: params.aero || false,
        ...(params.airlines && { airlines: params.airlines }),
        ...(params.strict_airline_match !== undefined && { strict_airline_match: params.strict_airline_match }),
        ...(params.time_tolerance !== undefined && { time_tolerance: params.time_tolerance }),
        ...(params.strict_leg_match !== undefined && { strict_leg_match: params.strict_leg_match }),
        ...(params.summary !== undefined && { summary: params.summary })
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

      // Check if aero is enabled for streaming
      if (params.aero) {
        return await this.searchFlightsWithStreaming(requestBody);
      }

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

  private async searchFlightsWithStreaming(requestBody: any): Promise<SearchResponse> {
    console.log('🌊 BiirdeeService: Starting streaming search');

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ BiirdeeService: Streaming API request failed:', response.status);
      console.error('❌ BiirdeeService: Error details:', errorText);
      throw new Error(`API request failed: ${response.status}. ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null, streaming not supported');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let allFlights: any[] = [];
    let searchParams: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('✅ BiirdeeService: Streaming completed');
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (NDJSON)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);
            console.log('📦 BiirdeeService: Received event:', event.type);

            if (event.type === 'search_started') {
              searchParams = event.search_params;
              console.log('🚀 Search started:', searchParams);
            } else if (event.type === 'provider_result') {
              console.log(`✈️  Provider ${event.provider} returned ${event.data?.data?.length || 0} flights`);
              if (event.data?.data) {
                allFlights.push(...event.data.data);
              }
            } else if (event.type === 'search_completed') {
              console.log('✅ Search completed');
            }
          } catch (parseError) {
            console.warn('⚠️  Failed to parse line:', line, parseError);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Transform the aggregated flights into our format
    console.log(`🔄 BiirdeeService: Transforming ${allFlights.length} total flights from streaming`);

    return {
      solutionList: {
        solutions: allFlights.map(flight => this.transformAeroFlight(flight))
      }
    };
  }

  private transformAeroFlight(aeroFlight: any): any {
    // Transform Aero API flight format to our internal format
    const itineraries = aeroFlight.itineraries || [];
    const slices = itineraries.map((itinerary: any) => {
      const segments = itinerary.segments || [];
      const firstSegment = segments[0] || {};
      const lastSegment = segments[segments.length - 1] || {};

      return {
        origin: {
          code: firstSegment.departure?.iataCode || '',
          name: firstSegment.departure?.iataCode || ''
        },
        destination: {
          code: lastSegment.arrival?.iataCode || '',
          name: lastSegment.arrival?.iataCode || ''
        },
        departure: firstSegment.departure?.at || '',
        arrival: lastSegment.arrival?.at || '',
        duration: this.parseDuration(itinerary.duration),
        flights: segments.map((seg: any) => `${seg.carrierCode || ''}${seg.number || ''}`),
        cabins: segments.map((seg: any) => seg.cabin || 'ECONOMY'),
        stops: segments.slice(0, -1).map((seg: any) => ({
          code: seg.arrival?.iataCode || '',
          name: seg.arrival?.iataCode || ''
        })),
        segments: segments.map((seg: any) => ({
          carrier: {
            code: seg.carrierCode || '',
            name: seg.carrierCode || '',
            shortName: seg.carrierCode || ''
          },
          marketingCarrier: seg.carrierCode || '',
          pricings: seg.fareDetailsBySegment ? [{
            fareBasis: seg.fareDetailsBySegment[0]?.fareBasis || '',
            bookingClass: seg.fareDetailsBySegment[0]?.class || ''
          }] : []
        }))
      };
    });

    return {
      id: aeroFlight.id || '',
      totalAmount: parseFloat(aeroFlight.price?.total || '0'),
      displayTotal: parseFloat(aeroFlight.price?.grandTotal || aeroFlight.price?.total || '0'),
      slices: slices,
      ext: {
        pricePerMile: 0
      }
    };
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration format (e.g., "PT1H33M")
    if (!duration) return 0;

    const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!matches) return 0;

    const hours = parseInt(matches[1] || '0');
    const minutes = parseInt(matches[2] || '0');

    return hours * 60 + minutes;
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

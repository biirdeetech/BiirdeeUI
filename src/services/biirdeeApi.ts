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
    if (!cabin) return 'COACH';

    // Handle both formats: 'PREMIUM_COACH' and 'PREMIUM-COACH'
    const normalizedCabin = cabin.toUpperCase().replace('_', '-');

    const cabinMap: Record<string, string> = {
      'COACH': 'COACH',
      'PREMIUM-COACH': 'PREMIUM-COACH',
      'BUSINESS': 'BUSINESS',
      'FIRST': 'FIRST'
    };

    return cabinMap[normalizedCabin] || 'COACH';
  }

  private mapMaxStops(maxStops?: number): string {
    if (maxStops === undefined || maxStops === null || maxStops < 0) {
      return '-1';
    }
    return String(maxStops);
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
            departureDateType: slice.departureDateType || 'depart',
            departureDateModifier: slice.departureDateModifier || '0',
            departureDatePreferredTimes: slice.departureDatePreferredTimes || [],
            returnDateType: slice.returnDateType || 'depart',
            returnDateModifier: slice.returnDateModifier || '0',
            returnDatePreferredTimes: slice.returnDatePreferredTimes || []
          }
        };

        if (slice.routing) {
          biirdeeSlice.routing = slice.routing;
        } else if (slice.via) {
          biirdeeSlice.routing = slice.via;
        } else if (slice.nonstop) {
          biirdeeSlice.routing = 'N';
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
          departureDateType: params.slices?.[0]?.departureDateType || 'depart',
          departureDateModifier: params.slices?.[0]?.departureDateModifier || '0',
          departureDatePreferredTimes: params.slices?.[0]?.departureDatePreferredTimes || [],
          returnDateType: params.slices?.[0]?.returnDateType || 'depart',
          returnDateModifier: params.slices?.[0]?.returnDateModifier || '0',
          returnDatePreferredTimes: params.slices?.[0]?.returnDatePreferredTimes || []
        }
      };

      if (params.slices?.[0]?.routing) {
        outboundSlice.routing = params.slices[0].routing;
      } else if (params.slices?.[0]?.via) {
        outboundSlice.routing = params.slices[0].via;
      } else if (params.slices?.[0]?.nonstop) {
        outboundSlice.routing = 'N';
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
            departureDateType: params.slices?.[1]?.departureDateType || 'depart',
            departureDateModifier: params.slices?.[1]?.departureDateModifier || '0',
            departureDatePreferredTimes: params.slices?.[1]?.departureDatePreferredTimes || [],
            returnDateType: params.slices?.[1]?.returnDateType || 'depart',
            returnDateModifier: params.slices?.[1]?.returnDateModifier || '0',
            returnDatePreferredTimes: params.slices?.[1]?.returnDatePreferredTimes || []
          }
        };

        if (params.slices?.[1]?.routing) {
          returnSlice.routing = params.slices[1].routing;
        } else if (params.slices?.[1]?.via) {
          returnSlice.routing = params.slices[1].via;
        } else if (params.slices?.[1]?.nonstop) {
          returnSlice.routing = 'N';
        }

        if (params.slices?.[1]?.ext) {
          returnSlice.ext = params.slices[1].ext;
        }

        slices.push(returnSlice);
      }
    }

    const tripType = params.tripType === 'roundTrip' ? 'multi-city' :
                     params.tripType === 'multiCity' ? 'multi-city' : 'one-way';

    // Use first slice's options as global defaults, or fall back to params
    const firstSlice = params.slices?.[0];
    const globalMaxStops = firstSlice?.maxStops ?? params.maxStops ?? -1;
    const globalExtraStops = firstSlice?.extraStops ?? params.extraStops ?? -1;
    const globalAllowAirportChanges = firstSlice?.allowAirportChanges ?? params.allowAirportChanges ?? true;
    const globalShowOnlyAvailable = firstSlice?.showOnlyAvailable ?? params.showOnlyAvailable ?? true;
    const globalAero = firstSlice?.aero ?? params.aero ?? false;
    const globalSummary = firstSlice?.fetchSummary ?? params.summary ?? false;

    const request: any = {
      type: tripType,
      slices: slices,
      options: {
        cabin: this.mapCabinClass(params.cabin),
        stops: this.mapMaxStops(globalMaxStops),
        extraStops: this.mapMaxStops(globalExtraStops),
        allowAirportChanges: String(globalAllowAirportChanges),
        showOnlyAvailable: String(globalShowOnlyAvailable),
        pageSize: params.pageSize || 25,
        pageNum: params.pageNum || 1,
        // Aero options
        aero: globalAero,
        ...(params.airlines && { airlines: params.airlines }),
        ...(params.strict_airline_match !== undefined && { strict_airline_match: params.strict_airline_match }),
        ...(params.time_tolerance !== undefined && { time_tolerance: params.time_tolerance }),
        ...(params.strict_leg_match !== undefined && { strict_leg_match: params.strict_leg_match }),
        ...(params.all_aero_cabin !== undefined && { all_aero_cabin: params.all_aero_cabin }),
        summary: globalSummary,
        ...(params.sales_city && {
          sales_city: typeof params.sales_city === 'string'
            ? { code: params.sales_city, name: params.sales_city }
            : params.sales_city
        }),
        ...(params.currency && {
          currency: typeof params.currency === 'string'
            ? { code: params.currency, displayName: params.currency }
            : params.currency
        })
      },
      pax: {
        adults: String(params.passengers || 1)
      }
    };

    return request;
  }

  async searchFlights(params: FlightSearchParams, onProgress?: (solution: any) => void, onMetadata?: (metadata: { solutionCount: number; pagination?: any; session?: string; solutionSet?: string }) => void): Promise<SearchResponse> {
    console.log('🛫 BiirdeeService: Starting flight search with params:', params);

    try {
      const requestBody = this.buildBiirdeeRequest(params);
      console.log('📡 BiirdeeService: Request body:', JSON.stringify(requestBody, null, 2));

      // Check if aero is enabled for streaming
      if (params.aero) {
        return await this.searchFlightsWithStreaming(requestBody, onProgress, onMetadata);
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

  private async searchFlightsWithStreaming(requestBody: any, onProgress?: (solution: any) => void, onMetadata?: (metadata: { solutionCount: number; pagination?: any; session?: string; solutionSet?: string }) => void): Promise<SearchResponse> {
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
    let totalSolutions = 0;
    let itaMetadata: any = null;

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

            if (event.type === 'start') {
              console.log('🚀 Search started with provider:', event.provider);
              // Capture ITA metadata from start event
              if (event.ita) {
                itaMetadata = event.ita;
                totalSolutions = event.ita.solutionCount || 0;
                console.log(`📊 ITA metadata: ${totalSolutions} solutions, page ${event.ita.pagination?.current} of ${event.ita.pagination?.count}`);
              }
            } else if (event.type === 'metadata') {
              // Update ITA metadata if present - prioritize ita.solutionCount over totalSolutions
              if (event.ita) {
                itaMetadata = event.ita;
                totalSolutions = event.ita.solutionCount || totalSolutions;

                // Call metadata callback immediately when metadata arrives
                if (onMetadata) {
                  onMetadata({
                    solutionCount: event.ita.solutionCount || 0,
                    pagination: event.ita.pagination,
                    session: event.ita.session,
                    solutionSet: event.ita.solutionSet
                  });
                }
              }
              console.log(`📊 Expecting ${totalSolutions} solutions (totalSolutions field: ${event.totalSolutions})`);
            } else if (event.type === 'solution') {
              console.log(`✈️  Solution ${event.solutionIndex + 1}: ${event.ext?.price}`);
              allFlights.push(event);

              // Call onProgress callback if provided for progressive rendering
              if (onProgress) {
                const transformedSolution = this.transformItaMatrixSolution(event);
                onProgress(transformedSolution);
              }
            } else if (event.type === 'summary') {
              console.log(`📋 Search complete: ${event.totalSolutions} total, ${event.enrichedCount} enriched (${event.enrichmentRate})`);
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
        solutions: allFlights.map(solution => this.transformItaMatrixSolution(solution))
      },
      solutionCount: itaMetadata?.solutionCount || totalSolutions,
      session: itaMetadata?.session,
      solutionSet: itaMetadata?.solutionSet,
      pagination: itaMetadata?.pagination
    };
  }

  private transformItaMatrixSolution(solution: any): any {
    // ITA Matrix streaming format is already close to our internal format
    // Solution structure: { type, solutionIndex, ext: {price, pricePerMile}, itinerary, pricings, displayTotal, id }

    const itinerary = solution.itinerary || {};
    const allCarriers = itinerary.carriers || [];

    // Helper to find carrier by code
    const findCarrier = (code: string) => {
      const carrier = allCarriers.find((c: any) => c.code === code);
      return carrier || { code, name: code, shortName: code };
    };

    // Helper to extract carrier code from flight number
    // IATA airline codes are always exactly 2 characters
    // Examples: "AS356" -> "AS", "S4280" -> "S4", "9W123" -> "9W"
    const extractCarrierCode = (flightNumber: string): string => {
      if (!flightNumber) return '';
      const match = flightNumber.match(/^([A-Z0-9]{2})/);
      return match ? match[1] : '';
    };

    const slices = (itinerary.slices || []).map((slice: any) => {
      const flights = slice.flights || [];

      // Map segments and match with flight numbers
      const segments = (slice.segments || []).map((seg: any, index: number) => {
        const flightNumber = flights[index] || '';
        const carrierCode = extractCarrierCode(flightNumber);
        const carrier = findCarrier(carrierCode);

        return {
          carrier: carrier,
          marketingCarrier: carrierCode,
          flightNumber: flightNumber,
          pricings: seg.pricings || []
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
        segments: segments,
        mileage: slice.mileage || undefined,
        mileagePrice: slice.mileagePrice || undefined,
        mileageBreakdown: slice.mileageBreakdown || undefined,
        mileageEnriched: slice.mileageEnriched || undefined,
        matchType: slice.matchType || undefined
      };
    });

    // Helper to extract numeric value and currency from strings like "PKR651625" or "USD1234"
    const extractPrice = (priceStr: string | undefined): number => {
      if (!priceStr) return 0;
      const numericStr = priceStr.replace(/^[A-Z]{3}/, '');
      return parseFloat(numericStr) || 0;
    };

    const extractCurrency = (priceStr: string | undefined): string => {
      if (!priceStr) return 'USD';
      const match = priceStr.match(/^[A-Z]{3}/);
      return match ? match[0] : 'USD';
    };

    // Parse price from ext or displayTotal
    const priceString = solution.ext?.totalPrice || solution.ext?.price || solution.displayTotal || '0';
    const price = extractPrice(priceString);
    const currency = extractCurrency(priceString);

    const pricePerMileString = solution.ext?.pricePerMile || '0';
    const pricePerMile = extractPrice(pricePerMileString);

    // Determine match type based on mileage breakdown data
    let matchType: 'exact' | 'partial' | 'none' = 'none';

    // Check if there's at least one full match in any slice's mileage breakdown
    const hasFullMatch = slices.some(slice =>
      slice.mileageBreakdown?.some((mb: any) =>
        mb.exactMatch === true ||
        (mb.allMatchingFlights?.some((flight: any) => flight.exactMatch === true))
      )
    );

    if (hasFullMatch) {
      matchType = 'exact';
    } else if (solution.totalMileage > 0) {
      matchType = 'partial';
    }

    // Build mileage deals array from solution data
    const mileageDeals: any[] = [];

    // If mileage information is available, create mileage deal(s)
    if (solution.totalMileage > 0) {
      // Get primary carrier for mileage program
      const dominantCarrier = itinerary.ext?.dominantCarrier || itinerary.carriers?.[0];

      if (dominantCarrier) {
        // Extract cabin information from actual matching flights
        const cabinsSet = new Set<string>();

        slices.forEach((slice: any) => {
          if (slice.mileageBreakdown && Array.isArray(slice.mileageBreakdown)) {
            slice.mileageBreakdown.forEach((breakdown: any) => {
              if (breakdown.allMatchingFlights && Array.isArray(breakdown.allMatchingFlights)) {
                breakdown.allMatchingFlights.forEach((flight: any) => {
                  if (flight.cabin) {
                    cabinsSet.add(flight.cabin);
                  }
                });
              }
            });
          }
        });

        // Fallback to ITA Matrix cabins if no Aero cabins found
        const cabins = cabinsSet.size > 0
          ? Array.from(cabinsSet)
          : (slices[0]?.cabins || []);

        mileageDeals.push({
          airline: dominantCarrier.shortName || dominantCarrier.name || dominantCarrier.code,
          airlineCode: dominantCarrier.code,
          mileage: solution.totalMileage,
          mileagePrice: solution.totalMileagePrice || 0,
          matchType: solution.fullyEnriched ? 'full' : 'partial',
          cabins: cabins
        });
      }
    }

    return {
      id: solution.id || `solution-${solution.solutionIndex}`,
      totalAmount: price,
      displayTotal: price,
      currency: currency,
      slices: slices,
      ext: {
        pricePerMile: pricePerMile
      },
      totalMileage: solution.totalMileage || 0,
      totalMileagePrice: solution.totalMileagePrice || 0,
      fullyEnriched: solution.fullyEnriched || false,
      matchType: matchType,
      mileageDeals: mileageDeals
    };
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

    const transformedSolutions = solutions.map((solution: any) => {
      const itinerary = solution.itinerary || {};
      const slices = itinerary.slices || [];
      const carriers = itinerary.carriers || [];

      return {
        id: solution.id,
        totalAmount: extractPrice(solution.ext?.price),
        displayTotal: extractPrice(solution.displayTotal),
        currency: extractCurrency(solution.displayTotal || solution.ext?.price),
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
            }],
            mileage: slice.mileage || undefined,
            mileagePrice: slice.mileagePrice || undefined,
            mileageBreakdown: slice.mileageBreakdown || undefined,
            mileageEnriched: slice.mileageEnriched || undefined,
            matchType: slice.matchType || undefined
          };
        }),
        ext: {
          pricePerMile: extractPrice(solution.ext?.pricePerMile)
        }
      };
    });

    return {
      solutionList: {
        solutions: transformedSolutions
      },
      session: biirdeeResponse.data.session,
      solutionSet: biirdeeResponse.data.solutionSet,
      solutionCount: biirdeeResponse.data.solutionList.solutionCount
    };
  }
}

export default BiirdeeService.getInstance();

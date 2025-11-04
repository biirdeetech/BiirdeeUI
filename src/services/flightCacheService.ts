import { SearchResponse, FlightSearchParams } from '../types/flight';

interface CacheEntry {
  data: SearchResponse;
  timestamp: number;
  pageNum: number;
}

interface CacheStore {
  [cacheKey: string]: {
    [pageNum: number]: CacheEntry;
  };
}

class FlightCacheService {
  private cache: CacheStore = {};
  private readonly TTL = 60 * 60 * 1000; // 1 hour in milliseconds

  generateCacheKey(params: FlightSearchParams): string {
    // Serialize slices with all their params (via, nonstop, ext, flexibility, routing, etc.)
    const slicesKey = params.slices?.map(slice => ({
      origins: slice.origins.sort().join(','),
      destinations: slice.destinations.sort().join(','),
      departDate: slice.departDate,
      cabin: slice.cabin,
      flexibility: slice.flexibility ?? 0,
      via: slice.via || '',
      routing: slice.routing || '',
      ext: slice.ext || '',
      routingRet: slice.routingRet || '',
      extRet: slice.extRet || '',
      returnFlexibility: slice.returnFlexibility ?? 0,
      nonstop: slice.nonstop || false
    })) || [];

    const key = {
      // Trip basics
      tripType: params.tripType,
      origin: params.origin,
      destination: params.destination,
      departDate: params.departDate,
      returnDate: params.returnDate || '',
      cabin: params.cabin,
      passengers: params.passengers,

      // Routing & stops
      maxStops: params.maxStops ?? -1,
      extraStops: params.extraStops ?? -1,
      flexibility: params.flexibility ?? 0,

      // Multi-city slices (includes via, nonstop, ext, routing for each leg)
      slices: slicesKey,

      // Pagination
      pageSize: params.pageSize || 25,

      // ITA Matrix options
      allowAirportChanges: params.allowAirportChanges ?? true,
      showOnlyAvailable: params.showOnlyAvailable ?? true,

      // Aero enrichment options
      aero: params.aero || false,
      airlines: params.airlines || '',
      strict_airline_match: params.strict_airline_match || false,
      time_tolerance: params.time_tolerance || 120,
      strict_leg_match: params.strict_leg_match || false,
      summary: params.summary || false
    };

    return JSON.stringify(key);
  }

  set(params: FlightSearchParams, pageNum: number, data: SearchResponse): void {
    const cacheKey = this.generateCacheKey(params);

    if (!this.cache[cacheKey]) {
      this.cache[cacheKey] = {};
    }

    this.cache[cacheKey][pageNum] = {
      data,
      timestamp: Date.now(),
      pageNum
    };

    console.log(`💾 FlightCache: Cached page ${pageNum} for key:`, cacheKey.substring(0, 100));
  }

  get(params: FlightSearchParams, pageNum: number): SearchResponse | null {
    const cacheKey = this.generateCacheKey(params);

    if (!this.cache[cacheKey] || !this.cache[cacheKey][pageNum]) {
      console.log(`❌ FlightCache: Cache miss for page ${pageNum}`);
      return null;
    }

    const entry = this.cache[cacheKey][pageNum];
    const age = Date.now() - entry.timestamp;

    if (age > this.TTL) {
      console.log(`⏰ FlightCache: Cache expired for page ${pageNum} (age: ${Math.round(age / 1000)}s)`);
      delete this.cache[cacheKey][pageNum];
      return null;
    }

    console.log(`✅ FlightCache: Cache hit for page ${pageNum} (age: ${Math.round(age / 1000)}s)`);
    return entry.data;
  }

  clear(params: FlightSearchParams): void {
    const cacheKey = this.generateCacheKey(params);
    if (this.cache[cacheKey]) {
      delete this.cache[cacheKey];
      console.log(`🗑️  FlightCache: Cleared cache for key:`, cacheKey.substring(0, 100));
    }
  }

  clearAll(): void {
    this.cache = {};
    console.log('🗑️  FlightCache: Cleared all cache');
  }

  getAllCachedPages(params: FlightSearchParams): number[] {
    const cacheKey = this.generateCacheKey(params);
    if (!this.cache[cacheKey]) {
      return [];
    }

    return Object.keys(this.cache[cacheKey])
      .map(Number)
      .filter(pageNum => {
        const entry = this.cache[cacheKey][pageNum];
        const age = Date.now() - entry.timestamp;
        return age <= this.TTL;
      })
      .sort((a, b) => a - b);
  }

  getCacheStats(): { totalKeys: number; totalPages: number } {
    let totalPages = 0;
    const totalKeys = Object.keys(this.cache).length;

    Object.values(this.cache).forEach(pages => {
      totalPages += Object.keys(pages).length;
    });

    return { totalKeys, totalPages };
  }
}

export const flightCache = new FlightCacheService();

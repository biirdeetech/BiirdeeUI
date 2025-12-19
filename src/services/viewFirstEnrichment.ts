/**
 * View-First Award Enrichment Service
 *
 * Handles batched, view-priority award fetching for flight results.
 * - Processes 2 flights at a time
 * - Prioritizes flights in viewport
 * - Continues in background during user actions
 * - Deduplicates by unique flight signature
 */

import { FlightSearchParams, FlightSolution } from '../types/flight';
import ITAMatrixService from './itaMatrixApi';

export interface EnrichmentQueueItem {
  flightId: string;
  carrierCode: string;
  isVisible: boolean;
  priority: number; // Lower = higher priority
  flight: FlightSolution;
}

export interface EnrichmentProgress {
  total: number;
  completed: number;
  inProgress: Set<string>;
  failed: Set<string>;
}

type EnrichmentCallback = (carrierCode: string, data: any[]) => void;
type ProgressCallback = (progress: EnrichmentProgress) => void;

class ViewFirstEnrichmentManager {
  private queue: EnrichmentQueueItem[] = [];
  private processing: boolean = false;
  private batchSize: number = 2;
  private enrichedFlights: Set<string> = new Set();
  private inProgressFlights: Set<string> = new Set();
  private failedFlights: Set<string> = new Set();
  private onEnrichmentComplete?: EnrichmentCallback;
  private onProgressUpdate?: ProgressCallback;
  private currentSearchParams?: FlightSearchParams;
  private abortController?: AbortController;

  /**
   * Initialize the enrichment manager with callbacks
   */
  initialize(
    onEnrichmentComplete: EnrichmentCallback,
    onProgressUpdate: ProgressCallback
  ) {
    this.onEnrichmentComplete = onEnrichmentComplete;
    this.onProgressUpdate = onProgressUpdate;
  }

  /**
   * Reset for new search
   */
  reset() {
    this.queue = [];
    this.enrichedFlights.clear();
    this.inProgressFlights.clear();
    this.failedFlights.clear();
    this.processing = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
  }

  /**
   * Add flights to enrichment queue
   */
  addFlights(
    flights: FlightSolution[],
    searchParams: FlightSearchParams,
    visibleFlightIds: Set<string> = new Set()
  ) {
    this.currentSearchParams = searchParams;

    // Extract unique carrier codes from flights
    const newItems: EnrichmentQueueItem[] = [];

    flights.forEach(flight => {
      const flightId = flight.id;

      // Skip if already enriched or in queue
      if (this.enrichedFlights.has(flightId) || this.inProgressFlights.has(flightId)) {
        return;
      }

      // Check if already in queue
      if (this.queue.some(item => item.flightId === flightId)) {
        return;
      }

      // Extract carrier code from first segment
      const carrierCode = flight.slices[0]?.segments?.[0]?.carrier?.code;
      if (!carrierCode || carrierCode.length !== 2) {
        return;
      }

      const isVisible = visibleFlightIds.has(flightId);
      const priority = isVisible ? 1 : 2;

      newItems.push({
        flightId,
        carrierCode,
        isVisible,
        priority,
        flight
      });
    });

    // Add to queue and sort by priority
    this.queue.push(...newItems);
    this.sortQueue();

    console.log(`📋 Enrichment Queue: Added ${newItems.length} flights, total queue size: ${this.queue.length}`);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Update visibility status for flights
   */
  updateVisibility(visibleFlightIds: Set<string>) {
    let updated = false;

    this.queue.forEach(item => {
      const wasVisible = item.isVisible;
      const isVisible = visibleFlightIds.has(item.flightId);

      if (wasVisible !== isVisible) {
        item.isVisible = isVisible;
        item.priority = isVisible ? 1 : 2;
        updated = true;
      }
    });

    if (updated) {
      this.sortQueue();
      console.log(`👁️ Enrichment Queue: Updated visibility, ${Array.from(visibleFlightIds).length} flights visible`);
    }
  }

  /**
   * Sort queue by priority (visible first)
   */
  private sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Within same priority, maintain insertion order
      return 0;
    });
  }

  /**
   * Process queue in batches
   */
  private async processQueue() {
    if (this.processing) return;
    if (this.queue.length === 0) {
      console.log('✅ Enrichment Queue: All flights processed');
      this.updateProgress();
      return;
    }

    this.processing = true;
    this.abortController = new AbortController();

    console.log(`🔄 Enrichment Queue: Processing batch of ${Math.min(this.batchSize, this.queue.length)} flights...`);

    // Take batch from queue
    const batch = this.queue.splice(0, this.batchSize);
    const carrierCodes = Array.from(new Set(batch.map(item => item.carrierCode)));

    // Mark as in progress
    batch.forEach(item => {
      this.inProgressFlights.add(item.flightId);
    });

    this.updateProgress();

    try {
      if (!this.currentSearchParams) {
        throw new Error('No search parameters available');
      }

      console.log(`🌟 Enrichment Queue: Fetching awards for carriers: ${carrierCodes.join(', ')}`);

      // Fetch enrichment data for this batch
      const enrichmentData = await ITAMatrixService.enrichWithV2Mileage(
        this.currentSearchParams,
        carrierCodes
      );

      // Process results by carrier
      const carrierMap = new Map<string, any[]>();

      enrichmentData.forEach((item: any) => {
        if (item.type === 'solution' && item.provider === 'awardtool-direct' && item.data) {
          const flightData = item.data;
          const itineraries = flightData.itineraries || [];

          itineraries.forEach((itinerary: any) => {
            const segments = itinerary.segments || [];
            segments.forEach((segment: any) => {
              const carrier = segment.carrierCode || segment.operating?.carrierCode;
              if (carrier && carrier.length === 2) {
                if (!carrierMap.has(carrier)) {
                  carrierMap.set(carrier, []);
                }
                carrierMap.get(carrier)!.push(item);
              }
            });
          });
        }
      });

      // Mark batch as complete and notify
      batch.forEach(item => {
        this.inProgressFlights.delete(item.flightId);
        this.enrichedFlights.add(item.flightId);

        // Call completion callback for this carrier
        const data = carrierMap.get(item.carrierCode) || [];
        if (this.onEnrichmentComplete && data.length > 0) {
          this.onEnrichmentComplete(item.carrierCode, data);
        }
      });

      console.log(`✅ Enrichment Queue: Batch complete, ${this.enrichedFlights.size} flights enriched`);
    } catch (error) {
      console.error('❌ Enrichment Queue: Batch failed:', error);

      // Mark batch as failed
      batch.forEach(item => {
        this.inProgressFlights.delete(item.flightId);
        this.failedFlights.add(item.flightId);
      });
    } finally {
      this.updateProgress();
      this.processing = false;

      // Continue processing if queue not empty
      if (this.queue.length > 0) {
        // Small delay before next batch to avoid overwhelming the API
        setTimeout(() => this.processQueue(), 500);
      }
    }
  }

  /**
   * Update progress callback
   */
  private updateProgress() {
    if (this.onProgressUpdate) {
      const total = this.enrichedFlights.size + this.inProgressFlights.size + this.failedFlights.size + this.queue.length;
      this.onProgressUpdate({
        total,
        completed: this.enrichedFlights.size,
        inProgress: new Set(this.inProgressFlights),
        failed: new Set(this.failedFlights)
      });
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      enrichedCount: this.enrichedFlights.size,
      inProgressCount: this.inProgressFlights.size,
      failedCount: this.failedFlights.size,
      isProcessing: this.processing
    };
  }
}

// Export singleton instance
export const enrichmentManager = new ViewFirstEnrichmentManager();

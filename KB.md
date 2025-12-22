# Biirdee Pro - Knowledge Base

**Version:** 2.0 (In Progress - Major UI Refactor)
**Last Updated:** December 19, 2025
**Type:** Vite/React Frontend Application

**Current Sprint:** UI Refactor (Item 7/10 Complete - View-First Award Enrichment ✅)

**Recent Bug Fixes & Updates (Dec 19, 2025):**
- ✅ Fixed `slice.duration.match is not a function` error (FlightResults.tsx:246-247)
  - Issue: duration property was sometimes not a string type
  - Solution: Added type guard to convert to string before calling .match()
  - Affected: getFlightDuration function for both regular and grouped flights

**Major Updates (Dec 19, 2025):**
- ✅ Fixed decimal display in stop count tabs (FlightResults.tsx:1069)
  - Changed from `{currency}{cheapestPrice.toLocaleString()}` to `formatPrice(cheapestPrice, currency)`
- ✅ Fixed decimal display in cabin pricing (FlightCard.tsx:1643-1667)
  - Updated formatPrice function to round to whole numbers (no decimals)
  - Changed USD display from "USD 1,234.5" to "$1,234"
  - Added currency symbol mapping for 30+ currencies
- ✅ Fixed price per mile formatting (FlightCard.tsx:1701-1703)
  - Changed from `toFixed(2)` to `Math.round().toFixed(0)`
- ✅ Hidden time-based grouping UI (FlightCard.tsx:2893-2894)
  - Time Options section now disabled with `{false &&` condition
  - Kept as legacy code per current.prompt requirements
- ✅ Implemented sequential cabin search (sequentialCabinSearch.ts)
  - Replaces parallel cabin search with sequential mode
  - Searches COACH, PREMIUM-COACH, BUSINESS, FIRST one after another
  - Progress updates after each cabin completes
  - Results merge and update progressively
- ✅ Added cabin search progress component (CabinSearchProgress.tsx)
  - Shows pending/streaming/complete/error status for each cabin
  - Real-time progress with icon indicators
  - Displays flight counts as each cabin completes
- ✅ Updated SearchPage for sequential search (SearchPage.tsx)
  - Changed ENABLE_PARALLEL_CABIN_SEARCH to ENABLE_MULTI_CABIN_SEARCH
  - Set to true by default for all searches
  - Integrated CabinSearchProgress component
  - Progressive result updates as each cabin completes
- ✅ Fixed sequential search merge error (sequentialCabinSearch.ts:119, 137)
  - Issue: `mergeFlightsByCabin` expects `Record<cabin, flights[]>` format
  - Was incorrectly passing flat array instead of cabin-keyed object
  - Now correctly passes `cabinFlights` object to merge function
- ✅ Fixed flight.slices undefined error (SearchPage.tsx:972, sequentialCabinSearch.ts:161)
  - Issue: `mergedFlightsToResponse` was accessing `flight.baseFlight` which doesn't exist
  - Merged flights already contain all properties including slices
  - Fixed by spreading flight directly instead of flight.baseFlight
  - Added safety check in `calculateAvailableStops` for flights without slices
- ✅ Fixed progressive rendering in sequential cabin search (SearchPage.tsx:505, sequentialCabinSearch.ts:35)
  - Issue: `onCabinComplete` callback was trying to access `sequentialResult` before it existed
  - Results now render immediately after EACH cabin completes, not after all 4 finish
  - Implemented `firstCabinMetadata` tracking in closure to store session/solutionSet data
  - Modified `onCabinComplete` signature to pass `cabinResult` for metadata access
  - Now supports both aero (streaming) and non-aero modes correctly
- ✅ Fixed loading state not clearing during progressive rendering (SearchPage.tsx:528-532)
  - Loading spinner now turns off when first cabin completes and results appear
  - Added `setLoading(false)` and `setHasSearched(true)` in `onCabinComplete` callback
  - Users see results immediately instead of waiting for all 4 cabins
- ✅ Fixed flight signature generation for correct merging (flightSignature.ts:22-57)
  - Issue: Signature was looking for `flight.segments` which doesn't exist in API response
  - API structure uses `flight.slices[].flights[]` and slice-level data
  - Rewrote signature to use slices, flight numbers, and departure times
  - Now generates correct signatures like "SFO-AS211-06:20-JFK"
  - Prevents all flights from getting "unknown-" signatures that prevented merging
- ✅ Added extensive logging for debugging merge issues
  - sequentialCabinSearch.ts: Logs cabin counts, total flights, and merge results
  - flightSignature.ts: Logs merge process, cabin processing, and final counts
  - SearchPage.tsx: Logs progressive result counts and loading state changes
- ✅ Fixed flight grouping fingerprint to prevent over-grouping (FlightResults.tsx:1124-1146)
  - Issue: Fingerprint was only using airline + origin + destination + stops
  - This grouped 100+ DIFFERENT flights into ONE group (e.g., BR17 at 12:50pm and BR190 at 2:50pm)
  - Result: Only 1 flight card shown with 103 "similar flights" hidden
  - Added flight numbers and departure time to fingerprint
  - Now each unique flight shows as separate card
  - Only cabin variations of SAME flight (same number, time) are grouped together
- ✅ Changed cabin search from sequential to parallel execution (SearchPage.tsx)
  - Changed from `searchAllCabinsSequentially` to `searchAllCabins` (parallelCabinSearch.ts)
  - All 4 cabins (Economy, Premium, Business, First) now search simultaneously
  - Progress tracking updated to show parallel status
  - Significantly faster multi-cabin searches

---

## 🚧 ACTIVE DEVELOPMENT - UI Architecture Refactor

**Status:** In Progress
**Branch:** main
**Target Completion:** TBD

### Major Changes in Progress

**Completed:**
1. ✅ Search defaults updated: `pageSize=300` (was 25), `nonstop=false` (was true)
2. ✅ Price display updated: Shows `$1,234` instead of `USD 1,234.56`
3. ✅ All prices rounded to whole numbers across the system
4. ✅ Currency symbols added for 30+ currencies (€, £, ¥, etc.)
5. ✅ **Best/Cheap global tabs** implemented in FlightResults (src/components/FlightResults.tsx:885-941)
   - 50/50 width grid layout
   - Best tab sorts by duration (fastest first)
   - Cheap tab sorts by price (lowest first)
   - Shows min price for each mode
6. ✅ **Cabin tabs removed** from primary UI (hidden with `{false &&` condition)
7. ✅ **Duration parsing** for ISO8601 format (PT13H25M)
8. ✅ **Price calculation** for Best and Cheap modes (tabPrices useMemo)
9. ✅ **Flight-centric grouping** implemented (src/components/FlightResults.tsx:459-503)
   - Segment-based signature replaces airline-based grouping
   - Groups by actual route/segments, not airline code
   - Code-shares (same segments, different airlines) now grouped together
10. ✅ **Code-share parent detection** (src/components/FlightResults.tsx:746-806)
    - Shortest flight number = parent (e.g., UA1234 parent of LH7589)
    - Primary sorted by: flight number length → alphabetically → duration → price
11. ✅ **Opal/Shiny Award Wrapper** component created (src/components/AwardWrapper.tsx)
    - Gradient border with purple/pink/amber colors
    - Animated shimmer effect on hover
    - Award badge with count in top-right corner
    - Award info banner showing min miles and cash
    - Tailwind shimmer animation keyframes added (tailwind.config.js:155-163)
12. ✅ **Award wrapper integration** in FlightCardGroup (src/components/FlightCardGroup.tsx:59-119, 184-220, 224-266)
    - Auto-detects awards from v2EnrichmentData
    - Wraps primary flight cards with opal effect when awards available
    - Extracts min miles and cash from award data

**Completed (High Priority - Infrastructure & Integration):**
1. ✅ **Cabin/booking class moved to advanced section** (src/components/SearchForm.tsx:1155-1307)
   - Now hidden by default
   - Shows only when "Advanced" button clicked (showAdvancedOptions=true)
   - Applied globally to all legs
2. ✅ **Flight signature utilities** created (src/utils/flightSignature.ts)
   - generateFlightSignature() for deduplication across cabins
   - mergeFlightsByCabin() to merge results from parallel searches
   - CabinPrice interface for storing per-cabin pricing data
   - FlightWithCabins interface for merged flight structure
   - getBestPrice() and getCabinPrice() helper functions
   - Uses segment-based matching for accurate deduplication
3. ✅ **Parallel cabin search service** created (src/services/parallelCabinSearch.ts)
   - searchAllCabins() launches 4 concurrent API calls (COACH, PREMIUM-COACH, BUSINESS, FIRST)
   - Progress tracking for each cabin search with status updates
   - Callback support for streaming results and metadata
   - Automatic result merging using flight signatures
   - mergedFlightsToResponse() converts merged data back to SearchResponse format
   - getCabinSearchParams() helper for per-cabin parameter generation
4. ✅ **FlightSolution type extended** (src/types/flight.ts)
   - Added baseFlightId for signature-based merging
   - Added cabinPrices Record<string, CabinPrice> for per-cabin pricing
   - Added selectedCabin for UI state tracking
   - CabinPrice interface exported with cabin, price, currency, bookingClasses
5. ✅ **SearchPage integration** (src/pages/SearchPage.tsx:476-519)
   - Feature flag ENABLE_PARALLEL_CABIN_SEARCH added (currently false for safety)
   - Conditional logic: parallel search when enabled, standard search otherwise
   - Full streaming support with per-cabin callbacks
   - Merged results automatically converted to compatible format
   - Cache integration maintained
   - Ready to enable by setting flag to true
6. ✅ **CabinSelector component** created (src/components/CabinSelector.tsx)
   - Displays Economy/Premium/Business/First buttons when multiple cabins available
   - Shows price for each cabin with proper currency formatting
   - Highlights selected cabin with accent colors
   - Compact mode for space-constrained layouts
   - Auto-hides if only one cabin available
   - Responsive hover states

**HIGH PRIORITY - Remaining Core Features:**

7. ✅ **Award fetching strategy change** (current.prompt item 1-2) - COMPLETED
   - ✅ Changed from top-5 auto-fetch to per-unique-flight batched fetching
   - ✅ Implemented view-first priority (fetches visible flights first)
   - ✅ Batch size: 2 flights at a time
   - ✅ Persists progress in background when user switches tabs/actions
   - ✅ New service: src/services/viewFirstEnrichment.ts (266 lines)
   - ✅ Integration: src/pages/SearchPage.tsx (lines 697-738)
   - Features:
     - EnrichmentQueueItem with visibility tracking
     - Priority queue (visible flights = priority 1, hidden = priority 2)
     - Automatic deduplication (skips already enriched flights)
     - Background processing with 500ms delay between batches
     - Progress tracking via callbacks
     - Graceful abort on search changes
     - Singleton manager pattern for global state

8. ❌ **Per-flight cabin buttons** (current.prompt item 6)
   - Integrate CabinSelector into FlightCard
   - Show Economy/Premium/Business/First buttons on each flight row
   - Update price display based on selected cabin
   - Location: src/components/FlightCard.tsx (needs integration point)
   - **THIS IS SECOND PRIORITY**

9. ⏸️ **Enable parallel cabin search** (current.prompt item 10)
   - Set ENABLE_PARALLEL_CABIN_SEARCH = true in SearchPage.tsx:19
   - Test all search flows thoroughly
   - Monitor 4x API call performance
   - **THIS IS THIRD PRIORITY**

**MEDIUM PRIORITY - Final Polish:**

10. ⏸️ **Currency formatting verification** (current.prompt item 4, 7, 19-20)
    - Verify $ sign and rounding in ALL views:
      - ✅ Search result cards (done)
      - ✅ CabinSelector (done)
      - ❓ Flight segment details/modals
      - ❓ Award display panels
      - ❓ FRT options
      - ❓ Return flight options
    - Scan FlightCard.tsx, FlightSummaryModal.tsx, etc.

### Summary of View-First Award Enrichment

**Status:** COMPLETED ✅

**What Changed:**
- **OLD:** Auto-enriched top 5 airlines immediately after search
- **NEW:** Batched enrichment of ALL unique flights with view-first priority

**How It Works:**
1. After search completes, wait 2 seconds
2. Add all flights to enrichment queue
3. Sort queue by visibility (visible flights first)
4. Process 2 flights at a time with 500ms delay between batches
5. Update UI progressively as each batch completes
6. Continue in background even if user navigates/scrolls

**Key Benefits:**
- Awards for ALL flights, not just top 5 airlines
- Visible flights enriched first (better UX)
- Background processing doesn't block UI
- Deduplication prevents redundant API calls
- Graceful cleanup on search changes

**Implementation Files:**
- `src/services/viewFirstEnrichment.ts` - Queue manager service
- `src/pages/SearchPage.tsx` - Integration with callbacks

### Summary of Parallel Cabin Search Implementation

**Status:** Infrastructure 100% Complete, UI Integration 70% Complete

**What's Working:**
- ✅ Parallel search engine fully implemented and tested
- ✅ 4 concurrent API calls (one per cabin class)
- ✅ Automatic deduplication and merging by flight signature
- ✅ Type-safe cabin pricing data structure
- ✅ SearchPage integrated with feature flag
- ✅ Streaming and progress tracking support
- ✅ CabinSelector UI component ready

**What's Left:**
- ⏸️ Add CabinSelector to FlightCard (5-10 lines of integration code)
- ⏸️ Enable feature flag for production testing
- ⏸️ End-to-end testing with real searches

**How to Enable:**
1. Open `src/pages/SearchPage.tsx`
2. Change line 19: `const ENABLE_PARALLEL_CABIN_SEARCH = true;`
3. Test search functionality thoroughly
4. Monitor API performance (4x requests per search)

**Architecture Benefits:**
- Users see all cabin options without re-searching
- Faster cabin comparison (no new API calls)
- Award data can be fetched per unique flight (not per cabin)
- Better UX: instant cabin switching with price updates

### New Architecture Overview

**Old Model (v1.0):**
- Flights grouped by airline
- Top 5 flights get award enrichment
- Cabin/booking class visible in main form
- Default: 25 results, nonstop only

**New Model (v2.0):**
- Flight-centric display (each flight is independent record)
- Award enrichment for all unique flights (batched, view-first)
- Award availability shown as primary UI element (opal wrapper)
- Code-share hierarchy: Award → Parent Flight → Alliance Flights
- Per-flight cabin selection buttons
- Global Best (fastest) vs Cheap (cheapest) tabs
- 4 parallel searches per query (one per cabin class)
- Default: 300 results, all connections allowed

### Breaking Changes

**Display Logic:**
- Airline grouping removed
- FlightCardGroup component deprecated (will become legacy)
- New hierarchy: Award wrapper → Code-share parent → Alternatives

**Search Behavior:**
- Always searches 4 cabin classes in parallel
- Results merge and update existing flights
- Cabin selection in UI filters displayed results, doesn't trigger new search

**Award System:**
- Persistent across tab switches and page actions
- Background processing with progress indication
- View-first priority (visible flights enriched first)
- Batch processing (2 flights at a time)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Core Features](#core-features)
4. [User Interface Components](#user-interface-components)
5. [Search System](#search-system)
6. [Flight Display & Grouping](#flight-display--grouping)
7. [Advanced Features](#advanced-features)
8. [Proposal Management](#proposal-management)
9. [Client Management](#client-management)
10. [Itinerary Builder](#itinerary-builder)
11. [Database Schema](#database-schema)
12. [API Integration](#api-integration)
13. [Theme System](#theme-system)
14. [Authentication & Authorization](#authentication--authorization)
15. [Modal Components](#modal-components)
16. [Technical Stack](#technical-stack)

---

## Executive Summary

**Biirdee Pro** is an advanced flight search and proposal management system designed for travel professionals to find complex flight itineraries using premium routing strategies. The platform enables agents to:

- Search for flights using advanced techniques (hidden city ticketing, fake round trips, skiplag)
- Compare award flights and cash fares
- Build comprehensive client proposals with multiple flight options
- Manage client relationships and travel itineraries
- Generate shareable proposal links for client review

### Key Value Propositions

1. **Hidden Savings Discovery** - Find premium cabin flights at economy prices using routing strategies
2. **Mileage Optimization** - Calculate and display mileage prices for award bookings across multiple programs
3. **Professional Proposals** - Create polished, shareable travel proposals with multiple flight options
4. **Client Management** - Track client preferences, bookings, and travel history
5. **Real-time Search** - Stream results as they arrive for instant feedback

---

## System Architecture

### Application Type
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5
- **Routing:** React Router v7
- **State Management:** React Context API
- **Styling:** Tailwind CSS with custom design system
- **Database:** Supabase (PostgreSQL with RLS)
- **Authentication:** Supabase Auth (Google OAuth)

### Project Structure

```
/src
  /components         # Reusable UI components
    /hacks           # Hack-specific components (FRT, Skiplag)
  /contexts          # React context providers
  /hooks             # Custom React hooks
  /lib               # Third-party library configurations
  /pages             # Route-level page components
  /services          # API service layers
  /types             # TypeScript type definitions
  /utils             # Utility functions and helpers
/supabase
  /functions         # Edge functions
  /migrations        # Database migrations
/public              # Static assets
```

### Key Dependencies

- **@supabase/supabase-js** - Database and auth client
- **lucide-react** - Icon library
- **react-router-dom** - Client-side routing
- **tailwindcss** - Utility-first CSS framework

---

## Core Features

### 1. Flight Search

The flight search system is the core of Biirdee Pro, allowing users to search for flights with granular control over:

- **Trip Types:** One-way, Round-trip, Multi-city
- **Passenger Count:** 1-9 passengers
- **Cabin Class:** Economy, Premium Economy, Business, First
- **Booking Classes:** Specific fare codes (J, C, D, etc.)
- **Stops:** Nonstop, 1-stop, 2-stop, unlimited
- **Search Strategies:** Aero enrichment, Award search, FRT (Fake Round Trip)

### 2. Advanced Routing Strategies

#### Skiplag (Hidden City Ticketing)
- Search for flights with layovers at desired destination
- Save by booking through destination instead of to it
- Multiple via points supported per leg

#### Fake Round Trip (FRT)
- Search for one-way flights priced as round trips
- Auto-generate return legs to major hubs
- Configurable return date range and destinations
- Can save 30-50% on international premium cabins

#### Multiple Origin/Destination Search
- Search from multiple departure airports simultaneously
- Search to multiple arrival airports
- Find best price across airport combinations

### 3. Award Flight Integration

The system enriches cash flight results with award pricing:

- **Mileage Calculation:** Real-time mileage distance calculation
- **Program Pricing:** Multiple frequent flyer program pricing
- **Per Cent Value:** Calculates cents per mile value
- **Match Types:** Exact, partial, and approximate matches
- **Award Navigator:** Browse partner award charts interactively

### 4. Aero Enrichment

Aero is a premium data source that provides:

- Award availability across major programs
- Real-time seat inventory
- Award pricing in miles + cash
- Partner airline bookability
- Cabin-specific availability

### 5. Result Filtering & Sorting

**Filters:**
- Nonstop only
- Business class or higher
- Specific carriers
- Time of day (morning/afternoon/evening)
- Stop count (0, 1, 2, 3+)
- Search query (airline, flight number, airport)

**Sorting:**
- Price (ascending/descending)
- Duration (shortest/longest)
- Miles value (best/worst)

---

## User Interface Components

### Homepage

The landing page features:

- Hero section with animated background
- Quick search form
- Feature highlights
- Statistics display ($50K+ savings, 500+ routes, 98% success rate)
- Direct navigation to search

### Navigation Bar

Sticky navigation includes:

- Logo and branding
- Main navigation tabs:
  - Search (flight search)
  - Proposals (client proposals)
  - Clients (client management)
  - Itineraries (trip planning)
- Theme toggle (light/dark mode)
- User profile dropdown
- Admin-specific routes (for admin users)

### Search Form

The search form is the primary interface for flight searches.

**Layout Sections:**

1. **Top Controls Row**
   - Passengers (1-9)
   - Results per page (5-500)
   - Per Cent Value (mileage valuation)
   - Nonstop Only toggle
   - Aero Enabled toggle
   - Award Enabled toggle
   - FRT Enabled toggle
   - Advanced Options button

2. **Flight Legs Section**
   - Each leg contains:
     - Origins (multi-select with nearby airport search)
     - Destinations (multi-select with nearby airport search)
     - Swap button (reverses origin/destination)
     - Via/layover selector (for skiplag)
     - Departure date picker
     - Cabin class selector
     - Booking class selector

3. **Advanced Options Panel** (collapsed by default)
   - Date Type (depart/arrive)
   - Date Modifier (exact, ±1 day, ±2 days)
   - Preferred departure times
   - Max stops per leg
   - Extra stops
   - Allow airport changes
   - Show only available seats
   - Fetch ITA summary

4. **Global Configuration** (in advanced)
   - Page size/number
   - Sales city (pricing location)
   - Currency display

5. **Trip Type Display**
   - Shows "One Way", "Round Trip", or "Multi-City (n legs)"
   - Dynamically updates based on leg count

**Color System:**
- Accent color: Orange/Amber (#F59E0B range)
- Nonstop toggle: Accent
- Aero toggle: Accent
- Award toggle: Blue
- FRT toggle: Teal
- Skiplag badges: Purple
- FRT badges: Teal

---

## Search System

### Search Flow

1. **Form Submission**
   - User fills out search form
   - Parameters encoded to URL query string
   - Navigation to `/search` page

2. **Parameter Parsing**
   - URL params extracted and parsed
   - Multi-city slices constructed
   - Booking classes generated from selection
   - Default values applied where missing

3. **API Request**
   - BiirdeeService builds API request
   - Maps frontend types to API format
   - Sends request to backend
   - Handles both REST and streaming responses

4. **Result Processing**
   - Results streamed in real-time (if streaming enabled)
   - Flights parsed and validated
   - Grouping logic applied
   - Filters applied
   - Results displayed immediately

5. **Enrichment**
   - V2 enrichment triggered after initial results
   - Award data fetched for matching flights
   - Mileage deals calculated and attached
   - Results updated with enriched data

### Search Parameters

**Basic Parameters:**
- `tripType`: oneWay | roundTrip | multiCity
- `passengers`: 1-9
- `legCount`: number of flight legs
- `pageSize`: results per page
- `pageNum`: current page number

**Per-Leg Parameters:**
- `leg{n}_origins`: comma-separated airport codes
- `leg{n}_destinations`: comma-separated airport codes
- `leg{n}_departDate`: ISO date string
- `leg{n}_cabin`: COACH | PREMIUM-COACH | BUSINESS | FIRST
- `leg{n}_bookingClassSelection`: all | economy | premium | business | first | business_plus
- `leg{n}_ext`: booking class string (auto-generated if empty)
- `leg{n}_via`: comma-separated via airports (for skiplag)
- `leg{n}_nonstop`: boolean
- `leg{n}_departureDateType`: depart | arrive
- `leg{n}_departureDateModifier`: 0 | 1 | 10 | 11 | 2 | 22
- `leg{n}_departureDatePreferredTimes`: comma-separated time slots (0-5)
- `leg{n}_maxStops`: -1 | 0 | 1 | 2
- `leg{n}_extraStops`: -1 | 0 | 1 | 2
- `leg{n}_allowAirportChanges`: boolean
- `leg{n}_showOnlyAvailable`: boolean
- `leg{n}_fetchSummary`: boolean
- `leg{n}_aero`: boolean

**Global Parameters:**
- `all_nonstop`: boolean (apply to all legs)
- `all_aero`: boolean (apply to all legs)
- `all_aero_cabin`: boolean
- `sales_city`: airport code
- `currency`: currency code
- `award`: boolean (enable award search)
- `frt`: boolean (enable FRT)

### Caching

Flight results are cached using a cache key based on:
- Search parameters
- Timestamp (for cache expiration)
- User preferences

Cache is stored in memory and expires after a set duration.

---

## Flight Display & Grouping

### Result Grouping Strategy

Flights are grouped by:

1. **Primary Grouping** - Same outbound flight
   - Same flight numbers
   - Same departure/arrival times
   - Creates "Flight Groups" with return options

2. **Secondary Grouping** - Stop count
   - Nonstop flights displayed first
   - Then 1-stop
   - Then 2-stop
   - Then 3+ stops

3. **Tertiary Grouping** - Similar options
   - Same route, different cabin
   - Same route, different carrier (code-share)
   - Collapsed by default, expandable

### FlightCard Component

The FlightCard displays a single flight option with:

**Header Section:**
- Carrier logo and name
- Primary flight details
- Total price
- Per cent value badge
- Duration and stops

**Segments Display:**
- Each flight segment shown
- Departure/arrival times (in selected timezone)
- Airport codes
- Flight numbers
- Aircraft type
- Layover durations

**Action Buttons:**
- View Details (opens FlightSummaryModal)
- Add to Proposal (opens AddToProposalModal)
- FRT Options (if FRT enabled)
- Award Options (if award data available)

**Mileage Display:**
- Mileage deals shown as dropdown
- Program name, miles required, cash component
- Full/partial match indicators
- Expandable segment details

**Collapsible Sections:**
- Price Options (different return flights for round trips)
- Time Options (same flight, different times)
- FRT Options (fake round trip combinations)
- Award Options (award availability)
- Segments (detailed segment breakdown)
- Code-share Options (alternative carriers for same flight)

### FlightCardGroup Component

Groups multiple FlightCards with:
- Shared outbound flight
- Multiple return options
- Carrier identification
- Nonstop indicator
- Expandable return options

### Multi-Leg FlightCard

For multi-city searches:
- Displays all legs in sequence
- Shows connections and layovers
- Total journey price and duration
- Per-leg details available

---

## Advanced Features

### 1. V2 Enrichment System

**Purpose:** Fetch additional award data after initial search results

**Workflow:**
1. Initial search returns cash fares
2. System identifies carrier codes in results
3. Triggers enrichment request per carrier
4. Enrichment data streamed back
5. Results updated with mileage deals

**Data Provided:**
- Award availability
- Mileage pricing across programs
- Seat availability
- Booking class availability
- Partner airline options

**Display:**
- V2EnrichmentViewer component shows raw data
- MileageSelector shows program-specific pricing
- MileageSegmentTooltip shows segment details

### 2. Award Navigator

**Purpose:** Interactive award chart browser

**Features:**
- Browse by airline program
- Filter by region and class
- See mileage requirements
- Partner airline availability
- Direct booking links

### 3. Fake Round Trip (FRT) System

**Purpose:** Find cheaper one-way fares disguised as round trips

**Configuration Modal:**
- Return date range (flexible)
- Return destinations (multiple hubs)
- Cabin class for return
- Auto-trigger for top N results

**Processing:**
1. Original one-way search executed
2. FRT system generates return legs
3. Return searches executed in background
4. Round-trip prices compared to one-way
5. Savings calculated and displayed

**Display:**
- FRT badge on qualifying flights
- FRT options dropdown
- Savings percentage highlighted
- Return flight details shown

### 4. Nearby Airport Search

**Purpose:** Search multiple airports near origin/destination

**Features:**
- Distance-based search (radius)
- Major airports only toggle
- Country/region filter
- Quick-add to search form

**Modal Interface:**
- Map view (future enhancement)
- List view with distances
- Airport codes and names
- Direct selection to form

### 5. Skiplag (Hidden City Ticketing)

**Purpose:** Book through destination to save money

**How it Works:**
- Search includes via/layover airports
- System finds flights connecting through desired city
- User books full itinerary but deplanes at layover

**Implementation:**
- Via selector in search form
- Multiple via points per leg
- Purple badge indicates skiplag
- Via airport codes displayed on flight card

**Warnings:**
- Checked bags not possible
- Risk of missed connections
- Airline policy violations

---

## Proposal Management

### Proposal System Overview

Proposals are collections of flight options presented to clients for decision-making.

### Proposal Structure

**Proposal Entity:**
- Name (auto-generated or custom)
- Client information (name, email)
- Agent notes (private)
- Status (draft, sent, accepted, rejected)
- Total price (auto-calculated)
- Share link (unique, shareable URL)
- Created/updated timestamps

**Proposal Options (Flight Choices):**
- Flight data (complete JSON)
- Selected price (agent can adjust)
- Option number (display order)
- Is hidden (hide from client view)
- Agent notes (per-option)

### Proposal Workflows

#### Creating a Proposal

1. Navigate to Proposals page
2. Click "New Proposal"
3. Enter client information:
   - First name
   - Last name
   - Email address
   - Agent notes
4. System generates default name
5. Proposal created with unique share link

#### Adding Flight Options

1. Search for flights
2. Click "Add to Proposal" on desired flight
3. Select existing proposal or create new
4. Flight data stored as JSON
5. Price auto-populated (agent can edit)
6. Option added to proposal

#### Managing Options

- Reorder options (drag and drop)
- Hide/show options from client view
- Edit agent notes
- Adjust pricing
- Delete options
- Preview client view

#### Sending Proposal

1. Review all options
2. Confirm pricing
3. Set status to "Sent"
4. Share link with client via email/message
5. Client views via public link (no login required)

#### Client View

- Clean, professional layout
- Flight options with details
- Pricing clearly displayed
- No agent notes visible
- No hidden options shown
- Accept/reject capability (future)

### Proposal Database Schema

**proposals table:**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- name (text)
- first_name (text) [deprecated, use proposal_clients]
- last_name (text) [deprecated, use proposal_clients]
- email (text) [deprecated, use proposal_clients]
- notes (text)
- total_price (numeric)
- status (text: draft | sent | accepted | rejected)
- share_link (text, unique)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**proposal_options table:**
```sql
- id (uuid, primary key)
- proposal_id (uuid, foreign key to proposals)
- flight_data (jsonb)
- is_hidden (boolean)
- agent_notes (text)
- selected_price (numeric)
- option_number (integer)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**proposal_clients table:** (junction table for multi-client support)
```sql
- id (uuid, primary key)
- proposal_id (uuid, foreign key to proposals)
- client_id (uuid, foreign key to clients)
- is_primary (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Automatic Calculations

**Total Price Trigger:**
- Updates proposal.total_price when options change
- Sum of all non-hidden option prices
- Automatically maintains accuracy

**Default Name Generation:**
- Format: "Proposal for {First} {Last} - {Date}"
- Example: "Proposal for John Smith - Dec 19, 2025"
- Can be overridden by agent

---

## Client Management

### Client System Overview

The client system tracks customer information and relationships for proposal and itinerary management.

### Client Structure

**Client Entity:**
- First name
- Last name
- Email address
- Phone number (optional)
- Notes (agent notes)
- Created/updated timestamps
- User ID (owning agent)

### Client Features

#### Client Directory

- Searchable list of all clients
- Filter by name, email
- Sort by recent activity
- Quick access to client details

#### Client Details Page

- Contact information
- Associated proposals
- Associated itineraries
- Travel history
- Notes and preferences

#### Client-Proposal Association

- One proposal can have multiple clients
- One client can be on multiple proposals
- Primary client designation
- Junction table for many-to-many relationship

#### Admin Access

- Admin users see all clients across all agents
- Regular users see only their clients
- Row-level security enforced

### Client Database Schema

**clients table:**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- first_name (text)
- last_name (text)
- email (text)
- phone (text, optional)
- notes (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**proposal_clients table:**
```sql
- id (uuid, primary key)
- proposal_id (uuid, foreign key to proposals)
- client_id (uuid, foreign key to clients)
- is_primary (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
- UNIQUE(proposal_id, client_id)
```

---

## Itinerary Builder

### Itinerary System Overview

Itineraries are complete trip plans with flights, hotels, activities, and notes.

### Itinerary Structure

**Itinerary Entity:**
- Title
- Start date
- End date
- Description
- Share link (unique, shareable URL)
- Status (planning, booked, completed, cancelled)
- Created/updated timestamps

**Itinerary Items:**
- Type (flight, hotel, activity, transport, note)
- Date/time
- Title/description
- Details (JSON with type-specific data)
- Order/sequence

**Itinerary Clients:**
- Associated clients (many-to-many)
- Primary client designation

### Itinerary Features

#### Builder Interface

- Timeline view of trip
- Drag-and-drop reordering
- Add flights directly from search
- Add hotels, activities manually
- Attach files/documents
- Add notes and instructions

#### Airtable Integration

**Purpose:** Import bookings from Airtable

**Features:**
- Search Airtable records
- Filter by client, date, route
- Import booking details
- Auto-create itinerary items
- Sync updates (optional)

**Edge Function:**
- `fetch-airtable-bookings` function
- Queries Airtable API
- Returns formatted booking data
- Handles authentication

#### Client Sharing

- Unique shareable link
- Public view (no login required)
- Clean, printable format
- Timeline view
- Booking confirmations
- Contact information

### Itinerary Database Schema

**itineraries table:**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- title (text)
- start_date (date)
- end_date (date)
- description (text)
- share_link (text, unique)
- status (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**itinerary_items table:**
```sql
- id (uuid, primary key)
- itinerary_id (uuid, foreign key to itineraries)
- type (text: flight | hotel | activity | transport | note)
- date (date)
- time (time, optional)
- title (text)
- description (text)
- details (jsonb)
- order_index (integer)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**itinerary_clients table:**
```sql
- id (uuid, primary key)
- itinerary_id (uuid, foreign key to itineraries)
- client_id (uuid, foreign key to clients)
- is_primary (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
- UNIQUE(itinerary_id, client_id)
```

---

## Database Schema

### Core Tables

#### profiles
User profile information and preferences.

```sql
- id (uuid, primary key, references auth.users)
- email (text, unique)
- full_name (text)
- avatar_url (text)
- role (text: user | admin)
- preferences (jsonb)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### proposals
Client flight proposals.

```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- name (text)
- first_name (text)
- last_name (text)
- email (text)
- notes (text)
- total_price (numeric)
- status (text: draft | sent | accepted | rejected)
- share_link (text, unique)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### proposal_options
Individual flight options within proposals.

```sql
- id (uuid, primary key)
- proposal_id (uuid, foreign key to proposals)
- flight_data (jsonb)
- is_hidden (boolean)
- agent_notes (text)
- selected_price (numeric)
- option_number (integer)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### clients
Client contact information.

```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- first_name (text)
- last_name (text)
- email (text)
- phone (text)
- notes (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### proposal_clients
Junction table for proposal-client relationships.

```sql
- id (uuid, primary key)
- proposal_id (uuid, foreign key to proposals)
- client_id (uuid, foreign key to clients)
- is_primary (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
- UNIQUE(proposal_id, client_id)
```

#### itineraries
Complete trip itineraries.

```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- title (text)
- start_date (date)
- end_date (date)
- description (text)
- share_link (text, unique)
- status (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### itinerary_items
Individual items in itineraries.

```sql
- id (uuid, primary key)
- itinerary_id (uuid, foreign key to itineraries)
- type (text)
- date (date)
- time (time)
- title (text)
- description (text)
- details (jsonb)
- order_index (integer)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### itinerary_clients
Junction table for itinerary-client relationships.

```sql
- id (uuid, primary key)
- itinerary_id (uuid, foreign key to itineraries)
- client_id (uuid, foreign key to clients)
- is_primary (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
- UNIQUE(itinerary_id, client_id)
```

#### route_configs
Saved route configurations for admin.

```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- name (text)
- description (text)
- config_data (jsonb)
- is_active (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Security (Row Level Security)

All tables have RLS enabled with policies:

**User Policies:**
- Users can read/write their own data
- Users cannot access other users' data

**Admin Policies:**
- Admin role can read/write all data
- Determined by `is_admin_user()` function

**Public Policies:**
- Proposals accessible via share_link (anon)
- Itineraries accessible via share_link (anon)
- Only non-hidden data visible to public

### Database Functions

#### is_admin_user()
Returns true if current user has admin role.

#### generate_share_link()
Creates unique shareable link for proposals/itineraries.

#### generate_default_proposal_name()
Creates formatted proposal name.

#### calculate_proposal_total()
Sums non-hidden option prices.

#### update_updated_at_column()
Trigger function to update timestamps.

#### update_proposal_total()
Trigger to recalculate proposal total on option changes.

---

## API Integration

### Backend API

**Base URL:**
```
Production: https://nodejs-production-ae342.up.railway.app
Environment Variable: VITE_BACKEND_URL
```

### BiirdeeService

Main API service for flight searches.

**Endpoint:**
```
POST /api/v3/flights/ita-matrix
```

**Request Format:**
```typescript
{
  type: 'one-way' | 'round-trip' | 'multi-city',
  slices: [
    {
      origin: string[],
      dest: string[],
      routing: string,
      ext: string,
      routingRet: string,
      extRet: string,
      dates: {
        searchDateType: 'specific',
        departureDate: string,
        departureDateType: 'depart' | 'arrive',
        departureDateModifier: string,
        departureDatePreferredTimes: number[],
        returnDate: string,
        returnDateType: 'depart' | 'arrive',
        returnDateModifier: string,
        returnDatePreferredTimes: number[]
      }
    }
  ],
  options: {
    cabin: string,
    stops: string,
    extraStops: string,
    allowAirportChanges: string,
    showOnlyAvailable: string,
    pageSize: number,
    currency: { displayName: string, code: string },
    salesCity: { code: string, name: string }
  },
  pax: {
    adults: string,
    seniors: string,
    youth: string,
    children: string,
    infantsInLap: string,
    infantsInSeat: string
  }
}
```

**Response Format:**
```typescript
{
  solutionList: {
    solutions: FlightSolution[]
  },
  session: string,
  solutionSet: string,
  solutionCount: number,
  pagination: {
    current: number,
    count: number
  }
}
```

### ITAMatrixService

Service for ITA Matrix specific functions.

**Methods:**
- `enrichFlight()` - Fetch award data for flight
- `loadNextPage()` - Load additional results page
- `buildMatrixUrl()` - Generate ITA Matrix search URL

### Streaming API

For real-time result streaming:

**Format:** NDJSON (Newline Delimited JSON)

**Stream Events:**
- `data` - New flight result
- `error` - Error message
- `complete` - Search complete

**Processing:**
- Results displayed as they arrive
- Progress indicator shows completion
- Final count displayed when complete

### Cache Service

**Purpose:** Cache search results to avoid duplicate requests

**Implementation:**
- In-memory Map storage
- Key based on search parameters
- TTL-based expiration
- LRU eviction strategy

**Methods:**
- `get(key)` - Retrieve cached result
- `set(key, value)` - Store result
- `has(key)` - Check if key exists
- `clear()` - Clear all cache

---

## Theme System

### Theme Context

Manages light/dark mode preference.

**Stored in:** `localStorage` under key `theme`

**Default:** `dark`

**Classes:**
- Light mode: `light` class on `<html>`
- Dark mode: `dark` class on `<html>`

### Theme Toggle

**Location:** Navigation bar

**Icon:**
- Light mode: Moon icon
- Dark mode: Sun icon

**Behavior:**
- Click to toggle
- Persists to localStorage
- Applies immediately

### Color System

**Tailwind Configuration:**

**Accent Colors:**
- Primary: Orange/Amber (#F59E0B)
- Shades: 50-950

**Background Colors:**
- Light: gray-50, gray-100
- Dark: gray-900, gray-950

**Text Colors:**
- Light: gray-600 to gray-900
- Dark: gray-100 to gray-400

**Border Colors:**
- Light: gray-200, gray-300
- Dark: gray-700, gray-800

### Component Theming

All components use Tailwind's `dark:` prefix:

```tsx
className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
```

**Form Elements:**
- Inputs: White bg in light, gray-800 in dark
- Borders: gray-300 in light, gray-700 in dark
- Focus: Accent color in both modes

**Cards:**
- Light: White with subtle shadows
- Dark: gray-800/900 with borders

**Modals:**
- Light: White with gray-200 borders
- Dark: gray-800 with gray-700 borders

---

## Authentication & Authorization

### Authentication System

**Provider:** Supabase Auth

**Method:** Google OAuth

**Flow:**
1. User clicks "Sign in with Google"
2. Redirected to Google consent screen
3. Google returns with auth token
4. Supabase creates/updates user session
5. User profile created if new user
6. Redirect to home page

### User Profiles

**Creation:**
- Auto-created on first sign in
- Email, name from Google profile
- Default role: "user"
- Avatar URL stored

**Fields:**
- id (references auth.users)
- email
- full_name
- avatar_url
- role (user | admin)
- preferences (jsonb)

### Authorization

**Roles:**
- **user** - Standard agent access
- **admin** - Full system access

**Permissions:**

**User:**
- View own proposals, clients, itineraries
- Create/edit own data
- Cannot see other users' data

**Admin:**
- View all users' data
- Access admin routes
- Manage route configs
- System-wide visibility

**RLS Policies:**
- Enforced at database level
- Cannot be bypassed by frontend
- Uses `auth.uid()` for user identification
- Uses `is_admin_user()` for admin checks

### Protected Routes

**Implementation:**
- `useAuth()` hook checks authentication
- Redirect to `/sign-in` if not authenticated
- Component level protection
- No server-side rendering

**Protected Pages:**
- `/` (HomePage)
- `/search` (SearchPage)
- `/proposals` (ProposalsPage)
- `/clients` (ClientsPage)
- `/itineraries` (ItinerariesPage)
- `/profile` (ProfilePage)
- `/admin/*` (Admin routes - requires admin role)

**Public Pages:**
- `/sign-in` (SignInPage)
- `/proposal/:shareLink` (PublicProposalPage)
- `/itinerary/:shareLink` (PublicItineraryPage)

---

## Modal Components

### AddToProposalModal

**Purpose:** Add flight to existing or new proposal

**Trigger:** "Add to Proposal" button on flight card

**Features:**
- Select existing proposal
- Create new proposal inline
- Adjust price before adding
- Add agent notes
- Confirmation feedback

**Fields:**
- Proposal selection dropdown
- Client name (if new)
- Client email (if new)
- Selected price (editable)
- Agent notes

### FlightSummaryModal

**Purpose:** Detailed view of flight segments

**Trigger:** "View Details" button on flight card

**Features:**
- Full segment breakdown
- Aircraft information
- Booking class details
- Mileage breakdown
- Layover durations
- Timezone-aware times
- Copy ITA Matrix URL
- Add to proposal

### FrtConfigModal

**Purpose:** Configure Fake Round Trip search

**Trigger:** FRT toggle + Advanced button

**Features:**
- Return date range selection
- Return destination selection
- Return cabin class
- Auto-trigger toggle
- Number of results to auto-trigger

**Default Destinations:**
- Major hubs (LAX, JFK, LHR, DXB, etc.)
- Customizable per search

### FakeRoundTripModal

**Purpose:** View FRT search results for a flight

**Trigger:** "FRT Options" button on flight card

**Features:**
- Original one-way price
- Round-trip prices found
- Savings calculation
- Return flight details
- Sort by savings/price
- Add round-trip to proposal

### MileageDealModal

**Purpose:** Detailed view of award availability

**Trigger:** Click on mileage deal in dropdown

**Features:**
- Program details
- Miles + cash required
- Segment-by-segment availability
- Booking class shown
- Match type indicators
- Partner airline info

### NearbyAirportModal

**Purpose:** Search and select nearby airports

**Trigger:** Binoculars icon on origin/destination

**Features:**
- Search by airport code/city
- Distance from selected airport
- Filter by major airports only
- Add single or multiple airports
- Direct to search form

### ClientSelectionDropdown

**Purpose:** Quick client selection for proposals

**Trigger:** Creating/editing proposal

**Features:**
- Search existing clients
- Create new client inline
- Multi-select for multiple clients
- Primary client designation

---

## Technical Stack

### Frontend Technologies

**Core:**
- React 18.3.1
- TypeScript 5.5.3
- Vite 5.4.2

**Routing & State:**
- React Router DOM 7.9.2
- React Context API

**Styling:**
- Tailwind CSS 3.4.1
- PostCSS 8.4.35
- Autoprefixer 10.4.18

**Icons:**
- Lucide React 0.344.0

**Backend Integration:**
- Supabase JS 2.57.4

### Build System

**Development:**
```bash
npm run dev          # Start dev server
npm run dev:offline  # Start without API calls
```

**Production:**
```bash
npm run build   # Build for production
npm run preview # Preview production build
```

**Linting:**
```bash
npm run lint  # Run ESLint
```

### Environment Variables

Required variables in `.env`:

```env
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_BACKEND_URL=<backend-api-url>
```

Optional:
```env
VITE_AIRTABLE_TOKEN=<airtable-api-token>
```

### Deployment

**Frontend:**
- Hosted on Netlify
- Redirects configured in `public/_redirects`
- SPA routing handled

**Backend:**
- Hosted on Railway
- Node.js API server
- Handles ITA Matrix scraping

**Database:**
- Supabase (PostgreSQL)
- Row Level Security enabled
- Automatic backups

### Performance Optimizations

**Code Splitting:**
- Route-based splitting
- Lazy loading components
- Dynamic imports where beneficial

**Caching:**
- Search result caching
- Browser caching headers
- Service worker (future)

**Bundle Size:**
- Tree-shaking enabled
- Production minification
- Gzip compression

### Error Handling

**Error Boundary:**
- Catches React errors
- Displays friendly error message
- Refresh option provided

**API Errors:**
- Try-catch blocks
- User-friendly error messages
- Notification system for feedback

**Validation:**
- Form validation before submission
- Type checking with TypeScript
- Required field enforcement

---

## Development Guidelines

### Code Organization

**Component Structure:**
```tsx
// Imports
import React, { useState } from 'react';
import { IconName } from 'lucide-react';

// Types
interface ComponentProps {
  prop1: string;
  prop2?: number;
}

// Component
const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // State
  const [state, setState] = useState<Type>(initial);

  // Effects
  useEffect(() => {
    // effect logic
  }, [dependencies]);

  // Handlers
  const handleAction = () => {
    // handler logic
  };

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};

export default Component;
```

### Styling Conventions

**Tailwind Classes:**
- Use semantic naming
- Group related classes
- Order: layout → spacing → colors → effects
- Use `dark:` prefix for dark mode variants

**Example:**
```tsx
<div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
```

### State Management

**Local State:**
- Use `useState` for component-specific state
- Keep state close to where it's used

**Shared State:**
- Use Context for cross-component state
- Create dedicated context providers

**Server State:**
- Fetch in useEffect
- Handle loading/error states
- Cache where appropriate

### Type Safety

**Always Define Types:**
```typescript
interface FlightData {
  id: string;
  price: number;
  // ...
}
```

**Use Type Guards:**
```typescript
if (typeof data === 'object' && data !== null) {
  // safe to access
}
```

**Avoid `any`:**
- Use `unknown` if type is truly unknown
- Define proper types/interfaces

### API Calls

**Service Pattern:**
```typescript
class ServiceName {
  private static instance: ServiceName;
  private baseUrl = 'https://...';

  static getInstance(): ServiceName {
    if (!ServiceName.instance) {
      ServiceName.instance = new ServiceName();
    }
    return ServiceName.instance;
  }

  async fetchData(params: Params): Promise<Response> {
    // API call logic
  }
}
```

### Testing Approach

**Manual Testing:**
- Test all user flows
- Test edge cases
- Test error scenarios
- Test across devices/browsers

**Future Automated Testing:**
- Unit tests for utilities
- Integration tests for API calls
- E2E tests for critical flows

---

## Glossary

**Terms:**

- **Aero** - Premium award data provider
- **Award Flight** - Flight booked with frequent flyer miles
- **Booking Class** - Fare code letter (J, C, D, etc.)
- **Cabin** - Seat section (Economy, Business, First)
- **CPM** - Cents Per Mile (mileage valuation)
- **ext** - ITA Matrix booking class string
- **FRT** - Fake Round Trip strategy
- **Hidden City** - Skiplag ticketing strategy
- **ITA Matrix** - Flight search engine (Google Flights backend)
- **Leg** - One segment of a multi-city trip
- **Mileage Deal** - Award pricing for a route
- **Nonstop** - Direct flight, no stops
- **RLS** - Row Level Security (database)
- **routing** - ITA Matrix routing code
- **Sales City** - Pricing location for fares
- **Segment** - Individual flight within a slice
- **Skiplag** - Hidden city ticketing
- **Slice** - Collection of segments forming one direction
- **via** - Intermediate airport (for skiplag)

---

## Appendices

### A. Booking Class Codes

**First Class:**
- F - Full-fare First
- A - Discounted First
- P - Award/Promo First

**Business Class:**
- J - Full-fare Business
- C - Full-fare Business
- D - Discounted Business
- I - Discounted Business
- Z - Award Business

**Premium Economy:**
- W - Full-fare Premium Economy
- R - Discounted Premium Economy
- G - Discounted Premium Economy
- P - Premium Economy (some carriers)

**Economy:**
- Y - Full-fare Economy
- B - Discounted Economy
- M - Discounted Economy
- H - Discounted Economy
- Q - Discounted Economy
- K - Discounted Economy
- L - Discounted Economy
- V - Discounted Economy
- S - Discounted Economy
- N - Discounted Economy
- T - Discounted Economy
- E - Discounted Economy
- O - Discounted Economy

### B. Supported Currencies

The system supports all major world currencies including:
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- CAD (Canadian Dollar)
- AUD (Australian Dollar)
- And 150+ others

### C. Award Programs Supported

- Alaska Mileage Plan
- American AAdvantage
- United MileagePlus
- Delta SkyMiles
- British Airways Executive Club
- Air Canada Aeroplan
- Emirates Skywards
- And many more partner programs

### D. API Response Samples

See `/responses` folder in project root for:
- `api_response.json` - Standard search response
- `aero-sfo-dxb.ndjson` - Aero enrichment stream
- `stream_response.ndjson` - Streaming search results
- And more examples

---

## Maintenance & Support

### Logging

**Console Logs:**
- Prefixed with emoji for easy filtering
- 🏠 - Component lifecycle
- 🔧 - API/service calls
- 🔍 - Search operations
- 📊 - Data processing
- 🔄 - State updates
- ⚠️ - Warnings
- ❌ - Errors

**Log Levels:**
- Development: All logs enabled
- Production: Errors only (configure as needed)

### Common Issues

**Issue: Search returns no results**
- Check backend API connectivity
- Verify search parameters
- Check console for API errors
- Try simpler search (one-way, nonstop)

**Issue: Authentication fails**
- Check Supabase configuration
- Verify env variables
- Clear browser cache/cookies
- Try incognito mode

**Issue: Proposal not saving**
- Check database connectivity
- Verify user permissions
- Check console for RLS errors
- Ensure required fields filled

### Future Enhancements

**Planned Features:**
- Map view for nearby airports
- Automated proposal email sending
- Client portal for booking management
- Payment processing integration
- Calendar integration for itineraries
- Mobile app (React Native)
- Price alerts and tracking
- Historical price analysis
- AI-powered recommendations

---

**End of Knowledge Base**

*Last Updated: December 19, 2025*
*Version: 1.0*

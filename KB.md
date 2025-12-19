# Biirdee Pro - Knowledge Base

**Version:** 1.0
**Last Updated:** December 2025
**Type:** Vite/React Frontend Application

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

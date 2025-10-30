# Biirdee Pro

Advanced flight search and proposal management platform.

## Development Setup

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Set to 'true' to bypass authentication for development
VITE_DISABLE_AUTH=false
```

### Development Mode (Auth Bypass)

To enable development mode and bypass Google authentication:

1. Set `VITE_DISABLE_AUTH=true` in your `.env` file
2. Restart your dev server
3. You'll be automatically logged in as a mock admin user

**Features in dev mode:**
- No Google sign-in required
- Automatic admin access
- Yellow "DEV" badge in navigation
- Full access to all pages including `/search` and proposals

**To disable dev mode:**
- Set `VITE_DISABLE_AUTH=false` in your `.env` file
- Restart your dev server
- Normal Google authentication will be required

### Running the App

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Authentication

By default, the app requires Google authentication with `@biirdee.com` email addresses.

In production, always ensure `VITE_DISABLE_AUTH` is set to `false` or removed entirely.

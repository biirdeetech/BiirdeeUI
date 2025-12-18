import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log({supabaseUrl,supabaseAnonKey})

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.warn('Storage quota exceeded, clearing old data:', error);
          // Clear some old storage data if quota is exceeded
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const storageKey = localStorage.key(i);
              if (storageKey && storageKey.startsWith('sb-')) {
                localStorage.removeItem(storageKey);
                break;
              }
            }
            localStorage.setItem(key, value);
          } catch {
            // If still failing, use session storage as fallback
            sessionStorage.setItem(key, value);
          }
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
          // Also try to remove from session storage in case it was stored there
          sessionStorage.removeItem(key);
        } catch {
          sessionStorage.removeItem(key);
        }
      }
    }
  }
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          company: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string;
          company?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
          company?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      proposals: {
        Row: {
          id: string;
          user_id: string;
          client_id: string | null;
          name: string;
          first_name: string | null; // Legacy field, will be removed
          last_name: string | null;  // Legacy field, will be removed
          email: string | null;      // Legacy field, will be removed
          notes: string;
          total_price: number;
          status: 'draft' | 'sent' | 'accepted' | 'rejected';
          share_link: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id?: string | null;
          name?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          notes?: string;
          total_price?: number;
          status?: 'draft' | 'sent' | 'accepted' | 'rejected';
          share_link?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string | null;
          name?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          notes?: string;
          total_price?: number;
          status?: 'draft' | 'sent' | 'accepted' | 'rejected';
          share_link?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      proposal_clients: {
        Row: {
          id: string;
          proposal_id: string;
          client_id: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          client_id: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          client_id?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      proposal_options: {
        Row: {
          id: string;
          proposal_id: string;
          flight_data: any; // JSONB can contain FlightSolution or GroupedFlight
          is_hidden: boolean;
          agent_notes: string;
          selected_price: number;
          option_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          flight_data: any;
          is_hidden?: boolean;
          agent_notes?: string;
          selected_price: number;
          option_number?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          flight_data?: any;
          is_hidden?: boolean;
          agent_notes?: string;
          selected_price?: number;
          option_number?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    itinerary_clients: {
      Row: {
        id: string;
        itinerary_id: string;
        client_id: string;
        is_primary: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        itinerary_id: string;
        client_id: string;
        is_primary?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: string;
        itinerary_id?: string;
        client_id?: string;
        is_primary?: boolean;
        created_at?: string;
        updated_at?: string;
      };
    };
  };
};
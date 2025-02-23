import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Get environment variables with fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Ensure URL is valid
try {
  new URL(supabaseUrl);
} catch (e) {
  throw new Error(`Invalid Supabase URL: ${supabaseUrl}`);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
    redirectTo: window.location.origin
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    },
    heartbeat: {
      interval: 5000,
      maxRetries: 10
    },
    reconnectAfterMs: (retryCount) => {
      // Exponential backoff
      return Math.min(1000 * Math.pow(2, retryCount), 30000);
    }
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
});

// Add connection health check
let isConnected = false;
let realtimeHealthCheck: ReturnType<typeof setInterval>;

const checkRealtimeHealth = async () => {
  try {
    const channel = supabase.channel('system');
    const status = await channel.subscribe((status) => {
      isConnected = status === 'SUBSCRIBED';
      if (!isConnected) {
        console.warn('Realtime connection lost, attempting to reconnect...');
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
    });
    
    return status === 'SUBSCRIBED';
  } catch (err) {
    console.error('Error checking realtime health:', err);
    return false;
  }
};

// Initialize health check
checkRealtimeHealth();

// Set up periodic health check
realtimeHealthCheck = setInterval(checkRealtimeHealth, 30000);

// Cleanup function
export const cleanup = () => {
  if (realtimeHealthCheck) {
    clearInterval(realtimeHealthCheck);
  }
  
  // Remove all channels
  const channels = supabase.getChannels();
  channels.forEach(channel => {
    supabase.removeChannel(channel);
  });
};

// Retry logic for failed requests
export const retryOperation = async (
  operation: () => Promise<any>,
  maxRetries = 3,
  delay = 1000
): Promise<any> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      await checkRealtimeHealth();
    }
  }
};

// Handle sign out with cleanup
export const signOut = async () => {
  try {
    cleanup();

    // Clear local storage
    const storageKey = supabase.auth.storageKey;
    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear any remaining auth data
    window.localStorage.removeItem('supabase.auth.token');
    window.localStorage.removeItem('supabase.auth.refreshToken');

    // Redirect to home page
    window.location.href = '/';

    return { error: null };
  } catch (error) {
    console.error('Error during sign out:', error);
    return { error };
  }
};
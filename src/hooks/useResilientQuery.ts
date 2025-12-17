import { useState, useEffect, useRef, useCallback } from 'react';

interface ResilientQueryOptions<T> {
  queryFn: () => Promise<T>;
  fallbackData?: T;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  enabled?: boolean;
  refetchInterval?: number;
  onError?: (error: Error) => void;
  // Key that triggers refetch when changed (similar to React Query's queryKey)
  queryKey?: string;
}

interface ResilientQueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
}

/**
 * A resilient query hook that handles:
 * - Automatic retries with exponential backoff
 * - Timeout protection
 * - Stale data fallback
 * - Graceful error handling
 * - Proper cleanup to prevent memory leaks
 */
export function useResilientQuery<T>({
  queryFn,
  fallbackData,
  retryCount = 3,
  retryDelay = 1000,
  timeout = 10000,
  enabled = true,
  refetchInterval,
  onError,
  queryKey,
}: ResilientQueryOptions<T>): ResilientQueryResult<T> {
  const [data, setData] = useState<T | undefined>(fallbackData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  
  const isMountedRef = useRef(true);
  const lastSuccessfulDataRef = useRef<T | undefined>(fallbackData);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refetchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Stabilize callbacks using refs to prevent re-subscription issues
  const queryFnRef = useRef(queryFn);
  const onErrorRef = useRef(onError);
  const fallbackDataRef = useRef(fallbackData);
  
  // Update refs when props change (without triggering re-renders)
  useEffect(() => {
    queryFnRef.current = queryFn;
  }, [queryFn]);
  
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  
  useEffect(() => {
    fallbackDataRef.current = fallbackData;
  }, [fallbackData]);

  const executeQuery = useCallback(async (signal: AbortSignal, attempt = 0): Promise<T | undefined> => {
    // Create timeout that respects abort signal
    const timeoutId = setTimeout(() => {
      if (!signal.aborted) {
        abortControllerRef.current?.abort();
      }
    }, timeout);

    try {
      if (signal.aborted) {
        throw new Error('Query aborted');
      }
      
      const result = await queryFnRef.current();
      clearTimeout(timeoutId);
      
      if (signal.aborted) {
        throw new Error('Query aborted');
      }
      
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (signal.aborted) {
        throw new Error('Query aborted');
      }
      
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Retry with exponential backoff if not aborted
      if (attempt < retryCount && !signal.aborted) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve, reject) => {
          const delayTimeout = setTimeout(resolve, delay);
          // Listen for abort during delay
          signal.addEventListener('abort', () => {
            clearTimeout(delayTimeout);
            reject(new Error('Query aborted'));
          }, { once: true });
        });
        return executeQuery(signal, attempt + 1);
      }
      
      throw error;
    }
  }, [timeout, retryCount, retryDelay]);

  const refetch = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);

    try {
      const result = await executeQuery(abortControllerRef.current.signal);
      
      if (isMountedRef.current) {
        setData(result);
        lastSuccessfulDataRef.current = result;
        setIsStale(false);
        setLoading(false);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Don't update state for aborted queries
      if (error.message === 'Query aborted') return;
      
      if (isMountedRef.current) {
        setError(error);
        setLoading(false);
        
        // Use last successful data as fallback
        if (lastSuccessfulDataRef.current !== undefined) {
          setData(lastSuccessfulDataRef.current);
          setIsStale(true);
        } else if (fallbackDataRef.current !== undefined) {
          setData(fallbackDataRef.current);
          setIsStale(true);
        }
        
        onErrorRef.current?.(error);
      }
    }
  }, [executeQuery]);

  // Track previous queryKey to detect changes
  const prevQueryKeyRef = useRef(queryKey);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled) {
      refetch();
    } else {
      setLoading(false);
    }

    // Set up refetch interval if specified
    if (refetchInterval && enabled) {
      refetchIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          refetch();
        }
      }, refetchInterval);
    }

    return () => {
      isMountedRef.current = false;
      // Abort any in-flight requests
      abortControllerRef.current?.abort();
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
        refetchIntervalRef.current = null;
      }
    };
  }, [enabled, refetchInterval, refetch]);

  // Refetch when queryKey changes (but not on initial mount)
  useEffect(() => {
    if (prevQueryKeyRef.current !== queryKey && prevQueryKeyRef.current !== undefined) {
      // Invalidate cache and refetch
      refetch();
    }
    prevQueryKeyRef.current = queryKey;
  }, [queryKey, refetch]);

  return { data, loading, error, refetch, isStale };
}

/**
 * Wrapper for Supabase queries with built-in resilience
 */
export async function resilientSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: {
    retryCount?: number;
    retryDelay?: number;
    timeout?: number;
    signal?: AbortSignal;
  } = {}
): Promise<T | null> {
  const { retryCount = 3, retryDelay = 1000, timeout = 10000, signal } = options;

  const executeWithRetry = async (attempt = 0): Promise<T | null> => {
    if (signal?.aborted) return null;
    
    const timeoutId = setTimeout(() => {}, timeout);

    try {
      const { data, error } = await Promise.race([
        queryFn(),
        new Promise<never>((_, reject) => {
          const t = setTimeout(() => reject(new Error('Query timeout')), timeout);
          signal?.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new Error('Query aborted'));
          }, { once: true });
        })
      ]);
      
      clearTimeout(timeoutId);
      if (error) throw error;
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (signal?.aborted) return null;
      
      if (attempt < retryCount) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry(attempt + 1);
      }
      console.error('Resilient query failed after retries:', err);
      return null;
    }
  };

  return executeWithRetry();
}

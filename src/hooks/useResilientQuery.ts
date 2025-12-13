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
}: ResilientQueryOptions<T>): ResilientQueryResult<T> {
  const [data, setData] = useState<T | undefined>(fallbackData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const isMountedRef = useRef(true);
  const lastSuccessfulDataRef = useRef<T | undefined>(fallbackData);
  const refetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const executeQuery = useCallback(async (attempt = 0): Promise<T | undefined> => {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeout);
    });

    try {
      // Race between query and timeout
      const result = await Promise.race([queryFn(), timeoutPromise]);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Retry with exponential backoff
      if (attempt < retryCount) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeQuery(attempt + 1);
      }
      
      throw error;
    }
  }, [queryFn, timeout, retryCount, retryDelay]);

  const refetch = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setLoading(true);
    setError(null);

    try {
      const result = await executeQuery();
      
      if (isMountedRef.current) {
        setData(result);
        lastSuccessfulDataRef.current = result;
        setIsStale(false);
        setLoading(false);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      if (isMountedRef.current) {
        setError(error);
        setLoading(false);
        
        // Use last successful data as fallback
        if (lastSuccessfulDataRef.current !== undefined) {
          setData(lastSuccessfulDataRef.current);
          setIsStale(true);
        } else if (fallbackData !== undefined) {
          setData(fallbackData);
          setIsStale(true);
        }
        
        onError?.(error);
      }
    }
  }, [executeQuery, fallbackData, onError]);

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
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, [enabled, refetchInterval]); // Note: refetch is stable due to useCallback

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
  } = {}
): Promise<T | null> {
  const { retryCount = 3, retryDelay = 1000, timeout = 10000 } = options;

  const executeWithRetry = async (attempt = 0): Promise<T | null> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeout);
    });

    try {
      const { data, error } = await Promise.race([queryFn(), timeoutPromise]);
      
      if (error) throw error;
      return data;
    } catch (err) {
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

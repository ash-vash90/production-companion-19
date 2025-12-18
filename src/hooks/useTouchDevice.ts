/**
 * Touch Device Detection and Utilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Detect if device has touch capability
 */
export function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches
      );
    };

    checkTouch();

    // Re-check on resize (for devices that switch modes)
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  return isTouch;
}

/**
 * Detect device type (phone, tablet, desktop)
 */
export type DeviceType = 'phone' | 'tablet' | 'desktop';

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setDeviceType('phone');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return deviceType;
}

/**
 * Swipe gesture detection
 */
interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  swiping: boolean;
}

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeOptions {
  threshold?: number; // Minimum distance for swipe (default 50px)
  timeout?: number; // Max time for swipe gesture (default 300ms)
  preventScroll?: boolean; // Prevent default scroll behavior
}

export function useSwipeGesture(
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) {
  const { threshold = 50, timeout = 300, preventScroll = false } = options;
  const stateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    swiping: false,
  });
  const startTimeRef = useRef<number>(0);

  const onTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    const touch = e.touches[0];
    stateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      swiping: true,
    };
    startTimeRef.current = Date.now();
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!stateRef.current.swiping) return;

    const touch = e.touches[0];
    stateRef.current.currentX = touch.clientX;
    stateRef.current.currentY = touch.clientY;

    if (preventScroll) {
      const deltaX = Math.abs(touch.clientX - stateRef.current.startX);
      const deltaY = Math.abs(touch.clientY - stateRef.current.startY);
      // Only prevent scroll if horizontal swipe is dominant
      if (deltaX > deltaY && deltaX > 10) {
        e.preventDefault();
      }
    }
  }, [preventScroll]);

  const onTouchEnd = useCallback(() => {
    if (!stateRef.current.swiping) return;

    const { startX, startY, currentX, currentY } = stateRef.current;
    const elapsed = Date.now() - startTimeRef.current;

    stateRef.current.swiping = false;

    // Check if gesture was fast enough
    if (elapsed > timeout) return;

    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine swipe direction
    if (absX > absY && absX > threshold) {
      if (deltaX > 0) {
        handlers.onSwipeRight?.();
      } else {
        handlers.onSwipeLeft?.();
      }
    } else if (absY > absX && absY > threshold) {
      if (deltaY > 0) {
        handlers.onSwipeDown?.();
      } else {
        handlers.onSwipeUp?.();
      }
    }
  }, [handlers, threshold, timeout]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

/**
 * Pull-to-refresh functionality
 */
interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // Pull distance to trigger refresh (default 80px)
  resistance?: number; // Pull resistance factor (default 2.5)
}

interface PullToRefreshState {
  pulling: boolean;
  refreshing: boolean;
  pullDistance: number;
  canRefresh: boolean;
}

export function usePullToRefresh(options: PullToRefreshOptions) {
  const { onRefresh, threshold = 80, resistance = 2.5 } = options;
  const [state, setState] = useState<PullToRefreshState>({
    pulling: false,
    refreshing: false,
    pullDistance: 0,
    canRefresh: false,
  });

  const startYRef = useRef(0);
  const containerRef = useRef<HTMLElement | null>(null);

  const setContainerRef = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);

  const onTouchStart = useCallback((e: TouchEvent) => {
    // Only start pull if at top of scrollable container
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop > 0) return;

    startYRef.current = e.touches[0].clientY;
    setState(prev => ({ ...prev, pulling: true }));
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!state.pulling || state.refreshing) return;

    const currentY = e.touches[0].clientY;
    const rawDistance = currentY - startYRef.current;

    // Only allow pulling down
    if (rawDistance < 0) {
      setState(prev => ({ ...prev, pullDistance: 0, canRefresh: false }));
      return;
    }

    // Apply resistance
    const pullDistance = rawDistance / resistance;
    const canRefresh = pullDistance >= threshold;

    setState(prev => ({ ...prev, pullDistance, canRefresh }));

    // Prevent scroll while pulling
    if (pullDistance > 0) {
      e.preventDefault();
    }
  }, [state.pulling, state.refreshing, threshold, resistance]);

  const onTouchEnd = useCallback(async () => {
    if (!state.pulling) return;

    if (state.canRefresh && !state.refreshing) {
      setState(prev => ({ ...prev, refreshing: true, pulling: false }));

      try {
        await onRefresh();
      } finally {
        setState({
          pulling: false,
          refreshing: false,
          pullDistance: 0,
          canRefresh: false,
        });
      }
    } else {
      setState({
        pulling: false,
        refreshing: false,
        pullDistance: 0,
        canRefresh: false,
      });
    }
  }, [state.pulling, state.canRefresh, state.refreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current ?? document;

    container.addEventListener('touchstart', onTouchStart as EventListener, { passive: true });
    container.addEventListener('touchmove', onTouchMove as EventListener, { passive: false });
    container.addEventListener('touchend', onTouchEnd as EventListener, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart as EventListener);
      container.removeEventListener('touchmove', onTouchMove as EventListener);
      container.removeEventListener('touchend', onTouchEnd as EventListener);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return {
    ...state,
    setContainerRef,
    pullProgress: Math.min(state.pullDistance / threshold, 1),
  };
}

/**
 * Haptic feedback (vibration API)
 */
export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const lightTap = useCallback(() => vibrate(10), [vibrate]);
  const mediumTap = useCallback(() => vibrate(20), [vibrate]);
  const heavyTap = useCallback(() => vibrate([30, 10, 30]), [vibrate]);
  const success = useCallback(() => vibrate([10, 50, 20]), [vibrate]);
  const error = useCallback(() => vibrate([50, 30, 50, 30, 50]), [vibrate]);

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    success,
    error,
  };
}

/**
 * Long press gesture detection
 */
interface LongPressOptions {
  delay?: number; // Time in ms to trigger long press (default 500ms)
  onLongPress: () => void;
  onPress?: () => void; // Regular tap handler
}

export function useLongPress(options: LongPressOptions) {
  const { delay = 500, onLongPress, onPress } = options;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressRef.current = false;

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(20);
      }
    }, delay);
  }, [delay, onLongPress]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const moveThreshold = 10;
    const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
    const deltaY = Math.abs(touch.clientY - startPosRef.current.y);

    // Cancel long press if user moves finger
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      clearTimer();
    }
  }, [clearTimer]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimer();
    
    // If it wasn't a long press, treat as regular tap
    if (!isLongPressRef.current && onPress) {
      onPress();
    }
  }, [clearTimer, onPress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

/**
 * Safe area insets (for notched devices)
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      const root = document.documentElement;
      setInsets({
        top: parseInt(getComputedStyle(root).getPropertyValue('--sat') || '0', 10),
        right: parseInt(getComputedStyle(root).getPropertyValue('--sar') || '0', 10),
        bottom: parseInt(getComputedStyle(root).getPropertyValue('--sab') || '0', 10),
        left: parseInt(getComputedStyle(root).getPropertyValue('--sal') || '0', 10),
      });
    };

    // Set CSS variables for safe area
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --sat: env(safe-area-inset-top);
        --sar: env(safe-area-inset-right);
        --sab: env(safe-area-inset-bottom);
        --sal: env(safe-area-inset-left);
      }
    `;
    document.head.appendChild(style);

    updateInsets();
    window.addEventListener('resize', updateInsets);

    return () => {
      document.head.removeChild(style);
      window.removeEventListener('resize', updateInsets);
    };
  }, []);

  return insets;
}

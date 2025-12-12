import { useState, useCallback, useRef, useEffect } from 'react';

// Types for the barcode scanner
export type BarcodeFormat =
  | 'QR_CODE'
  | 'CODE_128'
  | 'CODE_39'
  | 'EAN_13'
  | 'EAN_8'
  | 'UPC_A'
  | 'UPC_E'
  | 'DATA_MATRIX';

interface ScanResult {
  text: string;
  format: string;
}

interface UseBarcodeScanner {
  isScanning: boolean;
  isSupported: boolean;
  hasPermission: boolean | null;
  error: string | null;
  lastResult: ScanResult | null;
  startScanning: (elementId: string, onScan: (result: ScanResult) => void) => Promise<void>;
  stopScanning: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

/**
 * Hook for camera-based barcode scanning using html5-qrcode library.
 * Supports multiple barcode formats including QR, Code128, EAN, UPC.
 * 
 * Note: The html5-qrcode library is loaded dynamically at runtime.
 * If not available, the scanner will show an appropriate error.
 *
 * Usage:
 * ```tsx
 * const { startScanning, stopScanning, isScanning, error } = useBarcodeScanner();
 *
 * const handleScan = (result) => {
 *   console.log('Scanned:', result.text);
 * };
 *
 * // Start scanning with element ID where camera preview will render
 * await startScanning('scanner-container', handleScan);
 * ```
 */
export function useBarcodeScanner(): UseBarcodeScanner {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  const scannerRef = useRef<any>(null);
  const onScanCallbackRef = useRef<((result: ScanResult) => void) | null>(null);

  // Check if camera/media devices are supported
  const isSupported = typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Camera not supported on this device');
      setHasPermission(false);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately - we just wanted to check permission
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      setError(null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Camera permission denied';
      setError(errorMessage);
      setHasPermission(false);
      return false;
    }
  }, [isSupported]);

  const startScanning = useCallback(async (
    elementId: string,
    onScan: (result: ScanResult) => void
  ): Promise<void> => {
    if (!isSupported) {
      setError('Camera not supported on this device');
      return;
    }

    // Check permission first
    if (hasPermission === null) {
      const permitted = await requestPermission();
      if (!permitted) return;
    } else if (hasPermission === false) {
      setError('Camera permission denied');
      return;
    }

    try {
      setError(null);
      onScanCallbackRef.current = onScan;

      // Load html5-qrcode from CDN if not already loaded
      let Html5Qrcode = (window as any).Html5Qrcode;
      
      if (!Html5Qrcode) {
        try {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load scanner library'));
            document.head.appendChild(script);
          });
          Html5Qrcode = (window as any).Html5Qrcode;
        } catch {
          setError('Camera scanning library not available. Please enter barcode manually.');
          setIsScanning(false);
          return;
        }
      }

      if (!Html5Qrcode) {
        setError('Camera scanning library not loaded. Please enter barcode manually.');
        setIsScanning(false);
        return;
      }

      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [
          0,  // QR_CODE
          4,  // CODE_128
          2,  // CODE_39
          7,  // EAN_13
          6,  // EAN_8
          9,  // UPC_A
          10, // UPC_E
        ],
      };

      await scanner.start(
        { facingMode: 'environment' }, // Prefer back camera
        config,
        (decodedText, decodedResult) => {
          const result: ScanResult = {
            text: decodedText,
            format: decodedResult.result.format?.formatName || 'UNKNOWN',
          };
          setLastResult(result);

          // Provide haptic feedback if available
          if ('vibrate' in navigator) {
            navigator.vibrate(100);
          }

          onScanCallbackRef.current?.(result);
        },
        (errorMessage) => {
          // Ignore "No barcode found" errors - these are expected
          if (!errorMessage.includes('No barcode') && !errorMessage.includes('No QR code')) {
            console.debug('Scan frame error:', errorMessage);
          }
        }
      );

      setIsScanning(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start scanner';
      setError(errorMessage);
      setIsScanning(false);
      console.error('Scanner start error:', err);
    }
  }, [isSupported, hasPermission, requestPermission]);

  const stopScanning = useCallback(async (): Promise<void> => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
    onScanCallbackRef.current = null;
  }, []);

  return {
    isScanning,
    isSupported,
    hasPermission,
    error,
    lastResult,
    startScanning,
    stopScanning,
    requestPermission,
  };
}

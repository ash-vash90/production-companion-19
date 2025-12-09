import { useEffect, useCallback, useId } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Camera, CameraOff, AlertCircle, Loader2 } from 'lucide-react';

interface CameraScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
  title?: string;
  description?: string;
}

/**
 * Reusable camera barcode scanner dialog.
 * Opens camera preview and auto-detects barcodes/QR codes.
 *
 * Usage:
 * ```tsx
 * <CameraScannerDialog
 *   open={showScanner}
 *   onOpenChange={setShowScanner}
 *   onScan={(barcode) => {
 *     setBatchNumber(barcode);
 *     setShowScanner(false);
 *   }}
 * />
 * ```
 */
export function CameraScannerDialog({
  open,
  onOpenChange,
  onScan,
  title,
  description,
}: CameraScannerDialogProps) {
  const { language } = useLanguage();
  const scannerId = useId().replace(/:/g, '');
  const elementId = `scanner-${scannerId}`;

  const {
    isScanning,
    isSupported,
    hasPermission,
    error,
    startScanning,
    stopScanning,
    requestPermission,
  } = useBarcodeScanner();

  const handleScan = useCallback(
    (result: { text: string; format: string }) => {
      onScan(result.text);
      onOpenChange(false);
    },
    [onScan, onOpenChange]
  );

  // Start scanning when dialog opens
  useEffect(() => {
    if (open && isSupported) {
      // Small delay to ensure DOM element exists
      const timer = setTimeout(() => {
        startScanning(elementId, handleScan);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, isSupported, elementId, startScanning, handleScan]);

  // Stop scanning when dialog closes
  useEffect(() => {
    if (!open && isScanning) {
      stopScanning();
    }
  }, [open, isScanning, stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const defaultTitle = language === 'nl' ? 'Scan Barcode' : 'Scan Barcode';
  const defaultDescription =
    language === 'nl'
      ? 'Richt de camera op de barcode of QR-code'
      : 'Point the camera at the barcode or QR code';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription>{description || defaultDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isSupported ? (
            <Alert variant="destructive">
              <CameraOff className="h-4 w-4" />
              <AlertDescription>
                {language === 'nl'
                  ? 'Camera wordt niet ondersteund op dit apparaat'
                  : 'Camera is not supported on this device'}
              </AlertDescription>
            </Alert>
          ) : hasPermission === false ? (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {language === 'nl'
                    ? 'Camera toegang is geweigerd. Sta camera toegang toe in je browser instellingen.'
                    : 'Camera access denied. Please allow camera access in your browser settings.'}
                </AlertDescription>
              </Alert>
              <Button onClick={requestPermission} className="w-full">
                {language === 'nl' ? 'Opnieuw proberen' : 'Try Again'}
              </Button>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="relative">
              {/* Scanner container */}
              <div
                id={elementId}
                className="w-full aspect-square bg-muted rounded-lg overflow-hidden"
              />

              {/* Loading overlay */}
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-lg">
                  <div className="text-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {language === 'nl' ? 'Camera starten...' : 'Starting camera...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Scanning indicator */}
              {isScanning && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/50 rounded px-2 py-1">
                  <p className="text-xs text-white text-center">
                    {language === 'nl' ? 'Scannen actief...' : 'Scanning active...'}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {language === 'nl' ? 'Annuleren' : 'Cancel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

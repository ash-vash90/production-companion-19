import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface CancelWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  woNumber: string;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function CancelWorkOrderDialog({
  open,
  onOpenChange,
  woNumber,
  onConfirm,
  isLoading = false,
}: CancelWorkOrderDialogProps) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason('');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>{t('cancelWorkOrder')}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {t('cancelWorkOrderConfirmText')} <span className="font-semibold">{woNumber}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="cancel-reason" className="text-sm font-medium">
            {t('cancellationReason')} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="cancel-reason"
            placeholder={t('enterCancellationReason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[100px] resize-none"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            {t('cancellationReasonRequired')}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {t('keepWorkOrder')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? t('cancelling') : t('confirmCancel')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

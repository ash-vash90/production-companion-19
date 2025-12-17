import React, { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Loader2, Trash2, Zap, History } from 'lucide-react';

interface DeleteWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
  webhookName: string;
  webhookType: 'incoming' | 'outgoing';
  onConfirmDelete: () => Promise<void>;
}

const DeleteWebhookDialog: React.FC<DeleteWebhookDialogProps> = ({
  open,
  onOpenChange,
  webhookId,
  webhookName,
  webhookType,
  onConfirmDelete,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [rulesCount, setRulesCount] = useState(0);
  const [logsCount, setLogsCount] = useState(0);
  const [fetchingStats, setFetchingStats] = useState(false);

  useEffect(() => {
    if (open && webhookId) {
      fetchImpactStats();
    }
    if (!open) {
      setConfirmText('');
    }
  }, [open, webhookId]);

  const fetchImpactStats = async () => {
    setFetchingStats(true);
    try {
      if (webhookType === 'incoming') {
        // Count automation rules
        const { count: rulesResult } = await supabase
          .from('automation_rules')
          .select('*', { count: 'exact', head: true })
          .eq('incoming_webhook_id', webhookId);
        setRulesCount(rulesResult || 0);

        // Count webhook logs
        const { count: logsResult } = await supabase
          .from('webhook_logs')
          .select('*', { count: 'exact', head: true })
          .eq('incoming_webhook_id', webhookId);
        setLogsCount(logsResult || 0);
      } else {
        // Count outgoing webhook logs
        const { count: logsResult } = await (supabase
          .from('outgoing_webhook_logs' as any)
          .select('*', { count: 'exact', head: true })
          .eq('webhook_id', webhookId) as any);
        setLogsCount(logsResult || 0);
        setRulesCount(0);
      }
    } catch (error) {
      console.error('Error fetching impact stats:', error);
    } finally {
      setFetchingStats(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== webhookName.toLowerCase()) return;
    
    setLoading(true);
    try {
      await onConfirmDelete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting webhook:', error);
    } finally {
      setLoading(false);
    }
  };

  const isConfirmValid = confirmText.toLowerCase() === webhookName.toLowerCase();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete {webhookType === 'incoming' ? 'Incoming' : 'Outgoing'} Webhook
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-4">
            <p>
              You are about to permanently delete <strong className="text-foreground">{webhookName}</strong>. This action cannot be undone.
            </p>

            {/* Impact Summary */}
            {fetchingStats ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking impact...</span>
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="font-medium text-foreground text-sm">This will permanently delete:</p>
                <div className="space-y-1.5">
                  {webhookType === 'incoming' && rulesCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span><strong>{rulesCount}</strong> automation rule{rulesCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {logsCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <History className="h-4 w-4 text-blue-500" />
                      <span><strong>{logsCount}</strong> log entr{logsCount !== 1 ? 'ies' : 'y'}</span>
                    </div>
                  )}
                  {rulesCount === 0 && logsCount === 0 && (
                    <p className="text-sm text-muted-foreground">No associated data found</p>
                  )}
                </div>
              </div>
            )}

            {/* Type to confirm */}
            <div className="space-y-2">
              <Label htmlFor="confirm-name" className="text-foreground">
                Type <strong>{webhookName}</strong> to confirm deletion:
              </Label>
              <Input
                id="confirm-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Enter webhook name"
                className={confirmText && !isConfirmValid ? 'border-destructive' : ''}
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmValid || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Webhook
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteWebhookDialog;

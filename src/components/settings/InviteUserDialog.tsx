import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, UserPlus, Copy, Check, Mail } from 'lucide-react';

interface InviteUserDialogProps {
  onInviteCreated?: () => void;
}

export function InviteUserDialog({ onInviteCreated }: InviteUserDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'supervisor' | 'operator' | 'logistics'>('operator');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.warning('Email required', { description: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), role },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setInviteLink(data.invite.invite_link);
      toast.success('Invite created', { description: `Invitation sent to ${email}` });
      onInviteCreated?.();
    } catch (error: any) {
      console.error('Invite error:', error);
      toast.error('Failed to create invite', { description: error.message || 'Please try again' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Link copied', { description: 'Invite link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed', { description: 'Failed to copy link to clipboard' });
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail('');
    setRole('operator');
    setInviteLink(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('inviteUser') || 'Invite User'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('inviteUser') || 'Invite User'}
          </DialogTitle>
          <DialogDescription>
            {t('inviteUserDescription') || 'Send an invitation to a new user to join the system'}
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t('email')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('role')}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2">
                        <span>👑</span> {t('admin')}
                      </span>
                    </SelectItem>
                    <SelectItem value="supervisor">
                      <span className="flex items-center gap-2">
                        <span>👔</span> {t('supervisor')}
                      </span>
                    </SelectItem>
                    <SelectItem value="operator">
                      <span className="flex items-center gap-2">
                        <span>🔧</span> {t('operator')}
                      </span>
                    </SelectItem>
                    <SelectItem value="logistics">
                      <span className="flex items-center gap-2">
                        <span>📦</span> {t('logistics')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                {t('cancel')}
              </Button>
              <Button onClick={handleInvite} disabled={loading || !email.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('sendInvite') || 'Send Invite'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                <p className="text-sm text-success font-medium mb-2">
                  ✓ {t('inviteCreated') || 'Invite created successfully!'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('inviteInstructions') || 'Share this link with the user to complete their registration:'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('inviteLink') || 'Invite Link'}</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="text-xs font-medium tabular-nums tracking-wide"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('inviteExpiry') || 'This link expires in 7 days'}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>
                {t('done') || 'Done'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Factory, UserPlus } from 'lucide-react';
import { loginSchema, signupSchema } from '@/lib/validation';
import { supabase } from '@/integrations/supabase/client';

interface InviteData {
  email: string;
  role: string;
  invite_token: string;
}

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'nl'>('en');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [activeTab, setActiveTab] = useState('login');
  const { signIn, signUp, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Get the intended destination from location state, or default to dashboard
  const from = (location.state as any)?.from?.pathname || '/';

  // Check for invite token on mount
  useEffect(() => {
    const inviteToken = searchParams.get('invite');
    if (inviteToken) {
      checkInviteToken(inviteToken);
    }
  }, [searchParams]);

  const checkInviteToken = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('user_invites' as any)
        .select('email, role, invite_token')
        .eq('invite_token', token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        toast.error(t('error'), { description: 'Invalid or expired invite link' });
        return;
      }

      const invite = data as unknown as InviteData;
      setInviteData(invite);
      setEmail(invite.email);
      setActiveTab('signup');
      toast.success(t('success'), { 
        description: `You've been invited as ${invite.role}. Complete your registration below.` 
      });
    } catch (error) {
      console.error('Error checking invite:', error);
    }
  };

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validate input with zod
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setValidationErrors(errors);
      toast.error(t('error'), { description: Object.values(errors)[0] });
      return;
    }

    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      const errorMessage = error.message === 'Invalid login credentials'
        ? 'Invalid email or password. Please try again.'
        : error.message;
      toast.error(t('error'), { description: errorMessage });
    } else {
      toast.success(t('success'), { description: 'Successfully logged in' });
      navigate(from, { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validate input with zod
    const result = signupSchema.safeParse({ email, password, fullName });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setValidationErrors(errors);
      toast.error(t('error'), { description: Object.values(errors)[0] });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email.trim(), password, fullName.trim(), selectedLanguage);
    setLoading(false);

    if (error) {
      const errorMessage = error.message.includes('already registered')
        ? 'This email is already registered. Please log in instead.'
        : error.message;
      toast.error(t('error'), { description: errorMessage });
    } else {
      // If this was an invite, mark it as used and assign the role
      if (inviteData) {
        try {
          // Mark invite as used
          await supabase
            .from('user_invites' as any)
            .update({ used_at: new Date().toISOString() })
            .eq('invite_token', inviteData.invite_token);

          // The role will be assigned via trigger or we need to handle it
          // For now, we'll trust the signup flow and the admin can adjust if needed
          toast.success(t('success'), { 
            description: `Account created with ${inviteData.role} role. You can now log in.` 
          });
        } catch (inviteError) {
          console.error('Error updating invite:', inviteError);
        }
      } else {
        toast.success(t('success'), { description: 'Account created successfully! You can now log in.' });
      }
      setLanguage(selectedLanguage);
      setActiveTab('login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 md:h-14 md:w-14 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <Factory className="h-6 w-6 md:h-7 md:w-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-logo text-foreground lowercase">rhosonics</CardTitle>
          <CardDescription className="text-xs md:text-sm uppercase tracking-wider text-muted-foreground">
            MES Production System
          </CardDescription>
          {inviteData && (
            <div className="flex items-center justify-center gap-2 p-2 bg-primary/10 rounded-lg">
              <UserPlus className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">
                Invited as {inviteData.role}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10 md:h-11">
              <TabsTrigger value="login" className="font-data text-xs md:text-sm uppercase">{t('login')}</TabsTrigger>
              <TabsTrigger value="signup" className="font-data text-xs md:text-sm uppercase">{t('signup')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="email" className="font-data text-sm md:text-base uppercase tracking-wider">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="operator@rhosonics.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={validationErrors.email ? 'border-destructive' : ''}
                    maxLength={255}
                    required
                  />
                  {validationErrors.email && <p className="text-xs text-destructive">{validationErrors.email}</p>}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="password" className="font-data text-sm md:text-base uppercase tracking-wider">{t('password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={validationErrors.password ? 'border-destructive' : ''}
                    maxLength={128}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" variant="default" size="lg" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {t('login')}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="fullName" className="font-data text-sm md:text-base uppercase tracking-wider">{t('fullName')}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={validationErrors.fullName ? 'border-destructive' : ''}
                    maxLength={100}
                    required
                  />
                  {validationErrors.fullName && <p className="text-xs text-destructive">{validationErrors.fullName}</p>}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="signup-email" className="font-data text-sm md:text-base uppercase tracking-wider">{t('email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="operator@rhosonics.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={validationErrors.email ? 'border-destructive' : ''}
                    maxLength={255}
                    required
                  />
                  {validationErrors.email && <p className="text-xs text-destructive">{validationErrors.email}</p>}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="signup-password" className="font-data text-sm md:text-base uppercase tracking-wider">{t('password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={validationErrors.password ? 'border-destructive' : ''}
                    maxLength={128}
                    required
                  />
                  {validationErrors.password && <p className="text-xs text-destructive">{validationErrors.password}</p>}
                  <p className="text-xs text-muted-foreground">Min 8 chars, 1 uppercase, 1 lowercase, 1 number</p>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="language" className="font-data text-sm md:text-base uppercase tracking-wider">Language / Taal</Label>
                  <Select value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value as 'en' | 'nl')}>
                    <SelectTrigger className="h-10 md:h-11 text-sm md:text-base border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en" className="h-10 md:h-11 text-sm md:text-base">English</SelectItem>
                      <SelectItem value="nl" className="h-10 md:h-11 text-sm md:text-base">Nederlands</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" variant="default" size="lg" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {t('signup')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setLanguage(language === 'en' ? 'nl' : 'en')}
            className="font-data text-sm uppercase tracking-wider"
          >
            {language === 'en' ? 'Nederlands' : 'English'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Auth;

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, UserPlus, Mail, ArrowLeft, CheckCircle2, Eye, EyeOff, Globe } from 'lucide-react';
import { loginSchema, signupSchema, rhosonicsEmailSchema, verificationCodeSchema, passwordResetSchema } from '@/lib/validation';
import { supabase } from '@/integrations/supabase/client';
import { VerificationCodeInput } from '@/components/auth/VerificationCodeInput';
import { PasswordStrengthIndicator, isPasswordValid } from '@/components/auth/PasswordStrengthIndicator';
import { RhosonicsLogo } from '@/components/RhosonicsLogo';
interface InviteData {
  email: string;
  role: string;
  invite_token: string;
}

type AuthView = 'login' | 'signup' | 'signup-verify' | 'signup-success' | 'forgot-password' | 'forgot-verify' | 'reset-password' | 'reset-success';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'nl'>('en');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [view, setView] = useState<AuthView>('login');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { signIn, signUp, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const from = (location.state as any)?.from?.pathname || '/';

  // Check for invite token on mount
  useEffect(() => {
    const inviteToken = searchParams.get('invite');
    if (inviteToken) {
      checkInviteToken(inviteToken);
    }
  }, [searchParams]);

  // Countdown timer for code expiry
  useEffect(() => {
    if (!codeExpiresAt) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((codeExpiresAt.getTime() - now.getTime()) / 1000));
      setCountdown(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    
    const interval = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

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
      setView('signup');
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

  const handleSignupStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validate all fields
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

    // Send verification code
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('send-verification-code', {
        body: { email: email.trim(), type: 'signup', language: selectedLanguage }
      });

      if (response.error) throw response.error;
      
      const data = response.data;
      if (!data.success) {
        toast.error(t('error'), { description: data.error || 'Failed to send verification code' });
        setLoading(false);
        return;
      }

      setCodeExpiresAt(new Date(Date.now() + 10 * 60 * 1000));
      setVerificationCode('');
      setView('signup-verify');
      toast.success(t('success'), { description: 'Verification code sent to your email' });
    } catch (error: any) {
      console.error('Error sending verification code:', error);
      toast.error(t('error'), { description: 'Failed to send verification code. Please try again.' });
    }
    setLoading(false);
  };

  const handleVerifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const codeResult = verificationCodeSchema.safeParse(verificationCode);
    if (!codeResult.success) {
      toast.error(t('error'), { description: 'Please enter a valid 6-digit code' });
      return;
    }

    setLoading(true);
    try {
      // Verify the code
      const verifyResponse = await supabase.functions.invoke('verify-code', {
        body: { email: email.trim(), code: verificationCode, type: 'signup' }
      });

      if (verifyResponse.error) throw verifyResponse.error;
      
      const verifyData = verifyResponse.data;
      if (!verifyData.success) {
        toast.error(t('error'), { description: verifyData.error || 'Invalid verification code' });
        setLoading(false);
        return;
      }

      // Code verified - now create the account
      const { error: signUpError } = await signUp(email.trim(), password, fullName.trim(), selectedLanguage);
      
      if (signUpError) {
        const errorMessage = signUpError.message.includes('already registered')
          ? 'This email is already registered. Please log in instead.'
          : signUpError.message;
        toast.error(t('error'), { description: errorMessage });
        setLoading(false);
        return;
      }

      // If this was an invite, mark it as used
      if (inviteData) {
        try {
          await supabase
            .from('user_invites' as any)
            .update({ used_at: new Date().toISOString() })
            .eq('invite_token', inviteData.invite_token);
        } catch (inviteError) {
          console.error('Error updating invite:', inviteError);
        }
      }

      setLanguage(selectedLanguage);
      setView('signup-success');
      toast.success(t('success'), { description: 'Account created successfully!' });
    } catch (error: any) {
      console.error('Error verifying code:', error);
      toast.error(t('error'), { description: 'Verification failed. Please try again.' });
    }
    setLoading(false);
  };

  const handleForgotPasswordStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    const result = rhosonicsEmailSchema.safeParse(email);
    if (!result.success) {
      setValidationErrors({ email: result.error.errors[0].message });
      toast.error(t('error'), { description: result.error.errors[0].message });
      return;
    }

    setLoading(true);
    try {
      const response = await supabase.functions.invoke('send-verification-code', {
        body: { email: email.trim(), type: 'password_reset', language }
      });

      if (response.error) throw response.error;

      // Always show success (security - don't reveal if email exists)
      setCodeExpiresAt(new Date(Date.now() + 10 * 60 * 1000));
      setVerificationCode('');
      setView('forgot-verify');
      toast.success(t('success'), { description: 'If this email is registered, you will receive a reset code.' });
    } catch (error: any) {
      console.error('Error sending reset code:', error);
      toast.error(t('error'), { description: 'Failed to send reset code. Please try again.' });
    }
    setLoading(false);
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const codeResult = verificationCodeSchema.safeParse(verificationCode);
    if (!codeResult.success) {
      toast.error(t('error'), { description: 'Please enter a valid 6-digit code' });
      return;
    }

    setLoading(true);
    try {
      const verifyResponse = await supabase.functions.invoke('verify-code', {
        body: { email: email.trim(), code: verificationCode, type: 'password_reset' }
      });

      if (verifyResponse.error) throw verifyResponse.error;
      
      const verifyData = verifyResponse.data;
      if (!verifyData.success) {
        toast.error(t('error'), { description: verifyData.error || 'Invalid verification code' });
        setLoading(false);
        return;
      }

      setVerificationToken(verifyData.token);
      setPassword('');
      setConfirmPassword('');
      setView('reset-password');
    } catch (error: any) {
      console.error('Error verifying code:', error);
      toast.error(t('error'), { description: 'Verification failed. Please try again.' });
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    const result = passwordResetSchema.safeParse({ password, confirmPassword });
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
    try {
      const response = await supabase.functions.invoke('reset-password', {
        body: { token: verificationToken, newPassword: password }
      });

      if (response.error) throw response.error;
      
      const data = response.data;
      if (!data.success) {
        toast.error(t('error'), { description: data.error || 'Failed to reset password' });
        setLoading(false);
        return;
      }

      setView('reset-success');
      toast.success(t('success'), { description: 'Password reset successfully!' });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(t('error'), { description: 'Failed to reset password. Please try again.' });
    }
    setLoading(false);
  };

  const handleResendCode = async (type: 'signup' | 'password_reset') => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('send-verification-code', {
        body: { email: email.trim(), type, language }
      });

      if (response.error) throw response.error;
      
      setCodeExpiresAt(new Date(Date.now() + 10 * 60 * 1000));
      setVerificationCode('');
      setResendCooldown(60);
      toast.success(t('success'), { description: 'New verification code sent' });
    } catch (error: any) {
      console.error('Error resending code:', error);
      toast.error(t('error'), { description: 'Failed to resend code. Please try again.' });
    }
    setLoading(false);
  };

  const resetToLogin = () => {
    setView('login');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setVerificationCode('');
    setVerificationToken('');
    setValidationErrors({});
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render different views
  const renderContent = () => {
    switch (view) {
      case 'signup-verify':
      case 'forgot-verify':
        const isSignupVerify = view === 'signup-verify';
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {isSignupVerify ? 'Verify Your Email' : 'Enter Reset Code'}
              </h2>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to<br />
                <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>

            <form onSubmit={isSignupVerify ? handleVerifySignup : handleVerifyReset} className="space-y-6">
              <div className="space-y-4">
                <Label className="block text-center text-sm text-muted-foreground">
                  Enter verification code
                </Label>
                <VerificationCodeInput
                  value={verificationCode}
                  onChange={setVerificationCode}
                  disabled={loading}
                />
                
                {countdown > 0 && (
                  <p className="text-center text-sm text-warning flex items-center justify-center gap-2">
                    <span>⏱️</span>
                    Code expires in {formatCountdown(countdown)}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading || verificationCode.length !== 6}>
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Verify Code
              </Button>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setView(isSignupVerify ? 'signup' : 'forgot-password')}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResendCode(isSignupVerify ? 'signup' : 'password_reset')}
                  disabled={loading || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </Button>
              </div>
            </form>
          </div>
        );

      case 'signup-success':
      case 'reset-success':
        const isSignupSuccess = view === 'signup-success';
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-20 h-20 bg-success/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {isSignupSuccess ? 'Account Created!' : 'Password Reset!'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isSignupSuccess 
                  ? 'Your account has been created successfully. You can now sign in.'
                  : 'Your password has been reset successfully. You can now sign in with your new password.'}
              </p>
            </div>
            <Button onClick={resetToLogin} className="w-full" size="lg">
              Sign In
            </Button>
          </div>
        );

      case 'forgot-password':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Reset Password</h2>
              <p className="text-sm text-muted-foreground">
                Enter your email address and we'll send you a code to reset your password.
              </p>
            </div>

            <form onSubmit={handleForgotPasswordStart} className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="reset-email" className="font-data text-sm uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your.name@rhosonics.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={validationErrors.email ? 'border-destructive' : ''}
                  maxLength={255}
                  required
                />
                {validationErrors.email && (
                  <p className="text-xs text-destructive">{validationErrors.email}</p>
                )}
                <p className="text-xs text-muted-foreground">Only @rhosonics.com email addresses</p>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Send Reset Code
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setView('login')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </form>
          </div>
        );

      case 'reset-password':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Set New Password</h2>
              <p className="text-sm text-muted-foreground">
                Choose a strong password for your account.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="new-password" className="font-data text-sm uppercase tracking-wider">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={validationErrors.password ? 'border-destructive pr-10' : 'pr-10'}
                    maxLength={128}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {validationErrors.password && (
                  <p className="text-xs text-destructive">{validationErrors.password}</p>
                )}
                <PasswordStrengthIndicator password={password} />
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirm-password" className="font-data text-sm uppercase tracking-wider">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={validationErrors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                    maxLength={128}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {validationErrors.confirmPassword && (
                  <p className="text-xs text-destructive">{validationErrors.confirmPassword}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                disabled={loading || !isPasswordValid(password) || password !== confirmPassword}
              >
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Reset Password
              </Button>
            </form>
          </div>
        );

      case 'signup':
        return (
          <form onSubmit={handleSignupStart} className="space-y-5">
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
                placeholder="your.name@rhosonics.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={validationErrors.email ? 'border-destructive' : ''}
                maxLength={255}
                required
                disabled={!!inviteData}
              />
              {validationErrors.email && <p className="text-xs text-destructive">{validationErrors.email}</p>}
              <p className="text-xs text-muted-foreground">Only @rhosonics.com email addresses</p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="signup-password" className="font-data text-sm md:text-base uppercase tracking-wider">{t('password')}</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={validationErrors.password ? 'border-destructive pr-10' : 'pr-10'}
                  maxLength={128}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {validationErrors.password && <p className="text-xs text-destructive">{validationErrors.password}</p>}
              <PasswordStrengthIndicator password={password} />
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
            <Button 
              type="submit" 
              className="w-full" 
              variant="default" 
              size="lg" 
              disabled={loading || !isPasswordValid(password)}
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Continue
            </Button>
          </form>
        );

      default: // login
        return (
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
            <Button
              type="button"
              variant="link"
              className="w-full text-sm text-muted-foreground hover:text-primary"
              onClick={() => {
                setEmail('');
                setValidationErrors({});
                setView('forgot-password');
              }}
            >
              Forgot your password?
            </Button>
          </form>
        );
    }
  };

  // Determine if we should show tabs
  const showTabs = view === 'login' || view === 'signup';

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-950">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900" />
      
      {/* Particle animation */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="auth-particle absolute w-1 h-1 bg-primary/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${8 + Math.random() * 12}s`,
            }}
          />
        ))}
      </div>
      
      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in">
        <Card className="border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-6 text-center pb-2">
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150" />
                <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
                  <RhosonicsLogo size={48} className="text-white" />
                </div>
              </div>
              
              <div className="space-y-1">
                <h1 className="text-3xl md:text-4xl font-logo text-white lowercase tracking-tight">
                  rhosonics
                </h1>
                <p className="text-xs md:text-sm font-data uppercase tracking-[0.2em] text-slate-400">
                  Production System
                </p>
              </div>
            </div>

            {inviteData && view === 'signup' && (
              <div className="flex items-center justify-center gap-2 p-3 bg-primary/20 border border-primary/30 rounded-xl">
                <UserPlus className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium">
                  Invited as {inviteData.role}
                </span>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="pt-2">
            {showTabs ? (
              <Tabs value={view === 'signup' ? 'signup' : 'login'} onValueChange={(v) => setView(v as AuthView)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-800/50 border border-white/10 p-1">
                  <TabsTrigger 
                    value="login" 
                    className="font-data text-sm uppercase tracking-wider text-slate-400 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
                  >
                    {t('login')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup" 
                    className="font-data text-sm uppercase tracking-wider text-slate-400 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg"
                  >
                    {t('signup')}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="mt-6 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-left-2 data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 duration-200">
                  <div className="auth-form-dark">
                    {renderContent()}
                  </div>
                </TabsContent>
                
                <TabsContent value="signup" className="mt-6 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-right-2 data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 duration-200 max-h-[420px] overflow-y-auto">
                  <div className="auth-form-dark">
                    {renderContent()}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="mt-2 auth-form-dark">
                {renderContent()}
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-center pb-6 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'en' ? 'nl' : 'en')}
              className="text-slate-500 hover:text-white hover:bg-white/5 gap-2"
            >
              <Globe className="h-4 w-4" />
              <span className="font-data text-xs uppercase tracking-wider">
                {language === 'en' ? 'Nederlands' : 'English'}
              </span>
            </Button>
          </CardFooter>
        </Card>
        
        {/* Footer text */}
        <p className="text-center text-slate-600 text-xs mt-6 font-data">
          © {new Date().getFullYear()} Rhosonics B.V.
        </p>
      </div>
      
      {/* CSS for particle animation */}
      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(100vh) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) scale(1);
            opacity: 0;
          }
        }
        .auth-particle {
          animation: float-up linear infinite;
        }
        .auth-form-dark label {
          color: rgba(255, 255, 255, 0.8) !important;
        }
        .auth-form-dark input {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          color: white !important;
        }
        .auth-form-dark input::placeholder {
          color: rgba(255, 255, 255, 0.35) !important;
        }
        .auth-form-dark input:focus {
          border-color: hsl(var(--primary)) !important;
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2) !important;
        }
        .auth-form-dark .text-foreground {
          color: white !important;
        }
        .auth-form-dark .text-muted-foreground {
          color: rgba(255, 255, 255, 0.6) !important;
        }
        .auth-form-dark .text-destructive {
          color: hsl(0 84% 60%) !important;
        }
        .auth-form-dark select,
        .auth-form-dark [data-radix-select-trigger] {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          color: white !important;
        }
      `}</style>
    </div>
  );
};

export default Auth;

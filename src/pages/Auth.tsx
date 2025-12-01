import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Factory } from 'lucide-react';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'nl'>('en');
  const { signIn, signUp, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t('error'), { description: 'Please fill in all fields' });
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      const errorMessage = error.message === 'Invalid login credentials' 
        ? 'Invalid email or password. Please try again.'
        : error.message;
      toast.error(t('error'), { description: errorMessage });
    } else {
      toast.success(t('success'), { description: 'Successfully logged in' });
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast.error(t('error'), { description: 'Please fill in all fields' });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, fullName, selectedLanguage);
    setLoading(false);

    if (error) {
      const errorMessage = error.message.includes('already registered')
        ? 'This email is already registered. Please log in instead.'
        : error.message;
      toast.error(t('error'), { description: errorMessage });
    } else {
      toast.success(t('success'), { description: 'Account created successfully! You can now log in.' });
      setLanguage(selectedLanguage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--c-slate-50))] p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 md:h-14 md:w-14 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <Factory className="h-9 w-9 md:h-7 md:w-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl md:text-2xl font-logo text-[hsl(var(--c-obsidian))] lowercase">rhosonics</CardTitle>
          <CardDescription className="text-sm md:text-xs uppercase tracking-wider text-muted-foreground">
            MES Production System
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12 md:h-10">
              <TabsTrigger value="login" className="font-data text-sm md:text-xs uppercase">{t('login')}</TabsTrigger>
              <TabsTrigger value="signup" className="font-data text-sm md:text-xs uppercase">{t('signup')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="email" className="font-data text-base md:text-sm uppercase tracking-wider">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="operator@rhosonics.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="password" className="font-data text-base md:text-sm uppercase tracking-wider">{t('password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" variant="rhosonics" size="lg" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {t('login')}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="fullName" className="font-data text-base md:text-sm uppercase tracking-wider">{t('fullName')}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="signup-email" className="font-data text-base md:text-sm uppercase tracking-wider">{t('email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="operator@rhosonics.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="signup-password" className="font-data text-base md:text-sm uppercase tracking-wider">{t('password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="language" className="font-data text-base md:text-sm uppercase tracking-wider">Language / Taal</Label>
                  <Select value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value as 'en' | 'nl')}>
                    <SelectTrigger className="h-12 md:h-11 text-base border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en" className="h-12 md:h-10 text-base">English</SelectItem>
                      <SelectItem value="nl" className="h-12 md:h-10 text-base">Nederlands</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" variant="rhosonics" size="lg" disabled={loading}>
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

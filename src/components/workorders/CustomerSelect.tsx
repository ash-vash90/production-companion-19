import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface Customer {
  id: string;
  exact_customer_id: string;
  name: string;
  name_nl: string | null;
  email: string | null;
  is_active: boolean;
}

interface CustomerSelectProps {
  value: string | null; // customer_id
  onChange: (customerId: string | null, customerName: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function CustomerSelect({
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  className,
}: CustomerSelectProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch customers from database
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, exact_customer_id, name, name_nl, email, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(200);

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          fetchCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const searchLower = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.name_nl?.toLowerCase().includes(searchLower) ||
        c.exact_customer_id.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower)
    );
  }, [customers, search]);

  // Get selected customer
  const selectedCustomer = useMemo(() => {
    if (!value) return null;
    return customers.find((c) => c.id === value) || null;
  }, [customers, value]);

  const getDisplayName = (customer: Customer) => {
    if (language === 'nl' && customer.name_nl) {
      return customer.name_nl;
    }
    return customer.name;
  };

  const handleSelect = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      onChange(customer.id, getDisplayName(customer));
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null, null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between text-base font-normal',
            !selectedCustomer && 'text-muted-foreground',
            error && 'border-destructive',
            className
          )}
        >
          {selectedCustomer ? (
            <span className="truncate">{getDisplayName(selectedCustomer)}</span>
          ) : (
            <span>{placeholder || (language === 'nl' ? 'Selecteer klant...' : 'Select customer...')}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <CommandInput
              placeholder={language === 'nl' ? 'Zoek klant...' : 'Search customer...'}
              value={search}
              onValueChange={setSearch}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fetchCustomers()}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === 'nl' ? 'Laden...' : 'Loading...'}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <CommandEmpty>
                {language === 'nl' ? 'Geen klanten gevonden.' : 'No customers found.'}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {selectedCustomer && (
                  <CommandItem
                    value="__clear__"
                    onSelect={handleClear}
                    className="text-muted-foreground"
                  >
                    <span className="italic">
                      {language === 'nl' ? 'Wissen' : 'Clear selection'}
                    </span>
                  </CommandItem>
                )}
                {filteredCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => handleSelect(customer.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === customer.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate font-medium">{getDisplayName(customer)}</span>
                      {customer.email && (
                        <span className="text-xs text-muted-foreground truncate">
                          {customer.email}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                      {customer.exact_customer_id}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

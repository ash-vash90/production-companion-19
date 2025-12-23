import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  exact_item_id: string;
  item_code: string;
  name: string;
  name_nl: string | null;
  product_type: string;
}

interface ProductSelectProps {
  value: string | null;
  onChange: (productId: string | null, product: Product | null) => void;
  error?: string;
}

export function ProductSelect({ value, onChange, error }: ProductSelectProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProducts();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'products' 
      }, () => {
        loadProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, exact_item_id, item_code, name, name_nl, product_type')
        .eq('is_active', true)
        .order('item_code');

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === value);
  
  const getDisplayName = (product: Product) => {
    const name = language === 'nl' && product.name_nl ? product.name_nl : product.name;
    return `${product.item_code} - ${name}`;
  };

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.item_code.toLowerCase().includes(query) ||
      product.name.toLowerCase().includes(query) ||
      (product.name_nl && product.name_nl.toLowerCase().includes(query))
    );
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-10 text-base",
            !selectedProduct && "text-muted-foreground",
            error && "border-destructive"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Package className="h-4 w-4 shrink-0" />
            {selectedProduct 
              ? getDisplayName(selectedProduct)
              : (language === 'nl' ? 'Selecteer item...' : 'Select item...')
            }
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={language === 'nl' ? 'Zoek item...' : 'Search item...'} 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {language === 'nl' ? 'Laden...' : 'Loading...'}
              </div>
            ) : filteredProducts.length === 0 ? (
              <CommandEmpty>
                {language === 'nl' ? 'Geen items gevonden' : 'No items found'}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => {
                      onChange(product.id, product);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === product.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{product.item_code}</span>
                      <span className="text-sm text-muted-foreground">
                        {language === 'nl' && product.name_nl ? product.name_nl : product.name}
                      </span>
                    </div>
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

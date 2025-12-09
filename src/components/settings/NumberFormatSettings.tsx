import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, RefreshCw } from 'lucide-react';
import { SettingsService, WorkOrderFormat, SerialPrefixes, SerialFormat } from '@/services/settingsService';

const NumberFormatSettings = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewWO, setPreviewWO] = useState('');
  
  const [woFormat, setWoFormat] = useState<WorkOrderFormat>({
    prefix: 'WO',
    dateFormat: 'YYYYMMDD',
    separator: '-'
  });
  
  const [serialPrefixes, setSerialPrefixes] = useState<SerialPrefixes>({
    SENSOR: 'Q',
    MLA: 'W',
    HMI: 'X',
    TRANSMITTER: 'T',
    SDM_ECO: 'SDM'
  });
  
  const [serialFormat, setSerialFormat] = useState<SerialFormat>({
    padLength: 4,
    separator: '-'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    generatePreview();
  }, [woFormat]);

  const loadSettings = async () => {
    try {
      const [woFmt, prefixes, serialFmt] = await Promise.all([
        SettingsService.getWorkOrderFormat(),
        SettingsService.getSerialPrefixes(),
        SettingsService.getSerialFormat()
      ]);
      
      setWoFormat(woFmt);
      setSerialPrefixes(prefixes);
      setSerialFormat(serialFmt);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error(t('error'), { description: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = () => {
    const now = new Date();
    let dateStr = '';
    
    if (woFormat.dateFormat === 'YYYYMMDD') {
      dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    } else if (woFormat.dateFormat === 'YYMMDD') {
      dateStr = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    } else if (woFormat.dateFormat === 'YYYY-MM-DD') {
      dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    
    setPreviewWO(`${woFormat.prefix}${woFormat.separator}${dateStr}${woFormat.separator}001`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const results = await Promise.all([
        SettingsService.updateSetting('work_order_format', woFormat),
        SettingsService.updateSetting('serial_prefixes', serialPrefixes),
        SettingsService.updateSetting('serial_format', serialFormat)
      ]);

      if (results.every(r => r)) {
        toast.success(t('success'), { description: 'Settings saved successfully' });
        SettingsService.clearCache();
      } else {
        throw new Error('Failed to save some settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('error'), { description: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const getSerialPreview = (type: keyof SerialPrefixes) => {
    return `${serialPrefixes[type]}${serialFormat.separator}${'0'.repeat(serialFormat.padLength - 1)}1`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Work Order Format */}
      <Card>
        <CardHeader>
          <CardTitle>Work Order Number Format</CardTitle>
          <CardDescription>
            Configure how work order numbers are automatically generated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="woPrefix">Prefix</Label>
              <Input
                id="woPrefix"
                value={woFormat.prefix}
                onChange={(e) => setWoFormat({ ...woFormat, prefix: e.target.value })}
                placeholder="WO"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="woDateFormat">Date Format</Label>
              <Select
                value={woFormat.dateFormat}
                onValueChange={(value) => setWoFormat({ ...woFormat, dateFormat: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYYYMMDD">YYYYMMDD (20241203)</SelectItem>
                  <SelectItem value="YYMMDD">YYMMDD (241203)</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-12-03)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="woSeparator">Separator</Label>
              <Select
                value={woFormat.separator || 'none'}
                onValueChange={(value) => setWoFormat({ ...woFormat, separator: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">Dash (-)</SelectItem>
                  <SelectItem value="_">Underscore (_)</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <span className="text-sm text-muted-foreground">Preview: </span>
            <span className="font-mono font-semibold">{previewWO}</span>
          </div>
        </CardContent>
      </Card>

      {/* Serial Number Prefixes */}
      <Card>
        <CardHeader>
          <CardTitle>Serial Number Prefixes</CardTitle>
          <CardDescription>
            Define the prefix letter/code for each product type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(Object.keys(serialPrefixes) as Array<keyof SerialPrefixes>).map((type) => (
              <div key={type} className="space-y-2">
                <Label htmlFor={`prefix-${type}`}>{type.replace('_', ' ')}</Label>
                <Input
                  id={`prefix-${type}`}
                  value={serialPrefixes[type]}
                  onChange={(e) => setSerialPrefixes({ ...serialPrefixes, [type]: e.target.value.toUpperCase() })}
                  maxLength={4}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground font-mono">{getSerialPreview(type)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Serial Number Format */}
      <Card>
        <CardHeader>
          <CardTitle>Serial Number Format</CardTitle>
          <CardDescription>
            Configure serial number padding and separator
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="padLength">Number Padding (digits)</Label>
              <Select
                value={String(serialFormat.padLength)}
                onValueChange={(value) => setSerialFormat({ ...serialFormat, padLength: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 digits (001)</SelectItem>
                  <SelectItem value="4">4 digits (0001)</SelectItem>
                  <SelectItem value="5">5 digits (00001)</SelectItem>
                  <SelectItem value="6">6 digits (000001)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialSeparator">Separator</Label>
              <Select
                value={serialFormat.separator || 'none'}
                onValueChange={(value) => setSerialFormat({ ...serialFormat, separator: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">Dash (-)</SelectItem>
                  <SelectItem value="_">Underscore (_)</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={loadSettings}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default NumberFormatSettings;

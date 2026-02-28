import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, getCountry } from "@/lib/currencies";
import { Settings, Loader2, Globe, Zap, Check } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/user/preferences")
      .then((res) => setPrefs(res.data))
      .catch(() => setPrefs({ country: "US", currency: "USD", currency_symbol: "$", electricity_rate: 0.12 }))
      .finally(() => setLoading(false));
  }, []);

  const handleCountryChange = (code) => {
    const c = getCountry(code);
    setPrefs((p) => ({
      ...p,
      country: c.code,
      currency: c.currency,
      currency_symbol: c.symbol,
      electricity_rate: c.rate,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put("/user/preferences", {
        country: prefs.country,
        currency: prefs.currency,
        currency_symbol: prefs.currency_symbol,
        electricity_rate: Number(prefs.electricity_rate),
      });
      setPrefs(res.data);
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const selectedCountry = getCountry(prefs.country);

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-6" data-testid="settings-page">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="settings-title">Settings</h2>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Configure your preferences for currency and electricity costs
        </p>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            Country & Currency
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={prefs.country} onValueChange={handleCountryChange}>
              <SelectTrigger data-testid="settings-country-select">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={prefs.currency}
                disabled
                className="font-mono"
                data-testid="settings-currency-display"
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={prefs.currency_symbol}
                disabled
                className="font-mono text-lg"
                data-testid="settings-symbol-display"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Electricity Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Rate per kWh ({prefs.currency_symbol})</Label>
            <Input
              type="number"
              step="0.01"
              value={prefs.electricity_rate}
              onChange={(e) => setPrefs((p) => ({ ...p, electricity_rate: e.target.value }))}
              data-testid="settings-electricity-rate-input"
            />
            <p className="text-xs text-muted-foreground font-body">
              Default for {selectedCountry.name}: {selectedCountry.symbol}{selectedCountry.rate}/kWh.
              You can adjust this to match your actual electricity bill.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="glow-primary" data-testid="settings-save-btn">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
        Save Preferences
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calculator, Zap, Cylinder, DollarSign, Layers } from "lucide-react";
import { toast } from "sonner";

export default function CalculatorPage() {
  const [filaments, setFilaments] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [prefs, setPrefs] = useState({ currency_symbol: "$", electricity_rate: 0.12 });

  const [mode, setMode] = useState("inventory");
  const [selectedFilament, setSelectedFilament] = useState("");
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [manualCostPerKg, setManualCostPerKg] = useState(25);
  const [manualPowerKw, setManualPowerKw] = useState(0.2);
  const [weightGrams, setWeightGrams] = useState(50);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [result, setResult] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/filaments"),
      api.get("/printers"),
      api.get("/user/preferences"),
    ]).then(([fRes, pRes, prefRes]) => {
      setFilaments(fRes.data);
      setPrinters(pRes.data);
      setPrefs(prefRes.data);
    }).catch(() => {});
  }, []);

  const handleCalculate = () => {
    let costPerKg = manualCostPerKg;
    let powerKw = manualPowerKw;

    if (mode === "inventory") {
      const fil = filaments.find((f) => f.id === selectedFilament);
      if (fil) {
        costPerKg = (fil.cost / Math.max(fil.weight_total, 1)) * 1000;
      }
      const pr = printers.find((p) => p.id === selectedPrinter);
      if (pr) {
        powerKw = pr.power_kwh || 0.2;
      }
    }

    const filamentCost = weightGrams * (costPerKg / 1000);
    const electricityCost = powerKw * (durationMinutes / 60) * Number(prefs.electricity_rate || 0.12);
    const total = filamentCost + electricityCost;

    setResult({
      filament_cost: filamentCost,
      electricity_cost: electricityCost,
      total_cost: total,
      cost_per_gram: filamentCost / Math.max(weightGrams, 0.01),
    });
  };

  const sym = prefs.currency_symbol || "$";
  const fmt = (v) => `${sym}${Number(v).toFixed(2)}`;

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-6" data-testid="calculator-page">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="calculator-title">
          3D Print Cost Calculator
        </h2>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Estimate the cost of your next print based on filament and electricity usage
        </p>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Cost Estimation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-2">
            <Button
              variant={mode === "inventory" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("inventory")}
              data-testid="calc-mode-inventory"
            >
              From Inventory
            </Button>
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("manual")}
              data-testid="calc-mode-manual"
            >
              Manual Entry
            </Button>
          </div>

          {mode === "inventory" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Cylinder className="w-3 h-3" /> Filament</Label>
                <Select value={selectedFilament} onValueChange={setSelectedFilament}>
                  <SelectTrigger data-testid="calc-filament-select">
                    <SelectValue placeholder="Select filament" />
                  </SelectTrigger>
                  <SelectContent>
                    {filaments.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: f.color_hex || "#888" }} />
                          {f.brand} {f.filament_type} - {f.color} ({sym}{f.cost})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Layers className="w-3 h-3" /> Printer</Label>
                <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                  <SelectTrigger data-testid="calc-printer-select">
                    <SelectValue placeholder="Select printer" />
                  </SelectTrigger>
                  <SelectContent>
                    {printers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.power_kwh || 0.2} kW)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Filament Cost per kg ({sym})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={manualCostPerKg}
                  onChange={(e) => setManualCostPerKg(Number(e.target.value))}
                  data-testid="calc-manual-cost-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Printer Power (kW)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={manualPowerKw}
                  onChange={(e) => setManualPowerKw(Number(e.target.value))}
                  data-testid="calc-manual-power-input"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weight Used (g)</Label>
              <Input
                type="number"
                step="0.1"
                value={weightGrams}
                onChange={(e) => setWeightGrams(Number(e.target.value))}
                data-testid="calc-weight-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated Duration (min)</Label>
              <Input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                data-testid="calc-duration-input"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground font-body">
            <Zap className="w-3 h-3" />
            Electricity rate: {sym}{prefs.electricity_rate}/kWh
            <span className="text-muted-foreground/50">
              (change in Settings)
            </span>
          </div>

          <Button onClick={handleCalculate} className="w-full glow-primary" data-testid="calc-calculate-btn">
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Cost
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-primary/30 animate-fade-up" data-testid="calc-result">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-lg bg-muted/50" data-testid="calc-filament-cost">
                <Cylinder className="w-5 h-5 mx-auto text-primary mb-2" />
                <p className="text-xs text-muted-foreground font-body mb-1">Filament Cost</p>
                <p className="text-2xl font-bold font-mono">{fmt(result.filament_cost)}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {fmt(result.cost_per_gram)}/g
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50" data-testid="calc-electricity-cost">
                <Zap className="w-5 h-5 mx-auto text-yellow-500 mb-2" />
                <p className="text-xs text-muted-foreground font-body mb-1">Electricity Cost</p>
                <p className="text-2xl font-bold font-mono">{fmt(result.electricity_cost)}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/20" data-testid="calc-total-cost">
                <DollarSign className="w-5 h-5 mx-auto text-primary mb-2" />
                <p className="text-xs text-muted-foreground font-body mb-1">Total Estimated Cost</p>
                <p className="text-3xl font-bold font-mono text-primary">{fmt(result.total_cost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

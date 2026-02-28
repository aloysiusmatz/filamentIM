import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Plus, MoreHorizontal, Pencil, Trash2, CalendarIcon, Loader2, Search, Filter,
  Download, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreatableCombobox } from "@/components/CreatableCombobox";
import { COLOR_TEMPLATES } from "@/lib/colors";

const BRANDS = [
  "Hatchbox", "Prusament", "eSUN", "Polymaker", "Overture", "Sunlu",
  "Inland", "MatterHackers", "ColorFabb", "Proto-pasta", "Bambu Lab",
  "Creality", "Eryone", "TTYT3D", "Geeetech", "Elegoo", "Anycubic",
  "3D Solutech", "Duramic", "ZIRO", "Other",
];

const TYPES = [
  "PLA", "PLA+", "ABS", "ABS+", "PETG", "PETG+", "TPU", "Nylon",
  "ASA", "PC", "HIPS", "PVA", "Wood PLA", "Carbon Fiber PLA",
  "Silk PLA", "Marble PLA", "Glow-in-Dark PLA", "Metal Fill PLA",
  "PEEK", "PEI", "Other",
];

const emptyForm = {
  brand: "", filament_type: "", color: "", color_hex: "#f97316",
  weight_total: 1000, weight_remaining: 1000, cost: 0,
  diameter: 1.75, temp_nozzle: 200, temp_bed: 60,
  purchase_date: null, notes: "",
};

function FilamentDialog({ open, onClose, filament, onSave, allBrands, allTypes, currencySymbol }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    if (filament) {
      setForm({
        ...emptyForm,
        ...filament,
        purchase_date: filament.purchase_date ? new Date(filament.purchase_date) : null,
      });
    } else {
      setForm(emptyForm);
    }
    setShowColors(false);
  }, [filament, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        weight_total: Number(form.weight_total),
        weight_remaining: Number(form.weight_remaining),
        cost: Number(form.cost),
        diameter: Number(form.diameter),
        temp_nozzle: Number(form.temp_nozzle),
        temp_bed: Number(form.temp_bed),
        purchase_date: form.purchase_date ? format(form.purchase_date, "yyyy-MM-dd") : null,
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="filament-dialog-title">
            {filament ? "Edit Filament" : "Add Filament"}
          </DialogTitle>
          <DialogDescription>
            {filament ? "Update filament spool details" : "Add a new filament spool to your inventory"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="filament-form">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand</Label>
              <CreatableCombobox
                options={allBrands}
                value={form.brand}
                onChange={(v) => set("brand", v)}
                onCustomAdd={(v) => {
                  api.post("/reference/custom-brands", { name: v }).then(() => fetchUserOptions()).catch(() => {});
                }}
                placeholder="Select or add brand"
                testId="filament-brand-select"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <CreatableCombobox
                options={allTypes}
                value={form.filament_type}
                onChange={(v) => set("filament_type", v)}
                onCustomAdd={(v) => {
                  api.post("/reference/custom-types", { name: v }).then(() => fetchUserOptions()).catch(() => {});
                }}
                placeholder="Select or add type"
                testId="filament-type-select"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Color Name</Label>
              <Input
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                placeholder="e.g. Bright Orange"
                data-testid="filament-color-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.color_hex}
                  onChange={(e) => set("color_hex", e.target.value)}
                  className="w-10 h-9 rounded-md border cursor-pointer"
                  data-testid="filament-color-hex-input"
                />
                <Input
                  value={form.color_hex}
                  onChange={(e) => set("color_hex", e.target.value)}
                  placeholder="#f97316"
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColors(!showColors)}
                  data-testid="toggle-color-templates-btn"
                  className="text-xs whitespace-nowrap"
                >
                  {showColors ? "Hide" : "Templates"}
                </Button>
              </div>
            </div>
          </div>

          {showColors && (
            <div className="space-y-2 animate-fade-up" data-testid="color-templates-grid">
              <Label className="text-xs text-muted-foreground">Pick a color template</Label>
              <div className="grid grid-cols-10 sm:grid-cols-12 gap-1.5 max-h-[120px] overflow-y-auto p-1">
                {COLOR_TEMPLATES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    className={`w-6 h-6 rounded border-2 cursor-pointer transition-transform hover:scale-125 ${
                      form.color_hex?.toUpperCase() === c.hex.toUpperCase()
                        ? "border-primary ring-1 ring-primary scale-110"
                        : "border-border/50"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => { set("color", c.name); set("color_hex", c.hex); }}
                    data-testid={`color-template-${c.name.toLowerCase().replace(/\s/g, "-")}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Total Weight (g)</Label>
              <Input
                type="number"
                value={form.weight_total}
                onChange={(e) => set("weight_total", e.target.value)}
                data-testid="filament-weight-total-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Remaining (g)</Label>
              <Input
                type="number"
                value={form.weight_remaining}
                onChange={(e) => set("weight_remaining", e.target.value)}
                data-testid="filament-weight-remaining-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Cost ({currencySymbol || "$"})</Label>
              <Input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => set("cost", e.target.value)}
                data-testid="filament-cost-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Diameter (mm)</Label>
              <Select value={String(form.diameter)} onValueChange={(v) => set("diameter", Number(v))}>
                <SelectTrigger data-testid="filament-diameter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.75">1.75mm</SelectItem>
                  <SelectItem value="2.85">2.85mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nozzle Temp</Label>
              <Input
                type="number"
                value={form.temp_nozzle}
                onChange={(e) => set("temp_nozzle", e.target.value)}
                data-testid="filament-temp-nozzle-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Bed Temp</Label>
              <Input
                type="number"
                value={form.temp_bed}
                onChange={(e) => set("temp_bed", e.target.value)}
                data-testid="filament-temp-bed-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Purchase Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="filament-date-btn"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.purchase_date ? format(form.purchase_date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.purchase_date}
                  onSelect={(d) => { set("purchase_date", d); setDateOpen(false); }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              data-testid="filament-notes-input"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="filament-cancel-btn">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="glow-primary" data-testid="filament-save-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {filament ? "Update" : "Add Spool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [allBrands, setAllBrands] = useState(BRANDS);
  const [allTypes, setAllTypes] = useState(TYPES);
  const [prefs, setPrefs] = useState({ currency_symbol: "$" });
  const fileInputRef = useRef(null);

  const fetchFilaments = useCallback(async () => {
    try {
      const params = {};
      if (filterType !== "all") params.filament_type = filterType;
      if (filterBrand !== "all") params.brand = filterBrand;
      const res = await api.get("/filaments", { params });
      setFilaments(res.data);
    } catch {
      toast.error("Failed to load filaments");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterBrand]);

  const fetchUserOptions = useCallback(async () => {
    try {
      const res = await api.get("/reference/user-options");
      const userBrands = res.data.brands || [];
      const userTypes = res.data.types || [];
      const merged_brands = [...new Set([...BRANDS, ...userBrands])];
      const merged_types = [...new Set([...TYPES, ...userTypes])];
      setAllBrands(merged_brands);
      setAllTypes(merged_types);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchFilaments(); fetchUserOptions(); }, [fetchFilaments, fetchUserOptions]);

  useEffect(() => {
    api.get("/user/preferences").then((res) => setPrefs(res.data)).catch(() => {});
  }, []);

  const handleSave = async (data) => {
    if (editing) {
      await api.put(`/filaments/${editing.id}`, data);
      toast.success("Filament updated");
    } else {
      await api.post("/filaments", data);
      toast.success("Filament added");
    }
    setEditing(null);
    fetchFilaments();
    fetchUserOptions();
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/filaments/${id}`);
      toast.success("Filament deleted");
      fetchFilaments();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get("/filaments/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `filaments_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Exported successfully");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/filaments/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`Imported ${res.data.count} filaments`);
      fetchFilaments();
      fetchUserOptions();
      setImportOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = filaments.filter((f) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      f.brand?.toLowerCase().includes(s) ||
      f.color?.toLowerCase().includes(s) ||
      f.filament_type?.toLowerCase().includes(s)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] space-y-6" data-testid="filaments-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="filaments-title">
            Filament Inventory
          </h2>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {filaments.length} spool{filaments.length !== 1 ? "s" : ""} in stock
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={filaments.length === 0}
            data-testid="export-csv-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              data-testid="import-csv-btn"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Import CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
              data-testid="import-file-input"
            />
          </div>
          <Button
            onClick={() => { setEditing(null); setDialogOpen(true); }}
            className="glow-primary"
            data-testid="add-filament-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Spool
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search filaments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="filament-search-input"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]" data-testid="filter-type-select">
            <Filter className="w-3 h-3 mr-2" />
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger className="w-[160px]" data-testid="filter-brand-select">
            <Filter className="w-3 h-3 mr-2" />
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/40 overflow-hidden">
        <Table data-testid="filaments-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="hidden md:table-cell">Temps</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground font-body">
                  {filaments.length === 0
                    ? "No filaments yet. Add your first spool!"
                    : "No filaments match your filters"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((f) => {
                const pct = f.weight_total > 0 ? (f.weight_remaining / f.weight_total) * 100 : 0;
                const pctColor = pct < 10 ? "text-destructive" : pct < 20 ? "text-yellow-500" : "text-green-500";
                return (
                  <TableRow key={f.id} data-testid={`filament-row-${f.id}`} className="group">
                    <TableCell>
                      <div className="color-swatch" style={{ backgroundColor: f.color_hex || "#888" }} />
                    </TableCell>
                    <TableCell className="font-medium font-body">{f.brand}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">{f.filament_type}</Badge>
                    </TableCell>
                    <TableCell className="font-body">{f.color}</TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        <span className={`font-mono text-sm ${pctColor}`}>
                          {f.weight_remaining}g / {f.weight_total}g
                        </span>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">${f.cost}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                      {f.temp_nozzle}/{f.temp_bed}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`filament-actions-${f.id}`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => { setEditing(f); setDialogOpen(true); }}
                            data-testid={`edit-filament-${f.id}`}
                          >
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(f.id)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`delete-filament-${f.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <FilamentDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        filament={editing}
        onSave={handleSave}
        allBrands={allBrands}
        allTypes={allTypes}
      />
    </div>
  );
}

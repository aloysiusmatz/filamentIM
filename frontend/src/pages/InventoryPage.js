import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
    Plus, MoreHorizontal, Pencil, Trash2, Loader2, Search, Filter,
    PackageOpen, QrCode, Warehouse, Disc3, Undo2, SlidersHorizontal, ArrowDown, ArrowUp,
    Upload, Download, FileUp,
} from "lucide-react";
import { toast } from "sonner";
import { CreatableCombobox } from "@/components/CreatableCombobox";
import { COLOR_TEMPLATES } from "@/lib/colors";
import { QRCodeSVG } from "qrcode.react";

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

const emptyStockForm = {
    brand: "", filament_type: "", color: "", color_hex: "#f97316",
    empty_spool_weight: 250, weight_total: 1000, cost: 0, quantity_in_stock: 1,
};

/* ──────────────────────────────────────────────────────────────────
   Master Stock Dialog
   ────────────────────────────────────────────────────────────────── */

function MasterStockDialog({ open, onClose, stock, onSave, allBrands, allTypes, currencySymbol, fetchUserOptions }) {
    const [form, setForm] = useState(emptyStockForm);
    const [saving, setSaving] = useState(false);
    const [showColors, setShowColors] = useState(false);

    useEffect(() => {
        if (stock) {
            setForm({ ...emptyStockForm, ...stock });
        } else {
            setForm(emptyStockForm);
        }
        setShowColors(false);
    }, [stock, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                empty_spool_weight: Number(form.empty_spool_weight),
                weight_total: Number(form.weight_total),
                cost: Number(form.cost),
                quantity_in_stock: Number(form.quantity_in_stock),
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
                    <DialogTitle data-testid="stock-dialog-title">
                        {stock ? "Edit Master Stock" : "Add Master Stock"}
                    </DialogTitle>
                    <DialogDescription>
                        {stock ? "Update warehouse stock details" : "Add bulk/unopened spools to your warehouse"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4" data-testid="stock-form">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Brand</Label>
                            <CreatableCombobox
                                options={allBrands}
                                value={form.brand}
                                onChange={(v) => set("brand", v)}
                                onCustomAdd={(v) => {
                                    api.post("/reference/custom-brands", { name: v }).then(() => fetchUserOptions?.()).catch(() => { });
                                }}
                                placeholder="Select or add brand"
                                testId="stock-brand-select"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <CreatableCombobox
                                options={allTypes}
                                value={form.filament_type}
                                onChange={(v) => set("filament_type", v)}
                                onCustomAdd={(v) => {
                                    api.post("/reference/custom-types", { name: v }).then(() => fetchUserOptions?.()).catch(() => { });
                                }}
                                placeholder="Select or add type"
                                testId="stock-type-select"
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
                                data-testid="stock-color-input"
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
                                    data-testid="stock-color-hex-input"
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
                                        className={`w-6 h-6 rounded border-2 cursor-pointer transition-transform hover:scale-125 ${form.color_hex?.toUpperCase() === c.hex.toUpperCase()
                                            ? "border-primary ring-1 ring-primary scale-110"
                                            : "border-border/50"
                                            }`}
                                        style={{ backgroundColor: c.hex }}
                                        onClick={() => { set("color", c.name); set("color_hex", c.hex); }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Wt per Spool (g)</Label>
                            <Input
                                type="number"
                                value={form.weight_total}
                                onChange={(e) => set("weight_total", e.target.value)}
                                data-testid="stock-weight-total-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Empty Spool (g)</Label>
                            <Input
                                type="number"
                                value={form.empty_spool_weight}
                                onChange={(e) => set("empty_spool_weight", e.target.value)}
                                data-testid="stock-empty-spool-weight-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Cost/Spool ({currencySymbol || "$"})</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={form.cost}
                                onChange={(e) => set("cost", e.target.value)}
                                data-testid="stock-cost-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Qty in Stock</Label>
                            <Input
                                type="number"
                                min="0"
                                value={form.quantity_in_stock}
                                onChange={(e) => set("quantity_in_stock", e.target.value)}
                                data-testid="stock-quantity-input"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} data-testid="stock-cancel-btn">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving} className="glow-primary" data-testid="stock-save-btn">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {stock ? "Update" : "Add Stock"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* ──────────────────────────────────────────────────────────────────
   Active Spool QR Dialog
   ────────────────────────────────────────────────────────────────── */

function SpoolDetailDialog({ open, onClose, spool }) {
    if (!spool) return null;
    const pct = spool.weight_total > 0 ? (spool.weight_remaining / spool.weight_total) * 100 : 0;
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-primary" />
                        Spool Details
                    </DialogTitle>
                    <DialogDescription>
                        {spool.unique_string_id}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="p-4 bg-white rounded-xl shadow-sm border">
                        <QRCodeSVG value={spool.unique_string_id} size={180} />
                    </div>
                    <p className="font-mono text-lg font-bold tracking-wider">{spool.unique_string_id}</p>
                    <div className="w-full space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Brand</span>
                            <span className="font-medium">{spool.brand}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <Badge variant="secondary" className="font-mono text-xs">{spool.filament_type}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Color</span>
                            <div className="flex items-center gap-2">
                                <div className="color-swatch" style={{ backgroundColor: spool.color_hex || "#888" }} />
                                <span>{spool.color}</span>
                            </div>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <Badge variant={spool.status === "DEPLETED" ? "destructive" : "default"}>
                                {spool.status}
                            </Badge>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Remaining</span>
                                <span className="font-mono">{spool.weight_remaining}g / {spool.weight_total}g</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ──────────────────────────────────────────────────────────────────
   Adjust Spool Sheet
   ────────────────────────────────────────────────────────────────── */

function AdjustSpoolSheet({ open, onClose, spool, onAdjusted }) {
    const [mode, setMode] = useState("subtract");
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setMode("subtract");
            setAmount("");
            setReason("");
        }
    }, [open]);

    if (!spool) return null;

    const adjType = mode === "add" ? "positive_correction" : "scrap";

    const handleSubmit = async (e) => {
        e.preventDefault();
        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        setSaving(true);
        try {
            await api.post(`/active-spools/${spool.id}/adjust`, {
                amount: numAmount,
                type: adjType,
                notes: reason,
            });
            toast.success(`Spool adjusted: ${mode === "add" ? "+" : "−"}${numAmount}g`);
            onAdjusted();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Adjustment failed");
        } finally {
            setSaving(false);
        }
    };

    const preview = (() => {
        const numAmt = Number(amount) || 0;
        if (mode === "add") {
            return Math.min(spool.weight_remaining + numAmt, spool.weight_total);
        }
        return Math.max(spool.weight_remaining - numAmt, 0);
    })();

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-md">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <SlidersHorizontal className="w-5 h-5 text-primary" />
                        Adjust Spool
                    </SheetTitle>
                    <SheetDescription>
                        {spool.unique_string_id} &mdash; {spool.brand} {spool.filament_type} {spool.color}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                    {/* Current weight info */}
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/40 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Current Weight</p>
                        <p className="text-lg font-bold font-mono">{spool.weight_remaining}g <span className="text-sm text-muted-foreground font-normal">/ {spool.weight_total}g</span></p>
                    </div>

                    {/* Mode selector */}
                    <div className="space-y-3">
                        <Label>Adjustment Mode</Label>
                        <RadioGroup value={mode} onValueChange={setMode} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="add" id="mode-add" data-testid="adjust-mode-add" />
                                <Label htmlFor="mode-add" className="flex items-center gap-1.5 cursor-pointer font-normal">
                                    <ArrowUp className="w-4 h-4 text-green-500" />
                                    Add
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="subtract" id="mode-subtract" data-testid="adjust-mode-subtract" />
                                <Label htmlFor="mode-subtract" className="flex items-center gap-1.5 cursor-pointer font-normal">
                                    <ArrowDown className="w-4 h-4 text-red-500" />
                                    Subtract
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <Label>Amount (grams)</Label>
                        <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 50"
                            data-testid="adjust-amount-input"
                        />
                    </div>

                    {/* Preview */}
                    {Number(amount) > 0 && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">After Adjustment</p>
                            <p className="text-lg font-bold font-mono">
                                <span className={preview <= 0 ? "text-destructive" : "text-green-500"}>{preview}g</span>
                                <span className="text-sm text-muted-foreground font-normal ml-2">
                                    ({mode === "add" ? "+" : "−"}{Number(amount) || 0}g)
                                </span>
                            </p>
                            {preview <= 0 && (
                                <p className="text-xs text-destructive">⚠ Spool will be marked as DEPLETED</p>
                            )}
                        </div>
                    )}

                    {/* Reason */}
                    <div className="space-y-2">
                        <Label>Reason / Notes</Label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={mode === "subtract" ? "e.g. Scrap from failed print, calibration waste" : "e.g. Weight correction after measuring"}
                            rows={2}
                            data-testid="adjust-notes-input"
                        />
                    </div>

                    <SheetFooter className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving || !Number(amount)}
                            className="flex-1 glow-primary"
                            data-testid="adjust-save-btn"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {mode === "add" ? "Add Weight" : "Subtract Weight"}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}

/* ──────────────────────────────────────────────────────────────────
   CSV Import Dialog
   ────────────────────────────────────────────────────────────────── */

function ImportCSVDialog({ open, onClose, onImported }) {
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const fileRef = useRef(null);

    useEffect(() => {
        if (open) {
            setFile(null);
            setResult(null);
        }
    }, [open]);

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        setResult(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await api.post("/inventory/import", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setResult(res.data);
            const d = res.data;
            toast.success(
                `Import done: ${d.warehouse_created} created, ${d.warehouse_updated} updated, ${d.spools_created} spools`
            );
            onImported();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Import failed");
        } finally {
            setImporting(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const res = await api.get("/inventory/export-template", { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "inventory_template.csv");
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast.error("Failed to download template");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileUp className="w-5 h-5 text-primary" />
                        Import Inventory CSV
                    </DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to bulk-import warehouse stock and active spools.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Template download */}
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/40">
                        <p className="text-sm text-muted-foreground mb-2">
                            Need the template? Download one pre-filled with your current inventory:
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadTemplate}
                            data-testid="download-template-btn"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download CSV Template
                        </Button>
                    </div>

                    {/* File picker */}
                    <div className="space-y-2">
                        <Label>CSV File</Label>
                        <div
                            className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => fileRef.current?.click()}
                            data-testid="csv-drop-zone"
                        >
                            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                            {file ? (
                                <p className="text-sm font-medium">{file.name}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
                            )}
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                data-testid="csv-file-input"
                            />
                        </div>
                    </div>

                    {/* Import result */}
                    {result && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/40 space-y-1 text-sm">
                            <p className="font-medium">Import Results:</p>
                            <ul className="space-y-0.5 text-muted-foreground">
                                <li>✅ Warehouse created: <span className="font-mono font-bold text-foreground">{result.warehouse_created}</span></li>
                                <li>🔄 Warehouse updated: <span className="font-mono font-bold text-foreground">{result.warehouse_updated}</span></li>
                                <li>🎯 Active spools created: <span className="font-mono font-bold text-foreground">{result.spools_created}</span></li>
                                {result.total_errors > 0 && (
                                    <li className="text-destructive">
                                        ⚠ {result.total_errors} error{result.total_errors !== 1 ? "s" : ""}:
                                        <ul className="pl-4 mt-1 space-y-0.5">
                                            {result.errors.map((e, i) => <li key={i} className="text-xs">{e}</li>)}
                                        </ul>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} data-testid="import-cancel-btn">
                        {result ? "Done" : "Cancel"}
                    </Button>
                    {!result && (
                        <Button
                            onClick={handleImport}
                            disabled={!file || importing}
                            className="glow-primary"
                            data-testid="import-submit-btn"
                        >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                            Import
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ──────────────────────────────────────────────────────────────────
   Main Inventory Page
   ────────────────────────────────────────────────────────────────── */

export default function InventoryPage() {
    const [masterStock, setMasterStock] = useState([]);
    const [activeSpools, setActiveSpools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stockDialogOpen, setStockDialogOpen] = useState(false);
    const [editingStock, setEditingStock] = useState(null);
    const [spoolDetailOpen, setSpoolDetailOpen] = useState(false);
    const [selectedSpool, setSelectedSpool] = useState(null);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterBrand, setFilterBrand] = useState("all");
    const [allBrands, setAllBrands] = useState(BRANDS);
    const [allTypes, setAllTypes] = useState(TYPES);
    const [prefs, setPrefs] = useState({ currency_symbol: "$" });
    const [opening, setOpening] = useState(null); // stock id being opened
    const [openConfirmStock, setOpenConfirmStock] = useState(null); // stock object for confirmation
    const [adjustSheetOpen, setAdjustSheetOpen] = useState(false);
    const [adjustingSpool, setAdjustingSpool] = useState(null);
    const [returning, setReturning] = useState(null); // spool id being returned
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [stockRes, spoolsRes] = await Promise.all([
                api.get("/master-stock"),
                api.get("/active-spools"),
            ]);
            setMasterStock(stockRes.data);
            setActiveSpools(spoolsRes.data);
        } catch {
            toast.error("Failed to load inventory");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUserOptions = useCallback(async () => {
        try {
            const res = await api.get("/reference/user-options");
            const userBrands = res.data.brands || [];
            const userTypes = res.data.types || [];
            setAllBrands([...new Set([...BRANDS, ...userBrands])]);
            setAllTypes([...new Set([...TYPES, ...userTypes])]);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchData(); fetchUserOptions(); }, [fetchData, fetchUserOptions]);
    useEffect(() => {
        api.get("/user/preferences").then((r) => setPrefs(r.data)).catch(() => { });
    }, []);

    const handleSaveStock = async (data) => {
        if (editingStock) {
            await api.put(`/master-stock/${editingStock.id}`, data);
            toast.success("Stock updated");
        } else {
            await api.post("/master-stock", data);
            toast.success("Stock added");
        }
        setEditingStock(null);
        fetchData();
        fetchUserOptions();
    };

    const handleDeleteStock = async (id) => {
        try {
            await api.delete(`/master-stock/${id}`);
            toast.success("Stock deleted");
            fetchData();
        } catch {
            toast.error("Failed to delete");
        }
    };

    const handleOpenSpool = async (stockId) => {
        setOpening(stockId);
        try {
            const res = await api.post(`/master-stock/${stockId}/open`);
            toast.success(`Spool opened: ${res.data.active_spool.unique_string_id}`);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to open spool");
        } finally {
            setOpening(null);
        }
    };

    const handleReturnSpool = async (spoolId) => {
        setReturning(spoolId);
        try {
            await api.post(`/active-spools/${spoolId}/return`);
            toast.success("Spool returned to warehouse");
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to return spool");
        } finally {
            setReturning(null);
        }
    };

    const filteredStock = masterStock.filter((s) => {
        if (filterType !== "all" && s.filament_type !== filterType) return false;
        if (filterBrand !== "all" && s.brand !== filterBrand) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return s.brand?.toLowerCase().includes(q) || s.color?.toLowerCase().includes(q) || s.filament_type?.toLowerCase().includes(q);
    });

    const filteredSpools = activeSpools.filter((s) => {
        if (filterType !== "all" && s.filament_type !== filterType) return false;
        if (filterBrand !== "all" && s.brand !== filterBrand) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            s.brand?.toLowerCase().includes(q) ||
            s.color?.toLowerCase().includes(q) ||
            s.filament_type?.toLowerCase().includes(q) ||
            s.unique_string_id?.toLowerCase().includes(q)
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
        <div className="p-4 md:p-8 max-w-[1600px] space-y-6" data-testid="inventory-page">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight" data-testid="inventory-title">
                        Inventory
                    </h2>
                    <p className="text-sm text-muted-foreground font-body mt-1">
                        {masterStock.length} stock record{masterStock.length !== 1 ? "s" : ""} &middot; {activeSpools.length} active spool{activeSpools.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setImportDialogOpen(true)}
                        data-testid="import-csv-btn"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Import
                    </Button>
                    <Button
                        onClick={() => { setEditingStock(null); setStockDialogOpen(true); }}
                        className="glow-primary"
                        data-testid="add-stock-btn"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Stock
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Search inventory..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        data-testid="inventory-search"
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

            {/* Tabs */}
            <Tabs defaultValue="warehouse" className="space-y-4">
                <TabsList className="bg-muted/50">
                    <TabsTrigger value="warehouse" className="flex items-center gap-2" data-testid="tab-warehouse">
                        <Warehouse className="w-4 h-4" />
                        Warehouse Stock
                    </TabsTrigger>
                    <TabsTrigger value="active" className="flex items-center gap-2" data-testid="tab-active">
                        <Disc3 className="w-4 h-4" />
                        Active Spools
                    </TabsTrigger>
                </TabsList>

                {/* ── Warehouse Stock Tab ─────────────────────────────────────── */}
                <TabsContent value="warehouse">
                    <Card className="border-border/40 overflow-hidden">
                        <Table data-testid="master-stock-table">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[40px]"></TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Color</TableHead>
                                    <TableHead className="text-right">Wt/Spool</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="w-[120px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStock.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground font-body">
                                            {masterStock.length === 0
                                                ? "No warehouse stock yet. Add your first batch!"
                                                : "No records match your filters"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredStock.map((s) => (
                                        <TableRow key={s.id} data-testid={`stock-row-${s.id}`} className="group">
                                            <TableCell>
                                                <div className="color-swatch" style={{ backgroundColor: s.color_hex || "#888" }} />
                                            </TableCell>
                                            <TableCell className="font-medium font-body">{s.brand}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-mono text-xs">{s.filament_type}</Badge>
                                            </TableCell>
                                            <TableCell className="font-body">{s.color}</TableCell>
                                            <TableCell className="text-right font-mono">{s.weight_total}g</TableCell>
                                            <TableCell className="text-right font-mono">{prefs.currency_symbol || "$"}{s.cost}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    variant={s.quantity_in_stock > 0 ? "default" : "destructive"}
                                                    className="font-mono"
                                                >
                                                    {s.quantity_in_stock}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setOpenConfirmStock(s)}
                                                        disabled={s.quantity_in_stock <= 0 || opening === s.id}
                                                        className="text-xs"
                                                        data-testid={`open-spool-${s.id}`}
                                                    >
                                                        {opening === s.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                        ) : (
                                                            <PackageOpen className="w-3 h-3 mr-1" />
                                                        )}
                                                        Open
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                                data-testid={`stock-actions-${s.id}`}
                                                            >
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => { setEditingStock(s); setStockDialogOpen(true); }}
                                                                data-testid={`edit-stock-${s.id}`}
                                                            >
                                                                <Pencil className="w-4 h-4 mr-2" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteStock(s.id)}
                                                                className="text-destructive focus:text-destructive"
                                                                data-testid={`delete-stock-${s.id}`}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* ── Active Spools Tab ───────────────────────────────────────── */}
                <TabsContent value="active">
                    <Card className="border-border/40 overflow-hidden">
                        <Table data-testid="active-spools-table">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[40px]"></TableHead>
                                    <TableHead>Spool ID</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Color</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Remaining</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSpools.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground font-body">
                                            {activeSpools.length === 0
                                                ? "No active spools. Open one from Warehouse Stock!"
                                                : "No spools match your filters"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSpools.map((s) => {
                                        const pct = s.weight_total > 0 ? (s.weight_remaining / s.weight_total) * 100 : 0;
                                        const pctColor = pct < 10 ? "text-destructive" : pct < 20 ? "text-yellow-500" : "text-green-500";
                                        const isUnused = s.weight_remaining === s.weight_total;
                                        return (
                                            <TableRow key={s.id} data-testid={`spool-row-${s.id}`} className="group">
                                                <TableCell>
                                                    <div className="color-swatch" style={{ backgroundColor: s.color_hex || "#888" }} />
                                                </TableCell>
                                                <TableCell className="font-mono text-sm font-bold">{s.unique_string_id}</TableCell>
                                                <TableCell className="font-medium font-body">{s.brand}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-mono text-xs">{s.filament_type}</Badge>
                                                </TableCell>
                                                <TableCell className="font-body">{s.color}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={s.status === "DEPLETED" ? "destructive" : "default"}
                                                        className={s.status === "DEPLETED" ? "" : "bg-green-500/15 text-green-600 border-green-500/30"}
                                                    >
                                                        {s.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="space-y-1">
                                                        <span className={`font-mono text-sm ${pctColor}`}>
                                                            {s.weight_remaining}g / {s.weight_total}g
                                                        </span>
                                                        <Progress value={pct} className="h-1.5" />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                                data-testid={`spool-actions-${s.id}`}
                                                            >
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => { setSelectedSpool(s); setSpoolDetailOpen(true); }}
                                                                data-testid={`spool-qr-${s.id}`}
                                                            >
                                                                <QrCode className="w-4 h-4 mr-2" /> QR Code
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => { setAdjustingSpool(s); setAdjustSheetOpen(true); }}
                                                                data-testid={`spool-adjust-${s.id}`}
                                                            >
                                                                <SlidersHorizontal className="w-4 h-4 mr-2" /> Adjust Stock
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => handleReturnSpool(s.id)}
                                                                disabled={!isUnused || returning === s.id}
                                                                className={!isUnused ? "opacity-50 cursor-not-allowed" : ""}
                                                                data-testid={`spool-return-${s.id}`}
                                                            >
                                                                {returning === s.id ? (
                                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                ) : (
                                                                    <Undo2 className="w-4 h-4 mr-2" />
                                                                )}
                                                                Return to Warehouse
                                                                {!isUnused && <span className="text-xs text-muted-foreground ml-1">(used)</span>}
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
                </TabsContent>
            </Tabs>

            {/* ── Dialogs & Sheets ─────────────────────────────────────────── */}

            <MasterStockDialog
                open={stockDialogOpen}
                onClose={() => { setStockDialogOpen(false); setEditingStock(null); }}
                stock={editingStock}
                onSave={handleSaveStock}
                allBrands={allBrands}
                allTypes={allTypes}
                currencySymbol={prefs.currency_symbol}
                fetchUserOptions={fetchUserOptions}
            />

            <SpoolDetailDialog
                open={spoolDetailOpen}
                onClose={() => { setSpoolDetailOpen(false); setSelectedSpool(null); }}
                spool={selectedSpool}
            />

            <AdjustSpoolSheet
                open={adjustSheetOpen}
                onClose={() => { setAdjustSheetOpen(false); setAdjustingSpool(null); }}
                spool={adjustingSpool}
                onAdjusted={fetchData}
            />

            <ImportCSVDialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                onImported={fetchData}
            />

            {/* Open Spool Confirmation Alert Dialog */}
            <AlertDialog open={!!openConfirmStock} onOpenChange={(open) => { if (!open) setOpenConfirmStock(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Open New Spool?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to open this spool? This will move <strong>1 unit</strong> from{" "}
                            <strong>{openConfirmStock?.brand} {openConfirmStock?.filament_type} {openConfirmStock?.color}</strong>{" "}
                            to your Active Spools.
                            {openConfirmStock?.quantity_in_stock <= 1 && (
                                <span className="block mt-2 text-destructive font-medium">
                                    ⚠ This is your last spool in stock!
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel data-testid="open-confirm-cancel">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (openConfirmStock) {
                                    handleOpenSpool(openConfirmStock.id);
                                }
                                setOpenConfirmStock(null);
                            }}
                            data-testid="open-confirm-action"
                        >
                            <PackageOpen className="w-4 h-4 mr-2" />
                            Open Spool
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

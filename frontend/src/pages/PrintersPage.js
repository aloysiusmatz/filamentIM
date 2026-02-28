import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2, Layers, Box, Ruler, Zap,
} from "lucide-react";
import { toast } from "sonner";

const emptyPrinter = { name: "", model: "", build_volume: "", power_kwh: 0.2, notes: "" };

function PrinterDialog({ open, onClose, printer, onSave }) {
  const [form, setForm] = useState(emptyPrinter);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(printer ? { ...emptyPrinter, ...printer } : emptyPrinter);
  }, [printer, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Printer name required"); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="printer-dialog-title">
            {printer ? "Edit Printer" : "Add Printer"}
          </DialogTitle>
          <DialogDescription>
            {printer ? "Update printer details" : "Add a new 3D printer to your workshop"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="printer-form">
          <div className="space-y-2">
            <Label>Printer Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. My Ender 3 V2"
              required
              data-testid="printer-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder="e.g. Creality Ender 3 V2"
              data-testid="printer-model-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Build Volume (mm)</Label>
            <Input
              value={form.build_volume}
              onChange={(e) => set("build_volume", e.target.value)}
              placeholder="e.g. 220x220x250"
              data-testid="printer-volume-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Power Consumption (kW)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.power_kwh}
              onChange={(e) => set("power_kwh", Number(e.target.value))}
              placeholder="e.g. 0.2"
              data-testid="printer-power-input"
            />
            <p className="text-xs text-muted-foreground font-body">
              Typical FDM printer: 0.1-0.3 kW. Used for cost estimation.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes about this printer..."
              rows={2}
              data-testid="printer-notes-input"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="printer-cancel-btn">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="glow-primary" data-testid="printer-save-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {printer ? "Update" : "Add Printer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PrintersPage() {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchPrinters = useCallback(async () => {
    try {
      const res = await api.get("/printers");
      setPrinters(res.data);
    } catch {
      toast.error("Failed to load printers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrinters(); }, [fetchPrinters]);

  const handleSave = async (data) => {
    if (editing) {
      await api.put(`/printers/${editing.id}`, data);
      toast.success("Printer updated");
    } else {
      await api.post("/printers", data);
      toast.success("Printer added");
    }
    setEditing(null);
    fetchPrinters();
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/printers/${id}`);
      toast.success("Printer deleted");
      fetchPrinters();
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] space-y-6" data-testid="printers-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="printers-title">
            Printers
          </h2>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {printers.length} printer{printers.length !== 1 ? "s" : ""} in your workshop
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="glow-primary"
          data-testid="add-printer-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Printer
        </Button>
      </div>

      {printers.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="py-16 text-center">
            <Layers className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-body">
              No printers yet. Add your first 3D printer!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {printers.map((p, i) => (
            <Card
              key={p.id}
              className="border-border/40 hover:border-primary/30 transition-colors animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
              data-testid={`printer-card-${p.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate" data-testid={`printer-name-${p.id}`}>
                          {p.name}
                        </h3>
                        {p.model && (
                          <p className="text-xs text-muted-foreground font-body truncate">
                            {p.model}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {p.build_volume && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Box className="w-3 h-3" />
                          <span className="font-mono">{p.build_volume}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        <span className="font-mono">{p.power_kwh || 0.2} kW</span>
                      </div>
                      {p.notes && (
                        <p className="text-xs text-muted-foreground font-body mt-2 line-clamp-2">
                          {p.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0" data-testid={`printer-actions-${p.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => { setEditing(p); setDialogOpen(true); }}
                        data-testid={`edit-printer-${p.id}`}
                      >
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(p.id)}
                        className="text-destructive focus:text-destructive"
                        data-testid={`delete-printer-${p.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PrinterDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        printer={editing}
        onSave={handleSave}
      />
    </div>
  );
}

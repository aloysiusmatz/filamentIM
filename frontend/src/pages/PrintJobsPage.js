import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Printer, Clock, Weight, CheckCircle2, XCircle, CircleDot, Ban } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "success", label: "Success", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10 text-green-500 border-green-500/30" },
  { value: "failed", label: "Failed", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 text-red-500 border-red-500/30" },
  { value: "in_progress", label: "In Progress", icon: CircleDot, color: "text-blue-500", bg: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { value: "cancelled", label: "Cancelled", icon: Ban, color: "text-gray-500", bg: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
];

function PrintJobDialog({ open, onClose, filaments, onSave }) {
  const [form, setForm] = useState({
    filament_id: "", project_name: "", weight_used: 0, duration_minutes: 0, status: "success", notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ filament_id: "", project_name: "", weight_used: 0, duration_minutes: 0, status: "success", notes: "" });
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.filament_id) {
      toast.error("Select a filament");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        weight_used: Number(form.weight_used),
        duration_minutes: Number(form.duration_minutes),
      });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to log print");
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const selectedFilament = filaments.find((f) => f.id === form.filament_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="print-job-dialog-title">Log Print Job</DialogTitle>
          <DialogDescription>Record a new print and track filament usage</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="print-job-form">
          <div className="space-y-2">
            <Label>Filament Spool</Label>
            <Select value={form.filament_id} onValueChange={(v) => set("filament_id", v)}>
              <SelectTrigger data-testid="print-job-filament-select">
                <SelectValue placeholder="Select filament" />
              </SelectTrigger>
              <SelectContent>
                {filaments.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm border"
                        style={{ backgroundColor: f.color_hex || "#888" }}
                      />
                      {f.brand} {f.filament_type} - {f.color} ({f.weight_remaining}g left)
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFilament && (
              <p className="text-xs text-muted-foreground font-body">
                Available: {selectedFilament.weight_remaining}g of {selectedFilament.weight_total}g
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Project Name</Label>
            <Input
              value={form.project_name}
              onChange={(e) => set("project_name", e.target.value)}
              placeholder="e.g. Benchy, Phone Stand"
              required
              data-testid="print-job-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weight Used (g)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.weight_used}
                onChange={(e) => set("weight_used", e.target.value)}
                required
                data-testid="print-job-weight-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => set("duration_minutes", e.target.value)}
                data-testid="print-job-duration-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger data-testid="print-job-status-select">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <s.icon className={`w-3 h-3 ${s.color}`} />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              data-testid="print-job-notes-input"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="print-job-cancel-btn">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="glow-primary" data-testid="print-job-save-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Print
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(mins) {
  if (!mins) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function PrintJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [filaments, setFilaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, filRes] = await Promise.all([
        api.get("/print-jobs"),
        api.get("/filaments"),
      ]);
      setJobs(jobsRes.data);
      setFilaments(filRes.data);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (data) => {
    await api.post("/print-jobs", data);
    toast.success("Print job logged");
    fetchData();
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/print-jobs/${id}`);
      toast.success("Print job deleted");
      fetchData();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const totalWeight = jobs.reduce((sum, j) => sum + (j.weight_used || 0), 0);
  const totalTime = jobs.reduce((sum, j) => sum + (j.duration_minutes || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] space-y-6" data-testid="print-jobs-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="print-jobs-title">
            Print Jobs
          </h2>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {jobs.length} print{jobs.length !== 1 ? "s" : ""} logged
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="glow-primary"
          disabled={filaments.length === 0}
          data-testid="add-print-job-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Print
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Printer className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body">Total Prints</p>
              <p className="text-xl font-bold font-mono" data-testid="total-prints">{jobs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Weight className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body">Filament Used</p>
              <p className="text-xl font-bold font-mono" data-testid="total-weight-used">{totalWeight.toFixed(1)}g</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body">Print Time</p>
              <p className="text-xl font-bold font-mono" data-testid="total-print-time">{formatDuration(totalTime)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-border/40 overflow-hidden">
        <Table data-testid="print-jobs-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Filament</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground font-body">
                  {filaments.length === 0
                    ? "Add filaments first, then log your prints"
                    : "No prints logged yet. Start printing!"}
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((j) => (
                <TableRow key={j.id} data-testid={`job-row-${j.id}`} className="group">
                  <TableCell>
                    <div
                      className="color-swatch"
                      style={{ backgroundColor: j.filament_color_hex || "#888" }}
                    />
                  </TableCell>
                  <TableCell className="font-medium font-body">{j.project_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {j.filament_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground font-body">
                        {j.filament_brand} {j.filament_color}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const statusConf = STATUS_OPTIONS.find((s) => s.value === j.status) || STATUS_OPTIONS[0];
                      const Icon = statusConf.icon;
                      return (
                        <Badge variant="outline" className={`font-mono text-xs ${statusConf.bg} border`} data-testid={`job-status-${j.id}`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {statusConf.label}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right font-mono">{j.weight_used}g</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatDuration(j.duration_minutes)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {new Date(j.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => handleDelete(j.id)}
                      data-testid={`delete-job-${j.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <PrintJobDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        filaments={filaments}
        onSave={handleSave}
      />
    </div>
  );
}

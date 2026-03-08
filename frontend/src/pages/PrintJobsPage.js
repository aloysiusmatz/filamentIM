import { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Trash2, Loader2, Printer, Clock, Weight,
  CheckCircle2, XCircle, CircleDot, Ban, MoreHorizontal, Pencil, Layers, DollarSign, Minus,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "success", label: "Finished", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10 text-green-500 border-green-500/30" },
  { value: "failed", label: "Failed", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 text-red-500 border-red-500/30" },
  { value: "in_progress", label: "In Progress", icon: CircleDot, color: "text-blue-500", bg: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { value: "cancelled", label: "Cancelled", icon: Ban, color: "text-gray-500", bg: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
];

function PrintJobDialog({ open, onClose, activeSpools, printers, onSave, editingJob, currencySymbol, electricityRate }) {
  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      project_name: "",
      spools_used: [{ active_spool_id: "", weight_used: 0 }],
      duration_minutes: 0,
      status: "in_progress",
      printer_id: "",
      notes: "",
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "spools_used",
  });

  const [saving, setSaving] = useState(false);
  const isEdit = !!editingJob;
  const watchedSpools = watch("spools_used");
  const watchedPrinterId = watch("printer_id");
  const watchedDuration = watch("duration_minutes");

  useEffect(() => {
    if (open) {
      if (editingJob) {
        reset({
          project_name: editingJob.project_name || "",
          spools_used: editingJob.spools_used?.length > 0
            ? editingJob.spools_used.map((s) => ({
              active_spool_id: s.active_spool_id || "",
              weight_used: s.weight_used || 0,
            }))
            : [{ active_spool_id: "", weight_used: 0 }],
          duration_minutes: editingJob.duration_minutes || 0,
          status: editingJob.status || "in_progress",
          printer_id: editingJob.printer_id || "",
          notes: editingJob.notes || "",
        });
      } else {
        reset({
          project_name: "",
          spools_used: [{ active_spool_id: "", weight_used: 0 }],
          duration_minutes: 0,
          status: "in_progress",
          printer_id: "",
          notes: "",
        });
      }
    }
  }, [open, editingJob, reset]);

  const onSubmit = async (data) => {
    if (!isEdit) {
      const hasSpools = data.spools_used.some((s) => s.active_spool_id);
      if (!hasSpools) {
        toast.error("Select at least one spool");
        return;
      }
    }
    setSaving(true);
    try {
      if (isEdit) {
        await onSave({
          project_name: data.project_name,
          duration_minutes: Number(data.duration_minutes),
          status: data.status,
          printer_id: data.printer_id === "none" ? "" : data.printer_id,
          notes: data.notes,
        }, editingJob.id);
      } else {
        const payload = {
          project_name: data.project_name,
          spools_used: data.spools_used
            .filter((s) => s.active_spool_id)
            .map((s) => ({
              active_spool_id: s.active_spool_id,
              weight_used: Number(s.weight_used),
            })),
          duration_minutes: Number(data.duration_minutes),
          status: data.status,
          printer_id: data.printer_id === "none" ? "" : data.printer_id,
          notes: data.notes,
        };
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Calculate cost preview
  const costPreview = (() => {
    if (isEdit) return null;
    let totalFilCost = 0;
    let hasData = false;
    for (const su of (watchedSpools || [])) {
      if (!su.active_spool_id || !Number(su.weight_used)) continue;
      const spool = activeSpools.find((s) => s.id === su.active_spool_id);
      if (!spool) continue;
      hasData = true;
      const costPerG = (spool.cost || 0) / Math.max(spool.weight_total, 1);
      totalFilCost += Number(su.weight_used) * costPerG;
    }
    if (!hasData) return null;
    const pr = printers.find((p) => p.id === watchedPrinterId);
    const powerKw = pr ? (pr.power_kwh || 0.2) : 0.2;
    const elecCost = powerKw * (Number(watchedDuration) / 60) * (electricityRate || 0.12);
    return { filament: totalFilCost, electricity: elecCost, total: totalFilCost + elecCost };
  })();

  const openSpools = activeSpools.filter((s) => s.status === "OPENED");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="print-job-dialog-title">
            {isEdit ? "Edit Print Job" : "Log Print Job"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update print job details" : "Record a new print and track filament usage"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="print-job-form">
          {/* Project Name */}
          <div className="space-y-2">
            <Label>Project Name</Label>
            <Input
              {...register("project_name", { required: true })}
              placeholder="e.g. Benchy, Phone Stand"
              data-testid="print-job-name-input"
            />
          </div>

          {/* Spools Used */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Spools Used</Label>
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ active_spool_id: "", weight_used: 0 })}
                  data-testid="add-spool-row-btn"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Spool
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {fields.map((field, index) => {
                const selectedId = watchedSpools?.[index]?.active_spool_id;
                const selectedSpool = activeSpools.find((s) => s.id === selectedId);
                return (
                  <div key={field.id} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="flex-1 space-y-2">
                      <Select
                        value={watchedSpools?.[index]?.active_spool_id || ""}
                        onValueChange={(v) => setValue(`spools_used.${index}.active_spool_id`, v)}
                        disabled={isEdit}
                      >
                        <SelectTrigger data-testid={`spool-select-${index}`}>
                          <SelectValue placeholder="Select spool" />
                        </SelectTrigger>
                        <SelectContent>
                          {(isEdit ? activeSpools : openSpools).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-sm border"
                                  style={{ backgroundColor: s.color_hex || "#888" }}
                                />
                                <span className="font-mono text-xs">{s.unique_string_id}</span>
                                <span className="text-muted-foreground text-xs">
                                  {s.brand} {s.filament_type} ({s.weight_remaining}g)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedSpool && !isEdit && (
                        <p className="text-xs text-muted-foreground font-body pl-1">
                          Available: {selectedSpool.weight_remaining}g of {selectedSpool.weight_total}g
                        </p>
                      )}
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Grams"
                        {...register(`spools_used.${index}.weight_used`, { valueAsNumber: true })}
                        disabled={isEdit}
                        data-testid={`spool-weight-${index}`}
                      />
                    </div>
                    {!isEdit && fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 text-destructive hover:text-destructive"
                        onClick={() => remove(index)}
                        data-testid={`remove-spool-${index}`}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Printer */}
          {printers.length > 0 && (
            <div className="space-y-2">
              <Label>Printer</Label>
              <Select
                value={watchedPrinterId || ""}
                onValueChange={(v) => setValue("printer_id", v)}
              >
                <SelectTrigger data-testid="print-job-printer-select">
                  <SelectValue placeholder="Select printer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No printer selected</SelectItem>
                  {printers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <Layers className="w-3 h-3" />
                        {p.name} {p.model ? `(${p.model})` : ""}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Duration + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                {...register("duration_minutes", { valueAsNumber: true })}
                data-testid="print-job-duration-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={watch("status") || "in_progress"}
                onValueChange={(v) => setValue("status", v)}
              >
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
          </div>

          {/* Cost Preview */}
          {costPreview && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/40 space-y-1" data-testid="cost-preview">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Estimated Cost
              </p>
              <div className="flex items-center gap-4 text-sm font-mono">
                <span>Filament: {currencySymbol || "$"}{costPreview.filament.toFixed(2)}</span>
                <span className="text-muted-foreground">+</span>
                <span>Electricity: {currencySymbol || "$"}{costPreview.electricity.toFixed(2)}</span>
                <span className="text-muted-foreground">=</span>
                <span className="font-bold text-primary">{currencySymbol || "$"}{costPreview.total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              {...register("notes")}
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
              {isEdit ? "Update" : "Log Print"}
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
  const [activeSpools, setActiveSpools] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [prefs, setPrefs] = useState({ currency_symbol: "$", electricity_rate: 0.12 });

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, spoolsRes, printerRes, prefRes] = await Promise.all([
        api.get("/print-jobs"),
        api.get("/active-spools"),
        api.get("/printers"),
        api.get("/user/preferences"),
      ]);
      setJobs(jobsRes.data);
      setActiveSpools(spoolsRes.data);
      setPrinters(printerRes.data);
      setPrefs(prefRes.data);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (data, jobId) => {
    if (jobId) {
      await api.put(`/print-jobs/${jobId}`, data);
      toast.success("Print job updated");
    } else {
      await api.post("/print-jobs", data);
      toast.success("Print job logged");
    }
    setEditingJob(null);
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

  const totalWeight = jobs.reduce((sum, j) => sum + (j.total_weight_used || 0), 0);
  const totalTime = jobs.reduce((sum, j) => sum + (j.duration_minutes || 0), 0);
  const successCount = jobs.filter((j) => j.status === "success").length;

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
          onClick={() => { setEditingJob(null); setDialogOpen(true); }}
          className="glow-primary"
          disabled={activeSpools.filter((s) => s.status === "OPENED").length === 0}
          data-testid="add-print-job-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Print
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
        <Card className="p-4 border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-body">Finished</p>
              <p className="text-xl font-bold font-mono text-green-500" data-testid="success-count">{successCount}</p>
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
              <TableHead>Spools</TableHead>
              <TableHead>Printer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground font-body">
                  {activeSpools.length === 0
                    ? "Open some spools first, then log your prints"
                    : "No prints logged yet. Start printing!"}
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((j) => {
                const statusConf = STATUS_OPTIONS.find((s) => s.value === j.status) || STATUS_OPTIONS[0];
                const StatusIcon = statusConf.icon;
                const spoolsUsed = j.spools_used || [];
                const firstSpool = spoolsUsed[0];
                return (
                  <TableRow key={j.id} data-testid={`job-row-${j.id}`} className="group">
                    <TableCell>
                      {firstSpool ? (
                        <div className="color-swatch" style={{ backgroundColor: firstSpool.color_hex || "#888" }} />
                      ) : (
                        <div className="color-swatch" style={{ backgroundColor: "#888" }} />
                      )}
                    </TableCell>
                    <TableCell className="font-medium font-body">{j.project_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {spoolsUsed.map((su, i) => (
                          <Badge key={i} variant="secondary" className="font-mono text-xs">
                            <div
                              className="w-2 h-2 rounded-sm mr-1 inline-block"
                              style={{ backgroundColor: su.color_hex || "#888" }}
                            />
                            {su.unique_string_id || su.filament_type} ({su.weight_used}g)
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {j.printer_name ? (
                        <span className="text-sm font-body">{j.printer_name}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`font-mono text-xs ${statusConf.bg} border`}
                        data-testid={`job-status-${j.id}`}
                      >
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConf.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{j.total_weight_used}g</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatDuration(j.duration_minutes)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm" data-testid={`job-cost-${j.id}`}>
                      {j.estimated_cost != null
                        ? `${prefs.currency_symbol || "$"}${Number(j.estimated_cost).toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {new Date(j.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`job-actions-${j.id}`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => { setEditingJob(j); setDialogOpen(true); }}
                            data-testid={`edit-job-${j.id}`}
                          >
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(j.id)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`delete-job-${j.id}`}
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

      <PrintJobDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingJob(null); }}
        activeSpools={activeSpools}
        printers={printers}
        onSave={handleSave}
        editingJob={editingJob}
        currencySymbol={prefs.currency_symbol}
        electricityRate={prefs.electricity_rate}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cylinder, Weight, DollarSign, AlertTriangle, Printer, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#f97316", "#0ea5e9", "#22c55e", "#eab308", "#a855f7", "#ec4899", "#14b8a6", "#f43f5e"];

function StatCard({ icon: Icon, label, value, sub, delay = 0, testId }) {
  return (
    <Card
      className="animate-fade-up border-border/40 hover:border-primary/30 transition-colors"
      style={{ animationDelay: `${delay}ms` }}
      data-testid={testId}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">
              {label}
            </p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground font-body">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-body">
        No print data yet. Log your first print!
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontFamily: "Manrope",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="weight" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DistributionChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-body">
        Add filaments to see distribution
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          dataKey="count"
          nameKey="name"
          paddingAngle={2}
          label={({ name, count }) => `${name}: ${count}`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontFamily: "Manrope",
            fontSize: "12px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RecentJobs({ jobs }) {
  if (!jobs || jobs.length === 0) {
    return <p className="text-sm text-muted-foreground font-body p-4">No recent prints</p>;
  }
  return (
    <div className="space-y-3 p-1">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          data-testid={`recent-job-${job.id}`}
        >
          <div className="color-swatch" style={{ backgroundColor: job.filament_color_hex || "#888" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{job.project_name}</p>
            <p className="text-xs text-muted-foreground font-body">
              {job.filament_brand} {job.filament_type} &middot; {job.weight_used}g
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(job.created_at).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function LowStockList({ filaments }) {
  if (!filaments || filaments.length === 0) {
    return <p className="text-sm text-muted-foreground font-body p-4">All filaments stocked</p>;
  }
  return (
    <div className="space-y-3 p-1">
      {filaments.map((f) => {
        const pct = f.weight_total > 0 ? ((f.weight_remaining / f.weight_total) * 100).toFixed(0) : 0;
        return (
          <div
            key={f.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20"
            data-testid={`low-stock-${f.id}`}
          >
            <div className="color-swatch" style={{ backgroundColor: f.color_hex || "#888" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.brand} {f.color}</p>
              <p className="text-xs text-muted-foreground font-body">{f.filament_type}</p>
            </div>
            <Badge variant="destructive" className="font-mono text-xs">
              {pct}%
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState({ currency_symbol: "$" });

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats"),
      api.get("/user/preferences"),
    ]).then(([statsRes, prefsRes]) => {
      setStats(statsRes.data);
      setPrefs(prefsRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const s = stats || {};
  const sym = prefs.currency_symbol || "$";

  return (
    <div className="p-4 md:p-8 max-w-[1600px] space-y-8" data-testid="dashboard-page">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="dashboard-title">
          Dashboard
        </h2>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Overview of your filament inventory and print activity
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 grid-borders">
        <StatCard icon={Cylinder} label="Total Spools" value={s.total_filaments || 0} sub="in inventory" delay={0} testId="stat-total-spools" />
        <StatCard icon={Weight} label="Weight Available" value={`${s.total_weight_remaining || 0}g`} sub="across all spools" delay={50} testId="stat-weight" />
        <StatCard icon={DollarSign} label="Inventory Value" value={`${sym}${s.total_inventory_value || 0}`} sub="total cost" delay={100} testId="stat-value" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={s.low_stock_count || 0} sub="spools below 20%" delay={150} testId="stat-low-stock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="animate-fade-up border-border/40" style={{ animationDelay: "200ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Usage by Type
            </CardTitle>
          </CardHeader>
          <CardContent data-testid="usage-chart">
            <UsageChart data={s.usage_by_type} />
          </CardContent>
        </Card>

        <Card className="animate-fade-up border-border/40" style={{ animationDelay: "250ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cylinder className="w-4 h-4 text-primary" />
              Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent data-testid="distribution-chart">
            <DistributionChart data={s.type_distribution} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="animate-fade-up border-border/40" style={{ animationDelay: "300ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              Recent Prints
            </CardTitle>
          </CardHeader>
          <CardContent data-testid="recent-prints">
            <RecentJobs jobs={s.recent_jobs} />
          </CardContent>
        </Card>

        <Card className="animate-fade-up border-border/40" style={{ animationDelay: "350ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent data-testid="low-stock-alerts">
            <LowStockList filaments={s.low_stock_filaments} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

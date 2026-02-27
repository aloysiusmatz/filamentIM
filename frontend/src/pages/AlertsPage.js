import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, AlertCircle, Info, ShieldAlert } from "lucide-react";

const levelConfig = {
  critical: {
    icon: ShieldAlert,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    badge: "bg-red-500/20 text-red-500 border-red-500/30",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    badge: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
    label: "Warning",
  },
  low: {
    icon: AlertCircle,
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20",
    badge: "bg-orange-400/20 text-orange-400 border-orange-400/30",
    label: "Low",
  },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/alerts")
      .then((res) => setAlerts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const critical = alerts.filter((a) => a.alert_level === "critical");
  const warning = alerts.filter((a) => a.alert_level === "warning");
  const low = alerts.filter((a) => a.alert_level === "low");

  return (
    <div className="p-4 md:p-8 max-w-[1600px] space-y-8" data-testid="alerts-page">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="alerts-title">
          Stock Alerts
        </h2>
        <p className="text-sm text-muted-foreground font-body mt-1">
          {alerts.length} filament{alerts.length !== 1 ? "s" : ""} need attention
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-red-500/20">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground font-body">Critical (&lt;10%)</p>
              <p className="text-2xl font-bold font-mono text-red-500" data-testid="critical-count">
                {critical.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-yellow-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground font-body">Warning (&lt;20%)</p>
              <p className="text-2xl font-bold font-mono text-yellow-500" data-testid="warning-count">
                {warning.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-orange-400/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <div>
              <p className="text-xs text-muted-foreground font-body">Low (&lt;30%)</p>
              <p className="text-2xl font-bold font-mono text-orange-400" data-testid="low-count">
                {low.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {alerts.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="py-16 text-center">
            <Info className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-body">
              All filaments are well stocked. No alerts!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = levelConfig[alert.alert_level] || levelConfig.low;
            const Icon = config.icon;
            const pct = alert.remaining_pct;
            return (
              <Card
                key={alert.id}
                className={`border ${config.bg} animate-fade-up`}
                data-testid={`alert-${alert.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Icon className={`w-5 h-5 flex-shrink-0 ${config.color}`} />
                    <div
                      className="w-5 h-5 rounded color-swatch flex-shrink-0"
                      style={{ backgroundColor: alert.color_hex || "#888", width: 20, height: 20 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{alert.brand}</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {alert.filament_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground font-body">{alert.color}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className={`font-mono text-sm font-bold ${config.color}`}>
                          {pct}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {alert.weight_remaining}g / {alert.weight_total}g remaining
                      </p>
                    </div>
                    <Badge className={`${config.badge} border`} data-testid={`alert-badge-${alert.id}`}>
                      {config.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

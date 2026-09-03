import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMe, getGetMeQueryKey } from "@/lib/api-client";
import { useListAuditLogs, type AuditLogEntry } from "@/lib/auditLogApi";
import { History, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

const ACTION_LABELS: Record<string, string> = {
  "theme.create": "Created theme",
  "theme.update": "Updated theme",
  "theme.activate": "Activated theme",
  "theme.delete": "Deleted theme",
  "employee.create": "Added employee",
  "employee.update": "Updated employee",
  "employee.delete": "Removed employee",
  "employee.bulk_delete": "Bulk-removed employees",
  "employee.bulk_import": "Bulk-imported employees",
  "admin.create": "Created admin",
  "admin.status_change": "Changed admin status",
  "admin.role_change": "Changed admin role",
  "admin.delete": "Deleted admin",
  "newsletter.upload": "Uploaded newsletter",
  "newsletter.delete": "Deleted newsletter",
  "newsletter.send": "Sent newsletter",
};

function actionVariant(action: string): "default" | "destructive" | "secondary" {
  if (action.endsWith(".delete") || action === "employee.bulk_delete") return "destructive";
  if (action.endsWith(".create") || action === "newsletter.send" || action === "theme.activate") return "default";
  return "secondary";
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function detailsFor(entry: AuditLogEntry): string {
  if (!entry.metadata) return "-";
  try {
    const meta = JSON.parse(entry.metadata) as Record<string, unknown>;
    switch (entry.action) {
      case "newsletter.send":
        return `${meta.sent ?? 0} sent, ${meta.failed ?? 0} failed${meta.customRecipients ? " (custom recipients)" : ""}`;
      case "admin.status_change":
        return meta.isActive ? "Activated" : "Deactivated";
      case "admin.role_change":
        return `${meta.fromRole} → ${meta.toRole}`;
      case "admin.create":
        return `Role: ${meta.role}`;
      case "employee.bulk_delete":
        return `${meta.deletedCount ?? 0} removed`;
      default:
        return Object.entries(meta)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
    }
  } catch {
    return "-";
  }
}

export default function AuditLog() {
  const { data: session } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const isSuperAdmin = session?.role === "super_admin";
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useListAuditLogs({ page, pageSize }, { enabled: isSuperAdmin });

  if (!isSuperAdmin) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
            <p className="text-muted-foreground">Restricted to super admins.</p>
          </div>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              <p className="text-sm">Ask a super admin if you need to review recent admin activity.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Audit Log
          </h1>
          <p className="text-muted-foreground">
            Who did what — theme edits, employee and admin management, and newsletter uploads and sends.
          </p>
        </div>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Most recent actions first.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">When</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6"><Skeleton className="h-4 w-[130px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[160px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[160px]" /></TableCell>
                    </TableRow>
                  ))
                ) : !data?.logs?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No activity recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.logs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-6 whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">{entry.adminEmail}</TableCell>
                      <TableCell>
                        <Badge variant={actionVariant(entry.action)}>{actionLabel(entry.action)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{entry.targetLabel ?? "-"}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                        {detailsFor(entry)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {data && data.total > 0 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of {data.total}
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * pageSize >= data.total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

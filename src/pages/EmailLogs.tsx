import { useState } from "react";
import {
  useListEmailLogs,
  getListEmailLogsQueryKey,
  useListNewsletters,
  getListNewslettersQueryKey,
  type ListEmailLogsStatus,
} from "@/lib/api-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Link } from "wouter";
function getInitialStatusFilter(): ListEmailLogsStatus | "all" {
  const status = new URLSearchParams(window.location.search).get("status");
  return status === "sent" || status === "failed" || status === "pending" ? status : "all";
}

export default function EmailLogs() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ListEmailLogsStatus | "all">(getInitialStatusFilter);
  const [newsletterFilter, setNewsletterFilter] = useState<string>("all");

  const { data: newslettersData } = useListNewsletters(
    { pageSize: 100 }, 
    { query: { queryKey: getListNewslettersQueryKey({ pageSize: 100 }) } }
  );

  const { data, isLoading } = useListEmailLogs(
    { 
      page, 
      pageSize: 15,
      status: statusFilter !== "all" ? statusFilter : undefined,
      newsletterId: newsletterFilter !== "all" ? parseInt(newsletterFilter, 10) : undefined
    },
    { query: { queryKey: getListEmailLogsQueryKey({ 
      page, 
      pageSize: 15,
      status: statusFilter !== "all" ? statusFilter : undefined,
      newsletterId: newsletterFilter !== "all" ? parseInt(newsletterFilter, 10) : undefined
    }) } }
  );

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Logs</h1>
          <p className="text-muted-foreground mt-1">Monitor delivery status for all outgoing communications.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-64">
              <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full sm:w-80">
              <Select value={newsletterFilter} onValueChange={(v) => { setNewsletterFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by newsletter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Newsletters</SelectItem>
                  {newslettersData?.newsletters.map(nl => (
                    <SelectItem key={nl.id} value={nl.id.toString()}>{nl.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Employee Email</TableHead>
                <TableHead>Newsletter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  </TableRow>
                ))
              ) : !data?.logs?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No email logs found.
                  </TableCell>
                </TableRow>
              ) : (
                data.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="pl-6 font-medium">{log.employeeEmail}</TableCell>
                    <TableCell>
                      <Link href={`/newsletters/${log.newsletterId}`} className="hover:underline text-primary">
                        {log.newsletterTitle || `Newsletter #${log.newsletterId}`}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {log.deliveryStatus === 'failed' ? (
                        <Badge variant="destructive">{log.deliveryStatus}</Badge>
                      ) : log.deliveryStatus === 'sent' ? (
                        <Badge className="bg-foreground text-background hover:bg-foreground">
                          {log.deliveryStatus}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{log.deliveryStatus}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(log.sentAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                      {log.errorMessage || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {data && data.total > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * data.pageSize) + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total} logs
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * data.pageSize >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
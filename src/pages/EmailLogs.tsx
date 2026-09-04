import { useState } from "react";
import {
  useListEmailLogs,
  getListEmailLogsQueryKey,
  useListNewsletters,
  getListNewslettersQueryKey,
  type ListEmailLogsStatus,
} from "@/lib/api-client";
import { useEmailLogSummary } from "@/lib/emailLogSummaryApi";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Link } from "wouter";
import { CalendarDays, X, Download } from "lucide-react";

function getInitialStatusFilter(): ListEmailLogsStatus | "all" {
  const status = new URLSearchParams(window.location.search).get("status");
  return status === "sent" || status === "failed" || status === "pending" ? status : "all";
}

function currentMonth(): string {
  return format(new Date(), "yyyy-MM");
}

export default function EmailLogs() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ListEmailLogsStatus | "all">(getInitialStatusFilter);
  const [newsletterFilter, setNewsletterFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [summaryMonth, setSummaryMonth] = useState<string>(currentMonth());

  const { data: newslettersData } = useListNewsletters(
    { pageSize: 100 },
    { query: { queryKey: getListNewslettersQueryKey({ pageSize: 100 }) } }
  );

  const listParams = {
    page,
    pageSize: 15,
    status: statusFilter !== "all" ? statusFilter : undefined,
    newsletterId: newsletterFilter !== "all" ? parseInt(newsletterFilter, 10) : undefined,
    month: !dateFilter && monthFilter ? monthFilter : undefined,
    date: dateFilter || undefined,
  };

  const { data, isLoading } = useListEmailLogs(listParams, {
    query: { queryKey: getListEmailLogsQueryKey(listParams) },
  });

  const handleExport = () => {
    const params = new URLSearchParams();
    if (listParams.status) params.set("status", listParams.status);
    if (listParams.newsletterId != null) params.set("newsletterId", String(listParams.newsletterId));
    if (listParams.month) params.set("month", listParams.month);
    if (listParams.date) params.set("date", listParams.date);
    const qs = params.toString();
    window.open(`/api/email-logs/export${qs ? `?${qs}` : ""}`, "_blank");
  };

  const { data: summary, isLoading: isSummaryLoading } = useEmailLogSummary(summaryMonth);

  const hasActiveFilters =
    statusFilter !== "all" || newsletterFilter !== "all" || monthFilter !== "" || dateFilter !== "";

  const resetFilters = () => {
    setStatusFilter("all");
    setNewsletterFilter("all");
    setMonthFilter("");
    setDateFilter("");
    setPage(1);
  };

  const filterByDate = (date: string) => {
    setDateFilter(date);
    setMonthFilter("");
    setPage(1);
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Logs</h1>
          <p className="text-muted-foreground mt-1">
            Complete, permanent history of every email sent — nothing here is ever deleted.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Sends by month
              </CardTitle>
              <CardDescription>How many newsletter emails were sent, by month and by day.</CardDescription>
            </div>
            <div className="w-full sm:w-48">
              <Select value={summaryMonth} onValueChange={setSummaryMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {(summary?.months?.some((m) => m.month === summaryMonth)
                    ? summary.months
                    : [{ month: summaryMonth, sent: 0, failed: 0, pending: 0, total: 0 }, ...(summary?.months ?? [])]
                  ).map((m) => (
                    <SelectItem key={m.month} value={m.month}>
                      {format(new Date(`${m.month}-01T00:00:00`), "MMMM yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isSummaryLoading ? (
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-24" />
              ))}
            </div>
          ) : !summary?.days?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No emails sent in {format(new Date(`${summaryMonth}-01T00:00:00`), "MMMM yyyy")}.
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {summary.days.map((d) => (
                <button
                  key={d.date}
                  onClick={() => filterByDate(d.date)}
                  className={`text-left rounded-lg border px-3 py-2 min-w-[110px] hover:border-primary transition-colors ${
                    dateFilter === d.date ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="text-xs text-muted-foreground">{format(new Date(`${d.date}T00:00:00`), "MMM d")}</div>
                  <div className="text-lg font-semibold">{d.total}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.newsletters} newsletter{d.newsletters === 1 ? "" : "s"}
                    {d.failed > 0 ? ` · ${d.failed} failed` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center">
            <div className="w-full sm:w-48">
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

            <div className="w-full sm:w-72">
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

            <div className="w-full sm:w-44">
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => { setMonthFilter(e.target.value); setDateFilter(""); setPage(1); }}
                onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* unsupported browser, ignore */ } }}
                placeholder="Filter by month"
              />
            </div>

            <div className="w-full sm:w-44">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setMonthFilter(""); setPage(1); }}
                onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* unsupported browser, ignore */ } }}
                placeholder="Filter by date"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 sm:ml-auto">
              <Download className="h-3.5 w-3.5" />
              Export to Excel
            </Button>
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
                    {hasActiveFilters ? "No email logs match these filters." : "No email logs found."}
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

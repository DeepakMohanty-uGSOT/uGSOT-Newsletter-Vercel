import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetNewsletter, useListEmailLogs, getGetNewsletterQueryKey, getListEmailLogsQueryKey } from "@/lib/api-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Download, FileText, BarChart3, Clock, AlertCircle, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePreviewNewsletter } from "@/lib/themeApi";
import { format } from "date-fns";

export default function NewsletterDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [page, setPage] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { data: previewData, isLoading: isPreviewLoading } = usePreviewNewsletter(previewOpen ? id : null);

  const { data: newsletter, isLoading: isNewsletterLoading } = useGetNewsletter(id, {
    query: { queryKey: getGetNewsletterQueryKey(id), enabled: !!id }
  });

  const { data: emailLogs, isLoading: isLogsLoading } = useListEmailLogs(
    { newsletterId: id, page, pageSize: 10 },
    { query: { queryKey: getListEmailLogsQueryKey({ newsletterId: id, page, pageSize: 10 }), enabled: !!id } }
  );

  if (isNewsletterLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <Skeleton className="h-10 w-[300px]" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!newsletter) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Newsletter not found</h2>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/newsletters">Back to Newsletters</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-2 -ml-4 text-muted-foreground hover:text-foreground">
          <Link href="/newsletters">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Newsletters
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{newsletter.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="bg-secondary text-secondary-foreground px-2.5 py-0.5 rounded-full font-medium">
                {newsletter.topic}
              </span>
              <span className="flex items-center">
                <Clock className="mr-1 h-3 w-3" />
                Uploaded {format(new Date(newsletter.uploadedAt), "PPP")}
              </span>
            </div>
            {newsletter.description && (
              <p className="mt-4 max-w-3xl">{newsletter.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview Email
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/newsletters/${newsletter.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md bg-white">
            {isPreviewLoading ? (
              <div className="p-8">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : previewData?.html ? (
              <iframe
                title="Email preview"
                srcDoc={previewData.html}
                className="w-full h-[65vh] border-0"
              />
            ) : (
              <p className="p-8 text-muted-foreground text-sm">No preview available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newsletter.totalSent || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Deliveries</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newsletter.totalFailed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {newsletter.totalSent && (newsletter.totalSent + (newsletter.totalFailed || 0)) > 0
                ? ((newsletter.totalSent / (newsletter.totalSent + (newsletter.totalFailed || 0))) * 100).toFixed(1)
                : "0.0"}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Logs</CardTitle>
          <CardDescription>
            Detailed delivery status for this newsletter.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Employee Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Error Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLogsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  </TableRow>
                ))
              ) : !emailLogs?.logs?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No delivery logs found.
                  </TableCell>
                </TableRow>
              ) : (
                emailLogs.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="pl-6 font-medium">{log.employeeEmail}</TableCell>
                    <TableCell>
                      <Badge variant={
                        log.deliveryStatus === 'sent' ? 'default' : 
                        log.deliveryStatus === 'failed' ? 'destructive' : 'secondary'
                      }>
                        {log.deliveryStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(log.sentAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell className="text-sm text-destructive max-w-xs truncate">
                      {log.errorMessage || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {emailLogs && emailLogs.total > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * emailLogs.pageSize) + 1} to {Math.min(page * emailLogs.pageSize, emailLogs.total)} of {emailLogs.total} logs
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
                  disabled={page * emailLogs.pageSize >= emailLogs.total}
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
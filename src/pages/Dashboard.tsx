import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@/lib/api-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileText, Send, AlertCircle, BarChart3, UserPlus, PlusCircle, Inbox, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of the newsletter system.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href="/newsletters?new=1">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Newsletter
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/employees?new=1">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/email-logs">
              <Inbox className="h-4 w-4 mr-2" />
              Email Logs
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stats?.totalEmployees || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Newsletters</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stats?.totalNewsletters || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Emails Sent</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Send className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stats?.totalEmailsSent || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Delivery Rate</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stats?.deliveryRate.toFixed(1) || "0.0"}%</div>
              {stats?.totalEmailsFailed ? (
                <p className="text-xs text-muted-foreground mt-1 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1 text-destructive" />
                  {stats.totalEmailsFailed} failed
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Newsletters</CardTitle>
            <CardDescription>
              The most recently uploaded newsletters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !stats?.recentNewsletters?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No newsletters uploaded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentNewsletters.map((newsletter) => (
                  <div key={newsletter.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                    <div className="grid gap-1">
                      <Link href={`/newsletters/${newsletter.id}`} className="font-semibold hover:underline">
                        {newsletter.title}
                      </Link>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="bg-secondary px-2 py-0.5 rounded-full text-xs font-medium">
                          {newsletter.topic}
                        </span>
                        <span>{format(new Date(newsletter.uploadedAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {newsletter.totalSent ? (
                          <span className="text-foreground font-medium">{newsletter.totalSent} Sent</span>
                        ) : (
                          <span className="text-muted-foreground">Not sent yet</span>
                        )}
                      </div>
                      {newsletter.totalFailed ? (
                        <div className="text-xs text-destructive">{newsletter.totalFailed} Failed</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Failed Deliveries</CardTitle>
            <CardDescription>
              Emails that need attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !stats?.recentFailedDeliveries?.length ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-sm">No recent failures</span>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentFailedDeliveries.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3">
                    <div className="text-sm font-medium truncate">{log.employeeEmail}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {log.newsletterTitle || `Newsletter #${log.newsletterId}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.sentAt), "MMM d, yyyy HH:mm")}
                    </div>
                  </div>
                ))}
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link href="/email-logs?status=failed">View all failed deliveries</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
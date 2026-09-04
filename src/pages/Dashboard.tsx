import { useState } from "react";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@/lib/api-client";
import { useEmailLogSummary } from "@/lib/emailLogSummaryApi";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Pie, PieChart, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Users, FileText, Send, UserPlus, PlusCircle, CheckCircle2, ShieldCheck, Gauge, XCircle, Clock3, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

function DeliveryRateGauge({
  sent,
  failed,
  pending,
  rate,
}: {
  sent: number;
  failed: number;
  pending: number;
  rate: number;
}) {
  const data = [
    { name: "Delivered", value: sent },
    { name: "Not delivered", value: failed + pending },
  ].filter((d) => d.value > 0);
  const colors = ["hsl(var(--chart-1))", "hsl(0 0% 20%)"];

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-[160px] w-[160px] flex-shrink-0">
        <ChartContainer config={{} satisfies ChartConfig} className="h-full w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={2} strokeWidth={0}>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={colors[i % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight">{rate.toFixed(1)}%</span>
          <span className="text-[10px] text-muted-foreground">delivered</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-4 sm:max-w-xs">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <XCircle className="h-3.5 w-3.5 text-destructive" />
            Failed
          </div>
          <div className="mt-1 text-xl font-semibold">{failed}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Pending
          </div>
          <div className="mt-1 text-xl font-semibold">{pending}</div>
        </div>
      </div>
    </div>
  );
}

function EmailActivityChart({ data }: { data: { date: string; sent: number; failed: number }[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label:
      d.date.length === 7
        ? format(new Date(`${d.date}-01T00:00:00`), "MMM yyyy")
        : format(new Date(`${d.date}T00:00:00`), "MMM d"),
  }));

  return (
    <ChartContainer config={{} satisfies ChartConfig} className="h-[220px] w-full">
      <BarChart data={chartData} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={28} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="sent" name="Sent" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
        <Bar dataKey="failed" name="Failed" fill="hsl(0 0% 30%)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const [activityMonth, setActivityMonth] = useState<string>(() => format(new Date(), "yyyy-MM"));
  const { data: activitySummary, isLoading: isActivityLoading } = useEmailLogSummary(activityMonth);

  const totalEmails = (stats?.totalEmailsSent ?? 0) + (stats?.totalEmailsFailed ?? 0) + (stats?.totalEmailsPending ?? 0);

  const activityDays = [...(activitySummary?.days ?? [])].sort((a, b) => a.date.localeCompare(b.date));

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
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl shadow-sm">
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
          <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stats?.totalEmployees || 0}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Newsletters</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stats?.totalNewsletters || 0}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Emails Sent</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Send className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stats?.totalEmailsSent || 0}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Admins</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{stats?.totalActiveAdmins || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-xl shadow-sm mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Delivery Rate
          </CardTitle>
          <CardDescription>How reliably emails are reaching employees, and what still needs attention.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[160px] w-full max-w-lg rounded-lg" />
          ) : totalEmails === 0 ? (
            <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
              No emails sent yet.
            </div>
          ) : (
            <DeliveryRateGauge
              sent={stats?.totalEmailsSent ?? 0}
              failed={stats?.totalEmailsFailed ?? 0}
              pending={stats?.totalEmailsPending ?? 0}
              rate={stats?.deliveryRate ?? 0}
            />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm mb-8">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Email Activity
            </CardTitle>
            <CardDescription>
              Day-by-day sent vs. failed volume for the selected month — see exactly which days newsletters went out and how many emails each send covered.
            </CardDescription>
          </div>
          <div className="w-full sm:w-48">
            <Select value={activityMonth} onValueChange={setActivityMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {(activitySummary?.months?.some((m) => m.month === activityMonth)
                  ? activitySummary.months
                  : [{ month: activityMonth, sent: 0, failed: 0, pending: 0, total: 0 }, ...(activitySummary?.months ?? [])]
                ).map((m) => (
                  <SelectItem key={m.month} value={m.month}>
                    {format(new Date(`${m.month}-01T00:00:00`), "MMMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isActivityLoading ? (
            <Skeleton className="h-[220px] w-full rounded-lg" />
          ) : !activityDays.some((d) => d.sent + d.failed > 0) ? (
            <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
              No email activity in {format(new Date(`${activityMonth}-01T00:00:00`), "MMMM yyyy")}.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                  Sent
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(0 0% 30%)" }} />
                  Failed
                </span>
              </div>
              <EmailActivityChart data={activityDays} />
              <div className="mt-3 flex flex-wrap gap-2">
                {activityDays
                  .filter((d) => d.total > 0)
                  .map((d) => (
                    <div key={d.date} className="rounded-md border px-2.5 py-1.5 text-xs">
                      <span className="font-medium">{format(new Date(`${d.date}T00:00:00`), "MMM d")}</span>
                      <span className="text-muted-foreground">
                        {" "}— {d.sent} sent{d.failed > 0 ? `, ${d.failed} failed` : ""} across {d.newsletters} newsletter{d.newsletters === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-xl shadow-sm">
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
                  <div key={newsletter.id} className="flex items-center justify-between p-4 border rounded-xl bg-card hover:shadow-sm transition-shadow">
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

        <Card className="rounded-xl shadow-sm">
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
                  <div key={log.id} className="border rounded-xl p-3">
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

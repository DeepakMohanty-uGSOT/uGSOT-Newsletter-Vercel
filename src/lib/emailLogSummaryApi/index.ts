// Hand-written API bindings for the email-log summary endpoint — same
// reasoning as src/lib/auditLogApi: no OpenAPI codegen pipeline is wired
// into this flat project, so this reuses the generated client's
// customFetch directly instead of being generated.
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/lib/api-client/custom-fetch";

export interface EmailLogMonthSummary {
  month: string; // "YYYY-MM"
  sent: number;
  failed: number;
  pending: number;
  total: number;
}

export interface EmailLogDaySummary {
  date: string; // "YYYY-MM-DD"
  sent: number;
  failed: number;
  pending: number;
  total: number;
  newsletters: number;
}

export interface EmailLogSummaryResponse {
  months: EmailLogMonthSummary[];
  days: EmailLogDaySummary[];
}

export function getEmailLogSummaryQueryKey(month?: string) {
  return ["/api/email-logs/summary", month ?? null] as const;
}

export function useEmailLogSummary(month?: string) {
  return useQuery({
    queryKey: getEmailLogSummaryQueryKey(month),
    queryFn: () =>
      customFetch<EmailLogSummaryResponse>(
        `/api/email-logs/summary${month ? `?month=${encodeURIComponent(month)}` : ""}`,
        { method: "GET" },
      ),
  });
}

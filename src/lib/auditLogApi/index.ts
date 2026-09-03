// Hand-written API bindings for the admin audit log — same reasoning as
// src/lib/themeApi: no OpenAPI codegen pipeline is wired into this flat
// project, so these reuse the generated client's customFetch directly
// instead of being generated.
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@/lib/api-client/custom-fetch";

export interface AuditLogEntry {
  id: number;
  adminId: number | null;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogParams {
  page?: number;
  pageSize?: number;
  targetType?: string;
  targetId?: string | number;
}

function toQueryString(params: AuditLogParams): string {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.targetType) query.set("targetType", params.targetType);
  if (params.targetId != null) query.set("targetId", String(params.targetId));
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function getListAuditLogsQueryKey(params: AuditLogParams = {}) {
  return ["/api/audit-logs", params] as const;
}

export function useListAuditLogs(params: AuditLogParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: getListAuditLogsQueryKey(params),
    queryFn: () => customFetch<AuditLogListResponse>(`/api/audit-logs${toQueryString(params)}`, { method: "GET" }),
    enabled: options?.enabled,
  });
}

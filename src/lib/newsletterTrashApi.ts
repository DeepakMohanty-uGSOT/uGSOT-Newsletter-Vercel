// Hand-written API bindings for the newsletter "Recently Deleted" (soft
// delete) endpoints -- same reasoning as src/lib/auditLogApi and
// src/lib/emailLogSummaryApi: no OpenAPI codegen pipeline is wired up for
// hand-added features in this flat project, so this reuses the generated
// client's customFetch directly.
import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "@/lib/api-client/custom-fetch";

export interface DeletedNewsletter {
  id: number;
  title: string;
  topic: string;
  uploadedAt: string;
  deletedAt: string;
  deletedByAdminEmail: string | null;
}

export interface ListDeletedNewslettersResponse {
  newsletters: DeletedNewsletter[];
  total: number;
  page: number;
  pageSize: number;
}

export function getListDeletedNewslettersQueryKey(page: number) {
  return ["/api/newsletters/deleted", page] as const;
}

export function useListDeletedNewsletters(page: number, enabled: boolean) {
  return useQuery({
    queryKey: getListDeletedNewslettersQueryKey(page),
    queryFn: () =>
      customFetch<ListDeletedNewslettersResponse>(`/api/newsletters/deleted?page=${page}&pageSize=20`, {
        method: "GET",
      }),
    enabled,
  });
}

export function useRestoreNewsletter() {
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string }>(`/api/newsletters/${id}/restore`, { method: "POST" }),
  });
}

export function usePermanentlyDeleteNewsletter() {
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string }>(`/api/newsletters/${id}/permanent`, { method: "DELETE" }),
  });
}

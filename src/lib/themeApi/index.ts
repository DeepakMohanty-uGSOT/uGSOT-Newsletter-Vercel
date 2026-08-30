// Hand-written API bindings for the newsletter email theme feature — same
// reasoning as src/lib/adminApi: no OpenAPI codegen pipeline is wired into
// this flat project, so these reuse the generated client's customFetch
// directly instead of being generated.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@/lib/api-client/custom-fetch";

export interface ThemeRecord {
  id: number;
  name: string;
  headerGradientStart: string;
  headerGradientEnd: string;
  accentColor: string;
  footerColor: string;
  bannerEmoji: string | null;
  greetingText: string | null;
  customHtml: string | null;
  isActive: boolean;
  createdAt: string;
}

export type ThemeInput = Omit<ThemeRecord, "id" | "isActive" | "createdAt">;

export function getListThemesQueryKey() {
  return ["/api/themes"] as const;
}

export function useListThemes() {
  return useQuery({
    queryKey: getListThemesQueryKey(),
    queryFn: () => customFetch<{ themes: ThemeRecord[] }>("/api/themes", { method: "GET" }),
  });
}

export function useCreateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ThemeInput) =>
      customFetch<ThemeRecord>("/api/themes", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() }),
  });
}

export function useUpdateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: ThemeInput & { id: number }) =>
      customFetch<ThemeRecord>(`/api/themes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() }),
  });
}

export function useActivateTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<ThemeRecord>(`/api/themes/${id}/activate`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() }),
  });
}

export function useDeleteTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string }>(`/api/themes/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListThemesQueryKey() }),
  });
}

export function usePreviewNewsletter(newsletterId: number | null) {
  return useQuery({
    queryKey: ["/api/newsletters", newsletterId, "preview"],
    queryFn: () => customFetch<{ html: string }>(`/api/newsletters/${newsletterId}/preview`, { method: "GET" }),
    enabled: newsletterId != null,
  });
}

// Hand-written API bindings for the multi-admin user-management feature.
// The rest of this app's API calls go through a generated OpenAPI client
// (src/lib/api-client), but there's no codegen pipeline wired into this flat
// project to regenerate that client from an updated spec. These endpoints
// reuse the exact same customFetch used by the generated client (same base
// URL handling, same cookie/credentials behavior, same ApiError shape), so
// they behave identically to the generated hooks from the caller's side.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@/lib/api-client/custom-fetch";

export interface AdminRecord {
  id: number;
  email: string;
  role: "super_admin" | "admin";
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export function getListAdminsQueryKey() {
  return ["/api/admins"] as const;
}

export function useListAdmins() {
  return useQuery({
    queryKey: getListAdminsQueryKey(),
    queryFn: () => customFetch<{ admins: AdminRecord[] }>("/api/admins", { method: "GET" }),
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; initialPassword: string; role: "super_admin" | "admin" }) =>
      customFetch<AdminRecord>("/api/admins", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
    },
  });
}

export function useSetAdminActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      customFetch<AdminRecord>(`/api/admins/${id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
    },
  });
}

export function useSetAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: "super_admin" | "admin" }) =>
      customFetch<AdminRecord>(`/api/admins/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
    },
  });
}

export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ message: string }>(`/api/admins/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAdminsQueryKey() });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      customFetch<{ message: string }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDashboardStatsQueryKey } from "@/lib/api-client";

function invalidateEmployeeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey[0] === "/api/employees",
  });
  queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export interface EmployeeInput {
  employeeName: string;
  employeeEmail: string;
}

export function useCreateEmployee() {
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  const createEmployee = async (input: EmployeeInput) => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to create employee"));
      }
      const data = await res.json();
      invalidateEmployeeQueries(queryClient);
      return data;
    } finally {
      setIsCreating(false);
    }
  };

  return { createEmployee, isCreating };
}

export function useUpdateEmployee() {
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  const updateEmployee = async (id: number, input: Partial<EmployeeInput>) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to update employee"));
      }
      const data = await res.json();
      invalidateEmployeeQueries(queryClient);
      return data;
    } finally {
      setIsUpdating(false);
    }
  };

  return { updateEmployee, isUpdating };
}

export function useBulkDeleteEmployees() {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const bulkDeleteEmployees = async (ids: number[]) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/employees/bulk-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to delete employees"));
      }
      const data = await res.json();
      invalidateEmployeeQueries(queryClient);
      return data as { message: string; deletedCount: number };
    } finally {
      setIsDeleting(false);
    }
  };

  return { bulkDeleteEmployees, isDeleting };
}

export function useDeleteAllEmployees() {
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const queryClient = useQueryClient();

  const deleteAllEmployees = async () => {
    setIsDeletingAll(true);
    try {
      const res = await fetch("/api/employees", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to delete all employees"));
      }
      const data = await res.json();
      invalidateEmployeeQueries(queryClient);
      return data as { message: string; deletedCount: number };
    } finally {
      setIsDeletingAll(false);
    }
  };

  return { deleteAllEmployees, isDeletingAll };
}

export function useExportEmployees() {
  const [isExporting, setIsExporting] = useState(false);

  const exportEmployees = async (search?: string) => {
    setIsExporting(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/employees/export${query}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to export employees");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportEmployees, isExporting };
}

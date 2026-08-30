import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListEmployeesQueryKey, getListNewslettersQueryKey, getGetDashboardStatsQueryKey } from "@/lib/api-client";

export function useUploadEmployeeFile() {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/employees/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "/api/employees",
      });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      
      return data;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
}

export function useUploadNewsletter() {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const uploadNewsletter = async (params: { title: string; topic: string; description?: string; pdf: File }) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", params.title);
      formData.append("topic", params.topic);
      if (params.description) {
        formData.append("description", params.description);
      }
      formData.append("pdf", params.pdf);

      const res = await fetch("/api/newsletters/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: getListNewslettersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      
      return data;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadNewsletter, isUploading };
}
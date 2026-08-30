import { useEffect, useRef, useState } from "react";
import { useListEmployees, useDeleteEmployee, getListEmployeesQueryKey } from "@/lib/api-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Search, Loader2, FileUp, AlertTriangle, Plus, Pencil, Download, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { useUploadEmployeeFile } from "@/hooks/use-upload";
import {
  useCreateEmployee,
  useUpdateEmployee,
  useBulkDeleteEmployees,
  useDeleteAllEmployees,
  useExportEmployees,
  type EmployeeInput,
} from "@/hooks/use-employee-actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Employee = { id: number; employeeName: string; employeeEmail: string; createdAt: string };

export default function Employees() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading } = useUploadEmployeeFile();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);
  const [uploadConfirmOpen, setUploadConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<EmployeeInput>({ employeeName: "", employeeEmail: "" });
  const [addError, setAddError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  // Support deep-linking straight into the "Add Employee" dialog, e.g. from
  // a dashboard quick action (/employees?new=1).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setAddOpen(true);
    }
  }, []);
  const [editForm, setEditForm] = useState<EmployeeInput>({ employeeName: "", employeeEmail: "" });
  const [editError, setEditError] = useState<string | null>(null);

  const { createEmployee, isCreating } = useCreateEmployee();
  const { updateEmployee, isUpdating } = useUpdateEmployee();
  const { bulkDeleteEmployees, isDeleting: isBulkDeleting } = useBulkDeleteEmployees();
  const { deleteAllEmployees, isDeletingAll } = useDeleteAllEmployees();
  const { exportEmployees, isExporting } = useExportEmployees();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListEmployees(
    { search: debouncedSearch || undefined, page, pageSize: 10 },
    { query: { queryKey: getListEmployeesQueryKey({ search: debouncedSearch || undefined, page, pageSize: 10 }) } }
  );

  useEffect(() => {
    // Clear selection when the visible page/filter changes so stale IDs aren't carried over.
    setSelectedIds([]);
  }, [page, debouncedSearch]);

  const deleteMutation = useDeleteEmployee();

  const handleUploadButtonClick = () => {
    setUploadConfirmOpen(true);
  };

  const handleConfirmUpload = () => {
    setUploadConfirmOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadFile(file);
      toast({
        title: "Upload Complete — Previous list replaced",
        description: `Added: ${result.added}, Skipped: ${result.skipped}, Invalid: ${result.invalid}`,
      });
      if (result.errors && result.errors.length > 0) {
        console.error("Upload errors:", result.errors);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "There was an error uploading the file.",
      });
    }
    // Reset file input
    e.target.value = "";
  };

  const confirmDelete = (id: number) => {
    setEmployeeToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    if (!employeeToDelete) return;

    deleteMutation.mutate({ id: employeeToDelete }, {
      onSuccess: () => {
        toast({ title: "Employee deleted successfully" });
        setDeleteConfirmOpen(false);
        setEmployeeToDelete(null);
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === "/api/employees",
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Failed to delete employee",
        });
      }
    });
  };

  const employees: Employee[] = data?.employees ?? [];
  const allOnPageSelected = employees.length > 0 && employees.every((e) => selectedIds.includes(e.id));

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !employees.some((e) => e.id === id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...employees.map((e) => e.id)])]);
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkDelete = async () => {
    try {
      const result = await bulkDeleteEmployees(selectedIds);
      toast({ title: "Employees deleted", description: `Deleted ${result.deletedCount} employee(s).` });
      setSelectedIds([]);
      setBulkDeleteConfirmOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to delete employees",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleDeleteAll = async () => {
    try {
      const result = await deleteAllEmployees();
      toast({ title: "All employees deleted", description: `Deleted ${result.deletedCount} employee(s).` });
      setSelectedIds([]);
      setDeleteAllConfirmOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to delete all employees",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const openAddDialog = () => {
    setAddForm({ employeeName: "", employeeEmail: "" });
    setAddError(null);
    setAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    try {
      await createEmployee(addForm);
      toast({ title: "Employee added" });
      setAddOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add employee");
    }
  };

  const openEditDialog = (employee: Employee) => {
    setEditEmployee(employee);
    setEditForm({ employeeName: employee.employeeName, employeeEmail: employee.employeeEmail });
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;
    setEditError(null);
    try {
      await updateEmployee(editEmployee.id, editForm);
      toast({ title: "Employee updated" });
      setEditOpen(false);
      setEditEmployee(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update employee");
    }
  };

  const handleExport = () => {
    exportEmployees(debouncedSearch || undefined).catch(() => {
      toast({ variant: "destructive", title: "Failed to export employees" });
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage employee records for newsletter distribution.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export
          </Button>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              className="sr-only"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <Button variant="outline" disabled={isUploading} onClick={handleUploadButtonClick}>
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              Upload CSV/Excel
            </Button>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                disabled={!data || data.total === 0}
                onClick={() => setDeleteAllConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete All Employees
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirmOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected ({selectedIds.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all employees on this page"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-16 inline-block" /></TableCell>
                    </TableRow>
                  ))
                ) : !employees.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id} data-state={selectedIds.includes(employee.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(employee.id)}
                          onCheckedChange={() => toggleSelectOne(employee.id)}
                          aria-label={`Select ${employee.employeeName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{employee.employeeName}</TableCell>
                      <TableCell>{employee.employeeEmail}</TableCell>
                      <TableCell>{format(new Date(employee.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(employee)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => confirmDelete(employee.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.total > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * data.pageSize) + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total} employees
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
                  disabled={page * data.pageSize >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single-employee delete confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this employee? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-destructive">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="pt-3">Delete {selectedIds.length} employee{selectedIds.length === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected employee record(s). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setBulkDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-all confirmation */}
      <Dialog open={deleteAllConfirmOpen} onOpenChange={setDeleteAllConfirmOpen}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-destructive">
          <DialogHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="pt-3">Delete all {data?.total ?? 0} employees?</DialogTitle>
            <DialogDescription>
              This permanently deletes every employee record, not just this page, including any not currently shown by your search. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteAllConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={isDeletingAll}>
              {isDeletingAll ? "Deleting..." : "Yes, Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload replace-all confirmation */}
      <Dialog open={uploadConfirmOpen} onOpenChange={setUploadConfirmOpen}>
        <DialogContent className="sm:max-w-md border-t-4 border-t-destructive">
          <DialogHeader>
            <div className="mx-auto sm:mx-0 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="pt-3">Replace all employees?</DialogTitle>
            <DialogDescription>
              This will permanently delete the current employee list and replace it with the contents of the file you upload. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setUploadConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmUpload}>Yes, Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add employee */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddSubmit}>
            <DialogHeader>
              <DialogTitle>Add Employee</DialogTitle>
              <DialogDescription>Create a single employee record.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name</Label>
                <Input
                  id="add-name"
                  value={addForm.employeeName}
                  onChange={(e) => setAddForm((f) => ({ ...f, employeeName: e.target.value }))}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={addForm.employeeEmail}
                  onChange={(e) => setAddForm((f) => ({ ...f, employeeEmail: e.target.value }))}
                  placeholder="jane.doe@upgradsot.com"
                  required
                />
              </div>
              {addError && <p className="text-sm text-destructive">{addError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Adding..." : "Add Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit employee */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
              <DialogDescription>Update this employee's name or email.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.employeeName}
                  onChange={(e) => setEditForm((f) => ({ ...f, employeeName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.employeeEmail}
                  onChange={(e) => setEditForm((f) => ({ ...f, employeeEmail: e.target.value }))}
                  required
                />
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useGetMe, getGetMeQueryKey } from "@/lib/api-client";
import { useListAdmins, useCreateAdmin, useSetAdminActive, useSetAdminRole, useDeleteAdmin, useResetAdminPassword, type AdminRecord } from "@/lib/adminApi";
import { Plus, Loader2, ShieldCheck, MoreVertical, KeyRound } from "lucide-react";
import { format } from "date-fns";

const createAdminSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  initialPassword: z.string().min(8, "Initial password must be at least 8 characters"),
  role: z.enum(["admin", "super_admin"]),
});

function apiErrorMessage(error: unknown): string | undefined {
  return error && typeof error === "object" && "data" in error
    ? (error as { data?: { error?: string } }).data?.error
    : undefined;
}

export default function Users() {
  const { data: session } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data, isLoading } = useListAdmins();
  const createAdminMutation = useCreateAdmin();
  const setActiveMutation = useSetAdminActive();
  const setRoleMutation = useSetAdminRole();
  const deleteAdminMutation = useDeleteAdmin();
  const resetPasswordMutation = useResetAdminPassword();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRecord | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<AdminRecord | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState<string | undefined>(undefined);

  const form = useForm<z.infer<typeof createAdminSchema>>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { email: "", initialPassword: "", role: "admin" },
  });

  const onCreate = (values: z.infer<typeof createAdminSchema>) => {
    createAdminMutation.mutate(values, {
      onSuccess: () => {
        toast({ title: "Admin added", description: `${values.email} can now sign in with the password you set.` });
        form.reset();
        setDialogOpen(false);
      },
      onError: (error: unknown) => {
        toast({ title: "Could not add admin", description: apiErrorMessage(error) ?? "Something went wrong", variant: "destructive" });
      },
    });
  };

  const toggleActive = (admin: AdminRecord) => {
    setActiveMutation.mutate(
      { id: admin.id, isActive: !admin.isActive },
      {
        onError: (error: unknown) => {
          toast({ title: "Could not update admin", description: apiErrorMessage(error) ?? "Something went wrong", variant: "destructive" });
        },
      },
    );
  };

  const toggleRole = (admin: AdminRecord) => {
    const newRole = admin.role === "super_admin" ? "admin" : "super_admin";
    setRoleMutation.mutate(
      { id: admin.id, role: newRole },
      {
        onSuccess: () => {
          toast({ title: "Role updated", description: `${admin.email} is now ${newRole === "super_admin" ? "a Super Admin" : "an Admin"}.` });
        },
        onError: (error: unknown) => {
          toast({ title: "Could not change role", description: apiErrorMessage(error) ?? "Something went wrong", variant: "destructive" });
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAdminMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: "Admin deleted", description: `${deleteTarget.email} has been removed.` });
        setDeleteTarget(null);
      },
      onError: (error: unknown) => {
        toast({ title: "Could not delete admin", description: apiErrorMessage(error) ?? "Something went wrong", variant: "destructive" });
        setDeleteTarget(null);
      },
    });
  };

  const openResetPassword = (admin: AdminRecord) => {
    setNewPasswordValue("");
    setResetPasswordError(undefined);
    setResetPasswordTarget(admin);
  };

  const confirmResetPassword = () => {
    if (!resetPasswordTarget) return;
    if (newPasswordValue.length < 8) {
      setResetPasswordError("New password must be at least 8 characters");
      return;
    }
    resetPasswordMutation.mutate(
      { id: resetPasswordTarget.id, newPassword: newPasswordValue },
      {
        onSuccess: () => {
          toast({
            title: "Password reset",
            description: `${resetPasswordTarget.email} must set a new password from this one on their next sign-in. Share it with them directly.`,
          });
          setResetPasswordTarget(null);
          setNewPasswordValue("");
        },
        onError: (error: unknown) => {
          setResetPasswordError(apiErrorMessage(error) ?? "Something went wrong");
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
            <p className="text-muted-foreground">Manage who can sign in to this admin console.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Admin
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new admin</DialogTitle>
                <DialogDescription>
                  Set an initial password and share it with them directly. They will be required to
                  set their own password the first time they sign in.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="newadmin@upgradsot.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="initialPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial password</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="At least 8 characters" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createAdminMutation.isPending}>
                      {createAdminMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Admin"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Admin accounts</CardTitle>
            <CardDescription>Only the super admin can add, promote, demote, deactivate, or delete accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.admins.map((admin) => {
                    const isSelf = admin.email === session?.email;
                    return (
                      <TableRow key={admin.id}>
                        <TableCell className="font-medium">
                          {admin.email}
                          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                        </TableCell>
                        <TableCell>
                          {admin.role === "super_admin" ? (
                            <Badge variant="secondary" className="gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Super Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">Admin</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {admin.isActive ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Deactivated</Badge>
                          )}
                          {admin.mustChangePassword && (
                            <span className="ml-2 text-xs text-muted-foreground">(hasn't set password yet)</span>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(admin.createdAt), "PP")}</TableCell>
                        <TableCell className="text-right">
                          {isSelf ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openResetPassword(admin)}>
                                  Reset My Password
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={setRoleMutation.isPending}
                                  onClick={() => toggleRole(admin)}
                                >
                                  {admin.role === "super_admin" ? "Make Admin" : "Make Super Admin"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={setActiveMutation.isPending}
                                  onClick={() => toggleActive(admin)}
                                >
                                  {admin.isActive ? "Deactivate" : "Reactivate"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openResetPassword(admin)}>
                                  Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(admin)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their admin account. This cannot be undone — they will need
              to be added again from scratch if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteAdminMutation.isPending}
            >
              {deleteAdminMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!resetPasswordTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordTarget(null);
            setNewPasswordValue("");
            setResetPasswordError(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {resetPasswordTarget?.email}</DialogTitle>
            <DialogDescription>
              Set a new password and share it with them directly. They will be required to set
              their own password the next time they sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="At least 8 characters"
              value={newPasswordValue}
              onChange={(e) => {
                setNewPasswordValue(e.target.value);
                setResetPasswordError(undefined);
              }}
            />
            {resetPasswordError && <p className="text-sm font-medium text-destructive">{resetPasswordError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={confirmResetPassword} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useListAdmins, useCreateAdmin, useSetAdminActive } from "@/lib/adminApi";
import { Plus, Loader2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

const createAdminSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  initialPassword: z.string().min(8, "Initial password must be at least 8 characters"),
});

export default function Users() {
  const { data, isLoading } = useListAdmins();
  const createAdminMutation = useCreateAdmin();
  const setActiveMutation = useSetAdminActive();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof createAdminSchema>>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { email: "", initialPassword: "" },
  });

  const onCreate = (values: z.infer<typeof createAdminSchema>) => {
    createAdminMutation.mutate(values, {
      onSuccess: () => {
        toast({ title: "Admin added", description: `${values.email} can now sign in with the password you set.` });
        form.reset();
        setDialogOpen(false);
      },
      onError: (error: unknown) => {
        const message =
          error && typeof error === "object" && "data" in error
            ? ((error as { data?: { error?: string } }).data?.error ?? undefined)
            : undefined;
        toast({ title: "Could not add admin", description: message ?? "Something went wrong", variant: "destructive" });
      },
    });
  };

  const toggleActive = (id: number, isActive: boolean) => {
    setActiveMutation.mutate(
      { id, isActive: !isActive },
      {
        onError: (error: unknown) => {
          const message =
            error && typeof error === "object" && "data" in error
              ? ((error as { data?: { error?: string } }).data?.error ?? undefined)
              : undefined;
          toast({ title: "Could not update admin", description: message ?? "Something went wrong", variant: "destructive" });
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
            <CardDescription>Only the super admin can add, deactivate, or reactivate accounts.</CardDescription>
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
                  {data?.admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.email}</TableCell>
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
                        {admin.role !== "super_admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={setActiveMutation.isPending}
                            onClick={() => toggleActive(admin.id, admin.isActive)}
                          >
                            {admin.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetMe, getGetMeQueryKey } from "@/lib/api-client";
import { useChangePassword } from "@/lib/adminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function ChangePassword() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const changePasswordMutation = useChangePassword();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoading && (!session || !session.loggedIn)) {
      setLocation("/login");
    }
  }, [isLoading, session, setLocation]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    changePasswordMutation.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          // Update the cached session synchronously instead of just
          // invalidating it: invalidateQueries only marks the cache stale
          // and refetches in the background, so there'd be a brief window
          // where AppLayout still sees the old mustChangePassword: true,
          // bounces back to this page, and only then does the refetch land
          // — which reads as this screen flickering between "Set a new
          // password" and "Change your password". Setting the data directly
          // avoids that window entirely.
          queryClient.setQueryData(getGetMeQueryKey(), (old: typeof session) =>
            old ? { ...old, mustChangePassword: false } : old,
          );
          setLocation("/dashboard");
        },
        onError: (error: unknown) => {
          const message =
            error && typeof error === "object" && "data" in error
              ? ((error as { data?: { error?: string } }).data?.error ?? undefined)
              : undefined;
          form.setError("root", { message: message ?? "Could not change password" });
        },
      },
    );
  };

  if (isLoading || !session?.loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isForced = session.mustChangePassword;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5 font-semibold text-lg text-foreground">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span>upGrad SOT</span>
          </div>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">
              {isForced ? "Set a new password" : "Change your password"}
            </CardTitle>
            <CardDescription>
              {isForced
                ? "For security, you must set a new password before continuing."
                : "Enter your current password and choose a new one."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isForced ? "Temporary password" : "Current password"}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.formState.errors.root && (
                  <div className="text-sm font-medium text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    {form.formState.errors.root.message}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

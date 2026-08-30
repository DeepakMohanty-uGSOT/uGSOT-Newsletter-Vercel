import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, useGetMe, getGetMeQueryKey } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const loginMutation = useLogin();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (session?.loggedIn) {
      setLocation("/dashboard");
    }
  }, [session, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/dashboard");
      },
      onError: (error) => {
        const message = error.data?.error;
        if (message) {
          form.setError("root", { message });
        } else {
          form.setError("root", { message: "Invalid credentials" });
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session?.loggedIn) {
    return null;
  }

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
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your admin credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@upgradsot.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Having trouble signing in? Contact your system administrator.
        </p>
      </div>
    </div>
  );
}
import { useGetMe, getGetMeQueryKey, useLogout } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQueryClient } from "@tanstack/react-query";
import { User, LogOut } from "lucide-react";

export default function Settings() {
  const { data: session } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      }
    });
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your personal account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <User className="h-8 w-8" />
              </div>
              <div>
                <p className="font-medium">Admin Account</p>
                <p className="text-sm text-muted-foreground">{session?.email}</p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Logging out..." : "Log out"}
                {!logoutMutation.isPending && <LogOut className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
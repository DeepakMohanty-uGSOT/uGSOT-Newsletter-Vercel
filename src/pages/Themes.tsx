import { useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  useListThemes,
  useCreateTheme,
  useUpdateTheme,
  useActivateTheme,
  useDeleteTheme,
  type ThemeRecord,
} from "@/lib/themeApi";
import { Plus, Loader2, CheckCircle2, MoreVertical, Pencil, ShieldCheck, Upload, Maximize2 } from "lucide-react";
import { format } from "date-fns";

const themeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  customHtml: z.string().min(1, "HTML is required"),
});

type ThemeFormValues = z.infer<typeof themeSchema>;

function apiErrorMessage(error: unknown): string | undefined {
  return error && typeof error === "object" && "data" in error
    ? (error as { data?: { error?: string } }).data?.error
    : undefined;
}

// Realistic stand-in values so a theme's {{placeholders}} render as an
// actual-looking email in the Preview tab, without calling the server.
const SAMPLE_VALUES: Record<string, string> = {
  "{{name}}": "Priya Sharma",
  "{{email}}": "priya.sharma@upgradsot.com",
  "{{title}}": "uGSOT Newsletter – Issue 010 | September 2026",
  "{{topic}}": "AI Agents, Campus Highlights & What's New This Month",
  "{{description}}": "This month's edition covers our latest research updates, student achievements, and upcoming events at upGrad School Of Technology.",
};

function renderPreviewHtml(template: string): string {
  return Object.entries(SAMPLE_VALUES).reduce(
    (html, [placeholder, value]) => html.split(placeholder).join(value),
    template
  );
}

export default function Themes() {
  const { data: session } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const isSuperAdmin = session?.role === "super_admin";

  const { data, isLoading } = useListThemes();
  const createMutation = useCreateTheme();
  const updateMutation = useUpdateTheme();
  const activateMutation = useActivateTheme();
  const deleteMutation = useDeleteTheme();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ThemeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ThemeRecord | null>(null);
  const [fullscreenPreviewOpen, setFullscreenPreviewOpen] = useState(false);

  const form = useForm<ThemeFormValues>({
    resolver: zodResolver(themeSchema),
    defaultValues: { name: "", customHtml: "" },
  });

  const htmlFileInputRef = useRef<HTMLInputElement>(null);

  // Lets the HTML be authored elsewhere and dropped in wholesale, instead of
  // pasting into the textarea. Read entirely client-side (FileReader) — no
  // upload endpoint involved, it just fills in the same form field.
  const handleHtmlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".html") && !file.name.toLowerCase().endsWith(".htm") && file.type !== "text/html") {
      toast({ title: "Not an HTML file", description: "Please choose a .html file.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      form.setValue("customHtml", text, { shouldValidate: true, shouldDirty: true });
      toast({ title: "HTML loaded", description: `Loaded ${file.name} into the editor.` });
    };
    reader.onerror = () => {
      toast({ title: "Could not read file", description: "Something went wrong reading that file.", variant: "destructive" });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const openCreate = () => {
    setEditing(null);
    // Start from whatever theme is currently active (or the first one
    // available) so a new theme is an edit of real, working HTML rather
    // than a blank page.
    const starter = data?.themes.find((t) => t.isActive)?.customHtml ?? data?.themes[0]?.customHtml ?? "";
    form.reset({ name: "", customHtml: starter });
    setDialogOpen(true);
  };

  const openEdit = (theme: ThemeRecord) => {
    setEditing(theme);
    form.reset({
      name: theme.name,
      // The API always returns real, rendered HTML for every theme (even
      // ones saved before the HTML editor existed), so this is never blank.
      customHtml: theme.customHtml ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: ThemeFormValues) => {
    const payload = { name: values.name, customHtml: values.customHtml };

    const onSuccess = () => {
      toast({ title: editing ? "Theme updated" : "Theme created" });
      setDialogOpen(false);
      setEditing(null);
    };
    const onError = (error: unknown) => {
      toast({ title: "Something went wrong", description: apiErrorMessage(error) ?? "Please try again", variant: "destructive" });
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload }, { onSuccess, onError });
    } else {
      createMutation.mutate(payload, { onSuccess, onError });
    }
  };

  const handleActivate = (theme: ThemeRecord) => {
    activateMutation.mutate(theme.id, {
      onSuccess: () => toast({ title: "Active theme updated", description: `${theme.name} is now used for new newsletters by default.` }),
      onError: (error: unknown) => toast({ title: "Could not activate theme", description: apiErrorMessage(error) ?? "Something went wrong", variant: "destructive" }),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: "Theme deleted" });
        setDeleteTarget(null);
      },
      onError: (error: unknown) => {
        toast({ title: "Could not delete theme", description: apiErrorMessage(error) ?? "Something went wrong", variant: "destructive" });
        setDeleteTarget(null);
      },
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Themes</h1>
            <p className="text-muted-foreground">
              Customize the newsletter email's HTML directly for occasions like Independence Day or Diwali — no code
              deploys needed.
            </p>
          </div>
          {isSuperAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                New Theme
              </Button>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit theme" : "Create a new theme"}</DialogTitle>
                  <DialogDescription>
                    This HTML is exactly what gets sent as the newsletter email. Edit it directly — use{" "}
                    {"{{name}}"}, {"{{email}}"}, {"{{title}}"}, {"{{topic}}"}, and {"{{description}}"} anywhere you
                    want that recipient's or newsletter's value inserted; they're substituted right before sending.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Independence Day" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customHtml"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Email HTML</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => htmlFileInputRef.current?.click()}
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Upload HTML File
                            </Button>
                            <input
                              ref={htmlFileInputRef}
                              type="file"
                              accept=".html,.htm,text/html"
                              className="hidden"
                              onChange={handleHtmlFileChange}
                            />
                          </div>
                          <Tabs defaultValue="edit">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="edit">Edit HTML</TabsTrigger>
                              <TabsTrigger value="preview">Preview</TabsTrigger>
                            </TabsList>
                            <TabsContent value="edit">
                              <FormControl>
                                <Textarea className="font-mono text-xs min-h-[420px]" {...field} />
                              </FormControl>
                            </TabsContent>
                            <TabsContent value="preview">
                              <div className="mb-2 flex justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => setFullscreenPreviewOpen(true)}
                                >
                                  <Maximize2 className="h-3.5 w-3.5" />
                                  Full Screen
                                </Button>
                              </div>
                              <div className="border rounded-md overflow-hidden bg-white">
                                <iframe
                                  title="Theme preview"
                                  srcDoc={renderPreviewHtml(field.value || "")}
                                  className="w-full h-[420px] border-0"
                                />
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Rendered with sample recipient/newsletter data so you can see the real layout.
                              </p>
                              <Dialog open={fullscreenPreviewOpen} onOpenChange={setFullscreenPreviewOpen}>
                                <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] flex flex-col p-0 gap-0 sm:rounded-lg">
                                  <DialogHeader className="px-6 py-4 border-b">
                                    <DialogTitle>Full screen preview</DialogTitle>
                                    <DialogDescription>
                                      Rendered with sample recipient/newsletter data so you can see the real layout.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="flex-1 bg-white overflow-hidden">
                                    <iframe
                                      title="Theme preview (full screen)"
                                      srcDoc={renderPreviewHtml(field.value || "")}
                                      className="w-full h-full border-0"
                                    />
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TabsContent>
                          </Tabs>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : editing ? (
                          "Save changes"
                        ) : (
                          "Create Theme"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email themes</CardTitle>
            <CardDescription>
              {isSuperAdmin
                ? "The active theme is used by default when a newsletter is uploaded without a specific theme. Only super admins can create, edit, or delete themes."
                : "The active theme is used by default when a newsletter is uploaded without a specific theme. Ask a super admin to create or edit themes."}
            </CardDescription>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.themes.map((theme) => (
                    <TableRow key={theme.id}>
                      <TableCell className="font-medium">
                        {theme.bannerEmoji ? `${theme.bannerEmoji} ` : ""}
                        {theme.name}
                      </TableCell>
                      <TableCell>
                        {theme.isActive ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(theme.createdAt), "PP")}</TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(theme)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit HTML
                              </DropdownMenuItem>
                              {!theme.isActive && (
                                <DropdownMenuItem onClick={() => handleActivate(theme)}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Set as Active
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={theme.isActive}
                                onClick={() => setDeleteTarget(theme)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {data && data.themes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin ? 4 : 3} className="text-center text-muted-foreground py-8">
                        No themes yet. {isSuperAdmin ? "Create one to get started." : "Ask a super admin to create one."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!isSuperAdmin && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Theme editing is restricted to super admins.
          </p>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete theme</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? Newsletters that used this theme will fall back to the
              active theme. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

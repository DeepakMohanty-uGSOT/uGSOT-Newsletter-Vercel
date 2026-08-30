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
import { Textarea } from "@/components/ui/textarea";
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
import {
  useListThemes,
  useCreateTheme,
  useUpdateTheme,
  useActivateTheme,
  useDeleteTheme,
  type ThemeRecord,
} from "@/lib/themeApi";
import { Plus, Loader2, CheckCircle2, MoreVertical, Pencil } from "lucide-react";
import { format } from "date-fns";

const themeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  headerGradientStart: z.string().min(1, "Required").regex(/^#([0-9a-fA-F]{6})$/, "Use a hex color like #1d4ed8"),
  headerGradientEnd: z.string().min(1, "Required").regex(/^#([0-9a-fA-F]{6})$/, "Use a hex color like #1d4ed8"),
  accentColor: z.string().min(1, "Required").regex(/^#([0-9a-fA-F]{6})$/, "Use a hex color like #1d4ed8"),
  footerColor: z.string().min(1, "Required").regex(/^#([0-9a-fA-F]{6})$/, "Use a hex color like #1d4ed8"),
  bannerEmoji: z.string().optional(),
  greetingText: z.string().optional(),
  customHtml: z.string().optional(),
});

type ThemeFormValues = z.infer<typeof themeSchema>;

const defaultFormValues: ThemeFormValues = {
  name: "",
  headerGradientStart: "#1d4ed8",
  headerGradientEnd: "#1e40af",
  accentColor: "#1d4ed8",
  footerColor: "#111827",
  bannerEmoji: "",
  greetingText: "",
  customHtml: "",
};

function apiErrorMessage(error: unknown): string | undefined {
  return error && typeof error === "object" && "data" in error
    ? (error as { data?: { error?: string } }).data?.error
    : undefined;
}

function ColorField({ control, name, label }: { control: any; name: keyof ThemeFormValues; label: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex items-center gap-2">
            <FormControl>
              <Input type="color" className="h-9 w-14 p-1" value={field.value || "#000000"} onChange={field.onChange} />
            </FormControl>
            <FormControl>
              <Input placeholder="#1d4ed8" {...field} />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default function Themes() {
  const { data, isLoading } = useListThemes();
  const createMutation = useCreateTheme();
  const updateMutation = useUpdateTheme();
  const activateMutation = useActivateTheme();
  const deleteMutation = useDeleteTheme();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ThemeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ThemeRecord | null>(null);

  const form = useForm<ThemeFormValues>({
    resolver: zodResolver(themeSchema),
    defaultValues: defaultFormValues,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset(defaultFormValues);
    setDialogOpen(true);
  };

  const openEdit = (theme: ThemeRecord) => {
    setEditing(theme);
    form.reset({
      name: theme.name,
      headerGradientStart: theme.headerGradientStart,
      headerGradientEnd: theme.headerGradientEnd,
      accentColor: theme.accentColor,
      footerColor: theme.footerColor,
      bannerEmoji: theme.bannerEmoji ?? "",
      greetingText: theme.greetingText ?? "",
      customHtml: theme.customHtml ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: ThemeFormValues) => {
    const payload = {
      name: values.name,
      headerGradientStart: values.headerGradientStart,
      headerGradientEnd: values.headerGradientEnd,
      accentColor: values.accentColor,
      footerColor: values.footerColor,
      bannerEmoji: values.bannerEmoji || null,
      greetingText: values.greetingText || null,
      customHtml: values.customHtml || null,
    };

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
              Customize the look of newsletter emails for occasions like Independence Day or Diwali — no code changes needed.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              New Theme
            </Button>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit theme" : "Create a new theme"}</DialogTitle>
                <DialogDescription>
                  These colors and text are applied to the newsletter email template. Pick a theme when uploading a
                  newsletter, or set one as active to use it by default.
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
                  <div className="grid grid-cols-2 gap-4">
                    <ColorField control={form.control} name="headerGradientStart" label="Header gradient start" />
                    <ColorField control={form.control} name="headerGradientEnd" label="Header gradient end" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <ColorField control={form.control} name="accentColor" label="Accent color" />
                    <ColorField control={form.control} name="footerColor" label="Footer color" />
                  </div>
                  <FormField
                    control={form.control}
                    name="bannerEmoji"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banner emoji (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="🇮🇳" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="greetingText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Greeting text (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Happy Independence Day!" {...field} />
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
                        <FormLabel>Custom HTML template (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            className="font-mono text-xs min-h-[220px]"
                            placeholder={
                              "Leave blank to use the fields above with the default layout.\n\n" +
                              "Or paste a full HTML email here to take complete control of the design. " +
                              "Available placeholders, replaced per recipient at send time:\n" +
                              "{{name}}  {{email}}  {{title}}  {{topic}}  {{description}}"
                            }
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          When this is filled in, it completely replaces the default template (colors above are
                          then ignored) — use {"{{name}}"}, {"{{email}}"}, {"{{title}}"}, {"{{topic}}"}, and{" "}
                          {"{{description}}"} anywhere you want that value inserted.
                        </p>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email themes</CardTitle>
            <CardDescription>The active theme is used by default when a newsletter is uploaded without a specific theme.</CardDescription>
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
                    <TableHead>Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                        <div
                          className="h-6 w-24 rounded"
                          style={{
                            background: `linear-gradient(135deg, ${theme.headerGradientStart}, ${theme.headerGradientEnd})`,
                          }}
                        />
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
                              Edit
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
                    </TableRow>
                  ))}
                  {data && data.themes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No themes yet. Create one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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

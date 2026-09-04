import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  useListNewsletters,
  useDeleteNewsletter,
  useSendNewsletter,
  useListEmployees,
  getListEmployeesQueryKey,
  getListNewslettersQueryKey,
  listEmailLogs,
} from "@/lib/api-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Send, Download, Plus, Loader2, RotateCcw, Search, Users, History, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUploadNewsletter } from "@/hooks/use-upload";
import { useListThemes } from "@/lib/themeApi";
import { useListDeletedNewsletters, useRestoreNewsletter, usePermanentlyDeleteNewsletter, getListDeletedNewslettersQueryKey } from "@/lib/newsletterTrashApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

async function fetchAllFailedEmails(newsletterId: number): Promise<string[]> {
  const emails = new Set<string>();
  let page = 1;
  // Loop until every page of failed logs for this newsletter has been collected.
  while (true) {
    const res = await listEmailLogs({ newsletterId, status: "failed", page, pageSize: 100 });
    res.logs.forEach((log) => emails.add(log.employeeEmail));
    if (res.logs.length === 0 || page * res.pageSize >= res.total) break;
    page++;
  }
  return Array.from(emails);
}

export default function Newsletters() {
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useListNewsletters(
    { page, pageSize: 10 },
    { query: { queryKey: getListNewslettersQueryKey({ page, pageSize: 10 }) } }
  );

  const deleteMutation = useDeleteNewsletter();
  const sendMutation = useSendNewsletter();
  const { uploadNewsletter, isUploading } = useUploadNewsletter();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [newsletterToDelete, setNewsletterToDelete] = useState<number | null>(null);

  const [trashOpen, setTrashOpen] = useState(false);
  const [trashPage, setTrashPage] = useState(1);
  const { data: trashData, isLoading: isTrashLoading } = useListDeletedNewsletters(trashPage, trashOpen);
  const restoreMutation = useRestoreNewsletter();
  const permanentDeleteMutation = usePermanentlyDeleteNewsletter();
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<number | null>(null);

  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [newsletterToSend, setNewsletterToSend] = useState<number | null>(null);
  const [sendMode, setSendMode] = useState<"all" | "selected">("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePage, setEmployeePage] = useState(1);
  const [isPreparingRetry, setIsPreparingRetry] = useState<number | null>(null);

  const employeeParams = { search: employeeSearch || undefined, page: employeePage, pageSize: 20 };
  const { data: employeesData, isLoading: employeesLoading } = useListEmployees(
    employeeParams,
    { query: { queryKey: getListEmployeesQueryKey(employeeParams), enabled: sendConfirmOpen && sendMode === "selected" } }
  );

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadData, setUploadData] = useState({ title: "", topic: "", description: "" });
  const [uploadThemeId, setUploadThemeId] = useState<string>("");
  const { data: themesData } = useListThemes();
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Support deep-linking straight into the "New Newsletter" dialog, e.g.
  // from a dashboard quick action (/newsletters?new=1).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setUploadOpen(true);
    }
  }, []);

  const confirmDelete = (id: number) => {
    setNewsletterToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const resetSendDialog = () => {
    setNewsletterToSend(null);
    setSendMode("all");
    setSelectedEmails(new Set());
    setEmployeeSearch("");
    setEmployeePage(1);
  };

  const toggleEmployee = (email: string, checked: boolean) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (checked) next.add(email);
      else next.delete(email);
      return next;
    });
  };

  const selectAllOnPage = () => {
    if (!employeesData?.employees) return;
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      employeesData.employees.forEach((emp) => next.add(emp.employeeEmail));
      return next;
    });
  };

  const handleRestore = async (id: number) => {
    setRestoringId(id);
    try {
      await restoreMutation.mutateAsync(id);
      toast({ title: "Newsletter restored" });
      queryClient.invalidateQueries({ queryKey: getListNewslettersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListDeletedNewslettersQueryKey(trashPage) });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to restore newsletter", description: err?.message });
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    try {
      await permanentDeleteMutation.mutateAsync(permanentDeleteTarget);
      toast({ title: "Newsletter permanently deleted" });
      queryClient.invalidateQueries({ queryKey: getListDeletedNewslettersQueryKey(trashPage) });
      setPermanentDeleteTarget(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to permanently delete newsletter", description: err?.message });
    }
  };

  const handleDelete = () => {
    if (!newsletterToDelete) return;
    
    deleteMutation.mutate({ id: newsletterToDelete }, {
      onSuccess: () => {
        toast({ title: "Moved to Recently Deleted", description: "You can restore it within 30 days." });
        setDeleteConfirmOpen(false);
        setNewsletterToDelete(null);
        queryClient.invalidateQueries({ queryKey: getListNewslettersQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Failed to delete newsletter",
        });
      }
    });
  };

  const confirmSend = (id: number) => {
    resetSendDialog();
    setNewsletterToSend(id);
    setSendConfirmOpen(true);
  };

  const handleRetryFailed = async (id: number) => {
    setIsPreparingRetry(id);
    try {
      const emails = await fetchAllFailedEmails(id);
      if (emails.length === 0) {
        toast({ title: "No failed recipients to retry" });
        return;
      }
      resetSendDialog();
      setNewsletterToSend(id);
      setSendMode("selected");
      setSelectedEmails(new Set(emails));
      setSendConfirmOpen(true);
    } catch {
      toast({ variant: "destructive", title: "Failed to load failed recipients" });
    } finally {
      setIsPreparingRetry(null);
    }
  };

  const handleSend = () => {
    if (!newsletterToSend) return;
    if (sendMode === "selected" && selectedEmails.size === 0) return;

    const emails = sendMode === "selected" ? Array.from(selectedEmails) : undefined;

    sendMutation.mutate({ id: newsletterToSend, data: emails ? { emails } : undefined }, {
      onSuccess: (result) => {
        toast({
          title: "Newsletter sending started",
          description: `Queued: ${result.total} (Sent: ${result.sent}, Failed: ${result.failed})`,
        });
        setSendConfirmOpen(false);
        resetSendDialog();
        queryClient.invalidateQueries({ queryKey: getListNewslettersQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Failed to send newsletter",
        });
        setSendConfirmOpen(false);
      }
    });
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.title || !uploadData.topic || !uploadFile) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
      });
      return;
    }

    try {
      await uploadNewsletter({
        title: uploadData.title,
        topic: uploadData.topic,
        description: uploadData.description,
        pdf: uploadFile,
        themeId: uploadThemeId ? Number(uploadThemeId) : null,
      });
      
      toast({ title: "Newsletter uploaded successfully" });
      setUploadOpen(false);
      setUploadData({ title: "", topic: "", description: "" });
      setUploadFile(null);
      setUploadThemeId("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Newsletters</h1>
          <p className="text-muted-foreground mt-1">Manage and distribute corporate newsletters.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTrashOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Recently Deleted
          </Button>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Newsletter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Newsletter</DialogTitle>
              <DialogDescription>
                Upload a new PDF newsletter to distribute to employees.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input 
                  id="title" 
                  value={uploadData.title} 
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
                <Input 
                  id="topic" 
                  value={uploadData.topic} 
                  onChange={(e) => setUploadData({ ...uploadData, topic: e.target.value })} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={uploadData.description} 
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme">Email Theme</Label>
                <Select value={uploadThemeId} onValueChange={setUploadThemeId}>
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Use active theme (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    {themesData?.themes.map((theme) => (
                      <SelectItem key={theme.id} value={String(theme.id)}>
                        {theme.name}{theme.isActive ? " (Active)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdf">PDF File *</Label>
                <Input 
                  id="pdf" 
                  type="file" 
                  accept=".pdf" 
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)} 
                  required 
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Upload
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Title</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 inline-block" /></TableCell>
                  </TableRow>
                ))
              ) : !data?.newsletters?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No newsletters found.
                  </TableCell>
                </TableRow>
              ) : (
                data.newsletters.map((newsletter) => (
                  <TableRow key={newsletter.id}>
                    <TableCell className="pl-6 font-medium">
                      <Link href={`/newsletters/${newsletter.id}`} className="hover:underline text-primary">
                        {newsletter.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="bg-secondary px-2 py-1 rounded-md text-xs font-medium">
                        {newsletter.topic}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(newsletter.uploadedAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {newsletter.totalSent ? (
                          <span className="text-foreground font-medium">{newsletter.totalSent} Sent</span>
                        ) : (
                          <span className="text-muted-foreground">Not sent yet</span>
                        )}
                        {newsletter.totalFailed ? (
                          <span className="text-destructive ml-2 font-medium">({newsletter.totalFailed} Failed)</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmSend(newsletter.id)}
                          disabled={sendMutation.isPending && newsletterToSend === newsletter.id}
                        >
                          {sendMutation.isPending && newsletterToSend === newsletter.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Send
                        </Button>
                        {newsletter.totalFailed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetryFailed(newsletter.id)}
                            disabled={isPreparingRetry === newsletter.id}
                            title="Retry failed recipients"
                          >
                            {isPreparingRetry === newsletter.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <RotateCcw className="h-4 w-4 mr-2" />
                            )}
                            Retry Failed
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={`/api/newsletters/${newsletter.id}/pdf`} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => confirmDelete(newsletter.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {data && data.total > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * data.pageSize) + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total} newsletters
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

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Newsletter</DialogTitle>
            <DialogDescription>
              This moves the newsletter to Recently Deleted, where it can be restored within 30 days before it's permanently removed.
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

      <Dialog open={trashOpen} onOpenChange={(open) => { setTrashOpen(open); if (!open) setTrashPage(1); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recently Deleted</DialogTitle>
            <DialogDescription>
              Newsletters deleted within the last 30 days. Restore them, or permanently delete them right away.
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-md max-h-96 overflow-y-auto divide-y">
            {isTrashLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading...</div>
            ) : !trashData?.newsletters?.length ? (
              <div className="p-8 text-sm text-muted-foreground text-center">Nothing in the trash.</div>
            ) : (
              trashData.newsletters.map((nl) => {
                const daysLeft = Math.max(
                  0,
                  30 - Math.floor((Date.now() - new Date(nl.deletedAt).getTime()) / (24 * 60 * 60 * 1000))
                );
                return (
                  <div key={nl.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{nl.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Deleted {format(new Date(nl.deletedAt), "MMM d, yyyy HH:mm")}
                        {nl.deletedByAdminEmail ? ` by ${nl.deletedByAdminEmail}` : ""}
                        {" · "}
                        {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "purging soon"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(nl.id)}
                        disabled={restoringId === nl.id}
                      >
                        {restoringId === nl.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setPermanentDeleteTarget(nl.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete Forever
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {trashData && trashData.total > trashData.pageSize && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={trashPage === 1}
                onClick={() => setTrashPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {trashPage} of {Math.ceil(trashData.total / trashData.pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={trashPage * trashData.pageSize >= trashData.total}
                onClick={() => setTrashPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrashOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!permanentDeleteTarget} onOpenChange={(open) => { if (!open) setPermanentDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Forever</DialogTitle>
            <DialogDescription>
              This permanently deletes this newsletter and its PDF. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermanentDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={permanentDeleteMutation.isPending}>
              {permanentDeleteMutation.isPending ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sendConfirmOpen}
        onOpenChange={(open) => {
          setSendConfirmOpen(open);
          if (!open) resetSendDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Newsletter</DialogTitle>
            <DialogDescription>
              Choose who should receive this newsletter.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={sendMode} onValueChange={(v) => setSendMode(v as "all" | "selected")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">All Employees</TabsTrigger>
              <TabsTrigger value="selected">Select Employees</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="pt-4 text-sm text-muted-foreground">
              This will send the newsletter to every employee currently in the system. This may take some time depending on the number of employees.
            </TabsContent>

            <TabsContent value="selected" className="pt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees by name or email..."
                  className="pl-9"
                  value={employeeSearch}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setEmployeePage(1);
                  }}
                />
              </div>

              <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
                {employeesLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading employees...</div>
                ) : !employeesData?.employees?.length ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">No employees found.</div>
                ) : (
                  employeesData.employees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedEmails.has(emp.employeeEmail)}
                        onCheckedChange={(checked) => toggleEmployee(emp.employeeEmail, !!checked)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{emp.employeeName}</div>
                        <div className="text-xs text-muted-foreground truncate">{emp.employeeEmail}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {selectedEmails.size} selected
                </span>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={selectAllOnPage}>
                    Select page
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setSelectedEmails(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {employeesData && employeesData.total > employeesData.pageSize ? (
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={employeePage === 1}
                    onClick={() => setEmployeePage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {employeePage} of {Math.ceil(employeesData.total / employeesData.pageSize)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={employeePage * employeesData.pageSize >= employeesData.total}
                    onClick={() => setEmployeePage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setSendConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || (sendMode === "selected" && selectedEmails.size === 0)}
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : sendMode === "all" ? (
                "Send to All"
              ) : (
                `Send to ${selectedEmails.size} Selected`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
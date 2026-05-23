import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Key, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiKeyWithRaw extends ApiKey {
  rawKey: string;
}

function useListApiKeys() {
  return useQuery<{ keys: ApiKey[] }>({
    queryKey: ["/api/api-keys"],
    queryFn: () => customFetch<{ keys: ApiKey[] }>("/api/api-keys"),
  });
}

function useCreateApiKey() {
  return useMutation<{ key: ApiKeyWithRaw }, Error, { label: string }>({
    mutationFn: ({ label }) =>
      customFetch<{ key: ApiKeyWithRaw }>("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ label }),
      }),
  });
}

function useDeleteApiKey() {
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      customFetch<void>(`/api/api-keys/${id}`, { method: "DELETE", responseType: "auto" }),
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export default function ApiKeys() {
  const qc = useQueryClient();
  const { data, isLoading } = useListApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState<ApiKeyWithRaw | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);

  const handleCreate = () => {
    if (!label.trim()) return;
    createMutation.mutate(
      { label: label.trim() },
      {
        onSuccess: ({ key }) => {
          setNewKey(key);
          setLabel("");
          setCreateOpen(false);
          qc.invalidateQueries({ queryKey: ["/api/api-keys"] });
        },
        onError: () => toast.error("Failed to create API key"),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("API key revoked");
        setDeleteTarget(null);
        qc.invalidateQueries({ queryKey: ["/api/api-keys"] });
      },
      onError: () => toast.error("Failed to revoke API key"),
    });
  };

  const keys = data?.keys ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Allow external tools to read promotions data without a login.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Key
        </Button>
      </div>

      {newKey && (
        <Alert className="border-green-200 bg-green-50">
          <Key className="h-4 w-4 text-green-700" />
          <AlertDescription className="space-y-3">
            <p className="font-medium text-green-800">
              Key created — copy it now. You won't be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border rounded px-3 py-2 text-sm font-mono break-all select-all">
                {newKey.rawKey}
              </code>
              <CopyButton text={newKey.rawKey} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-green-700 hover:text-green-900"
              onClick={() => setNewKey(null)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Keys</CardTitle>
          <CardDescription>
            Send requests with <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Api-Key: &lt;key&gt;</code> to authenticate.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : keys.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No API keys yet. Create one to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.label}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {key.keyPrefix}…
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(key.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {key.lastUsedAt
                        ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                        : <Badge variant="outline" className="text-xs font-normal">Never</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Pass your API key in the <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Api-Key</code> header on any read endpoint:</p>
          <pre className="bg-muted rounded-md p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`# List promotions
curl "${window.location.origin}/api/promotions?dateFrom=2026-05-01&pageSize=100" \\
  -H "X-Api-Key: pm_your_key_here"

# Export full CSV
curl "${window.location.origin}/api/promotions/export" \\
  -H "X-Api-Key: pm_your_key_here" \\
  -o promotions.csv

# Summary stats
curl "${window.location.origin}/api/promotions/stats" \\
  -H "X-Api-Key: pm_your_key_here"`}
          </pre>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give the key a label so you remember what it's for.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="key-label">Label</Label>
            <Input
              id="key-label"
              placeholder="e.g. Metabase, Power BI, Python script"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!label.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revoke API Key
            </DialogTitle>
            <DialogDescription>
              Any integrations using <strong>{deleteTarget?.label}</strong> will stop working immediately.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Revoking…" : "Revoke Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

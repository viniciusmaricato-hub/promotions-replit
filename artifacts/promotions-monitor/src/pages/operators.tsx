import { useState } from "react";
import {
  useListOperators,
  useCreateOperator,
  useUpdateOperator,
  getListOperatorsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pencil, Plus, ExternalLink, Instagram, Send, Upload } from "lucide-react";
import { ImportOperatorsDialog } from "@/components/import-operators-dialog";

const operatorSchema = z
  .object({
    name: z.string().min(1, "Operator name is required"),
    homepageUrl: z
      .string()
      .trim()
      .url("Must be a valid URL (https://...)")
      .or(z.literal(""))
      .optional(),
    instagramHandle: z.string().trim().optional(),
    telegramHandle: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.instagramHandle) || Boolean(data.telegramHandle), {
    message: "Add at least one handle (Instagram or Telegram).",
    path: ["instagramHandle"],
  });

type OperatorFormData = z.infer<typeof operatorSchema>;

type OperatorRow = {
  id: number;
  name: string;
  homepageUrl?: string | null;
  instagramHandle?: string | null;
  telegramHandle?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function OperatorForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
  submitLabel,
}: {
  defaultValues: OperatorFormData;
  onSubmit: (data: OperatorFormData) => void;
  isPending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  const form = useForm<OperatorFormData>({
    resolver: zodResolver(operatorSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Operator</FormLabel>
              <FormControl>
                <Input placeholder="e.g. BetMGM" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="homepageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Home page</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://www.betmgm.com"
                  type="url"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>Reference URL for the operator&apos;s site.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="instagramHandle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instagram handle</FormLabel>
              <FormControl>
                <Input
                  placeholder="@betmgm"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>Leave blank to skip Instagram.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="telegramHandle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telegram handle</FormLabel>
              <FormControl>
                <Input
                  placeholder="@betmgm or t.me/betmgm"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>Leave blank to skip Telegram.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function normalizeHandle(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export default function Operators() {
  const queryClient = useQueryClient();
  const { data: operators, isLoading } = useListOperators();
  const createOperator = useCreateOperator();
  const updateOperator = useUpdateOperator();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorRow | null>(null);

  const handleCreate = (data: OperatorFormData) => {
    createOperator.mutate(
      {
        data: {
          name: data.name.trim(),
          homepageUrl: data.homepageUrl?.trim() || null,
          instagramHandle: normalizeHandle(data.instagramHandle),
          telegramHandle: normalizeHandle(data.telegramHandle),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOperatorsQueryKey() });
          toast.success("Operator added");
          setIsAddOpen(false);
        },
        onError: (err) => {
          const apiErr = err as { response?: { data?: { error?: string } } };
          toast.error(apiErr.response?.data?.error ?? "Failed to add operator");
        },
      },
    );
  };

  const handleEdit = (data: OperatorFormData) => {
    if (!editing) return;
    updateOperator.mutate(
      {
        id: editing.id,
        data: {
          name: data.name.trim(),
          homepageUrl: data.homepageUrl?.trim() || null,
          instagramHandle: normalizeHandle(data.instagramHandle),
          telegramHandle: normalizeHandle(data.telegramHandle),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOperatorsQueryKey() });
          toast.success("Operator updated");
          setEditing(null);
        },
        onError: (err) => {
          const apiErr = err as { response?: { data?: { error?: string } } };
          toast.error(apiErr.response?.data?.error ?? "Failed to update operator");
        },
      },
    );
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    updateOperator.mutate(
      { id, data: { active: !currentActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOperatorsQueryKey() });
          toast.success(`Operator ${!currentActive ? "activated" : "deactivated"}`);
        },
        onError: () => {
          toast.error("Failed to update status");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operators</h1>
          <p className="text-muted-foreground">
            Manage which competitor operators the pipeline scrapes for promotions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="h-4 w-4" /> Import CSV
          </Button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Operator
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Operator</DialogTitle>
              </DialogHeader>
              <OperatorForm
                defaultValues={{ name: "", homepageUrl: "", instagramHandle: "", telegramHandle: "" }}
                onSubmit={handleCreate}
                isPending={createOperator.isPending}
                onCancel={() => setIsAddOpen(false)}
                submitLabel="Add Operator"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ImportOperatorsDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Operator</DialogTitle>
          </DialogHeader>
          {editing && (
            <OperatorForm
              defaultValues={{
                name: editing.name,
                homepageUrl: editing.homepageUrl ?? "",
                instagramHandle: editing.instagramHandle ?? "",
                telegramHandle: editing.telegramHandle ?? "",
              }}
              onSubmit={handleEdit}
              isPending={updateOperator.isPending}
              onCancel={() => setEditing(null)}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead>Home page</TableHead>
                <TableHead>Instagram</TableHead>
                <TableHead>Telegram</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : operators?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No operators configured. Add one to start tracking.
                  </TableCell>
                </TableRow>
              ) : (
                operators?.map((op) => (
                  <TableRow
                    key={op.id}
                    className={!op.active ? "opacity-60 bg-muted/30" : ""}
                  >
                    <TableCell className="font-medium">{op.name}</TableCell>
                    <TableCell>
                      {op.homepageUrl ? (
                        <a
                          href={op.homepageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {op.homepageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {op.instagramHandle ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-sm">
                          <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
                          {op.instagramHandle}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {op.telegramHandle ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-sm">
                          <Send className="h-3.5 w-3.5 text-muted-foreground" />
                          {op.telegramHandle}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {op.active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(op.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit operator"
                          onClick={() => setEditing(op)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {op.active ? "ON" : "OFF"}
                          </span>
                          <Switch
                            checked={op.active}
                            onCheckedChange={() => handleToggleActive(op.id, op.active)}
                            disabled={
                              updateOperator.isPending &&
                              updateOperator.variables?.id === op.id
                            }
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

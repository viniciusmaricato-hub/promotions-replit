import { useState } from "react";
import { useListSources, useCreateSource, useUpdateSource, getListSourcesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const sourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  platform: z.enum(["Instagram", "Telegram"]),
  handle: z.string().min(1, "Handle is required"),
});

export default function Sources() {
  const queryClient = useQueryClient();
  const { data: sources, isLoading } = useListSources();
  const createSource = useCreateSource();
  const updateSource = useUpdateSource();
  
  const [isAddOpen, setIsAddOpen] = useState(false);

  const form = useForm<z.infer<typeof sourceSchema>>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      name: "",
      platform: "Instagram",
      handle: "",
    },
  });

  const onSubmit = (data: z.infer<typeof sourceSchema>) => {
    createSource.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey() });
        toast.success("Source added successfully");
        setIsAddOpen(false);
        form.reset();
      },
      onError: (err) => {
        toast.error(err?.error || "Failed to add source");
      }
    });
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    updateSource.mutate({ id, data: { active: !currentActive } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSourcesQueryKey() });
        toast.success(`Source ${!currentActive ? 'activated' : 'deactivated'}`);
      },
      onError: () => {
        toast.error("Failed to update status");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitored Sources</h1>
          <p className="text-muted-foreground">Manage the competitor accounts being scraped.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Source</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operator Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. BetMGM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Instagram">Instagram</SelectItem>
                          <SelectItem value="Telegram">Telegram</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="handle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Handle / Username</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. @betmgm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createSource.isPending}>
                    {createSource.isPending ? "Adding..." : "Add Source"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : sources?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No sources configured. Add one to start tracking.
                  </TableCell>
                </TableRow>
              ) : (
                sources?.map((source) => (
                  <TableRow key={source.id} className={!source.active ? "opacity-60 bg-muted/30" : ""}>
                    <TableCell className="font-medium">{source.name}</TableCell>
                    <TableCell>{source.platform}</TableCell>
                    <TableCell className="font-mono text-sm">{source.handle}</TableCell>
                    <TableCell>
                      {source.active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(source.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs font-medium text-muted-foreground mr-1">
                          {source.active ? "ON" : "OFF"}
                        </span>
                        <Switch 
                          checked={source.active} 
                          onCheckedChange={() => handleToggleActive(source.id, source.active)}
                          disabled={updateSource.isPending && updateSource.variables?.id === source.id}
                        />
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
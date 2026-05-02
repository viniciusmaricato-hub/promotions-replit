import { useRef, useState } from "react";
import {
  useImportOperators,
  getListOperatorsQueryKey,
  type ImportOperatorsResponse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, Download, X, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  parseCsv,
  mapOperatorRows,
  type OperatorImportRow,
} from "@/lib/csv";

const TEMPLATE_CSV =
  "name,homepageUrl,instagramHandle,telegramHandle\n" +
  "BetMGM,https://www.betmgm.com,@betmgm,\n" +
  "Caesars,https://www.caesars.com,,@caesars_news\n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportOperatorsDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const importMutation = useImportOperators();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<OperatorImportRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<ImportOperatorsResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setWarnings([]);
    setResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File) => {
    setResult(null);
    setParseError(null);
    setRows([]);
    setWarnings([]);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const mapped = mapOperatorRows(parsed);
      setRows(mapped.rows);
      setWarnings(mapped.warnings);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseError(`Could not read file: ${msg}`);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "operators-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (rows.length === 0) return;
    importMutation.mutate(
      { data: { operators: rows } },
      {
        onSuccess: (data) => {
          setResult(data);
          queryClient.invalidateQueries({ queryKey: getListOperatorsQueryKey() });
          if (data.errors.length === 0) {
            toast.success(
              `Imported ${data.created} new, updated ${data.updated} operators.`,
            );
          } else {
            toast.warning(
              `Imported ${data.created + data.updated} of ${rows.length} rows. ${data.errors.length} skipped.`,
            );
          }
        },
        onError: (err) => {
          const apiErr = err as { response?: { data?: { error?: string } } };
          toast.error(apiErr.response?.data?.error ?? "Import failed.");
        },
      },
    );
  };

  const previewRows = rows.slice(0, 10);
  const remaining = rows.length - previewRows.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import operators from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: <code>name</code>,{" "}
            <code>homepageUrl</code>, <code>instagramHandle</code>,{" "}
            <code>telegramHandle</code>. Operators are matched by name
            (case-insensitive): existing rows are updated, new names are
            added. Blank columns keep the existing value when updating.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {fileName ? "Choose different file" : "Choose CSV file"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleDownloadTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download template
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {fileName && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">
                · {rows.length} valid row{rows.length === 1 ? "" : "s"} parsed
              </span>
              <button
                type="button"
                onClick={reset}
                className="ml-auto text-muted-foreground hover:text-foreground"
                aria-label="Clear file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {warnings.map((w, i) => (
            <Alert key={i} variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}

          {previewRows.length > 0 && !result && (
            <div className="rounded-md border">
              <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
                Preview
                {remaining > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (showing first 10 of {rows.length})
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Home page</TableHead>
                      <TableHead>Instagram</TableHead>
                      <TableHead>Telegram</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {r.name || (
                            <span className="text-destructive text-xs">
                              (missing)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.homepageUrl ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {r.instagramHandle ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {r.telegramHandle ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                  {result.created} created
                </Badge>
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
                  {result.updated} updated
                </Badge>
                {result.skipped > 0 && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {result.skipped} skipped
                  </Badge>
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-md border border-destructive/30">
                  <div className="border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
                    Skipped rows
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground">
                              {e.row}
                            </TableCell>
                            <TableCell className="font-medium">
                              {e.name ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">{e.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={rows.length === 0 || importMutation.isPending}
              >
                {importMutation.isPending
                  ? "Importing..."
                  : `Import ${rows.length} operator${rows.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

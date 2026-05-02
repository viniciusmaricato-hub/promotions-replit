export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  const cleaned = text.replace(/^\uFEFF/, "");
  const records = parseRecords(cleaned);

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0]!.map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < records.length; i++) {
    const record = records[i]!;
    if (record.length === 1 && record[0]!.trim() === "") continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (record[j] ?? "").trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      current.push(field);
      field = "";
    } else if (c === "\r") {
      // ignore — handled by \n
    } else if (c === "\n") {
      current.push(field);
      records.push(current);
      current = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    records.push(current);
  }

  return records;
}

export interface OperatorImportRow {
  name: string;
  homepageUrl: string | null;
  instagramHandle: string | null;
  telegramHandle: string | null;
}

const HEADER_ALIASES: Record<string, keyof OperatorImportRow> = {
  name: "name",
  operator: "name",
  "operator name": "name",
  homepage: "homepageUrl",
  "homepage url": "homepageUrl",
  homepageurl: "homepageUrl",
  "home page": "homepageUrl",
  url: "homepageUrl",
  website: "homepageUrl",
  instagram: "instagramHandle",
  "instagram handle": "instagramHandle",
  instagramhandle: "instagramHandle",
  ig: "instagramHandle",
  telegram: "telegramHandle",
  "telegram handle": "telegramHandle",
  telegramhandle: "telegramHandle",
  tg: "telegramHandle",
};

export interface MappedOperators {
  rows: OperatorImportRow[];
  warnings: string[];
}

export function mapOperatorRows(parsed: ParsedCsv): MappedOperators {
  const warnings: string[] = [];
  const headerMap = new Map<string, keyof OperatorImportRow>();

  for (const header of parsed.headers) {
    const normalized = header.trim().toLowerCase();
    const mapped = HEADER_ALIASES[normalized];
    if (mapped) {
      headerMap.set(header, mapped);
    }
  }

  if (![...headerMap.values()].includes("name")) {
    warnings.push(
      'CSV must include a "name" (or "operator") column. Found columns: ' +
        parsed.headers.join(", "),
    );
    return { rows: [], warnings };
  }

  const rows: OperatorImportRow[] = parsed.rows.map((raw) => {
    const out: OperatorImportRow = {
      name: "",
      homepageUrl: null,
      instagramHandle: null,
      telegramHandle: null,
    };
    for (const [csvHeader, field] of headerMap.entries()) {
      const value = (raw[csvHeader] ?? "").trim();
      if (field === "name") {
        out.name = value;
      } else {
        (out[field] as string | null) = value.length === 0 ? null : value;
      }
    }
    return out;
  });

  return { rows, warnings };
}

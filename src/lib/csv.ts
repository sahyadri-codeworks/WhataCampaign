import Papa from "papaparse";
import type { Contact, ScheduleBatch } from "./types";

type CsvRow = Record<string, string>;

const PHONE_KEYS = ["phone", "mobile", "whatsapp", "number", "phone_number", "contact", "tel"];
const NAME_KEYS = ["name", "full_name", "customer", "customer_name", "first_name", "contact_name"];

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getPhone(row: CsvRow) {
  const phoneKey = Object.keys(row).find((key) =>
    PHONE_KEYS.includes(normalizeHeader(key)),
  );

  return phoneKey ? normalizeCellValue(row[phoneKey]) : "";
}

function getName(row: CsvRow) {
  const nameKey = Object.keys(row).find((key) =>
    NAME_KEYS.includes(normalizeHeader(key)),
  );

  return nameKey ? normalizeCellValue(row[nameKey]) : "";
}

function normalizeRow(row: CsvRow): CsvRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), normalizeCellValue(value)]),
  );
}

function rowsToContacts(rows: CsvRow[]): Contact[] {
  return rows
    .map((row, index) => {
      const normalizedRow = normalizeRow(row);
      const phone = getPhone(normalizedRow).trim();

      if (!phone) {
        return null;
      }

      return {
        id: `${Date.now()}-${index}`,
        phone,
        name: getName(normalizedRow).trim(),
        extraData: normalizedRow,
      };
    })
    .filter(Boolean) as Contact[];
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function parseCsvText(text: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => normalizeHeader(header),
  });

  if (result.errors.length > 0) {
    const fatalError = result.errors.find((error) => error.type !== "FieldMismatch");
    if (fatalError) {
      throw new Error(`Could not parse CSV: ${fatalError.message}`);
    }
  }

  return result.data;
}

function parseTxtFile(text: string): CsvRow[] {
  // Auto-detect delimiter: tab, comma, semicolon, or pipe
  const firstLine = text.split("\n")[0] ?? "";
  let delimiter = ",";

  if (firstLine.includes("\t")) {
    delimiter = "\t";
  } else if (firstLine.includes(";")) {
    delimiter = ";";
  } else if (firstLine.includes("|")) {
    delimiter = "|";
  }

  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header) => normalizeHeader(header),
  });
  return result.data;
}

async function parseExcelFile(file: File): Promise<CsvRow[]> {
  // Dynamic import to keep xlsx out of the initial bundle
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("The Excel file has no sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<CsvRow>(sheet, { defval: "" });
  return rows;
}

/**
 * Parse contacts from CSV, TXT, XLS, or XLSX files.
 */
export async function parseContactsFile(file: File): Promise<Contact[]> {
  const ext = getFileExtension(file.name);
  let rows: CsvRow[];

  switch (ext) {
    case "xlsx":
    case "xls": {
      rows = await parseExcelFile(file);
      break;
    }
    case "txt": {
      const text = await file.text();
      rows = parseTxtFile(text);
      break;
    }
    case "csv":
    default: {
      const text = await file.text();
      rows = parseCsvText(text);
      break;
    }
  }

  const contacts = rowsToContacts(rows);

  if (contacts.length === 0) {
    throw new Error(
      "No valid phone numbers found. Make sure your file has a header row and a column named " +
      "\"phone\", \"mobile\", \"whatsapp\", or \"number\"."
    );
  }

  return contacts;
}

/** @deprecated Use parseContactsFile instead */
export const parseContactsCsv = parseContactsFile;

export function scheduleBatchToCsv(batch: ScheduleBatch) {
  return Papa.unparse(
    batch.contacts.map((contact) => ({
      day: batch.day,
      send_date: batch.date,
      phone: contact.phone,
      name: contact.name ?? "",
      ...contact.extraData,
    })),
  );
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download a sample CSV template so users know the expected format.
 */
export function downloadSampleCsv() {
  const anchor = document.createElement("a");
  anchor.href = "/sample-contacts.csv";
  anchor.download = "sample-contacts.csv";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

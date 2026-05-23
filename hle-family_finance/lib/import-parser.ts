export type ParsedTransaction = {
  date: string;
  amount: number;
  description: string;
  payee: string;
  checkNumber?: string;
  referenceNumber?: string;
  rawData: string;
};

type WellsFargoColumns = {
  dateIdx: number;
  descriptionIdx: number;
  amountIdx: number;
  checkIdx: number;
  skipFirst: boolean;
};

function detectWellsFargoColumns(firstFields: string[]): WellsFargoColumns {
  // Modern export carries a header whose first cell is "DATE".
  if (firstFields[0]?.trim().toLowerCase() === "date") {
    const header = firstFields.map((h) => h.trim().toLowerCase());
    const findIdx = (...names: string[]) => header.findIndex((h) => names.includes(h));
    const di = findIdx("date");
    const desci = header.findIndex((h) => h.includes("description") || h.includes("memo"));
    const ai = findIdx("amount");
    const ci = header.findIndex((h) => h.includes("check"));
    return {
      dateIdx: di !== -1 ? di : 0,
      descriptionIdx: desci !== -1 ? desci : 1,
      amountIdx: ai !== -1 ? ai : 2,
      checkIdx: ci !== -1 ? ci : 3,
      skipFirst: true,
    };
  }
  // Legacy headerless layout: date, amount, *, check_number, description.
  // Confirm by checking that field 1 parses as a number.
  const legacyAmount = Number.parseFloat(firstFields[1]?.replaceAll(/[,"$]/g, "") ?? "");
  if (firstFields.length >= 5 && !Number.isNaN(legacyAmount)) {
    return { dateIdx: 0, descriptionIdx: 4, amountIdx: 1, checkIdx: 3, skipFirst: false };
  }
  return { dateIdx: 0, descriptionIdx: 1, amountIdx: 2, checkIdx: 3, skipFirst: false };
}

function parseWellsFargoLine(line: string, cols: WellsFargoColumns): ParsedTransaction | null {
  if (!line.trim()) return null;
  const fields = parseCSVLine(line);
  if (fields.length < 3) return null;

  const dateParts = (fields[cols.dateIdx] ?? "").split("/");
  if (dateParts.length !== 3) return null;
  const date = `${dateParts[2]}-${dateParts[0].padStart(2, "0")}-${dateParts[1].padStart(2, "0")}`;

  const amount = Number.parseFloat((fields[cols.amountIdx] ?? "").replaceAll(/[,"$]/g, ""));
  if (Number.isNaN(amount)) return null;

  const description = (fields[cols.descriptionIdx] ?? "").trim();
  const checkNumber = (fields[cols.checkIdx] ?? "").trim();

  return {
    date,
    amount,
    description,
    payee: extractPayee(description),
    checkNumber: checkNumber || undefined,
    rawData: line,
  };
}

/**
 * Parse Wells Fargo CSV format.
 *
 * Modern export (with header, 2024+):
 *   "DATE","DESCRIPTION","AMOUNT","CHECK #","STATUS"
 *   "05/20/2026","WOODMENHMD WHMD 260520 ...","-43.96","","Posted"
 *
 * Legacy export (no header):
 *   "01/15/2026","-45.67","*","","WALMART STORE #1234"
 *
 * The format is auto-detected by inspecting the first non-empty line.
 */
export function parseWellsFargoCSV(content: string): ParsedTransaction[] {
  const lines = content.trim().split(/\r?\n/);
  const firstLine = lines.find((l) => l.trim()) ?? "";
  const cols = detectWellsFargoColumns(parseCSVLine(firstLine));

  const transactions: ParsedTransaction[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (cols.skipFirst && i === 0) continue;
    const tx = parseWellsFargoLine(lines[i], cols);
    if (tx) transactions.push(tx);
  }
  return transactions;
}

/**
 * Parse generic CSV format.
 * Tries to detect columns: Date, Amount/Debit/Credit, Description/Memo/Payee
 */
export function parseGenericCSV(content: string): ParsedTransaction[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Find column indices
  const dateIdx = header.findIndex((h) => h.includes("date") || h === "posted date" || h === "transaction date");
  const amountIdx = header.findIndex((h) => h === "amount" || h === "transaction amount");
  const debitIdx = header.findIndex((h) => h === "debit" || h === "withdrawal");
  const creditIdx = header.findIndex((h) => h === "credit" || h === "deposit");
  const descIdx = header.findIndex((h) => h.includes("description") || h.includes("memo") || h.includes("narrative"));
  const payeeIdx = header.findIndex((h) => h === "payee" || h === "name");

  if (dateIdx === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseCSVLine(lines[i]);

    const dateStr = fields[dateIdx];
    if (!dateStr) continue;

    // Try to parse date
    const date = parseFlexibleDate(dateStr);
    if (!date) continue;

    let amount: number;
    if (amountIdx !== -1) {
      amount = parseFloat(fields[amountIdx]?.replace(/[,"$]/g, "") || "0");
    } else if (debitIdx !== -1 || creditIdx !== -1) {
      const debit = parseFloat(fields[debitIdx]?.replace(/[,"$]/g, "") || "0") || 0;
      const credit = parseFloat(fields[creditIdx]?.replace(/[,"$]/g, "") || "0") || 0;
      amount = credit > 0 ? credit : -debit;
    } else {
      continue;
    }

    if (isNaN(amount)) continue;

    const description = fields[descIdx] || "";
    const payee = fields[payeeIdx] || extractPayee(description);

    transactions.push({
      date,
      amount,
      description: description.trim(),
      payee: payee.trim(),
      rawData: lines[i],
    });
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseFlexibleDate(dateStr: string): string | null {
  // Try MM/DD/YYYY
  let match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;

  // Try YYYY-MM-DD
  match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return dateStr;

  // Try MM-DD-YYYY
  match = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;

  return null;
}

/**
 * Parse OFX/QFX file format (Quicken/Quickbooks interchange).
 * Basic implementation extracting STMTTRN entries.
 */
export function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Extract statement transactions between <STMTTRN> and </STMTTRN>
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = txRegex.exec(content)) !== null) {
    const block = match[1];

    const dtposted = extractOFXTag(block, "DTPOSTED");
    const trnamt = extractOFXTag(block, "TRNAMT");
    const name = extractOFXTag(block, "NAME");
    const memo = extractOFXTag(block, "MEMO");
    const fitid = extractOFXTag(block, "FITID");
    const checknum = extractOFXTag(block, "CHECKNUM");

    if (!dtposted || !trnamt) continue;

    // Parse OFX date (YYYYMMDD or YYYYMMDDHHMMSS)
    const year = dtposted.substring(0, 4);
    const month = dtposted.substring(4, 6);
    const day = dtposted.substring(6, 8);
    const date = `${year}-${month}-${day}`;

    const amount = parseFloat(trnamt);
    if (isNaN(amount)) continue;

    const description = name || memo || "";

    transactions.push({
      date,
      amount,
      description: description.trim(),
      payee: extractPayee(description.trim()),
      referenceNumber: fitid || undefined,
      checkNumber: checknum || undefined,
      rawData: block.trim(),
    });
  }

  return transactions;
}

function extractOFXTag(block: string, tag: string): string | null {
  // OFX tags can be SGML-style (no closing tag) or XML-style
  const xmlMatch = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  if (xmlMatch) return xmlMatch[1].trim();

  // SGML-style: <TAG>value\n
  const sgmlMatch = block.match(new RegExp(`<${tag}>(.+)`, "i"));
  if (sgmlMatch) return sgmlMatch[1].trim();

  return null;
}

function extractPayee(description: string): string {
  // Common cleanup patterns
  let payee = description
    .replace(/\s+/g, " ")
    .replace(/\b(POS|DEBIT|CREDIT|ACH|WIRE|CHECK|ATM|WITHDRAWAL|DEPOSIT)\b/gi, "")
    .replace(/\d{4,}/g, "") // Remove long number sequences (card numbers, etc.)
    .replace(/\s{2,}/g, " ")
    .trim();

  // Take first meaningful part
  const parts = payee.split(/[#*]/);
  if (parts[0]) payee = parts[0].trim();

  return payee || description;
}

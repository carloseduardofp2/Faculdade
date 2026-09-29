import * as XLSX from "xlsx";

const HEADER_ALIASES = {
  pgrad: ["PGRAD", "POSTOGRADUACAO", "POSTOGRAD", "POSTO", "GRADUACAO"],
  fullName: ["NOME", "NOMECOMPLETO"],
  warName: ["NOMEGUERRA", "NOMEDEGUERRA"],
  birthDate: ["DTNASCIMENTO", "DATANASCIMENTO", "NASCIMENTO", "DTNASC", "DATADENASCIMENTO"],
};

export const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/[^A-Z0-9]/g, "");
}

export function titleCaseName(value) {
  const connectors = new Set(["de", "da", "do", "das", "dos", "e"]);
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && connectors.has(word)) return word;
      return word ? word[0].toLocaleUpperCase("pt-BR") + word.slice(1) : "";
    })
    .join(" ");
}

export function tokenizeFullName(fullName) {
  const text = String(fullName ?? "");
  return [...text.matchAll(/[\p{L}\p{M}]+/gu)].map((match, index) => ({
    index,
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
    normalized: normalizeText(match[0]),
    mode: "none",
  }));
}

function tokenizeWarName(warName) {
  return [...String(warName ?? "").matchAll(/[\p{L}\p{M}]+\.?/gu)].map((match) => {
    const clean = match[0].replace(/\.$/, "");
    return {
      text: clean,
      normalized: normalizeText(clean),
      initial: normalizeText(clean).length === 1,
    };
  });
}

export function matchWarName(fullName, warName) {
  const fullTokens = tokenizeFullName(fullName);
  const warTokens = tokenizeWarName(warName);

  function search(warIndex, afterIndex, matches) {
    if (warIndex >= warTokens.length) return matches;
    const target = warTokens[warIndex];
    for (let index = afterIndex + 1; index < fullTokens.length; index += 1) {
      const candidate = fullTokens[index];
      const isMatch = target.initial
        ? candidate.normalized.startsWith(target.normalized)
        : candidate.normalized === target.normalized;
      if (!isMatch) continue;
      const result = search(warIndex + 1, index, [...matches, { index, mode: target.initial ? "initial" : "full" }]);
      if (result) return result;
    }
    return null;
  }

  const matches = warTokens.length ? search(0, -1, []) : [];
  if (matches) {
    matches.forEach(({ index, mode }) => { fullTokens[index].mode = mode; });
  }

  return {
    tokens: fullTokens,
    matched: Boolean(matches) && matches.length === warTokens.length,
    warning: !warTokens.length
      ? "Nome de guerra não informado"
      : !matches
        ? "Confira o destaque do nome de guerra"
        : "",
  };
}

export function getTargetPeriods(baseDate = new Date()) {
  const current = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const next = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  return [current, next].map((date, index) => ({
    id: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    month: date.getMonth(),
    year: date.getFullYear(),
    name: MONTHS[date.getMonth()],
    label: `${MONTHS[date.getMonth()][0].toLocaleUpperCase("pt-BR")}${MONTHS[date.getMonth()].slice(1)} de ${date.getFullYear()}`,
    shortLabel: `${MONTHS[date.getMonth()].slice(0, 3).toLocaleUpperCase("pt-BR")}/${date.getFullYear()}`,
    kind: index === 0 ? "Mês atual" : "Próximo mês",
  }));
}

function makeDate(year, month, day) {
  const result = new Date(year, month - 1, day);
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) return null;
  return result;
}

function parseBirthDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return makeDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? makeDate(parsed.y, parsed.m, parsed.d) : null;
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  let match = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (match) {
    const year = Number(match[3].length === 2 ? `19${match[3]}` : match[3]);
    return makeDate(year, Number(match[2]), Number(match[1]));
  }

  match = text.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (match) return makeDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return null;
}

function findSheetAndHeaders(workbook) {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const searchLimit = Math.min(rows.length, 15);
    for (let rowIndex = 0; rowIndex < searchLimit; rowIndex += 1) {
      const normalized = rows[rowIndex].map(normalizeHeader);
      const columns = {};
      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        columns[key] = normalized.findIndex((header) => aliases.includes(header));
      }
      if (Object.values(columns).every((index) => index >= 0)) {
        return { sheetName, rows, headerRow: rowIndex, columns };
      }
    }
  }
  return null;
}

export async function readMilitaryFile(file) {
  const bytes = await file.arrayBuffer();
  let workbook;
  try {
    workbook = XLSX.read(bytes, { type: "array", cellDates: true, raw: true });
  } catch (error) {
    throw new Error("Não foi possível abrir a planilha. Verifique se o arquivo está íntegro.", { cause: error });
  }

  const located = findSheetAndHeaders(workbook);
  if (!located) {
    throw new Error("Não encontrei as colunas PGRAD, NOME, NOME_GUERRA e DT_NASCIMENTO.");
  }

  const records = [];
  const invalidRows = [];
  const { rows, headerRow, columns } = located;
  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const values = Object.values(columns).map((column) => row[column]);
    if (values.every((value) => String(value ?? "").trim() === "")) continue;

    const pgrad = String(row[columns.pgrad] ?? "").trim();
    const fullNameRaw = String(row[columns.fullName] ?? "").trim();
    const warName = String(row[columns.warName] ?? "").trim();
    const birthDate = parseBirthDate(row[columns.birthDate]);

    const rowProblems = [
      !pgrad && "P/Grad ausente",
      !fullNameRaw && "Nome ausente",
      !birthDate && "Data de nascimento inválida",
    ].filter(Boolean);
    if (rowProblems.length) {
      invalidRows.push({ row: rowIndex + 1, reason: rowProblems.join("; ") });
      continue;
    }

    const fullName = titleCaseName(fullNameRaw);
    const match = matchWarName(fullName, warName);
    records.push({
      id: `${located.sheetName}-${rowIndex + 1}`,
      sourceRow: rowIndex + 1,
      pgrad,
      fullName,
      warName,
      birthDate,
      included: true,
      match,
      manualMatch: false,
    });
  }

  records.sort((a, b) => a.birthDate.getDate() - b.birthDate.getDate() || a.fullName.localeCompare(b.fullName, "pt-BR"));
  return { records, invalidRows, sheetName: located.sheetName, totalRows: records.length + invalidRows.length };
}

export function recordsForPeriod(records, period) {
  return records.filter((record) => record.birthDate.getMonth() === period.month);
}

export function formatCardDate(record, period) {
  return `Santa Maria - RS, ${record.birthDate.getDate()} de ${MONTHS[period.month]} de ${period.year}.`;
}

export function cloneTokenModes(tokens) {
  return tokens.map((token) => ({ ...token }));
}

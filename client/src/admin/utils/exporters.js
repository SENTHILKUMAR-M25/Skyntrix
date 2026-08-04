// Dependency-free CSV / Excel (SpreadsheetML) exports for admin tables.

const csvEscape = (value) => {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export const toCSV = (rows, columns) => {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => csvEscape(c.value(row)))
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
};

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadCSV = (rows, columns, filename) => {
  const csv = "\uFEFF" + toCSV(rows, columns); // BOM for Excel UTF-8
  download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
};

// Minimal SpreadsheetML .xls builder (opens cleanly in Excel / Google Sheets).
export const downloadExcel = (rows, columns, filename) => {
  const head = columns.map((c) => `<th style="background:#6D28D9;color:#fff;font-weight:bold;">${String(c.label).replace(/[<>&]/g, "")}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const value = c.value(row);
          const text = value == null ? "" : String(value).replace(/[<>&]/g, "");
          return `<td>${text}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1">${head}${body}</table></body></html>`;
  download(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" }), filename);
};

export const stamp = (prefix = "leads") => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

// Parse CSV text into an array of objects keyed by header row.
export const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
    return obj;
  });
};

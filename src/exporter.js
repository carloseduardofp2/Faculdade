import JSZip from "jszip";
import { PDFDocument, rgb } from "pdf-lib";
import { renderCardBlob } from "./canvas.js";
import { normalizeText } from "./data.js";

const A4 = { width: 595.28, height: 841.89 };

function safeName(value) {
  return normalizeText(value)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "MILITAR";
}

function periodFolder(period) {
  return `${safeName(period.name)}_${period.year}`;
}

function drawCropMarks(page, x, y, width, height) {
  const length = 9;
  const gap = 3;
  const color = rgb(0.62, 0.62, 0.62);
  const thickness = 0.45;
  const lines = [
    [x - gap - length, y, x - gap, y], [x, y - gap - length, x, y - gap],
    [x + width + gap, y, x + width + gap + length, y], [x + width, y - gap - length, x + width, y - gap],
    [x - gap - length, y + height, x - gap, y + height], [x, y + height + gap, x, y + height + gap + length],
    [x + width + gap, y + height, x + width + gap + length, y + height], [x + width, y + height + gap, x + width, y + height + gap + length],
  ];
  lines.forEach(([startX, startY, endX, endY]) => page.drawLine({ start: { x: startX, y: startY }, end: { x: endX, y: endY }, color, thickness }));
}

async function buildPdf(rendered, format, cropMarks) {
  const pdf = await PDFDocument.create();
  const marginX = 28;
  const marginY = 34;
  const middleGap = 18;
  const slotWidth = A4.width - marginX * 2;
  const slotHeight = (A4.height - marginY * 2 - middleGap) / 2;

  const groups = new Map();
  rendered.forEach((item) => {
    if (!groups.has(item.period.id)) groups.set(item.period.id, []);
    groups.get(item.period.id).push(item);
  });

  for (const items of groups.values()) {
    for (let index = 0; index < items.length; index += 2) {
      const page = pdf.addPage([A4.width, A4.height]);
      const pair = items.slice(index, index + 2);
      for (let slot = 0; slot < pair.length; slot += 1) {
        const item = pair[slot];
        const bytes = await item.blob.arrayBuffer();
        const embedded = format === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const scale = Math.min(slotWidth / embedded.width, slotHeight / embedded.height);
        const width = embedded.width * scale;
        const height = embedded.height * scale;
        const x = (A4.width - width) / 2;
        const slotBottom = slot === 0 ? A4.height / 2 + middleGap / 2 : marginY;
        const y = slotBottom + (slotHeight - height) / 2;
        page.drawImage(embedded, { x, y, width, height });
        if (cropMarks) drawCropMarks(page, x, y, width, height);
      }
    }
  }
  return new Blob([await pdf.save({ useObjectStreams: false })], { type: "application/pdf" });
}

export async function generatePackage({ items, background, layout, format, cropMarks, onProgress }) {
  if (!items.length) throw new Error("Selecione pelo menos um cartão para exportar.");
  const zip = new JSZip();
  const rendered = [];
  const usedNames = new Map();
  const totalSteps = items.length + 2;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    onProgress?.({ percent: Math.round((index / totalSteps) * 100), label: `Gerando cartão ${index + 1} de ${items.length}` });
    const blob = await renderCardBlob(background, item.record, item.period, layout, format);
    const extension = format === "png" ? "png" : "jpg";
    const base = `${String(item.record.birthDate.getDate()).padStart(2, "0")}_${safeName(item.record.warName || item.record.fullName)}`;
    const key = `${item.period.id}/${base}`;
    const occurrence = (usedNames.get(key) || 0) + 1;
    usedNames.set(key, occurrence);
    const filename = `${base}${occurrence > 1 ? `_${occurrence}` : ""}.${extension}`;
    zip.file(`${periodFolder(item.period)}/${filename}`, blob);
    rendered.push({ ...item, blob });
  }

  onProgress?.({ percent: Math.round((items.length / totalSteps) * 100), label: "Montando PDF de impressão" });
  const pdfBlob = await buildPdf(rendered, format, cropMarks);
  const firstPeriod = items[0].period;
  const lastPeriod = items[items.length - 1].period;
  const pdfSuffix = firstPeriod.id === lastPeriod.id
    ? `${safeName(firstPeriod.name)}_${firstPeriod.year}`
    : `${safeName(firstPeriod.name)}_${firstPeriod.year}_${safeName(lastPeriod.name)}_${lastPeriod.year}`;
  zip.file(`IMPRIMIR_${pdfSuffix}.pdf`, pdfBlob);

  onProgress?.({ percent: Math.round(((items.length + 1) / totalSteps) * 100), label: "Compactando o pacote" });
  const zipBlob = await zip.generateAsync(
    { type: "blob", compression: "STORE" },
    ({ percent }) => onProgress?.({ percent: Math.min(99, Math.round(82 + percent * 0.17)), label: "Compactando o pacote" }),
  );
  onProgress?.({ percent: 100, label: "Pacote concluído" });

  return {
    blob: zipBlob,
    filename: `Cartoes_Aniversariantes_${pdfSuffix}.zip`,
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

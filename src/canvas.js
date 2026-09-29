import { formatCardDate } from "./data.js";

const BASE_WIDTH = 2339;
const BASE_HEIGHT = 1654;
const FONT_FAMILY = '"Cambria ComSoc", Cambria, Georgia, serif';

export function createDefaultLayout() {
  return {
    version: 1,
    custom: [],
    identity: {
      x: 0.5,
      y: 550 / BASE_HEIGHT,
      fontRatio: 70 / BASE_WIDTH,
      maxWidthRatio: 0.9,
      color: "#000000",
      align: "center",
      autoFit: true,
    },
    date: {
      x: 2100 / BASE_WIDTH,
      y: 1160 / BASE_HEIGHT,
      fontRatio: 55 / BASE_WIDTH,
      maxWidthRatio: 0.72,
      color: "#000000",
      align: "right",
      autoFit: true,
    },
  };
}

export function cloneLayout(layout) {
  return JSON.parse(JSON.stringify(layout));
}

export async function loadImageSource(source) {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

export async function ensureCardFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('400 72px "Cambria ComSoc"'),
    document.fonts.load('700 72px "Cambria ComSoc"'),
  ]);
}

function buildIdentitySegments(record) {
  const segments = [];
  if (record.pgrad) segments.push({ text: `${record.pgrad} `, bold: true });

  const bold = new Array(record.fullName.length).fill(false);
  record.match.tokens.forEach((token) => {
    if (token.mode === "full") {
      for (let index = token.start; index < token.end; index += 1) bold[index] = true;
    } else if (token.mode === "initial") {
      bold[token.start] = true;
    }
  });

  let current = "";
  let currentBold = bold[0] ?? false;
  for (let index = 0; index < record.fullName.length; index += 1) {
    if (bold[index] !== currentBold && current) {
      segments.push({ text: current, bold: currentBold });
      current = "";
      currentBold = bold[index];
    }
    current += record.fullName[index];
  }
  if (current) segments.push({ text: current, bold: currentBold });
  return segments;
}

function setFont(context, size, bold) {
  context.font = `${bold ? 700 : 400} ${size}px ${FONT_FAMILY}`;
}

function measureSegments(context, segments, fontSize) {
  return segments.reduce((width, segment) => {
    setFont(context, fontSize, segment.bold);
    return width + context.measureText(segment.text).width;
  }, 0);
}

function drawSegments(context, segments, layer, imageWidth, imageHeight) {
  const maxWidth = layer.maxWidthRatio * imageWidth;
  const preferredSize = Math.max(12, layer.fontRatio * imageWidth);
  let fontSize = preferredSize;
  let width = measureSegments(context, segments, fontSize);

  if (layer.autoFit && width > maxWidth) {
    fontSize = Math.max(preferredSize * 0.48, preferredSize * (maxWidth / width));
    width = measureSegments(context, segments, fontSize);
  }

  const anchorX = layer.x * imageWidth;
  const top = layer.y * imageHeight;
  let startX = anchorX;
  if (layer.align === "center") startX -= width / 2;
  if (layer.align === "right") startX -= width;

  context.textBaseline = "top";
  context.fillStyle = layer.color;
  let cursor = startX;
  for (const segment of segments) {
    setFont(context, fontSize, segment.bold);
    context.fillText(segment.text, cursor, top);
    cursor += context.measureText(segment.text).width;
  }

  return {
    x: startX,
    y: top,
    width,
    height: fontSize * 1.14,
    fontSize,
    anchorX,
  };
}

function drawSelection(context, box, imageWidth, imageHeight, snapped) {
  const scale = imageWidth / BASE_WIDTH;
  context.save();
  context.strokeStyle = "#23684a";
  context.lineWidth = Math.max(2, 3 * scale);
  context.setLineDash([10 * scale, 7 * scale]);
  context.strokeRect(box.x - 8 * scale, box.y - 6 * scale, box.width + 16 * scale, box.height + 12 * scale);
  context.setLineDash([]);

  const radius = Math.max(5, 7 * scale);
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#23684a";
  context.beginPath();
  context.arc(box.anchorX, box.y + box.height / 2, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  if (snapped) {
    context.strokeStyle = "rgba(35,104,74,.65)";
    context.lineWidth = Math.max(1, 2 * scale);
    context.beginPath();
    context.moveTo(imageWidth / 2, 0);
    context.lineTo(imageWidth / 2, imageHeight);
    context.stroke();
  }
  context.restore();
}

export function renderCard(canvas, background, record, period, layout, options = {}) {
  if (!background || !record || !period) return {};
  canvas.width = background.naturalWidth || background.width;
  canvas.height = background.naturalHeight || background.height;
  const context = canvas.getContext("2d", { alpha: false });
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(background, 0, 0, canvas.width, canvas.height);

  const identityBox = drawSegments(context, buildIdentitySegments(record), layout.identity, canvas.width, canvas.height);
  const dateBox = drawSegments(
    context,
    [{ text: formatCardDate(record, period), bold: false }],
    layout.date,
    canvas.width,
    canvas.height,
  );

  const boxes = { identity: identityBox, date: dateBox };
  (layout.custom || []).forEach((layer) => {
    boxes[layer.id] = drawSegments(
      context,
      [{ text: layer.text || "", bold: Boolean(layer.bold) }],
      layer,
      canvas.width,
      canvas.height,
    );
  });
  if (options.selection && boxes[options.selection]) {
    drawSelection(context, boxes[options.selection], canvas.width, canvas.height, options.snapped);
  }
  return boxes;
}

export function canvasToBlob(canvas, format = "jpeg", quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem.")),
      format === "png" ? "image/png" : "image/jpeg",
      quality,
    );
  });
}

export async function renderCardBlob(background, record, period, layout, format = "jpeg") {
  const canvas = document.createElement("canvas");
  renderCard(canvas, background, record, period, layout);
  return canvasToBlob(canvas, format);
}

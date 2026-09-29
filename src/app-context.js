import { getTargetPeriods, MONTHS, recordsForPeriod } from "./data.js";
import { createDefaultLayout } from "./canvas.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const PAGE_TITLES = {
  import: "Preparar cartões",
  people: "Conferir aniversariantes",
  editor: "Editar modelo",
  export: "Exportar cartões",
};

const defaultPeriod = getTargetPeriods()[1];

export const state = {
  periods: [defaultPeriod],
  records: [],
  invalidRows: [],
  sheetFile: null,
  sheetName: "",
  background: null,
  backgroundName: "",
  activePeriodId: defaultPeriod.id,
  selectedLayer: "identity",
  previewRecordId: "",
  previewPeriodId: defaultPeriod.id,
  layout: createDefaultLayout(),
  editorBoxes: {},
  snapped: false,
  dragging: null,
  editingRecord: null,
  draftTokens: [],
  history: [],
  historyIndex: -1,
  exportFormat: "jpeg",
};

export const elements = {
  sidebar: $(".sidebar"), mobileMenu: $("#mobileMenu"), pageTitle: $("#pageTitle"),
  periodBadge: $("#periodBadge"), navItems: $$(".nav-item"), views: $$(".view"),
  sheetInput: $("#sheetInput"), imageInput: $("#imageInput"), sheetDrop: $("#sheetDrop"),
  imageDrop: $("#imageDrop"), sheetFileName: $("#sheetFileName"), imageFileName: $("#imageFileName"),
  importStatus: $("#importStatus"), periodMonth: $("#periodMonth"), periodYear: $("#periodYear"),
  goPeople: $("#goPeople"), monthTabs: $("#monthTabs"), peopleBody: $("#peopleBody"),
  emptyPeople: $("#emptyPeople"), peopleSearch: $("#peopleSearch"), selectAll: $("#selectAll"),
  includedCount: $("#includedCount"), nameDialog: $("#nameDialog"), nameTokenEditor: $("#nameTokenEditor"),
  previewPerson: $("#previewPerson"), cardCanvas: $("#cardCanvas"), layersList: $("#layersList"),
  customTextControls: $("#customTextControls"), customText: $("#customText"), customBold: $("#customBold"),
  fontSize: $("#fontSize"), fontSizeValue: $("#fontSizeValue"), maxWidth: $("#maxWidth"),
  maxWidthValue: $("#maxWidthValue"), textColor: $("#textColor"), textColorHex: $("#textColorHex"),
  autoFit: $("#autoFit"), presetSelect: $("#presetSelect"), presetDialog: $("#presetDialog"),
  presetName: $("#presetName"), periodChecks: $("#periodChecks"), exportCardCount: $("#exportCardCount"),
  exportPageCount: $("#exportPageCount"), progressBox: $("#progressBox"), progressLabel: $("#progressLabel"),
  progressPercent: $("#progressPercent"), exportProgress: $("#exportProgress"),
  generatePackage: $("#generatePackage"), toastRegion: $("#toastRegion"),
};

export function capitalize(value) {
  return value ? value[0].toLocaleUpperCase("pt-BR") + value.slice(1) : "";
}

export function makePeriod(month, year) {
  return {
    id: `${year}-${String(month + 1).padStart(2, "0")}`,
    month, year, name: MONTHS[month],
    label: `${capitalize(MONTHS[month])} de ${year}`,
    shortLabel: `${MONTHS[month].slice(0, 3).toLocaleUpperCase("pt-BR")}/${year}`,
  };
}

export function currentPeriod() {
  return state.periods[0];
}

export function selectedMonthRecords() {
  return recordsForPeriod(state.records, currentPeriod());
}

export function selectedCardItems() {
  const period = currentPeriod();
  return recordsForPeriod(state.records, period)
    .filter((record) => record.included)
    .map((record) => ({ record, period }));
}

export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  elements.toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

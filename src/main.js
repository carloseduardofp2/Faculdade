import "./styles.css";
import "./styles/responsive.css";
import { ensureCardFonts } from "./canvas.js";
import { elements, PAGE_TITLES, $ } from "./app-context.js";
import { setupImportFeature } from "./features/import-controller.js";
import { renderPeoplePage, setupPeopleFeature } from "./features/people-controller.js";
import { renderEditor, setupEditorFeature, showEditorPage } from "./features/editor-controller.js";
import { setupExportFeature, showExportPage } from "./features/export-controller.js";

function navigate(viewName) {
  const navItem = elements.navItems.find((item) => item.dataset.view === viewName);
  if (!navItem || navItem.disabled) return;
  elements.views.forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
  elements.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  elements.pageTitle.textContent = PAGE_TITLES[viewName];
  elements.sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (viewName === "people") renderPeoplePage();
  if (viewName === "editor") showEditorPage();
  if (viewName === "export") showExportPage();
}

function setupNavigation() {
  elements.navItems.forEach((item) => item.addEventListener("click", () => navigate(item.dataset.view)));
  elements.mobileMenu.addEventListener("click", () => elements.sidebar.classList.toggle("open"));
  document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.back)));
  $("#goPeople").addEventListener("click", () => navigate("people"));
  $("#goEditor").addEventListener("click", () => navigate("editor"));
  $("#goExport").addEventListener("click", () => navigate("export"));
}

async function initialize() {
  setupNavigation();
  setupPeopleFeature();
  setupEditorFeature();
  setupExportFeature();
  await ensureCardFonts();
  await setupImportFeature({ onBackgroundChange: renderEditor });
}

initialize();

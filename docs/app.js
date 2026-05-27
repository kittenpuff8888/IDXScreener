const state = {
  manifest: null,
  payload: null,
  tab: "dashboard",
  filter: "ALL",
  search: "",
  sortKey: null,
  sortDir: 1,
};

const dashboardColumns = [
  "Filter", "Ticker", "Sector", "Price", "Chg %", "RVOL", "Zone", "MP Profile",
  "MA Position", "POI", "Anchor", "Target", "Upside %", "R/R"
];
const maxDashboardRows = 80;

const filterLabels = {
  A: "EMA Trend",
  B: "Golden Cross",
  C: "Swing BOS",
  D: "POI Bounce",
  E: "EQ Breakout",
};

const numericNames = new Set([
  "Price", "Chg %", "RVOL", "Target", "Upside %", "Invalidation", "Closing Price", "Price Change %",
  "RS Rating", "RVOL 20D", "ADR %", "ATR (14) %", "RSI 14", "P/E Ratio", "P/B Ratio",
  "Dividend Yield", "Profit Margin", "ROE", "ROA", "Revenue Growth", "Earnings Growth", "Bars", "Retry Count"
]);

const els = {
  dateSelect: document.querySelector("#dateSelect"),
  runMeta: document.querySelector("#runMeta"),
  downloadLink: document.querySelector("#downloadLink"),
  metricTotal: document.querySelector("#metricTotal"),
  metricOk: document.querySelector("#metricOk"),
  metricPartial: document.querySelector("#metricPartial"),
  metricNoData: document.querySelector("#metricNoData"),
  searchInput: document.querySelector("#searchInput"),
  filterBar: document.querySelector("#filterBar"),
  dashboardView: document.querySelector("#dashboardView"),
  signalCards: document.querySelector("#signalCards"),
  spotlightCards: document.querySelector("#spotlightCards"),
  sectorBars: document.querySelector("#sectorBars"),
  viewTitle: document.querySelector("#viewTitle"),
  viewMeta: document.querySelector("#viewMeta"),
  tableHead: document.querySelector("#tableHead"),
  tableBody: document.querySelector("#tableBody"),
  emptyState: document.querySelector("#emptyState"),
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value !== "number") return value;
  if (key.includes("%") || key === "Chg %") {
    const pct = Math.abs(value) <= 1 ? value * 100 : value;
    return `${pct.toFixed(2)}%`;
  }
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getColumns(tab = state.tab) {
  if (tab === "dashboard") return dashboardColumns;
  const exported = state.payload?.columns?.[tab];
  if (exported?.length) return exported;
  const rows = state.payload?.[tab] || [];
  return rows[0] ? Object.keys(rows[0]).filter((key) => key !== "Section") : [];
}

function isNumericColumn(key, rows) {
  if (numericNames.has(key)) return true;
  return rows.some((row) => typeof row[key] === "number");
}

function titleForTab(tab) {
  return {
    dashboard: "Signal Dashboard",
    screener: "IDX Screener",
    technical: "IDX Technical Detail",
    fundamental: "IDX Fundamental Detail",
    processing: "Data Processing Results",
  }[tab] || tab;
}

function filteredRows(limitDashboard = true) {
  const sourceTab = state.tab === "dashboard" ? "screener" : state.tab;
  const raw = state.payload?.[sourceTab] || [];
  let rows = raw;

  if ((state.tab === "dashboard" || state.tab === "screener") && state.filter !== "ALL") {
    rows = rows.filter((row) => row.Filter === state.filter);
  }

  const needle = state.search.trim().toLowerCase();
  if (needle) {
    rows = rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(needle)));
  }

  if (state.sortKey) {
    rows = [...rows].sort((a, b) => {
      const av = a[state.sortKey];
      const bv = b[state.sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * state.sortDir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * state.sortDir;
    });
  } else if (state.tab === "dashboard") {
    rows = [...rows].sort((a, b) => (b["Upside %"] || 0) - (a["Upside %"] || 0));
  }

  if (state.tab === "dashboard" && limitDashboard) {
    return rows.slice(0, maxDashboardRows);
  }

  return rows;
}

function activeRows() {
  return filteredRows(true);
}

function renderMetrics() {
  const summary = state.payload?.summary || {};
  els.metricTotal.textContent = summary.totalScanned ?? "-";
  els.metricOk.textContent = summary.ok ?? "-";
  els.metricPartial.textContent = summary.partial ?? "-";
  els.metricNoData.textContent = summary.noData ?? "-";
}

function renderFilterBar() {
  if (state.tab !== "dashboard" && state.tab !== "screener") {
    els.filterBar.innerHTML = "";
    return;
  }
  const counts = { ALL: state.payload.screener.length };
  for (const row of state.payload.screener) counts[row.Filter] = (counts[row.Filter] || 0) + 1;
  els.filterBar.innerHTML = ["ALL", "A", "B", "C", "D", "E"].map((tag) => {
    const label = tag === "ALL" ? "All" : `Filter ${tag}`;
    return `<button class="chip ${state.filter === tag ? "active" : ""}" data-filter="${tag}" type="button">${label} ${counts[tag] || 0}</button>`;
  }).join("");
}

function groupCount(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "-";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderDashboard(rows) {
  const allRows = state.payload?.screener || [];
  const counts = groupCount(allRows, "Filter");
  const total = allRows.length || 1;

  els.signalCards.innerHTML = ["A", "B", "C", "D", "E"].map((tag) => {
    const count = counts[tag] || 0;
    const pct = Math.round((count / total) * 100);
    return `
      <button class="signal-card ${state.filter === tag ? "active" : ""}" data-filter="${tag}" type="button">
        <span>Filter ${tag}</span>
        <strong>${count}</strong>
        <small>${filterLabels[tag]} / ${pct}%</small>
      </button>
    `;
  }).join("");

  const topSetups = [...rows]
    .filter((row) => typeof row["Upside %"] === "number")
    .sort((a, b) => (b["Upside %"] || 0) - (a["Upside %"] || 0))
    .slice(0, 4);

  els.spotlightCards.innerHTML = topSetups.length ? topSetups.map((row) => `
    <article class="setup-card">
      <div>
        <strong>${escapeHtml(row.Ticker)}</strong>
        <span>${escapeHtml(row.Sector)}</span>
      </div>
      <dl>
        <dt>Price</dt><dd>${escapeHtml(formatValue("Price", row.Price))}</dd>
        <dt>Upside</dt><dd class="positive">${escapeHtml(formatValue("Upside %", row["Upside %"]))}</dd>
        <dt>R/R</dt><dd>${escapeHtml(formatValue("R/R", row["R/R"]))}</dd>
      </dl>
      <p>${escapeHtml(row.Zone || row.POI || "-")}</p>
    </article>
  `).join("") : `<div class="muted-box">No setups in the current filter.</div>`;

  const sectorCounts = Object.entries(groupCount(rows, "Sector"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxSector = Math.max(1, ...sectorCounts.map(([, count]) => count));

  els.sectorBars.innerHTML = sectorCounts.length ? sectorCounts.map(([sector, count]) => `
    <div class="sector-row">
      <span>${escapeHtml(sector)}</span>
      <div><i style="width:${Math.max(8, (count / maxSector) * 100)}%"></i></div>
      <strong>${count}</strong>
    </div>
  `).join("") : `<div class="muted-box">No sector data for this filter.</div>`;
}

function renderTable() {
  const rows = activeRows();
  const totalRows = filteredRows(false).length;
  const visibleColumns = getColumns();

  els.viewTitle.textContent = titleForTab(state.tab);
  const rowText = state.tab === "dashboard"
    ? `Top ${rows.length.toLocaleString("en-US")} of ${totalRows.toLocaleString("en-US")} setups`
    : `${rows.length.toLocaleString("en-US")} rows`;
  els.viewMeta.textContent = `${rowText} / ${visibleColumns.length.toLocaleString("en-US")} columns`;
  els.dashboardView.toggleAttribute("hidden", state.tab !== "dashboard");
  if (state.tab === "dashboard") renderDashboard(rows);

  els.tableHead.innerHTML = `<tr>${visibleColumns.map((key) => {
    const mark = state.sortKey === key ? (state.sortDir === 1 ? " ^" : " v") : "";
    return `<th class="sortable" data-sort="${escapeHtml(key)}">${escapeHtml(key)}${mark}</th>`;
  }).join("")}</tr>`;

  els.tableBody.innerHTML = rows.map((row) => `<tr>${visibleColumns.map((key) => {
    const value = row[key];
    const numeric = isNumericColumn(key, rows);
    const classes = [
      numeric ? "numeric" : "",
      key === "Ticker" ? "ticker" : "",
      numeric && Number(value) > 0 && key.includes("%") ? "positive" : "",
      numeric && Number(value) < 0 && key.includes("%") ? "negative" : "",
    ].filter(Boolean).join(" ");
    return `<td class="${classes}">${escapeHtml(formatValue(key, value))}</td>`;
  }).join("")}</tr>`).join("");

  els.emptyState.toggleAttribute("hidden", rows.length > 0);
}

function render() {
  if (!state.payload) return;
  els.runMeta.textContent = `Market data as of ${state.payload.date} / Run ${state.payload.runTime || "-"}`;
  els.downloadLink.href = state.payload.workbook || "#";
  els.downloadLink.setAttribute("aria-disabled", state.payload.workbook ? "false" : "true");
  renderMetrics();
  renderFilterBar();
  renderTable();
}

async function loadDate(date) {
  const item = state.manifest.dates.find((entry) => entry.date === date);
  if (!item) return;
  state.payload = await fetchJson(item.file);
  state.sortKey = null;
  state.sortDir = 1;
  render();
}

async function init() {
  state.manifest = await fetchJson("data/manifest.json");
  if (!state.manifest.dates.length) {
    els.runMeta.textContent = "No screener data has been published yet.";
    renderTable();
    return;
  }

  els.dateSelect.innerHTML = state.manifest.dates
    .map((entry) => `<option value="${entry.date}">${entry.date}</option>`)
    .join("");
  els.dateSelect.value = state.manifest.latest;
  await loadDate(state.manifest.latest);
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    state.tab = button.dataset.tab;
    state.filter = "ALL";
    state.sortKey = null;
    state.search = "";
    els.searchInput.value = "";
    render();
  });
});

els.dateSelect.addEventListener("change", (event) => loadDate(event.target.value));
els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderTable();
});
els.filterBar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
});
els.dashboardView.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
});
els.tableHead.addEventListener("click", (event) => {
  const header = event.target.closest("[data-sort]");
  if (!header) return;
  const key = header.dataset.sort;
  if (state.sortKey === key) state.sortDir *= -1;
  else {
    state.sortKey = key;
    state.sortDir = 1;
  }
  renderTable();
});

init().catch((error) => {
  els.runMeta.textContent = error.message;
});

const state = {
  manifest: null,
  payload: null,
  tab: "screener",
  filter: "ALL",
  search: "",
  sortKey: null,
  sortDir: 1,
};

const columns = {
  screener: [
    "Filter", "Ticker", "Sector", "Price", "Chg %", "RVOL", "ADR & ATR (14)", "Zone",
    "MP Profile", "MA Position", "POI", "Anchor", "Entry", "Target", "Upside %", "Invalidation", "R/R"
  ],
  technical: [
    "Ticker", "Closing Price", "Price Change %", "RS Rating", "IDX Sector", "Sector", "Industry",
    "Market Cap", "Liquidity Category", "RVOL 20D", "ADR %", "ATR (14) %", "MA Zone",
    "RSI 14", "MACD Cross", "Current QVWAP Zone", "Previous QVWAP Zone", "Previous Year VWAP Zone"
  ],
  fundamental: [
    "Ticker", "Price", "Price Change %", "IDX Sector", "Market Cap", "P/E Ratio", "P/B Ratio",
    "Dividend Yield", "Profit Margin", "ROE", "ROA", "Revenue Growth", "Earnings Growth"
  ],
  processing: ["Ticker", "Status", "Bars", "Retry Count", "Source Used", "Latest Market Day", "Reason"],
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

function activeRows() {
  const raw = state.payload?.[state.tab] || [];
  let rows = raw;

  if (state.tab === "screener" && state.filter !== "ALL") {
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
  }

  return rows;
}

function renderMetrics() {
  const summary = state.payload?.summary || {};
  els.metricTotal.textContent = summary.totalScanned ?? "-";
  els.metricOk.textContent = summary.ok ?? "-";
  els.metricPartial.textContent = summary.partial ?? "-";
  els.metricNoData.textContent = summary.noData ?? "-";
}

function renderFilterBar() {
  if (state.tab !== "screener") {
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

function renderTable() {
  const visibleColumns = columns[state.tab];
  const rows = activeRows();

  els.tableHead.innerHTML = `<tr>${visibleColumns.map((key) => {
    const mark = state.sortKey === key ? (state.sortDir === 1 ? " ▲" : " ▼") : "";
    return `<th class="sortable" data-sort="${key}">${key}${mark}</th>`;
  }).join("")}</tr>`;

  els.tableBody.innerHTML = rows.map((row) => `<tr>${visibleColumns.map((key) => {
    const value = row[key];
    const numeric = numericNames.has(key);
    const classes = [
      numeric ? "numeric" : "",
      key === "Ticker" ? "ticker" : "",
      numeric && Number(value) > 0 && key.includes("%") ? "positive" : "",
      numeric && Number(value) < 0 && key.includes("%") ? "negative" : "",
    ].filter(Boolean).join(" ");
    return `<td class="${classes}">${formatValue(key, value)}</td>`;
  }).join("")}</tr>`).join("");

  els.emptyState.hidden = rows.length > 0;
}

function render() {
  if (!state.payload) return;
  els.runMeta.textContent = `Market data as of ${state.payload.date} · Run ${state.payload.runTime || "-"}`;
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

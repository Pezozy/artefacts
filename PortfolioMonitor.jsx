import { useState, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// ─── Utilities ────────────────────────────────────────────────────────────────

const parseVal = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : Number(v);
  return isNaN(n) ? null : n;
};

const isFiniteNum = (v) =>
  v !== null && v !== undefined && typeof v === "number" && isFinite(v) && !isNaN(v);

const fmtCurrency = (val, currency = "USD") => {
  try {
    return val.toLocaleString("en-US", {
      style: "currency",
      currency: currency === "OTHER" ? "USD" : currency,
      maximumFractionDigits: 0,
    });
  } catch {
    return String(val);
  }
};

const fmtPct = (val, decimals = 2) =>
  isFiniteNum(val) ? val.toFixed(decimals) + "%" : "—";

const fmt = (val, type, currency = "USD") => {
  if (!isFiniteNum(val)) return "—";
  if (type === "currency") return fmtCurrency(val, currency);
  if (type === "percent") return fmtPct(val);
  return String(val);
};

// ─── UI Primitives ────────────────────────────────────────────────────────────

function CopyModal({ text, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1e293b] border border-slate-600/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
        <h3 className="text-white font-semibold mb-3 text-sm">Copy Results</h3>
        <textarea
          className="w-full bg-slate-900 text-slate-300 text-xs rounded-lg p-3 h-52 resize-none border border-slate-700 focus:outline-none font-mono"
          value={text}
          readOnly
          autoFocus
          onFocus={(e) => e.target.select()}
        />
        <button
          onClick={onClose}
          className="mt-3 w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function useCopyToClipboard() {
  const [modal, setModal] = useState(null);
  const copy = useCallback((text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => setModal(text));
    } else {
      setModal(text);
    }
  }, []);
  const ModalNode = modal ? <CopyModal text={modal} onClose={() => setModal(null)} /> : null;
  return [copy, ModalNode];
}

function CalcCard({ title, description, children, onReset, onCopy }) {
  return (
    <div className="bg-[#1e293b] border border-slate-700/40 rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex items-start justify-between px-6 py-5 border-b border-slate-700/40">
        <div className="flex-1 min-w-0 pr-4">
          <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{description}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onCopy}
            className="text-xs bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-slate-600/30"
          >
            Copy Results
          </button>
          <button
            onClick={onReset}
            className="text-xs bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-slate-600/30"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, suffix, prefix, disabled }) {
  const currSymbol = prefix || "";
  return (
    <div className="mb-3">
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      )}
      <div className="relative flex items-center">
        {currSymbol && (
          <span className="absolute left-3 text-slate-400 text-sm pointer-events-none select-none z-10">
            {currSymbol}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          disabled={!!disabled}
          className={[
            "w-full bg-slate-800/80 border border-slate-600/70 rounded-lg text-white text-sm",
            "placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50",
            "transition-colors appearance-none",
            currSymbol ? "pl-7" : "px-3",
            suffix ? "pr-14" : "pr-3",
            "py-2",
            disabled ? "opacity-40 cursor-not-allowed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
        {suffix && (
          <span className="absolute right-3 text-slate-500 text-xs pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C+", "Growth", "Other"];
const SECTORS = ["SaaS", "Fintech", "HealthTech", "DeepTech", "Consumer", "E-commerce", "Climate", "BioTech", "Other"];
const STATUSES = ["Active", "Exited", "Written Off"];

const STATUS_COLORS = {
  Active: { badge: "bg-cyan-900/40 text-cyan-300 border-cyan-700/40" },
  Exited: { badge: "bg-green-900/40 text-green-300 border-green-700/40" },
  "Written Off": { badge: "bg-red-900/40 text-red-300 border-red-700/40" },
};

const PIE_PALETTE = [
  "#0ea5e9", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ef4444", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

// ─── Data Helpers ─────────────────────────────────────────────────────────────

const mkCompany = (id) => ({
  id,
  name: "",
  sector: "SaaS",
  stage: "Seed",
  status: "Active",
  investmentDate: "",
  checkSize: "",
  ownershipPct: "",
  currentValuation: "",
  exitProceeds: "",
  note: "",
});

const PM_DEFAULTS = {
  companies: [mkCompany(1), mkCompany(2), mkCompany(3)],
};

function computePortfolioMetrics(companies, currency) {
  const today = new Date();
  const rows = companies.map((c) => {
    const check = parseVal(c.checkSize);
    const own = parseVal(c.ownershipPct);
    const valuation = parseVal(c.currentValuation);
    const exitProc = parseVal(c.exitProceeds);
    const invDate = c.investmentDate ? new Date(c.investmentDate + "T00:00:00") : null;
    const holdingYears =
      invDate && invDate < today
        ? (today - invDate) / (1000 * 60 * 60 * 24 * 365.25)
        : null;

    let currentValue = null;
    if (c.status === "Exited" && isFiniteNum(exitProc)) {
      currentValue = exitProc;
    } else if (c.status === "Written Off") {
      currentValue = 0;
    } else if (isFiniteNum(valuation) && isFiniteNum(own)) {
      currentValue = valuation * (own / 100);
    }

    const moic =
      isFiniteNum(currentValue) && isFiniteNum(check) && check > 0
        ? currentValue / check
        : null;
    const irr =
      isFiniteNum(moic) && isFiniteNum(holdingYears) && holdingYears > 0
        ? (Math.pow(moic, 1 / holdingYears) - 1) * 100
        : null;

    return { ...c, check, own, valuation, exitProc, invDate, holdingYears, currentValue, moic, irr };
  });

  const validRows = rows.filter((r) => isFiniteNum(r.check));
  const totalInvested = validRows.reduce((s, r) => s + r.check, 0);
  const totalValue = validRows.reduce(
    (s, r) => s + (isFiniteNum(r.currentValue) ? r.currentValue : 0),
    0
  );
  const portfolioMoic = totalInvested > 0 ? totalValue / totalInvested : null;
  const numActive = rows.filter((r) => r.status === "Active").length;
  const numExited = rows.filter((r) => r.status === "Exited").length;
  const numWO = rows.filter((r) => r.status === "Written Off").length;

  const bySector = {};
  validRows.forEach((r) => {
    bySector[r.sector] = (bySector[r.sector] || 0) + r.check;
  });
  const sectorData = Object.entries(bySector).map(([name, value]) => ({ name, value }));

  const companyBar = validRows.map((r) => ({
    name: r.name || "Unnamed",
    invested: r.check,
    currentValue: isFiniteNum(r.currentValue) ? r.currentValue : 0,
  }));

  return { rows, totalInvested, totalValue, portfolioMoic, numActive, numExited, numWO, sectorData, companyBar };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortfolioMonitor({ currency = "USD" }) {
  const [inputs, setInputs] = useState(PM_DEFAULTS);
  const [copyFn, CopyModalNode] = useCopyToClipboard();
  const [expandedId, setExpandedId] = useState(null);

  const addCompany = useCallback(() => {
    setInputs((prev) => {
      if (prev.companies.length >= 40) return prev;
      return { ...prev, companies: [...prev.companies, mkCompany(Date.now())] };
    });
  }, []);

  const removeCompany = useCallback((id) => {
    setInputs((prev) => ({
      ...prev,
      companies: prev.companies.filter((c) => c.id !== id),
    }));
  }, []);

  const updateCompany = useCallback((id, field, val) => {
    setInputs((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    }));
  }, []);

  const handleReset = useCallback(() => {
    setInputs(PM_DEFAULTS);
    setExpandedId(null);
  }, []);

  const metrics = useMemo(
    () => computePortfolioMetrics(inputs.companies, currency),
    [inputs.companies, currency]
  );

  const handleCopy = useCallback(() => {
    const lines = [
      "Portfolio Monitor Summary",
      "=========================",
      `Total Companies: ${inputs.companies.length}  |  Active: ${metrics.numActive}  |  Exited: ${metrics.numExited}  |  Written Off: ${metrics.numWO}`,
      `Total Invested:  ${fmt(metrics.totalInvested, "currency", currency)}`,
      `Portfolio Value: ${fmt(metrics.totalValue, "currency", currency)}`,
      `Portfolio MOIC:  ${isFiniteNum(metrics.portfolioMoic) ? metrics.portfolioMoic.toFixed(2) + "x" : "—"}`,
      "",
      "Company Detail:",
      ...metrics.rows.map(
        (r) =>
          `  ${r.name || "Unnamed"} | ${r.stage} | ${r.status} | Invested: ${fmt(r.check, "currency", currency)} | Value: ${isFiniteNum(r.currentValue) ? fmt(r.currentValue, "currency", currency) : "—"} | MOIC: ${isFiniteNum(r.moic) ? r.moic.toFixed(2) + "x" : "—"}`
      ),
    ];
    copyFn(lines.join("\n"));
  }, [metrics, inputs.companies, currency, copyFn]);

  const moicColor = (m) => {
    if (!isFiniteNum(m)) return "text-slate-400";
    if (m >= 3) return "text-green-400";
    if (m >= 1) return "text-cyan-400";
    return "text-red-400";
  };

  const currPrefix =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";

  const tooltipStyle = {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#f1f5f9",
    fontSize: 12,
  };

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="Portfolio Monitor"
        description="Track investments, ownership stakes, valuations, and returns across your portfolio."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        {/* ── Summary KPI strip ── */}
        {metrics.totalInvested > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Invested", value: fmt(metrics.totalInvested, "currency", currency) },
              { label: "Portfolio Value", value: fmt(metrics.totalValue, "currency", currency) },
              {
                label: "Portfolio MOIC",
                value: isFiniteNum(metrics.portfolioMoic)
                  ? metrics.portfolioMoic.toFixed(2) + "x"
                  : "—",
              },
              {
                label: "Companies",
                value: `${metrics.numActive} active · ${metrics.numExited} exited · ${metrics.numWO} w/o`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
                <div className="text-base font-bold text-white truncate">{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Charts ── */}
        {metrics.sectorData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Sector allocation pie */}
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Invested by Sector
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={metrics.sectorData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {metrics.sectorData.map((_, i) => (
                      <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => fmt(v, "currency", currency)}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Invested vs value bar */}
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Invested vs. Current Value
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={metrics.companyBar}
                  margin={{ top: 0, right: 8, left: 0, bottom: 30 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v) => fmt(v, "currency", currency)}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v) => fmt(v, "currency", currency)}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="invested" name="Invested" fill="#334155" radius={[3, 3, 0, 0]} />
                  <Bar
                    dataKey="currentValue"
                    name="Current Value"
                    fill="#0ea5e9"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Company rows ── */}
        <div className="space-y-2 mb-4">
          {/* Desktop column headers */}
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 px-3 pb-1">
            {["Company", "Sector", "Stage", "Status", "Invested", "Valuation", "MOIC", ""].map(
              (h) => (
                <div key={h} className="text-[10px] uppercase tracking-widest text-slate-500">
                  {h}
                </div>
              )
            )}
          </div>

          {inputs.companies.map((company, idx) => {
            const row = metrics.rows[idx];
            const isExpanded = expandedId === company.id;
            const sc = STATUS_COLORS[company.status] || STATUS_COLORS.Active;

            return (
              <div
                key={company.id}
                className="bg-slate-800/50 border border-slate-700/40 rounded-xl overflow-hidden"
              >
                {/* Collapsed row */}
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center p-3">
                  <input
                    type="text"
                    value={company.name}
                    placeholder={`Company ${idx + 1}`}
                    onChange={(e) => updateCompany(company.id, "name", e.target.value)}
                    className="bg-slate-900/60 border border-slate-700/50 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 w-full"
                  />
                  <select
                    value={company.sector}
                    onChange={(e) => updateCompany(company.id, "sector", e.target.value)}
                    className="bg-slate-900/60 border border-slate-700/50 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500 w-full cursor-pointer"
                  >
                    {SECTORS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={company.stage}
                    onChange={(e) => updateCompany(company.id, "stage", e.target.value)}
                    className="bg-slate-900/60 border border-slate-700/50 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500 w-full cursor-pointer"
                  >
                    {STAGES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={company.status}
                    onChange={(e) => updateCompany(company.id, "status", e.target.value)}
                    className={`border text-xs rounded-lg px-2 py-1.5 focus:outline-none w-full cursor-pointer ${sc.badge}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <InputField
                    label=""
                    value={company.checkSize}
                    onChange={(val) => updateCompany(company.id, "checkSize", val)}
                    placeholder="Invested"
                    prefix={currPrefix}
                  />
                  <InputField
                    label=""
                    value={
                      company.status === "Exited" ? company.exitProceeds : company.currentValuation
                    }
                    onChange={(val) =>
                      updateCompany(
                        company.id,
                        company.status === "Exited" ? "exitProceeds" : "currentValuation",
                        val
                      )
                    }
                    placeholder={company.status === "Exited" ? "Exit $" : "Valuation"}
                    prefix={currPrefix}
                  />
                  <div
                    className={`text-sm font-bold text-right lg:text-left ${moicColor(row?.moic)}`}
                  >
                    {isFiniteNum(row?.moic) ? row.moic.toFixed(2) + "x" : "—"}
                  </div>
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : company.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors text-xs"
                      title="Details"
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                    <button
                      onClick={() => removeCompany(company.id)}
                      disabled={inputs.companies.length <= 1}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-slate-700/40 bg-slate-900/30 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                        Investment Date
                      </label>
                      <input
                        type="date"
                        value={company.investmentDate}
                        onChange={(e) =>
                          updateCompany(company.id, "investmentDate", e.target.value)
                        }
                        className="bg-slate-800 border border-slate-700/50 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 w-full"
                      />
                    </div>
                    <InputField
                      label="Ownership %"
                      value={company.ownershipPct}
                      onChange={(val) => updateCompany(company.id, "ownershipPct", val)}
                      placeholder="e.g. 5.0"
                      suffix="%"
                    />
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                        Note
                      </label>
                      <input
                        type="text"
                        value={company.note}
                        onChange={(e) => updateCompany(company.id, "note", e.target.value)}
                        placeholder="Board seat, pro-rata, etc."
                        className="bg-slate-800 border border-slate-700/50 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 w-full"
                      />
                    </div>
                    {(isFiniteNum(row?.moic) ||
                      isFiniteNum(row?.irr) ||
                      isFiniteNum(row?.currentValue)) && (
                      <div className="sm:col-span-2 lg:col-span-3 bg-slate-800/60 border border-slate-700/30 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          {
                            label: "Current Value",
                            value: isFiniteNum(row?.currentValue)
                              ? fmt(row.currentValue, "currency", currency)
                              : "—",
                          },
                          {
                            label: "MOIC",
                            value: isFiniteNum(row?.moic) ? row.moic.toFixed(2) + "x" : "—",
                          },
                          {
                            label: "IRR (est.)",
                            value: isFiniteNum(row?.irr) ? fmtPct(row.irr) : "—",
                          },
                          {
                            label: "Holding (yrs)",
                            value: isFiniteNum(row?.holdingYears)
                              ? row.holdingYears.toFixed(1) + " yr"
                              : "—",
                          },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">
                              {label}
                            </div>
                            <div className="text-sm font-semibold text-white">{value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add company */}
        <button
          onClick={addCompany}
          disabled={inputs.companies.length >= 40}
          className="w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-600 hover:bg-cyan-950/10 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Add Company
        </button>
      </CalcCard>
    </>
  );
}

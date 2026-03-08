import { useState, useCallback, useMemo, useRef } from "react";
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
  Legend,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = [
  "SaaS", "Fintech", "HealthTech", "EdTech", "E-commerce",
  "Deep Tech", "Consumer", "B2B Services", "CleanTech", "AI / ML",
  "Cybersecurity", "Logistics", "Real Estate", "Media", "Other",
];

const STAGES = [
  "Pre-seed", "Seed", "Series A", "Series B", "Series C", "Series D+",
  "Growth", "Pre-IPO", "Public", "Acquired", "Dead",
];

const STATUS_OPTIONS = ["Active", "Acquired", "IPO", "Dead", "Unknown"];

const SECTOR_COLORS = [
  "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#f43f5e", "#8b5cf6",
  "#0ea5e9", "#84cc16", "#fb923c", "#e879f9", "#64748b",
];

const STAGE_COLORS = {
  "Pre-seed":  "#64748b",
  "Seed":      "#3b82f6",
  "Series A":  "#a855f7",
  "Series B":  "#f97316",
  "Series C":  "#eab308",
  "Series D+": "#ec4899",
  "Growth":    "#22c55e",
  "Pre-IPO":   "#06b6d4",
  "Public":    "#10b981",
  "Acquired":  "#8b5cf6",
  "Dead":      "#ef4444",
};

const BLANK_STARTUP = {
  name: "",
  sector: "SaaS",
  stage: "Seed",
  status: "Active",
  founded: "",
  hq: "",
  website: "",
  description: "",
  totalRaised: "",   // $M
  lastRound: "",
  lastRoundDate: "",
  lastRoundAmount: "", // $M
  valuation: "",     // $M
  employees: "",
  notes: "",
};

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_DATA = [
  {
    id: "1", name: "Stripe",       sector: "Fintech",    stage: "Pre-IPO",  status: "Active",
    founded: "2010", hq: "San Francisco, CA", website: "stripe.com",
    description: "Global payments infrastructure for the internet.",
    totalRaised: "8800", lastRound: "Series I", lastRoundDate: "2023-03-15",
    lastRoundAmount: "6500", valuation: "50000", employees: "8000", notes: "",
  },
  {
    id: "2", name: "Figma",        sector: "SaaS",       stage: "Acquired", status: "Acquired",
    founded: "2012", hq: "San Francisco, CA", website: "figma.com",
    description: "Collaborative interface design tool for teams.",
    totalRaised: "333", lastRound: "Series E", lastRoundDate: "2021-06-24",
    lastRoundAmount: "200", valuation: "20000", employees: "1200", notes: "Acquired by Adobe",
  },
  {
    id: "3", name: "Notion",       sector: "SaaS",       stage: "Growth",   status: "Active",
    founded: "2013", hq: "San Francisco, CA", website: "notion.so",
    description: "All-in-one workspace for notes, docs, and project management.",
    totalRaised: "343", lastRound: "Series C", lastRoundDate: "2021-10-08",
    lastRoundAmount: "275", valuation: "10000", employees: "800", notes: "",
  },
  {
    id: "4", name: "Anthropic",    sector: "AI / ML",    stage: "Series D+", status: "Active",
    founded: "2021", hq: "San Francisco, CA", website: "anthropic.com",
    description: "AI safety company developing reliable and interpretable AI.",
    totalRaised: "7700", lastRound: "Series E", lastRoundDate: "2024-03-01",
    lastRoundAmount: "2750", valuation: "18000", employees: "700", notes: "",
  },
  {
    id: "5", name: "Linear",       sector: "SaaS",       stage: "Series B",  status: "Active",
    founded: "2019", hq: "San Francisco, CA", website: "linear.app",
    description: "Streamlined issue tracking and project management for software teams.",
    totalRaised: "52", lastRound: "Series B", lastRoundDate: "2022-07-26",
    lastRoundAmount: "35", valuation: "400", employees: "100", notes: "",
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtM = (val) => {
  const n = parseFloat(val);
  if (!isFinite(n) || isNaN(n) || val === "" || val == null) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${n.toFixed(0)}M`;
};

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch { return dateStr; }
};

const fmtNum = (val) => {
  const n = parseInt(val, 10);
  if (!isFinite(n) || isNaN(n)) return "—";
  return n.toLocaleString();
};

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Badge({ label, color = "#64748b" }) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: color + "22", color }}
    >
      {label}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <span className="text-xl font-bold text-white tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <h3 className="text-sm font-semibold text-slate-300 mb-3">{children}</h3>
  );
}

function LabeledField({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "bg-slate-800 border border-slate-700/50 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder-slate-600 w-full";
const selectCls =
  "bg-slate-800 border border-slate-700/50 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 w-full cursor-pointer";
const textareaCls =
  "bg-slate-800 border border-slate-700/50 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder-slate-600 w-full resize-none";

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function StartupModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...BLANK_STARTUP, ...initial }));

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#1e293b] border border-slate-600/50 rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-8">
        <h2 className="text-white font-semibold text-base mb-5">
          {initial?.id ? "Edit Startup" : "Add Startup"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: name + website */}
          <div className="grid grid-cols-2 gap-4">
            <LabeledField label="Company Name *">
              <input
                required
                className={inputCls}
                placeholder="Acme Corp"
                value={form.name}
                onChange={set("name")}
              />
            </LabeledField>
            <LabeledField label="Website">
              <input
                className={inputCls}
                placeholder="acme.com"
                value={form.website}
                onChange={set("website")}
              />
            </LabeledField>
          </div>

          {/* Row 2: sector + stage + status */}
          <div className="grid grid-cols-3 gap-4">
            <LabeledField label="Sector">
              <select className={selectCls} value={form.sector} onChange={set("sector")}>
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Stage">
              <select className={selectCls} value={form.stage} onChange={set("stage")}>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Status">
              <select className={selectCls} value={form.status} onChange={set("status")}>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </LabeledField>
          </div>

          {/* Row 3: founded + hq + employees */}
          <div className="grid grid-cols-3 gap-4">
            <LabeledField label="Founded (year)">
              <input
                className={inputCls}
                placeholder="2020"
                value={form.founded}
                onChange={set("founded")}
              />
            </LabeledField>
            <LabeledField label="HQ (city, country)">
              <input
                className={inputCls}
                placeholder="San Francisco, CA"
                value={form.hq}
                onChange={set("hq")}
              />
            </LabeledField>
            <LabeledField label="Employees">
              <input
                className={inputCls}
                placeholder="50"
                value={form.employees}
                onChange={set("employees")}
              />
            </LabeledField>
          </div>

          {/* Row 4: funding */}
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 space-y-3">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Funding</p>
            <div className="grid grid-cols-2 gap-4">
              <LabeledField label="Total Raised ($M)">
                <input
                  className={inputCls}
                  placeholder="50"
                  value={form.totalRaised}
                  onChange={set("totalRaised")}
                />
              </LabeledField>
              <LabeledField label="Valuation ($M)">
                <input
                  className={inputCls}
                  placeholder="200"
                  value={form.valuation}
                  onChange={set("valuation")}
                />
              </LabeledField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <LabeledField label="Last Round">
                <input
                  className={inputCls}
                  placeholder="Series A"
                  value={form.lastRound}
                  onChange={set("lastRound")}
                />
              </LabeledField>
              <LabeledField label="Round Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.lastRoundDate}
                  onChange={set("lastRoundDate")}
                />
              </LabeledField>
              <LabeledField label="Round Amount ($M)">
                <input
                  className={inputCls}
                  placeholder="10"
                  value={form.lastRoundAmount}
                  onChange={set("lastRoundAmount")}
                />
              </LabeledField>
            </div>
          </div>

          {/* Description + notes */}
          <LabeledField label="Description">
            <textarea
              className={textareaCls}
              rows={2}
              placeholder="What does this company do?"
              value={form.description}
              onChange={set("description")}
            />
          </LabeledField>
          <LabeledField label="Notes">
            <textarea
              className={textareaCls}
              rows={2}
              placeholder="Private notes..."
              value={form.notes}
              onChange={set("notes")}
            />
          </LabeledField>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
            >
              {initial?.id ? "Save Changes" : "Add Startup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-800/60 last:border-0">
      <span className="text-xs text-slate-400 font-medium shrink-0">{label}</span>
      <span className="text-xs text-slate-200 text-right break-words max-w-[60%]">{value}</span>
    </div>
  );
}

function DetailPanel({ startup, onEdit, onDelete, onClose }) {
  const stageColor = STAGE_COLORS[startup.stage] || "#64748b";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#1e293b] border border-slate-600/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl h-[calc(100vh-2rem)] overflow-y-auto flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{startup.name}</h2>
            {startup.website && (
              <p className="text-xs text-cyan-400 mt-0.5">{startup.website}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-xl leading-none shrink-0 mt-0.5"
          >
            ×
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge label={startup.sector} color="#06b6d4" />
          <Badge label={startup.stage} color={stageColor} />
          <Badge
            label={startup.status}
            color={
              startup.status === "Active" ? "#22c55e" :
              startup.status === "Acquired" ? "#8b5cf6" :
              startup.status === "IPO" ? "#06b6d4" :
              startup.status === "Dead" ? "#ef4444" : "#64748b"
            }
          />
        </div>

        {/* Description */}
        {startup.description && (
          <p className="text-sm text-slate-300 leading-relaxed">{startup.description}</p>
        )}

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{fmtM(startup.totalRaised)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Total Raised</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{fmtM(startup.valuation)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Valuation</p>
          </div>
        </div>

        {/* Details */}
        <div>
          <DetailRow label="Founded" value={startup.founded} />
          <DetailRow label="HQ" value={startup.hq} />
          <DetailRow label="Employees" value={startup.employees ? fmtNum(startup.employees) : null} />
          <DetailRow label="Last Round" value={startup.lastRound} />
          <DetailRow label="Round Date" value={fmtDate(startup.lastRoundDate)} />
          <DetailRow label="Round Amount" value={fmtM(startup.lastRoundAmount)} />
        </div>

        {/* Notes */}
        {startup.notes && (
          <div className="bg-slate-800/40 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Notes</p>
            <p className="text-xs text-slate-300 leading-relaxed">{startup.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-2">
          <button
            onClick={() => onEdit(startup)}
            className="flex-1 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${startup.name}"?`)) {
                onDelete(startup.id);
                onClose();
              }
            }}
            className="px-4 py-2 text-sm bg-red-900/40 hover:bg-red-800/60 text-red-400 hover:text-red-300 rounded-lg transition-colors font-medium border border-red-900/40"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function SectorChart({ startups }) {
  const data = useMemo(() => {
    const counts = {};
    startups.forEach((s) => { counts[s.sector] = (counts[s.sector] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }));
  }, [startups]);

  if (data.length === 0) return null;

  return (
    <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-4">
      <SectionHeader>By Sector</SectionHeader>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [v, "Companies"]}
          />
          <Bar dataKey="value" radius={4}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StageChart({ startups }) {
  const data = useMemo(() => {
    const counts = {};
    startups.forEach((s) => { counts[s.stage] = (counts[s.stage] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => STAGES.indexOf(a[0]) - STAGES.indexOf(b[0]))
      .map(([name, value]) => ({ name, value, color: STAGE_COLORS[name] || "#64748b" }));
  }, [startups]);

  if (data.length === 0) return null;

  return (
    <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-4">
      <SectionHeader>By Stage</SectionHeader>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
            stroke="none"
          >
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
          />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TableRow({ startup, onClick }) {
  const stageColor = STAGE_COLORS[startup.stage] || "#64748b";
  return (
    <tr
      onClick={onClick}
      className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors group"
    >
      <td className="py-3 px-4">
        <div>
          <p className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
            {startup.name}
          </p>
          {startup.hq && <p className="text-[10px] text-slate-500 mt-0.5">{startup.hq}</p>}
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-slate-300">{startup.sector}</span>
      </td>
      <td className="py-3 px-4">
        <Badge label={startup.stage} color={stageColor} />
      </td>
      <td className="py-3 px-4 text-right tabular-nums">
        <span className="text-xs text-slate-300">{fmtM(startup.totalRaised)}</span>
      </td>
      <td className="py-3 px-4 text-right tabular-nums">
        <span className="text-xs text-slate-300">{fmtM(startup.valuation)}</span>
      </td>
      <td className="py-3 px-4 text-xs text-slate-400">
        {startup.lastRound ? (
          <span>{startup.lastRound} · {fmtDate(startup.lastRoundDate)}</span>
        ) : "—"}
      </td>
      <td className="py-3 px-4 text-xs text-slate-400">
        {startup.founded || "—"}
      </td>
      <td className="py-3 px-4">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            startup.status === "Active"    ? "bg-green-900/40 text-green-400" :
            startup.status === "Acquired" ? "bg-purple-900/40 text-purple-400" :
            startup.status === "IPO"      ? "bg-cyan-900/40 text-cyan-400" :
            startup.status === "Dead"     ? "bg-red-900/40 text-red-400" :
            "bg-slate-700 text-slate-400"
          }`}
        >
          {startup.status}
        </span>
      </td>
    </tr>
  );
}

// ─── Sort helpers ──────────────────────────────────────────────────────────────

const SORT_FIELDS = [
  { key: "name",         label: "Name" },
  { key: "sector",       label: "Sector" },
  { key: "stage",        label: "Stage" },
  { key: "totalRaised",  label: "Total Raised" },
  { key: "valuation",    label: "Valuation" },
  { key: "lastRoundDate",label: "Round Date" },
  { key: "founded",      label: "Founded" },
];

function sortStartups(list, field, dir) {
  return [...list].sort((a, b) => {
    let va = a[field] ?? "";
    let vb = b[field] ?? "";
    if (["totalRaised", "valuation", "lastRoundAmount"].includes(field)) {
      va = parseFloat(va) || -Infinity;
      vb = parseFloat(vb) || -Infinity;
    } else if (field === "founded") {
      va = parseInt(va, 10) || -Infinity;
      vb = parseInt(vb, 10) || -Infinity;
    } else if (field === "stage") {
      va = STAGES.indexOf(va);
      vb = STAGES.indexOf(vb);
    } else {
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
    }
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

// ─── Export ────────────────────────────────────────────────────────────────────

function toCSV(startups) {
  const headers = [
    "Name","Sector","Stage","Status","Founded","HQ","Website",
    "Total Raised ($M)","Valuation ($M)","Last Round","Round Date","Round Amount ($M)",
    "Employees","Description","Notes",
  ];
  const rows = startups.map((s) => [
    s.name, s.sector, s.stage, s.status, s.founded, s.hq, s.website,
    s.totalRaised, s.valuation, s.lastRound, s.lastRoundDate, s.lastRoundAmount,
    s.employees, s.description, s.notes,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  return [headers.join(","), ...rows].join("\n");
}

function downloadCSV(startups) {
  const blob = new Blob([toCSV(startups)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "startup-database.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Inner Component ──────────────────────────────────────────────────────────

function StartupDatabaseInner() {
  const [startups, setStartups] = useState(() =>
    SEED_DATA.map((s) => ({ ...s }))
  );
  const [modal, setModal] = useState(null);        // null | "add" | { ...startup }
  const [detail, setDetail] = useState(null);      // null | startup
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("All");
  const [filterStage, setFilterStage] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [view, setView] = useState("table");       // "table" | "charts"

  // ── Derived ──

  const filtered = useMemo(() => {
    let list = startups;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q) ||
          s.hq.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    if (filterSector !== "All") list = list.filter((s) => s.sector === filterSector);
    if (filterStage  !== "All") list = list.filter((s) => s.stage  === filterStage);
    if (filterStatus !== "All") list = list.filter((s) => s.status === filterStatus);
    return sortStartups(list, sortField, sortDir);
  }, [startups, search, filterSector, filterStage, filterStatus, sortField, sortDir]);

  const stats = useMemo(() => {
    const active = startups.filter((s) => s.status === "Active").length;
    const totalRaised = startups.reduce((sum, s) => sum + (parseFloat(s.totalRaised) || 0), 0);
    const sectors = new Set(startups.map((s) => s.sector)).size;
    const stages  = new Set(startups.map((s) => s.stage)).size;
    return { total: startups.length, active, totalRaised, sectors, stages };
  }, [startups]);

  // ── Handlers ──

  const toggleSort = useCallback((field) => {
    setSortField((prev) => {
      if (prev === field) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return field; }
      setSortDir("asc");
      return field;
    });
  }, []);

  const handleSave = useCallback((form) => {
    if (form.id) {
      setStartups((prev) => prev.map((s) => s.id === form.id ? { ...form } : s));
    } else {
      setStartups((prev) => [...prev, { ...form, id: genId() }]);
    }
    setModal(null);
  }, []);

  const handleDelete = useCallback((id) => {
    setStartups((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleEdit = useCallback((startup) => {
    setDetail(null);
    setModal(startup);
  }, []);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-600 ml-1">↕</span>;
    return <span className="text-cyan-400 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Startup Database</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track and research companies in your universe
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCSV(filtered)}
            className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => setModal("add")}
            className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors"
          >
            + Add Startup
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Companies" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard
          label="Total Raised"
          value={fmtM(stats.totalRaised)}
          sub="across all tracked"
        />
        <StatCard label="Sectors / Stages" value={`${stats.sectors} / ${stats.stages}`} />
      </div>

      {/* Filters + Search + View toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <input
          className="bg-slate-800 border border-slate-700/50 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder-slate-500 flex-1 min-w-0"
          placeholder="Search by name, sector, HQ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={selectCls + " !w-auto text-xs"}
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
        >
          <option>All</option>
          {SECTORS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          className={selectCls + " !w-auto text-xs"}
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
        >
          <option>All</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          className={selectCls + " !w-auto text-xs"}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option>All</option>
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-slate-700 shrink-0">
          {["table", "charts"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 text-xs font-medium transition-colors capitalize ${
                view === v
                  ? "bg-slate-700 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-500">
        {filtered.length} of {startups.length} companies
        {(filterSector !== "All" || filterStage !== "All" || filterStatus !== "All" || search) && " (filtered)"}
      </p>

      {/* Main Content */}
      {view === "table" ? (
        filtered.length === 0 ? (
          <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-sm">No startups found.</p>
            <button
              onClick={() => setModal("add")}
              className="mt-4 px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors"
            >
              Add your first startup
            </button>
          </div>
        ) : (
          <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-800/30">
                    {[
                      { field: "name",          label: "Company" },
                      { field: "sector",        label: "Sector" },
                      { field: "stage",         label: "Stage" },
                      { field: "totalRaised",   label: "Total Raised", right: true },
                      { field: "valuation",     label: "Valuation", right: true },
                      { field: "lastRoundDate", label: "Last Round" },
                      { field: "founded",       label: "Founded" },
                      { field: null,            label: "Status" },
                    ].map(({ field, label, right }) => (
                      <th
                        key={label}
                        onClick={field ? () => toggleSort(field) : undefined}
                        className={[
                          "px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider",
                          right ? "text-right" : "text-left",
                          field ? "cursor-pointer hover:text-slate-200 select-none" : "",
                        ].join(" ")}
                      >
                        {label}
                        {field && <SortIcon field={field} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((startup) => (
                    <TableRow
                      key={startup.id}
                      startup={startup}
                      onClick={() => setDetail(startup)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Charts view */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SectorChart startups={filtered} />
          <StageChart  startups={filtered} />

          {/* Funding bar chart */}
          <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-4 sm:col-span-2">
            <SectionHeader>Top Companies by Total Raised</SectionHeader>
            {(() => {
              const data = [...filtered]
                .filter((s) => parseFloat(s.totalRaised) > 0)
                .sort((a, b) => (parseFloat(b.totalRaised) || 0) - (parseFloat(a.totalRaised) || 0))
                .slice(0, 12)
                .map((s) => ({
                  name: s.name,
                  value: parseFloat(s.totalRaised) || 0,
                  color: STAGE_COLORS[s.stage] || "#64748b",
                }));
              if (data.length === 0) return <p className="text-xs text-slate-500">No funding data available.</p>;
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data} margin={{ bottom: 40 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      angle={-35}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `$${v / 1000}B` : `$${v}M`}
                    />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => [`$${v}M`, "Raised"]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {data.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal === "add" || (modal && modal.id)) && (
        <StartupModal
          initial={modal === "add" ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {detail && (
        <DetailPanel
          startup={detail}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ─── Standalone Page ──────────────────────────────────────────────────────────

export default function StartupDatabase() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0c1525]/95 backdrop-blur-md border-b border-slate-800/80 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-14 gap-3">
            <span className="text-sm font-bold text-white tracking-tight">Startup Database</span>
            <div className="w-px h-5 bg-slate-700" />
            <span className="text-xs text-slate-400">Company research &amp; tracking</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <StartupDatabaseInner />
      </main>
    </div>
  );
}

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell
} from "recharts";

// ─── Safe Formatter ───────────────────────────────────────────────────────────
const fmt = (val, type, currency = "USD") => {
  if (val === null || val === undefined || (typeof val === "number" && !isFinite(val))) return "—";
  try {
    if (type === "currency")
      return val.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
    if (type === "percent") return Number(val).toFixed(1) + "%";
    if (type === "number") return Number(val).toLocaleString();
    if (type === "date")
      return new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
  return String(val);
};

const daysAgo = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff < 0 ? null : diff;
};

const daysInStage = (stageEnteredDate) => {
  if (!stageEnteredDate) return null;
  const d = new Date(stageEnteredDate);
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff < 0 ? 0 : diff;
};

const today = () => new Date().toISOString().split("T")[0];
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// 6 months from today
const sixMonthsFromNow = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().split("T")[0];
};

// ─── Column Definitions ───────────────────────────────────────────────────────
const COLUMNS = [
  { key: "identified",    label: "Identified",          accent: "#64748b", tailwind: "border-slate-500" },
  { key: "researched",    label: "Researched",           accent: "#3b82f6", tailwind: "border-blue-500" },
  { key: "outreached",    label: "Outreached",           accent: "#a855f7", tailwind: "border-purple-500" },
  { key: "meeting",       label: "Meeting Booked",       accent: "#eab308", tailwind: "border-yellow-500" },
  { key: "diligence",     label: "Due Diligence",        accent: "#f97316", tailwind: "border-orange-500" },
  { key: "closed",        label: "Closed / Won · Passed",accent: "#22c55e", tailwind: "border-green-500" },
];

const ACTIVE_STAGES = ["outreached", "meeting", "diligence"];
const SOFT_STAGES   = ["meeting", "diligence"];
const HARD_STAGES   = ["closed"];

const INVESTOR_TYPES  = ["VC Fund", "Family Office", "Angel", "Corporate", "Accelerator", "Other"];
const STAGE_FOCUSES   = ["Pre-Seed", "Seed", "Series A", "Series B", "Growth"];
const SOURCES         = ["Cold Outreach", "Warm Introduction", "Inbound", "Referral", "Conference", "Other"];
const INTERACTION_TYPES = ["Email", "Call", "Meeting", "Introduction", "Note"];
const ROUND_TYPES     = ["Pre-Seed", "Seed", "Series A", "Series B", "Bridge", "Other"];
const CURRENCIES      = ["USD", "EUR", "GBP"];
const OUTCOMES        = ["Won", "Passed", "Ghosted"];

const TYPE_COLORS = {
  "VC Fund":       "bg-blue-900 text-blue-300",
  "Family Office": "bg-purple-900 text-purple-300",
  "Angel":         "bg-yellow-900 text-yellow-300",
  "Corporate":     "bg-orange-900 text-orange-300",
  "Accelerator":   "bg-green-900 text-green-300",
  "Other":         "bg-slate-700 text-slate-300",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_INVESTORS = [
  {
    id: genId(), name: "Sequoia Capital", firmName: "Sequoia Capital", type: "VC Fund",
    website: "https://sequoiacap.com", linkedin: "", email: "", phone: "",
    stageFocus: ["Series A", "Series B"], sectorFocus: ["SaaS", "Fintech"], geographyFocus: ["US"],
    minTicket: 2000000, maxTicket: 5000000, expectedTicket: 3000000,
    stage: "identified", outcome: null,
    lastActivityDate: null, nextFollowUpDate: null,
    source: "Cold Outreach", warmIntroVia: "",
    interactions: [], notes: "Top-tier VC, focus on enterprise SaaS.", tags: ["tier-1", "saas"],
    stageEnteredDate: today(), createdAt: today(),
  },
  {
    id: genId(), name: "Andreessen Horowitz", firmName: "a16z", type: "VC Fund",
    website: "https://a16z.com", linkedin: "", email: "", phone: "",
    stageFocus: ["Series A"], sectorFocus: ["SaaS", "AI"], geographyFocus: ["US"],
    minTicket: 1000000, maxTicket: 3000000, expectedTicket: 2000000,
    stage: "researched", outcome: null,
    lastActivityDate: null, nextFollowUpDate: null,
    source: "Inbound", warmIntroVia: "",
    interactions: [], notes: "Strong crypto and AI thesis.", tags: ["tier-1"],
    stageEnteredDate: today(), createdAt: today(),
  },
  {
    id: genId(), name: "Tiger Global", firmName: "Tiger Global Management", type: "VC Fund",
    website: "https://tigerglobal.com", linkedin: "", email: "", phone: "",
    stageFocus: ["Series A", "Series B"], sectorFocus: ["Fintech"], geographyFocus: ["Global"],
    minTicket: 5000000, maxTicket: 5000000, expectedTicket: 5000000,
    stage: "outreached", outcome: null,
    lastActivityDate: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
    nextFollowUpDate: null,
    source: "Cold Outreach", warmIntroVia: "",
    interactions: [], notes: "", tags: [],
    stageEnteredDate: today(), createdAt: today(),
  },
  {
    id: genId(), name: "First Round Capital", firmName: "First Round Capital", type: "VC Fund",
    website: "https://firstround.com", linkedin: "", email: "", phone: "",
    stageFocus: ["Seed", "Series A"], sectorFocus: ["SaaS"], geographyFocus: ["US"],
    minTicket: null, maxTicket: null, expectedTicket: null,
    stage: "outreached", outcome: null,
    lastActivityDate: new Date(Date.now() - 20 * 86400000).toISOString().split("T")[0],
    nextFollowUpDate: null,
    source: "Referral", warmIntroVia: "",
    interactions: [], notes: "No activity in 20 days — follow up needed.", tags: ["stale"],
    stageEnteredDate: today(), createdAt: today(),
  },
  {
    id: genId(), name: "Founders Fund", firmName: "Founders Fund", type: "VC Fund",
    website: "https://foundersfund.com", linkedin: "", email: "", phone: "",
    stageFocus: ["Series A"], sectorFocus: ["Deep Tech"], geographyFocus: ["US"],
    minTicket: 2000000, maxTicket: 2000000, expectedTicket: 2000000,
    stage: "meeting", outcome: null,
    lastActivityDate: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
    nextFollowUpDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    source: "Warm Introduction", warmIntroVia: "John Smith",
    interactions: [{ id: genId(), date: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0], type: "Meeting", summary: "Intro call went well, follow-up scheduled." }],
    notes: "Meeting next week.", tags: ["warm"],
    stageEnteredDate: today(), createdAt: today(),
  },
  {
    id: genId(), name: "Benchmark", firmName: "Benchmark Capital", type: "VC Fund",
    website: "https://benchmark.com", linkedin: "", email: "", phone: "",
    stageFocus: ["Series A", "Series B"], sectorFocus: ["Enterprise"], geographyFocus: ["US"],
    minTicket: 3000000, maxTicket: 3000000, expectedTicket: 3000000,
    stage: "diligence", outcome: null,
    lastActivityDate: new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0],
    nextFollowUpDate: null,
    source: "Conference", warmIntroVia: "",
    interactions: [], notes: "Deep in diligence.", tags: ["hot"],
    stageEnteredDate: today(), createdAt: today(),
  },
  {
    id: genId(), name: "Y Combinator", firmName: "Y Combinator", type: "Accelerator",
    website: "https://ycombinator.com", linkedin: "", email: "", phone: "",
    stageFocus: ["Pre-Seed", "Seed"], sectorFocus: ["SaaS"], geographyFocus: ["Global"],
    minTicket: 500000, maxTicket: 500000, expectedTicket: 500000,
    stage: "closed", outcome: "Won",
    lastActivityDate: new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0],
    nextFollowUpDate: null,
    source: "Inbound", warmIntroVia: "",
    interactions: [], notes: "Closed and won.", tags: ["closed"],
    stageEnteredDate: today(), createdAt: today(),
  },
  {
    id: genId(), name: "SoftBank", firmName: "SoftBank Vision Fund", type: "VC Fund",
    website: "https://softbank.com", linkedin: "", email: "", phone: "",
    stageFocus: ["Series B", "Growth"], sectorFocus: ["AI", "Fintech"], geographyFocus: ["Global"],
    minTicket: 10000000, maxTicket: 10000000, expectedTicket: 10000000,
    stage: "closed", outcome: "Passed",
    lastActivityDate: new Date(Date.now() - 15 * 86400000).toISOString().split("T")[0],
    nextFollowUpDate: null,
    source: "Cold Outreach", warmIntroVia: "",
    interactions: [], notes: "Passed — stage too early.", tags: ["passed"],
    stageEnteredDate: today(), createdAt: today(),
  },
];

const DEFAULT_SETTINGS = {
  dealName: "Series A Raise",
  roundType: "Series A",
  targetAmount: 10000000,
  closeDate: sixMonthsFromNow(),
  currency: "USD",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-2 py-1.5
          text-xs text-slate-200 bg-slate-800 border border-slate-600 rounded shadow-lg whitespace-normal text-center pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

function Modal({ onClose, children, maxWidth = "max-w-xl" }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`relative bg-[#1e293b] border border-[#334155] rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, tooltip, sub }) {
  return (
    <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-3 flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</span>
        {tooltip && (
          <Tooltip text={tooltip}>
            <span className="text-slate-500 cursor-help text-xs">ⓘ</span>
          </Tooltip>
        )}
      </div>
      <div className="text-lg font-bold text-white truncate">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function TagPill({ text, onRemove, color = "bg-slate-700 text-slate-300" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {text}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-white ml-0.5 leading-none">×</button>
      )}
    </span>
  );
}

function CurrencyInput({ label, value, onChange, placeholder }) {
  return (
    <div>
      {label && <label className="block text-xs text-slate-400 mb-1">{label}</label>}
      <input
        type="number" min="0" value={value ?? ""} placeholder={placeholder ?? "0"}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#0ea5e9]"
      />
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, required, error }) {
  return (
    <div>
      {label && <label className="block text-xs text-slate-400 mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>}
      <input
        type="text" value={value ?? ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-[#0f172a] border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#0ea5e9] ${error ? "border-red-500" : "border-[#334155]"}`}
      />
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

function SelectInput({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      {label && <label className="block text-xs text-slate-400 mb-1">{label}</label>}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0ea5e9]">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div>
      {label && <label className="block text-xs text-slate-400 mb-1">{label}</label>}
      <input
        type="date" value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0ea5e9]"
      />
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ settings, onSave, onClose }) {
  const [draft, setDraft] = useState({ ...settings });
  const set = (k, v) => setDraft((p) => ({ ...p, [k]: v }));

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]">
        <h2 className="text-base font-semibold text-white">Round Settings</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
      </div>
      <div className="overflow-y-auto p-5 space-y-4">
        <TextInput label="Deal / Company Name" value={draft.dealName} onChange={(v) => set("dealName", v)} />
        <SelectInput label="Round Type" value={draft.roundType} onChange={(v) => set("roundType", v)} options={ROUND_TYPES} />
        <CurrencyInput label="Target Raise Amount" value={draft.targetAmount} onChange={(v) => set("targetAmount", v)} placeholder="e.g. 10000000" />
        <DateInput label="Target Close Date" value={draft.closeDate} onChange={(v) => set("closeDate", v)} />
        <SelectInput label="Lead Currency" value={draft.currency} onChange={(v) => set("currency", v)} options={CURRENCIES} />
      </div>
      <div className="flex gap-2 px-5 py-4 border-t border-[#334155]">
        <button onClick={() => onSave(draft)}
          className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Save
        </button>
        <button onClick={onClose}
          className="flex-1 border border-[#334155] text-slate-300 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </Modal>
  );
}

// ─── Weekly Digest Modal ──────────────────────────────────────────────────────
function WeeklyDigestModal({ investors, settings, onClose }) {
  const [copied, setCopied] = useState(false);
  const taRef = useRef(null);
  const { currency } = settings;

  const digest = useMemo(() => {
    const byStage = (key) => investors.filter((i) => i.stage === key);
    const won = investors.filter((i) => i.stage === "closed" && i.outcome === "Won");
    const passed = investors.filter((i) => i.stage === "closed" && i.outcome === "Passed");

    const ticketSum = (arr) => {
      const total = arr.reduce((s, i) => s + (i.expectedTicket ?? 0), 0);
      return total > 0 ? fmt(total, "currency", currency) : "—";
    };

    const hardCommitted = won.reduce((s, i) => s + (i.expectedTicket ?? 0), 0);
    const softCircled = [...byStage("meeting"), ...byStage("diligence")].reduce((s, i) => s + (i.expectedTicket ?? 0), 0);
    const target = settings.targetAmount && settings.targetAmount > 0 ? settings.targetAmount : null;
    const coverage = target ? ((hardCommitted + softCircled) / target * 100).toFixed(1) : null;

    const active = [...byStage("meeting"), ...byStage("diligence")];
    const followUps = investors.filter((i) => {
      if (!i.nextFollowUpDate) return false;
      const d = new Date(i.nextFollowUpDate);
      const diff = Math.floor((d - Date.now()) / 86400000);
      return diff <= 7;
    });

    let lines = [
      `FUNDRAISING UPDATE — ${settings.dealName || "My Fundraise"} | ${settings.roundType || "—"} | ${fmt(today(), "date")}`,
      `TARGET: ${target ? fmt(target, "currency", currency) : "Not set"} | CLOSE DATE: ${settings.closeDate ? fmt(settings.closeDate, "date") : "Not set"}`,
      "",
      "ROUND PROGRESS",
      `Hard Committed: ${fmt(hardCommitted, "currency", currency)} (${won.length} investor${won.length !== 1 ? "s" : ""})`,
      `Soft Circled:   ${fmt(softCircled, "currency", currency)} (${[...byStage("meeting"), ...byStage("diligence")].length} investor${[...byStage("meeting"), ...byStage("diligence")].length !== 1 ? "s" : ""})`,
      coverage ? `Total Coverage: ${coverage}% of target` : "Total Coverage: —",
      "",
      "PIPELINE SUMMARY",
      `Identified:     ${byStage("identified").length} investors`,
      `Researched:     ${byStage("researched").length} investors`,
      `Outreached:     ${byStage("outreached").length} investors (${ticketSum(byStage("outreached"))} pipeline)`,
      `Meeting Booked: ${byStage("meeting").length} investors (${ticketSum(byStage("meeting"))} pipeline)`,
      `Due Diligence:  ${byStage("diligence").length} investors (${ticketSum(byStage("diligence"))} pipeline)`,
      `Closed Won:     ${won.length} investors (${ticketSum(won)})`,
      `Closed Passed:  ${passed.length} investors`,
    ];

    if (active.length > 0) {
      lines.push("", "ACTIVE CONVERSATIONS (Meeting Booked + Due Diligence)");
      active.forEach((i) => {
        const da = daysAgo(i.lastActivityDate);
        lines.push(`${i.name}${i.firmName && i.firmName !== i.name ? ` — ${i.firmName}` : ""} — ${COLUMNS.find((c) => c.key === i.stage)?.label || i.stage} — Last contact: ${da !== null ? `${da}d ago` : "never"}`);
      });
    }

    if (followUps.length > 0) {
      lines.push("", "FOLLOW-UPS DUE");
      followUps.forEach((i) => {
        lines.push(`${i.name} — Follow-up due: ${fmt(i.nextFollowUpDate, "date")}`);
      });
    }

    lines.push("", "Generated by Valuta Platform");
    return lines.join("\n");
  }, [investors, settings, currency]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(digest);
      } else {
        if (taRef.current) {
          taRef.current.select();
          document.execCommand("copy");
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (taRef.current) taRef.current.select();
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]">
        <h2 className="text-base font-semibold text-white">Weekly Digest</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
      </div>
      <div className="overflow-y-auto p-5 flex-1">
        <textarea ref={taRef} readOnly value={digest}
          className="w-full h-96 bg-[#0f172a] border border-[#334155] rounded-lg p-3 text-xs text-slate-300 font-mono resize-none focus:outline-none" />
      </div>
      <div className="flex gap-2 px-5 py-4 border-t border-[#334155]">
        <button onClick={handleCopy}
          className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors min-w-[120px]">
          {copied ? "Copied ✓" : "Copy to Clipboard"}
        </button>
        <button onClick={onClose}
          className="border border-[#334155] text-slate-300 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
          Close
        </button>
      </div>
    </Modal>
  );
}

// ─── Add/Edit Investor Modal ──────────────────────────────────────────────────
const BLANK_INVESTOR = {
  name: "", firmName: "", type: "VC Fund",
  website: "", linkedin: "", email: "", phone: "",
  stageFocus: [], sectorFocus: [], geographyFocus: [],
  minTicket: null, maxTicket: null, expectedTicket: null,
  stage: "identified", outcome: null,
  lastActivityDate: null, nextFollowUpDate: null,
  source: "Cold Outreach", warmIntroVia: "",
  interactions: [], notes: "", tags: [],
  stageEnteredDate: null,
};

function InvestorModal({ investor, defaultStage, onSave, onClose, currency }) {
  const [form, setForm] = useState(() => ({
    ...BLANK_INVESTOR,
    ...(investor || {}),
    stage: investor?.stage ?? defaultStage ?? "identified",
    stageFocus: investor?.stageFocus ?? [],
    sectorFocus: investor?.sectorFocus ?? [],
    geographyFocus: investor?.geographyFocus ?? [],
    tags: investor?.tags ?? [],
    interactions: investor?.interactions ?? [],
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [sectorInput, setSectorInput] = useState("");
  const [geoInput, setGeoInput] = useState("");
  const [urlWarning, setUrlWarning] = useState(false);
  const [ticketWarning, setTicketWarning] = useState(false);
  const [newInteraction, setNewInteraction] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.website && !/^https?:\/\//i.test(form.website.trim())) setUrlWarning(true);
    else setUrlWarning(false);
    if (form.minTicket && form.maxTicket && form.minTicket > form.maxTicket) setTicketWarning(true);
    else setTicketWarning(false);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    setTimeout(() => {
      const stageChanged = !investor || investor.stage !== form.stage;
      onSave({
        ...BLANK_INVESTOR,
        ...form,
        name: form.name.trim(),
        stageEnteredDate: stageChanged ? today() : (investor?.stageEnteredDate ?? today()),
        createdAt: investor?.createdAt ?? today(),
        id: investor?.id ?? genId(),
      });
      setSaving(false);
    }, 300);
  };

  const toggleStageFocus = (s) => {
    set("stageFocus", form.stageFocus.includes(s) ? form.stageFocus.filter((x) => x !== s) : [...form.stageFocus, s]);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]);
    setTagInput("");
  };

  const addInteraction = () => {
    const entry = { id: genId(), date: today(), type: "Email", summary: "" };
    setNewInteraction(entry);
  };

  const saveInteraction = () => {
    if (!newInteraction) return;
    set("interactions", [newInteraction, ...form.interactions]);
    setNewInteraction(null);
  };

  const showClosed = form.stage === "closed";

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]">
        <h2 className="text-base font-semibold text-white">{investor ? "Edit Investor" : "Add Investor"}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
      </div>
      <div className="overflow-y-auto p-5 space-y-6 flex-1">

        {/* Basic Info */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Basic Info</h3>
          <div className="space-y-3">
            <TextInput label="Investor / Contact Name" value={form.name} onChange={(v) => set("name", v)} required error={errors.name} />
            <TextInput label="Firm / Fund Name" value={form.firmName} onChange={(v) => set("firmName", v)} />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput label="Investor Type" value={form.type} onChange={(v) => set("type", v)} options={INVESTOR_TYPES} />
              <SelectInput label="Source" value={form.source} onChange={(v) => set("source", v)} options={SOURCES} />
            </div>
            {form.source === "Warm Introduction" && (
              <TextInput label="Warm Introduction Via" value={form.warmIntroVia} onChange={(v) => set("warmIntroVia", v)} />
            )}
            <div>
              <TextInput label="Website" value={form.website} onChange={(v) => set("website", v)} placeholder="https://..." />
              {urlWarning && <p className="text-xs text-yellow-400 mt-0.5">URL may be invalid</p>}
            </div>
            <TextInput label="LinkedIn URL" value={form.linkedin} onChange={(v) => set("linkedin", v)} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Email" value={form.email} onChange={(v) => set("email", v.trim())} />
              <TextInput label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
            </div>
          </div>
        </section>

        {/* Investment Profile */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Investment Profile</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-2">Stage Focus</label>
              <div className="flex flex-wrap gap-2">
                {STAGE_FOCUSES.map((s) => (
                  <button key={s} onClick={() => toggleStageFocus(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.stageFocus.includes(s) ? "bg-[#0ea5e9] border-[#0ea5e9] text-white" : "border-[#334155] text-slate-400 hover:border-slate-400"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sector Focus</label>
              <div className="flex gap-2 mb-1">
                <input value={sectorInput} onChange={(e) => setSectorInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (sectorInput.trim()) { set("sectorFocus", [...form.sectorFocus, sectorInput.trim()]); setSectorInput(""); } } }}
                  placeholder="Add sector, press Enter"
                  className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#0ea5e9]" />
              </div>
              <div className="flex flex-wrap gap-1">{form.sectorFocus.map((s, i) => <TagPill key={i} text={s} onRemove={() => set("sectorFocus", form.sectorFocus.filter((_, j) => j !== i))} />)}</div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Geography Focus</label>
              <div className="flex gap-2 mb-1">
                <input value={geoInput} onChange={(e) => setGeoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (geoInput.trim()) { set("geographyFocus", [...form.geographyFocus, geoInput.trim()]); setGeoInput(""); } } }}
                  placeholder="Add geography, press Enter"
                  className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#0ea5e9]" />
              </div>
              <div className="flex flex-wrap gap-1">{form.geographyFocus.map((g, i) => <TagPill key={i} text={g} onRemove={() => set("geographyFocus", form.geographyFocus.filter((_, j) => j !== i))} />)}</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CurrencyInput label="Min Ticket" value={form.minTicket} onChange={(v) => set("minTicket", v)} />
              <CurrencyInput label="Max Ticket" value={form.maxTicket} onChange={(v) => set("maxTicket", v)} />
              <CurrencyInput label="Expected Ticket (This Deal)" value={form.expectedTicket} onChange={(v) => set("expectedTicket", v)} />
            </div>
            {ticketWarning && <p className="text-xs text-yellow-400">Min ticket is greater than max ticket</p>}
          </div>
        </section>

        {/* Pipeline Status */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Pipeline Status</h3>
          <div className="space-y-3">
            <SelectInput label="Current Stage" value={form.stage} onChange={(v) => set("stage", v)}
              options={COLUMNS.map((c) => ({ value: c.key, label: c.label }))} />
            {showClosed && (
              <SelectInput label="Outcome" value={form.outcome ?? ""} onChange={(v) => set("outcome", v || null)}
                options={OUTCOMES} placeholder="Select outcome" />
            )}
            <div className="grid grid-cols-2 gap-3">
              <DateInput label="Last Activity Date" value={form.lastActivityDate} onChange={(v) => set("lastActivityDate", v)} />
              <DateInput label="Next Follow-Up Date" value={form.nextFollowUpDate} onChange={(v) => set("nextFollowUpDate", v)} />
            </div>
          </div>
        </section>

        {/* Interactions */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Interaction Log</h3>
          {newInteraction && (
            <div className="bg-[#0f172a] border border-[#0ea5e9] rounded-lg p-3 mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <DateInput label="Date" value={newInteraction.date} onChange={(v) => setNewInteraction((p) => ({ ...p, date: v }))} />
                <SelectInput label="Type" value={newInteraction.type} onChange={(v) => setNewInteraction((p) => ({ ...p, type: v }))} options={INTERACTION_TYPES} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Summary</label>
                <textarea value={newInteraction.summary} onChange={(e) => setNewInteraction((p) => ({ ...p, summary: e.target.value.slice(0, 500) }))}
                  rows={2} maxLength={500}
                  className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-[#0ea5e9]" />
                <p className="text-xs text-slate-500 text-right">{newInteraction.summary.length}/500</p>
              </div>
              <div className="flex gap-2">
                <button onClick={saveInteraction} className="text-xs bg-[#0ea5e9] text-white px-3 py-1 rounded-lg">Save Entry</button>
                <button onClick={() => setNewInteraction(null)} className="text-xs border border-[#334155] text-slate-400 px-3 py-1 rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          <button onClick={addInteraction}
            className="text-xs text-[#0ea5e9] hover:text-[#38bdf8] mb-3 flex items-center gap-1">
            + Log Interaction
          </button>
          {form.interactions.length === 0 && !newInteraction ? (
            <p className="text-xs text-slate-500 italic">No interactions logged yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {form.interactions.map((entry) => (
                <div key={entry.id} className="bg-[#0f172a] border border-[#334155] rounded-lg p-2.5 flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-[#0ea5e9]">{entry.type}</span>
                      <span className="text-xs text-slate-500">{fmt(entry.date, "date")}</span>
                    </div>
                    <p className="text-xs text-slate-300 truncate">{entry.summary || <span className="text-slate-500 italic">No summary</span>}</p>
                  </div>
                  <button onClick={() => set("interactions", form.interactions.filter((e) => e.id !== entry.id))}
                    className="text-slate-500 hover:text-red-400 text-sm leading-none flex-shrink-0">×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Notes</h3>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value.slice(0, 1000))}
            rows={3} maxLength={1000} placeholder="General notes about this investor…"
            className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-[#0ea5e9]" />
          <p className="text-xs text-slate-500 text-right">{form.notes.length}/1000</p>
        </section>

        {/* Tags */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Tags</h3>
          <div className="flex gap-2 mb-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Type tag and press Enter"
              className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#0ea5e9]" />
          </div>
          <div className="flex flex-wrap gap-1">
            {form.tags.map((t, i) => (
              <TagPill key={i} text={t} color="bg-[#0ea5e9]/20 text-[#38bdf8]"
                onRemove={() => set("tags", form.tags.filter((_, j) => j !== i))} />
            ))}
          </div>
        </section>
      </div>
      <div className="flex gap-2 px-5 py-4 border-t border-[#334155]">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {saving ? "Saving…" : "Save Investor"}
        </button>
        <button onClick={onClose}
          className="flex-1 border border-[#334155] text-slate-300 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </Modal>
  );
}

// ─── Investor Card ────────────────────────────────────────────────────────────
function InvestorCard({ investor, column, currency, onEdit, onDelete, dimmed }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timerRef = useRef(null);

  const da = daysAgo(investor.lastActivityDate);
  const dis = daysInStage(investor.stageEnteredDate);
  const isWon = investor.stage === "closed" && investor.outcome === "Won";
  const isPassed = investor.stage === "closed" && investor.outcome === "Passed";
  const isStale = ACTIVE_STAGES.includes(investor.stage) && (da !== null && da > 14);
  const isFollowUpLate = investor.nextFollowUpDate && (() => {
    const d = new Date(investor.nextFollowUpDate);
    return !isNaN(d.getTime()) && d < new Date();
  })();
  const showWarning = isStale || isFollowUpLate;

  const ticketStr = (() => {
    const { minTicket, maxTicket, expectedTicket } = investor;
    if (expectedTicket !== null && expectedTicket !== undefined) return fmt(expectedTicket, "currency", currency);
    if (minTicket !== null && maxTicket !== null) return `${fmt(minTicket, "currency", currency)} – ${fmt(maxTicket, "currency", currency)}`;
    if (minTicket !== null) return `${fmt(minTicket, "currency", currency)}+`;
    if (maxTicket !== null) return `up to ${fmt(maxTicket, "currency", currency)}`;
    return "—";
  })();

  const borderColor = isWon ? "#22c55e" : isPassed ? "#ef4444" : column.accent;

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(investor.id);
    } else {
      setConfirmDelete(true);
      timerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className={`relative bg-[#1e293b] rounded-lg border border-[#334155] hover:border-[#475569] transition-all group
      ${isPassed ? "opacity-60" : ""} ${dimmed ? "opacity-35" : ""}`}
      style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isWon && <span className="text-yellow-400 text-xs flex-shrink-0">🏆</span>}
            {isPassed && <span className="text-red-400 text-xs flex-shrink-0">✕</span>}
            {showWarning && (
              <Tooltip text={isFollowUpLate ? "Follow-up overdue" : "No activity in 14+ days — consider following up"}>
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 inline-block" />
              </Tooltip>
            )}
            <span className="font-semibold text-sm text-white truncate">
              {investor.name || "Unnamed Investor"}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {!confirmDelete ? (
              <>
                <button onClick={() => onEdit(investor)} className="text-slate-400 hover:text-white p-0.5 text-xs">✏️</button>
                <button onClick={handleDelete} className="text-slate-400 hover:text-red-400 p-0.5 text-xs">×</button>
              </>
            ) : (
              <span className="flex items-center gap-1 text-xs">
                <span className="text-slate-300">Delete?</span>
                <button onClick={() => { onDelete(investor.id); clearTimeout(timerRef.current); }}
                  className="text-red-400 hover:text-red-300 font-medium">Yes</button>
                <button onClick={() => { setConfirmDelete(false); clearTimeout(timerRef.current); }}
                  className="text-slate-400 hover:text-white">No</button>
              </span>
            )}
          </div>
        </div>

        {investor.firmName && investor.firmName !== investor.name && (
          <p className="text-xs text-slate-400 truncate mb-1">{investor.firmName}</p>
        )}

        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[investor.type] || TYPE_COLORS.Other}`}>
            {investor.type || "Other"}
          </span>
          {investor.tags.slice(0, 2).map((t, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">{t}</span>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-200">{ticketStr}</span>
          <span>{dis !== null ? `${dis}d in stage` : "—"}</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {da !== null ? `Last contact: ${da}d ago` : "No activity logged"}
        </div>
      </div>
    </div>
  );
}

// ─── Round Tracker ────────────────────────────────────────────────────────────
function RoundTracker({ investors, settings }) {
  const { currency, targetAmount, closeDate, dealName, roundType } = settings;

  const stats = useMemo(() => {
    const soft = investors.filter((i) => SOFT_STAGES.includes(i.stage));
    const hard = investors.filter((i) => i.stage === "closed" && i.outcome === "Won");
    const hasTickets = (arr) => arr.some((i) => i.expectedTicket !== null && i.expectedTicket !== undefined);

    const sumTickets = (arr) => arr.reduce((s, i) => s + (i.expectedTicket ?? 0), 0);

    return {
      softCircled: hasTickets(soft) ? sumTickets(soft) : null,
      hardCommitted: sumTickets(hard),
      active: investors.filter((i) => ["researched", "outreached", "meeting", "diligence"].includes(i.stage)).length,
      meetings: investors.filter((i) => i.stage === "meeting").length,
      byStageCounts: COLUMNS.map((c) => ({ label: c.label.split("/")[0].trim(), count: investors.filter((i) => i.stage === c.key).length, key: c.key })),
    };
  }, [investors]);

  const target = targetAmount && targetAmount > 0 ? targetAmount : null;
  const softVal = stats.softCircled ?? 0;
  const hardVal = stats.hardCommitted;
  const totalVal = softVal + hardVal;
  const progress = target ? Math.min(totalVal / target, 1) : 0;
  const hardPct = target ? Math.min(hardVal / target, 1) : 0;
  const targetReached = target && totalVal >= target;

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white">Round Tracker</h2>
          <p className="text-xs text-slate-400 truncate">{dealName} · {roundType} · Target: {target ? fmt(target, "currency", currency) : "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <StatCard label="Target Raise" value={target ? fmt(target, "currency", currency) : "—"} />
        <StatCard
          label="Soft Circled"
          value={stats.softCircled !== null ? fmt(stats.softCircled, "currency", currency) : "—"}
          tooltip={stats.softCircled === null ? "Add expected ticket sizes to investor cards to track soft circles" : null}
        />
        <StatCard label="Hard Committed" value={fmt(stats.hardCommitted, "currency", currency)} />
        <StatCard label="Active Convos" value={fmt(stats.active, "number")} />
        <StatCard label="Meetings Booked" value={fmt(stats.meetings, "number")} />
        <StatCard label="Est. Close Date" value={closeDate ? fmt(closeDate, "date") : "—"} />
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Round Progress</span>
            {targetReached && (
              <span className="text-xs font-medium text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">Target Reached 🎯</span>
            )}
          </div>
          {target ? (
            <div className="relative h-2.5 rounded-full bg-[#0f172a] overflow-hidden border border-[#334155]">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress * 100}%`, background: "linear-gradient(90deg, #0ea5e9, #38bdf8)" }}>
                <div className="absolute inset-y-0 left-0 rounded-full bg-[#0ea5e9]/40" style={{ width: `${hardPct / Math.max(progress, 0.001) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="h-2.5 rounded-full bg-[#334155] flex items-center justify-center">
              <span className="text-xs text-slate-500 leading-none" style={{ fontSize: "0.6rem" }}>Set a target raise amount in Settings to track progress</span>
            </div>
          )}
          {target && (
            <p className="text-xs text-slate-500 mt-1">
              {fmt(hardVal, "currency", currency)} committed · {fmt(softVal, "currency", currency)} soft circled · {fmt(Math.max(target - totalVal, 0), "currency", currency)} remaining
            </p>
          )}
        </div>

        {/* Mini funnel */}
        <div className="flex-shrink-0 hidden lg:flex items-end gap-0.5" title="Pipeline funnel">
          {stats.byStageCounts.map((s, i) => {
            const maxH = 32;
            const maxCount = Math.max(...stats.byStageCounts.map((x) => x.count), 1);
            const h = Math.max((s.count / maxCount) * maxH, 4);
            return (
              <Tooltip key={s.key} text={`${s.label}: ${s.count}`}>
                <div className="flex flex-col items-center gap-0.5 cursor-default">
                  <span className="text-[9px] text-slate-500">{s.count}</span>
                  <div className="w-7 rounded-sm" style={{ height: h, background: COLUMNS[i].accent + "99" }} />
                  <span className="text-[8px] text-slate-600 w-7 text-center leading-tight truncate">{s.label.slice(0, 4)}</span>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FundraisingCRM() {
  const [investors, setInvestors] = useState(MOCK_INVESTORS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const [addModal, setAddModal] = useState(null); // null | { investor?, defaultStage? }
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStage, setFilterStage] = useState("All");
  const [sortBy, setSortBy] = useState("Date Added");

  const filtersActive = search || filterType !== "All" || filterStage !== "All";

  const filteredIds = useMemo(() => {
    const q = search.toLowerCase();
    return new Set(
      investors
        .filter((i) => {
          const matchSearch = !q || i.name.toLowerCase().includes(q) || (i.firmName || "").toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q));
          const matchType = filterType === "All" || i.type === filterType;
          const matchStage = filterStage === "All" || i.stageFocus.includes(filterStage);
          return matchSearch && matchType && matchStage;
        })
        .map((i) => i.id)
    );
  }, [investors, search, filterType, filterStage]);

  const sortedInvestors = useMemo(() => {
    const copy = [...investors];
    if (sortBy === "Last Activity") copy.sort((a, b) => (b.lastActivityDate || "").localeCompare(a.lastActivityDate || ""));
    else if (sortBy === "Ticket Size") copy.sort((a, b) => (b.expectedTicket ?? -1) - (a.expectedTicket ?? -1));
    else if (sortBy === "Name Alphabetical") copy.sort((a, b) => a.name.localeCompare(b.name));
    else copy.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    return copy;
  }, [investors, sortBy]);

  const handleSaveInvestor = useCallback((inv) => {
    setInvestors((prev) => {
      const idx = prev.findIndex((i) => i.id === inv.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = inv; return next; }
      return [...prev, inv];
    });
    setAddModal(null);
  }, []);

  const handleDelete = useCallback((id) => {
    setInvestors((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const colInvestors = (key) => sortedInvestors.filter((i) => i.stage === key);

  const colTicketSum = (key) => {
    const arr = investors.filter((i) => i.stage === key);
    if (arr.length === 0 || arr.every((i) => i.expectedTicket === null || i.expectedTicket === undefined)) return null;
    return arr.reduce((s, i) => s + (i.expectedTicket ?? 0), 0);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#1e293b] border-b border-[#334155] px-4 py-3 flex-shrink-0">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Fundraising Command Center</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {settings.dealName} · {settings.roundType} · Target: {settings.targetAmount && settings.targetAmount > 0 ? fmt(settings.targetAmount, "currency", settings.currency) : "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAddModal({})}
              className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              + Add Investor
            </button>
            <button onClick={() => setShowDigest(true)}
              className="border border-[#334155] text-slate-300 hover:text-white hover:border-slate-400 text-sm px-3 py-1.5 rounded-lg transition-colors">
              Weekly Digest
            </button>
            <button onClick={() => setShowSettings(true)}
              className="border border-[#334155] text-slate-300 hover:text-white text-sm px-2.5 py-1.5 rounded-lg transition-colors">
              ⚙
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden max-w-[1800px] mx-auto w-full px-4 py-4">
        {/* Round Tracker */}
        <RoundTracker investors={investors} settings={settings} />

        {/* Search / Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search investors, firms, tags…"
            className="flex-1 min-w-[180px] bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#0ea5e9]" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#0ea5e9]">
            <option value="All">All Types</option>
            {INVESTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}
            className="bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#0ea5e9]">
            <option value="All">All Stage Focus</option>
            {STAGE_FOCUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#0ea5e9]">
            {["Date Added", "Last Activity", "Ticket Size", "Name Alphabetical"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {filtersActive && (
            <button onClick={() => { setSearch(""); setFilterType("All"); setFilterStage("All"); }}
              className="text-xs text-slate-400 hover:text-white border border-[#334155] px-2.5 py-1.5 rounded-lg transition-colors">
              Clear Filters ×
            </button>
          )}
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 h-full" style={{ minWidth: `${COLUMNS.length * 292}px` }}>
            {COLUMNS.map((col) => {
              const colCards = colInvestors(col.key);
              const ticketSum = colTicketSum(col.key);
              const matchCount = colCards.filter((i) => filteredIds.has(i.id)).length;

              return (
                <div key={col.key} className="flex flex-col" style={{ minWidth: 280, width: 280 }}>
                  {/* Column header */}
                  <div className="bg-[#1e293b] border border-[#334155] rounded-t-lg px-3 py-2.5 flex-shrink-0"
                    style={{ borderLeftColor: col.accent, borderLeftWidth: 3 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-white truncate">{col.label}</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-[#0f172a] text-slate-300">{colCards.length}</span>
                      </div>
                      <button onClick={() => setAddModal({ defaultStage: col.key })}
                        className="text-slate-400 hover:text-[#0ea5e9] text-lg leading-none flex-shrink-0 ml-1">+</button>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {ticketSum !== null ? fmt(ticketSum, "currency", settings.currency) : "—"}
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto bg-[#0f172a]/50 border-x border-b border-[#334155] rounded-b-lg p-2 space-y-2"
                    style={{ maxHeight: "calc(100vh - 360px)", minHeight: 200 }}>
                    {colCards.length === 0 ? (
                      <div className="flex items-center justify-center h-24 border-2 border-dashed border-[#334155] rounded-lg">
                        <p className="text-xs text-slate-600 text-center px-2">No investors yet — add one above</p>
                      </div>
                    ) : (
                      <>
                        {colCards.map((inv) => (
                          <InvestorCard
                            key={inv.id}
                            investor={inv}
                            column={col}
                            currency={settings.currency}
                            onEdit={(i) => setAddModal({ investor: i })}
                            onDelete={handleDelete}
                            dimmed={filtersActive && !filteredIds.has(inv.id)}
                          />
                        ))}
                        {filtersActive && matchCount === 0 && (
                          <p className="text-xs text-slate-600 text-center py-2 italic">No investors match current filters.</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(s) => { setSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showDigest && (
        <WeeklyDigestModal investors={investors} settings={settings} onClose={() => setShowDigest(false)} />
      )}
      {addModal !== null && (
        <InvestorModal
          investor={addModal.investor ?? null}
          defaultStage={addModal.defaultStage ?? "identified"}
          currency={settings.currency}
          onSave={handleSaveInvestor}
          onClose={() => setAddModal(null)}
        />
      )}
    </div>
  );
}

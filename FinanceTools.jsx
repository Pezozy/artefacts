import React, { useState, useCallback, useMemo } from "react";
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
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  ReferenceLine,
} from "recharts";

// ─── Safe Math Utilities ───────────────────────────────────────────────────────

/** Returns null if v is empty/null/undefined/NaN, otherwise the numeric value */
const parseVal = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : Number(v);
  return isNaN(n) ? null : n;
};

/** True only if v is a finite, non-NaN number */
const isFiniteNum = (v) =>
  v !== null && v !== undefined && typeof v === "number" && isFinite(v) && !isNaN(v);

/** Safe division — returns null when denominator is 0, null, or b is invalid */
const div = (a, b) => {
  if (!isFiniteNum(a) || !isFiniteNum(b) || b === 0) return null;
  return a / b;
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ─── Currency Formatting ───────────────────────────────────────────────────────

const CURRENCY_META = {
  USD: { symbol: "$", locale: "en-US", code: "USD" },
  EUR: { symbol: "€", locale: "de-DE", code: "EUR" },
  GBP: { symbol: "£", locale: "en-GB", code: "GBP" },
  OTHER: { symbol: "", locale: "en-US", code: "USD" },
};

const fmtCurrency = (val, currency = "USD", decimals = 0) => {
  if (!isFiniteNum(val)) return "—";
  try {
    const { symbol } = CURRENCY_META[currency] || CURRENCY_META.USD;
    const abs = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    if (decimals === 2) {
      return `${sign}${symbol}${abs.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `${sign}${symbol}${Math.round(abs).toLocaleString("en-US")}`;
  } catch {
    return "—";
  }
};

const fmtPct = (val, decimals = 2) => {
  if (!isFiniteNum(val)) return "—";
  const sign = val < 0 ? "" : ""; // sign is built in by toFixed
  return `${val.toFixed(decimals)}%`;
};

const fmtNum = (val) => {
  if (!isFiniteNum(val)) return "—";
  return Math.round(val).toLocaleString("en-US");
};

const fmtNumExact = (val, decimals = 2) => {
  if (!isFiniteNum(val)) return "—";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Universal safe formatter — define once, use everywhere.
 * Never renders raw computed values directly into JSX.
 */
const fmt = (val, type, currency = "USD") => {
  if (val === null || val === undefined || (typeof val === "number" && !isFinite(val))) return "—";
  if (type === "currency") {
    const sym = CURRENCY_META[currency]?.symbol || "$";
    const abs = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    return `${sign}${sym}${Math.round(abs).toLocaleString("en-US")}`;
  }
  if (type === "percent") return `${Number(val).toFixed(2)}%`;
  if (type === "multiple") return `${Number(val).toFixed(2)}x`;
  if (type === "number") return Number(val).toLocaleString("en-US");
  return String(val);
};

// ─── Error Boundary ───────────────────────────────────────────────────────────

class CalcErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-8 text-center">
          <p className="text-red-400 font-semibold text-lg mb-1">Calculator Error</p>
          <p className="text-slate-400 text-sm">
            An unexpected error occurred in this calculator. Other calculators are unaffected.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  prefix,
  hint,
  warning,
  disabled,
  step,
  tooltip,
}) {
  const currSymbol = prefix || "";
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-400 mb-1">
        {label}
        {tooltip && <FieldTooltip text={tooltip} />}
      </label>
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
          step={step}
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
      {hint && <p className="text-xs text-slate-500 mt-1 italic">{hint}</p>}
      {warning && <p className="text-xs text-yellow-400 mt-1">{warning}</p>}
    </div>
  );
}

function ResultRow({ label, value, note, tealBadge, redValue, highlight }) {
  const isDash = value === "—";
  const isNeg = !isDash && typeof value === "string" && value.startsWith("-");
  const valueColor = isDash
    ? "text-slate-600"
    : redValue || isNeg
    ? "text-red-400"
    : "text-white";

  return (
    <div
      className={[
        "flex items-start justify-between py-2.5 border-b border-slate-700/40 last:border-0",
        highlight ? "bg-cyan-950/20 -mx-4 px-4 rounded-lg" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex-1 pr-4 min-w-0">
        <span className="text-sm text-slate-300 leading-snug">{label}</span>
        {note && (
          <p className="text-xs text-slate-600 italic mt-0.5 leading-tight">{note}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {tealBadge && (
          <span className="text-xs bg-cyan-900/50 text-cyan-300 border border-cyan-600/30 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
            {tealBadge}
          </span>
        )}
        <span className={`text-sm font-semibold tabular-nums ${valueColor}`}>{value}</span>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function InfoBanner({ children, variant = "yellow" }) {
  const styles = {
    yellow: "bg-yellow-950/30 border-yellow-600/30 text-yellow-300",
    blue: "bg-cyan-950/30 border-cyan-600/30 text-cyan-300",
    slate: "bg-slate-800/50 border-slate-600/30 text-slate-400",
    red: "bg-red-950/30 border-red-600/30 text-red-300",
    green: "bg-green-950/30 border-green-600/30 text-green-300",
  };
  return (
    <div className={`border rounded-lg px-4 py-3 mb-4 text-xs leading-relaxed ${styles[variant] || styles.slate}`}>
      {children}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function FieldTooltip({ text }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={(e) => { e.preventDefault(); setVisible((v) => !v); }}
        className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-400 text-[9px] font-bold inline-flex items-center justify-center hover:bg-slate-600 hover:text-white transition-colors cursor-help shrink-0 leading-none"
        aria-label="Field information"
      >
        ?
      </button>
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-2 text-xs text-slate-300 leading-relaxed shadow-2xl pointer-events-none whitespace-normal">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-600/50" />
        </div>
      )}
    </span>
  );
}

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

// ─── Clipboard Helper ─────────────────────────────────────────────────────────

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

// ─── CALCULATOR 1 — SAFE / Convertible Note ───────────────────────────────────

const SAFE_NOTE_DEFAULTS = {
  investmentAmount: "",
  instrumentType: "SAFE",
  valuationCap: "",
  discountRate: "",
  interestRate: "",
  termMonths: "",
  preMoney: "",
  pricePerShare: "",
  existingShares: "",
};

function SafeNoteCalculator({ currency }) {
  const [inputs, setInputs] = useState(SAFE_NOTE_DEFAULTS);
  const [copyFn, CopyModalNode] = useCopyToClipboard();

  const setField = useCallback(
    (field) => (val) => setInputs((prev) => ({ ...prev, [field]: val })),
    []
  );

  // ── Derived computations ──────────────────────────────────────────────────
  const results = useMemo(() => {
    try {
      const inv = parseVal(inputs.investmentAmount);
      const cap = parseVal(inputs.valuationCap);
      // Discount: empty means 0 (no discount); treat "" as 0
      const discRaw = inputs.discountRate === "" ? 0 : parseVal(inputs.discountRate);
      const disc = isFiniteNum(discRaw) ? clamp(discRaw, 0, 100) : null;
      const discCapped = isFiniteNum(discRaw) && discRaw > 100;
      const intRate = parseVal(inputs.interestRate);
      const term = parseVal(inputs.termMonths);
      const preMoney = parseVal(inputs.preMoney);
      const ppsRaw = parseVal(inputs.pricePerShare);
      const shares = parseVal(inputs.existingShares);
      const sharesCapped =
        parseVal(inputs.existingShares) !== null &&
        parseVal(inputs.existingShares) > 100 &&
        false; // shares can exceed 100 — not a percentage

      const isNote = inputs.instrumentType === "convertible_note";

      // ── Accrued interest & total conversion ──
      let accruedInterest = null;
      let totalConversion = inv; // may be null if inv is null
      if (isNote && isFiniteNum(inv) && isFiniteNum(intRate) && isFiniteNum(term)) {
        accruedInterest = inv * (intRate / 100) * (term / 12);
        totalConversion = inv + accruedInterest;
      }

      // ── Effective PPS (given or derived) ──
      let derivedPPS = null;
      let effectivePPS = ppsRaw;
      if (!isFiniteNum(effectivePPS) && isFiniteNum(preMoney) && isFiniteNum(shares) && shares > 0) {
        derivedPPS = preMoney / shares;
        effectivePPS = derivedPPS;
      }

      // ── Cap conversion price ──
      let capPrice = null;
      const capNeedsShares = isFiniteNum(cap) && !isFiniteNum(shares);
      if (isFiniteNum(cap) && isFiniteNum(shares) && shares > 0) {
        capPrice = cap / shares;
      }

      // ── Discounted price ──
      let discPrice = null;
      if (isFiniteNum(effectivePPS) && isFiniteNum(disc)) {
        discPrice = effectivePPS * (1 - disc / 100);
      }

      // ── Conversion price & governing method ──
      let conversionPrice = null;
      let method = null;
      let capGoverns = false;
      let discGoverns = false;

      if (isFiniteNum(capPrice) && isFiniteNum(discPrice)) {
        if (capPrice <= discPrice) {
          conversionPrice = capPrice;
          method = "Cap";
          capGoverns = true;
        } else {
          conversionPrice = discPrice;
          method = disc > 0 ? "Discount" : "Round Price";
          discGoverns = disc > 0;
        }
      } else if (isFiniteNum(capPrice)) {
        conversionPrice = capPrice;
        method = "Cap";
      } else if (isFiniteNum(discPrice)) {
        conversionPrice = discPrice;
        method = disc > 0 ? "Discount" : "Round Price";
      }

      const bothMethodsPresent = isFiniteNum(capPrice) && isFiniteNum(discPrice);

      // No cap or discount applied (convert at round price)
      const noCapOrDiscount =
        !isFiniteNum(cap) &&
        (!isFiniteNum(disc) || disc === 0);

      // ── Shares issued ──
      let sharesIssued = null;
      if (isFiniteNum(totalConversion) && isFiniteNum(conversionPrice) && conversionPrice > 0) {
        sharesIssued = totalConversion / conversionPrice;
      }

      // ── Post-conversion ownership ──
      let postOwnership = null;
      if (isFiniteNum(sharesIssued) && isFiniteNum(shares)) {
        postOwnership = (sharesIssued / (shares + sharesIssued)) * 100;
      }

      // ── Effective discount to round price ──
      let effectiveDiscount = null;
      if (isFiniteNum(effectivePPS) && isFiniteNum(conversionPrice) && effectivePPS > 0) {
        effectiveDiscount = ((effectivePPS - conversionPrice) / effectivePPS) * 100;
      }

      // ── Cap table chart data ──
      let chartData = null;
      if (isFiniteNum(shares) && isFiniteNum(sharesIssued)) {
        chartData = [
          { name: "Existing", value: shares, color: "#334155" },
          { name: "Investor", value: sharesIssued, color: "#0ea5e9" },
        ];
      }

      return {
        inv,
        accruedInterest,
        totalConversion,
        capPrice,
        discPrice,
        effectivePPS,
        derivedPPS,
        conversionPrice,
        method,
        capGoverns,
        discGoverns,
        bothMethodsPresent,
        noCapOrDiscount,
        sharesIssued,
        postOwnership,
        effectiveDiscount,
        isNote,
        disc,
        discCapped,
        capNeedsShares,
        chartData,
      };
    } catch {
      return {};
    }
  }, [inputs]);

  // ── Copy results text ──────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const r = results;
    const sym = CURRENCY_META[currency]?.symbol || "$";
    const lines = [
      "SAFE / Convertible Note Calculator",
      "====================================",
      `Instrument Type:              ${inputs.instrumentType === "SAFE" ? "SAFE" : "Convertible Note"}`,
      `Investment Amount:            ${fmtCurrency(r.inv, currency)}`,
      r.isNote && isFiniteNum(r.accruedInterest)
        ? `Accrued Interest:             ${fmtCurrency(r.accruedInterest, currency)}`
        : null,
      `Total Conversion Amount:      ${fmtCurrency(r.totalConversion, currency)}`,
      `Conversion Price Per Share:   ${fmtCurrency(r.conversionPrice, currency, 2)}`,
      `Method:                       ${r.method || "—"}`,
      `Shares Issued to Investor:    ${fmtNum(r.sharesIssued)}`,
      `Post-Conversion Ownership:    ${fmtPct(r.postOwnership)}`,
      `Effective Discount:           ${fmtPct(r.effectiveDiscount)}`,
    ]
      .filter(Boolean)
      .join("\n");
    copyFn(lines);
  }, [results, inputs, currency, copyFn]);

  const handleReset = useCallback(() => setInputs(SAFE_NOTE_DEFAULTS), []);

  const r = results;
  const badgeForConversionRow = r.bothMethodsPresent
    ? r.capGoverns
      ? "Cap Governs"
      : "Discount Governs"
    : null;

  const currencySymbol = CURRENCY_META[currency]?.symbol || "$";

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="SAFE / Convertible Note Calculator"
        description="Model how a SAFE or convertible note converts into equity at your next priced round. See exactly how much you're giving up before you sign."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Inputs Panel ── */}
          <div>
            <SectionHeader>Inputs</SectionHeader>

            {/* Instrument Type Toggle */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Instrument Type
              </label>
              <div className="flex bg-slate-800/60 rounded-xl p-1 gap-1 border border-slate-700/40">
                {[
                  { value: "SAFE", label: "SAFE" },
                  { value: "convertible_note", label: "Convertible Note" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setField("instrumentType")(value)}
                    className={[
                      "flex-1 text-sm py-2 rounded-lg font-medium transition-all",
                      inputs.instrumentType === value
                        ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/30"
                        : "text-slate-400 hover:text-slate-200",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <InputField
              label="Investment Amount"
              value={inputs.investmentAmount}
              onChange={setField("investmentAmount")}
              placeholder="e.g. 250000"
              prefix={currencySymbol}
            />

            <InputField
              label="Valuation Cap"
              value={inputs.valuationCap}
              onChange={setField("valuationCap")}
              placeholder="e.g. 10000000"
              prefix={currencySymbol}
            />

            <InputField
              label="Discount Rate"
              value={inputs.discountRate}
              onChange={setField("discountRate")}
              placeholder="e.g. 20"
              suffix="%"
              hint={inputs.discountRate === "" ? "Default: 0% (no discount)" : undefined}
              warning={r.discCapped ? "Value capped at 100%" : undefined}
            />

            {inputs.instrumentType === "convertible_note" && (
              <>
                <InputField
                  label="Interest Rate (Annual)"
                  value={inputs.interestRate}
                  onChange={setField("interestRate")}
                  placeholder="e.g. 8"
                  suffix="%"
                />
                <InputField
                  label="Term"
                  value={inputs.termMonths}
                  onChange={setField("termMonths")}
                  placeholder="e.g. 18"
                  suffix="months"
                />
              </>
            )}

            <InputField
              label="Pre-Money Valuation at Conversion"
              value={inputs.preMoney}
              onChange={setField("preMoney")}
              placeholder="e.g. 12000000"
              prefix={currencySymbol}
            />

            <InputField
              label="Price Per Share at Conversion"
              value={inputs.pricePerShare}
              onChange={setField("pricePerShare")}
              placeholder="e.g. 1.50"
              prefix={currencySymbol}
              step="0.01"
              hint={
                r.derivedPPS
                  ? `Derived from Pre-Money ÷ Shares: ${fmtCurrency(r.derivedPPS, currency, 2)}`
                  : undefined
              }
            />

            <InputField
              label="Existing Shares Outstanding"
              value={inputs.existingShares}
              onChange={setField("existingShares")}
              placeholder="e.g. 8000000"
            />
          </div>

          {/* ── Results Panel ── */}
          <div>
            <SectionHeader>Results</SectionHeader>

            {/* Banners */}
            {r.noCapOrDiscount && (
              <InfoBanner variant="yellow">
                No cap or discount applied — investor converts at the full round price.
              </InfoBanner>
            )}
            {r.capNeedsShares && (
              <InfoBanner variant="slate">
                Enter Existing Shares Outstanding to calculate the cap conversion price.
              </InfoBanner>
            )}

            {/* Result rows */}
            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30">
              {r.isNote && (
                <ResultRow
                  label="Accrued Interest"
                  value={fmtCurrency(r.accruedInterest, currency)}
                  note={
                    !isFiniteNum(r.accruedInterest)
                      ? "Enter Interest Rate and Term to calculate."
                      : undefined
                  }
                />
              )}

              <ResultRow
                label="Total Conversion Amount"
                value={fmtCurrency(r.totalConversion, currency)}
                note={
                  !isFiniteNum(r.totalConversion)
                    ? "Enter Investment Amount to calculate."
                    : undefined
                }
              />

              <ResultRow
                label="Conversion Price Per Share"
                value={fmtCurrency(r.conversionPrice, currency, 2)}
                note={
                  !isFiniteNum(r.conversionPrice)
                    ? "Enter Valuation Cap and/or Price Per Share to calculate."
                    : undefined
                }
                tealBadge={badgeForConversionRow}
                highlight={!!badgeForConversionRow}
              />

              <ResultRow
                label="Method Used"
                value={r.method ?? "—"}
                note={
                  !r.method
                    ? "Determined by Cap and Discount inputs."
                    : undefined
                }
              />

              <ResultRow
                label="Shares Issued to Investor"
                value={fmtNum(r.sharesIssued)}
                note={
                  !isFiniteNum(r.sharesIssued)
                    ? "Enter Investment Amount and Conversion Price to calculate."
                    : undefined
                }
              />

              <ResultRow
                label="Investor Post-Conversion Ownership"
                value={fmtPct(r.postOwnership)}
                note={
                  !isFiniteNum(r.postOwnership)
                    ? "Enter Existing Shares Outstanding to calculate."
                    : undefined
                }
              />

              <ResultRow
                label="Effective Discount to Round Price"
                value={fmtPct(r.effectiveDiscount)}
                note={
                  !isFiniteNum(r.effectiveDiscount)
                    ? "Enter Price Per Share at Conversion to calculate."
                    : undefined
                }
                redValue={isFiniteNum(r.effectiveDiscount) && r.effectiveDiscount < 0}
              />
            </div>

            {/* ── Price comparison bar ── */}
            {isFiniteNum(r.conversionPrice) && isFiniteNum(r.effectivePPS) && (
              <div className="mt-4 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Price Comparison
                </p>
                <div className="space-y-2.5">
                  {[
                    {
                      label: "Round Price",
                      val: r.effectivePPS,
                      color: "bg-slate-500",
                      textColor: "text-slate-300",
                    },
                    isFiniteNum(r.capPrice) && {
                      label: "Cap Price",
                      val: r.capPrice,
                      color: "bg-violet-500",
                      textColor: "text-violet-300",
                    },
                    isFiniteNum(r.discPrice) &&
                      r.disc > 0 && {
                        label: "Discounted Price",
                        val: r.discPrice,
                        color: "bg-orange-500",
                        textColor: "text-orange-300",
                      },
                    {
                      label: "Conversion Price",
                      val: r.conversionPrice,
                      color: "bg-cyan-500",
                      textColor: "text-cyan-300",
                    },
                  ]
                    .filter(Boolean)
                    .map((row) => {
                      const pct = Math.max(
                        4,
                        Math.min(100, (row.val / r.effectivePPS) * 100)
                      );
                      return (
                        <div key={row.label} className="flex items-center gap-3">
                          <span className={`text-xs w-32 shrink-0 ${row.textColor}`}>
                            {row.label}
                          </span>
                          <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.color} transition-all duration-300`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-mono w-20 text-right ${row.textColor}`}>
                            {fmtCurrency(row.val, currency, 2)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── Cap table chart ── */}
            {r.chartData && (
              <div className="mt-4 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  Post-Conversion Cap Table
                </p>
                <p className="text-xs text-slate-600 mb-3">Share distribution after conversion</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={r.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(1)}%`
                        }
                        labelLine={{ stroke: "#475569", strokeWidth: 1 }}
                      >
                        {r.chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => [fmtNum(val) + " shares", ""]}
                        contentStyle={{
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#cbd5e1",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-1">
                  {r.chartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: d.color }}
                      />
                      <span className="text-xs text-slate-400">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CalcCard>
    </>
  );
}

// ─── Shared Chart Colors ──────────────────────────────────────────────────────

const CHART_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16",
  "#f59e0b", "#ef4444", "#64748b", "#f97316", "#10b981",
  "#e879f9", "#2dd4bf", "#fb923c", "#a3e635", "#38bdf8",
];

// ─── Calculator 2 — Post-Money Dilution Calculator ───────────────────────────

const DILUTION_DEFAULTS = {
  preMoney: "",
  investment: "",
  totalShares: "",
  optionPoolMode: "number",
  optionPoolValue: "",
  shareholders: [
    { id: 1, name: "Founder 1", shares: "" },
    { id: 2, name: "Founder 2", shares: "" },
    { id: 3, name: "Option Pool (existing)", shares: "" },
  ],
};

function DilutionCalculator({ currency }) {
  const [inputs, setInputs] = useState(DILUTION_DEFAULTS);
  const [copyFn, CopyModalNode] = useCopyToClipboard();

  const setField = useCallback(
    (field) => (val) => setInputs((prev) => ({ ...prev, [field]: val })),
    []
  );

  const addShareholder = useCallback(() => {
    setInputs((prev) => {
      if (prev.shareholders.length >= 20) return prev;
      return {
        ...prev,
        shareholders: [
          ...prev.shareholders,
          { id: Date.now(), name: "", shares: "" },
        ],
      };
    });
  }, []);

  const removeShareholder = useCallback((id) => {
    setInputs((prev) => ({
      ...prev,
      shareholders: prev.shareholders.filter((s) => s.id !== id),
    }));
  }, []);

  const updateShareholder = useCallback((id, field, val) => {
    setInputs((prev) => ({
      ...prev,
      shareholders: prev.shareholders.map((s) =>
        s.id === id ? { ...s, [field]: val } : s
      ),
    }));
  }, []);

  const results = useMemo(() => {
    try {
      const preMoney = parseVal(inputs.preMoney);
      const investment = parseVal(inputs.investment);
      const totalShares = parseVal(inputs.totalShares);
      const poolValRaw = parseVal(inputs.optionPoolValue);

      const postMoney =
        isFiniteNum(preMoney) && isFiniteNum(investment)
          ? preMoney + investment
          : null;

      const pps =
        isFiniteNum(preMoney) && isFiniteNum(totalShares) && totalShares > 0
          ? preMoney / totalShares
          : null;

      const newInvestorShares =
        isFiniteNum(investment) && isFiniteNum(pps) && pps > 0
          ? investment / pps
          : null;

      // Option pool: number mode = direct value;
      // percent mode = algebraically solved: shares = p% × (existing + investor) / (1 − p%)
      let newOptionShares = null;
      if (inputs.optionPoolMode === "number") {
        newOptionShares = isFiniteNum(poolValRaw) && poolValRaw > 0 ? poolValRaw : null;
      } else if (inputs.optionPoolMode === "percent" && isFiniteNum(poolValRaw)) {
        const poolPct = clamp(poolValRaw, 0, 100) / 100;
        if (isFiniteNum(totalShares) && poolPct > 0 && poolPct < 1) {
          const investorBase = isFiniteNum(newInvestorShares) ? newInvestorShares : 0;
          newOptionShares = (poolPct * (totalShares + investorBase)) / (1 - poolPct);
        }
      }

      let totalPostRound = isFiniteNum(totalShares) ? totalShares : null;
      if (isFiniteNum(totalPostRound)) {
        if (isFiniteNum(newInvestorShares)) totalPostRound += newInvestorShares;
        if (isFiniteNum(newOptionShares)) totalPostRound += newOptionShares;
      }

      const shTableSum = inputs.shareholders.reduce((sum, s) => {
        const v = parseVal(s.shares);
        return sum + (isFiniteNum(v) && v > 0 ? v : 0);
      }, 0);

      const sharesMatch =
        !isFiniteNum(totalShares) || Math.abs(shTableSum - totalShares) < 0.5;

      // Effective pre-round total for ownership % base
      const effectivePreTotal = isFiniteNum(totalShares)
        ? totalShares
        : shTableSum > 0
        ? shTableSum
        : null;

      const shareholders = inputs.shareholders.map((s) => {
        const shares = parseVal(s.shares);
        const hasShares = isFiniteNum(shares) && shares > 0;
        const preOwnership =
          hasShares && isFiniteNum(effectivePreTotal) && effectivePreTotal > 0
            ? (shares / effectivePreTotal) * 100
            : null;
        const postOwnership =
          hasShares && isFiniteNum(totalPostRound) && totalPostRound > 0
            ? (shares / totalPostRound) * 100
            : null;
        const dilution =
          isFiniteNum(preOwnership) && isFiniteNum(postOwnership)
            ? preOwnership - postOwnership
            : null;
        return { ...s, sharesNum: shares, hasShares, preOwnership, postOwnership, dilution };
      });

      const newInvestorOwnership =
        isFiniteNum(newInvestorShares) &&
        isFiniteNum(totalPostRound) &&
        totalPostRound > 0
          ? (newInvestorShares / totalPostRound) * 100
          : null;

      const newOptionOwnership =
        isFiniteNum(newOptionShares) &&
        isFiniteNum(totalPostRound) &&
        totalPostRound > 0
          ? (newOptionShares / totalPostRound) * 100
          : null;

      // Build chart entities list (existing shareholders + new pool + new investor)
      const activeShareholders = shareholders.filter((s) => s.hasShares);
      const allEntities = [
        ...activeShareholders,
        ...(isFiniteNum(newOptionShares)
          ? [
              {
                id: "__newpool__",
                name: "New Option Pool",
                sharesNum: newOptionShares,
                preOwnership: 0,
                postOwnership: newOptionOwnership,
                dilution: null,
                hasShares: true,
              },
            ]
          : []),
        ...(isFiniteNum(newInvestorShares)
          ? [
              {
                id: "__investor__",
                name: "New Investor",
                sharesNum: newInvestorShares,
                preOwnership: 0,
                postOwnership: newInvestorOwnership,
                dilution: null,
                hasShares: true,
              },
            ]
          : []),
      ];

      // Build stacked horizontal bar chart data
      const barChartData =
        allEntities.length > 0
          ? (() => {
              const beforeRow = { label: "Before Round" };
              const afterRow = { label: "After Round" };
              allEntities.forEach((e) => {
                beforeRow[e.name] = isFiniteNum(e.preOwnership)
                  ? parseFloat(e.preOwnership.toFixed(2))
                  : 0;
                afterRow[e.name] = isFiniteNum(e.postOwnership)
                  ? parseFloat(e.postOwnership.toFixed(2))
                  : 0;
              });
              return [beforeRow, afterRow];
            })()
          : null;

      return {
        preMoney,
        investment,
        totalShares,
        postMoney,
        pps,
        newInvestorShares,
        newOptionShares,
        totalPostRound,
        shareholders,
        newInvestorOwnership,
        newOptionOwnership,
        sharesMatch,
        shTableSum,
        barChartData,
        allEntities,
      };
    } catch {
      return {};
    }
  }, [inputs]);

  const handleReset = useCallback(() => setInputs(DILUTION_DEFAULTS), []);

  const handleCopy = useCallback(() => {
    const r = results;
    const text = [
      "Post-Money Dilution Calculator",
      "================================",
      `Pre-Money Valuation:     ${fmtCurrency(r.preMoney, currency)}`,
      `Investment Amount:       ${fmtCurrency(r.investment, currency)}`,
      `Post-Money Valuation:    ${fmtCurrency(r.postMoney, currency)}`,
      `Price Per Share:         ${fmtCurrency(r.pps, currency, 2)}`,
      `New Investor Shares:     ${fmtNum(r.newInvestorShares)}`,
      `New Option Pool Shares:  ${fmtNum(r.newOptionShares)}`,
      `Total Shares Post-Round: ${fmtNum(r.totalPostRound)}`,
      `New Investor Ownership:  ${fmtPct(r.newInvestorOwnership)}`,
      "",
      "Ownership Table:",
      ...(r.shareholders || [])
        .filter((s) => s.hasShares)
        .map(
          (s) =>
            `  ${s.name || "?"}: Before=${fmtPct(s.preOwnership, 1)} → After=${fmtPct(
              s.postOwnership,
              1
            )} (Dilution: ${
              isFiniteNum(s.dilution) && s.dilution > 0.005
                ? `-${fmtPct(s.dilution, 1)}`
                : "—"
            })`
        ),
    ].join("\n");
    copyFn(text);
  }, [results, currency, copyFn]);

  const r = results;
  const currSymbol = CURRENCY_META[currency]?.symbol || "$";

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="Post-Money Dilution Calculator"
        description="See exactly how a new funding round changes ownership percentages across all shareholders. Know your dilution before you negotiate."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Inputs ── */}
          <div>
            <SectionHeader>Round Parameters</SectionHeader>

            <InputField
              label="Pre-Money Valuation"
              value={inputs.preMoney}
              onChange={setField("preMoney")}
              placeholder="e.g. 8000000"
              prefix={currSymbol}
            />
            <InputField
              label="Investment Amount"
              value={inputs.investment}
              onChange={setField("investment")}
              placeholder="e.g. 2000000"
              prefix={currSymbol}
            />
            <InputField
              label="Current Total Shares Outstanding"
              value={inputs.totalShares}
              onChange={setField("totalShares")}
              placeholder="e.g. 10000000"
            />

            {/* Option pool with mode toggle */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">
                  Option Pool — New Shares This Round
                </label>
                <div className="flex bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/40">
                  {[
                    ["number", "#"],
                    ["percent", "%"],
                  ].map(([mode, lbl]) => (
                    <button
                      key={mode}
                      onClick={() => setField("optionPoolMode")(mode)}
                      className={[
                        "text-xs px-2.5 py-1 rounded-md font-semibold transition-colors",
                        inputs.optionPoolMode === mode
                          ? "bg-cyan-600 text-white"
                          : "text-slate-400 hover:text-slate-200",
                      ].join(" ")}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative flex items-center">
                <input
                  type="number"
                  value={inputs.optionPoolValue}
                  onChange={(e) => setField("optionPoolValue")(e.target.value)}
                  placeholder={
                    inputs.optionPoolMode === "percent" ? "e.g. 10" : "e.g. 1000000"
                  }
                  className="w-full bg-slate-800/80 border border-slate-600/70 rounded-lg px-3 py-2 pr-16 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors appearance-none"
                />
                <span className="absolute right-3 text-slate-500 text-xs pointer-events-none">
                  {inputs.optionPoolMode === "percent" ? "% post" : "shares"}
                </span>
              </div>
              {inputs.optionPoolMode === "percent" && (
                <p className="text-xs text-slate-500 mt-1 italic">
                  Solved algebraically: shares = p% × (existing + investor) ÷ (1 − p%)
                </p>
              )}
            </div>

            {/* Shareholder table */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <SectionHeader>Shareholder Table</SectionHeader>
                <span className="text-xs text-slate-600 pb-3">
                  {inputs.shareholders.length}/20
                </span>
              </div>

              {!r.sharesMatch && isFiniteNum(r.totalShares) && (
                <InfoBanner variant="yellow">
                  Shareholder shares ({fmtNum(r.shTableSum)}) don&apos;t match total shares
                  outstanding ({fmtNum(r.totalShares)}). Ownership percentages use your total
                  shares input.
                </InfoBanner>
              )}

              <div className="space-y-1.5">
                {inputs.shareholders.map((s, idx) => (
                  <div key={s.id} className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => updateShareholder(s.id, "name", e.target.value)}
                      placeholder={`Shareholder ${idx + 1}`}
                      className="flex-1 min-w-0 bg-slate-800/80 border border-slate-600/70 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <input
                      type="number"
                      value={s.shares}
                      onChange={(e) => updateShareholder(s.id, "shares", e.target.value)}
                      placeholder="shares"
                      className="w-28 bg-slate-800/80 border border-slate-600/70 rounded-lg px-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                    />
                    <button
                      onClick={() => removeShareholder(s.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors w-5 shrink-0 text-lg leading-none text-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {inputs.shareholders.length < 20 && (
                <button
                  onClick={addShareholder}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-600/30 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-colors w-full"
                >
                  + Add Shareholder
                </button>
              )}
            </div>
          </div>

          {/* ── Results ── */}
          <div>
            <SectionHeader>Results</SectionHeader>

            {/* Key metrics */}
            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 mb-4">
              <ResultRow
                label="Post-Money Valuation"
                value={fmtCurrency(r.postMoney, currency)}
                note={
                  !isFiniteNum(r.postMoney)
                    ? "Enter Pre-Money and Investment Amount to calculate."
                    : undefined
                }
              />
              <ResultRow
                label="Price Per Share"
                value={fmtCurrency(r.pps, currency, 2)}
                note={
                  !isFiniteNum(r.pps)
                    ? "Enter Pre-Money and Total Shares to calculate."
                    : undefined
                }
              />
              <ResultRow
                label="New Investor Shares Issued"
                value={fmtNum(r.newInvestorShares)}
                note={
                  !isFiniteNum(r.newInvestorShares)
                    ? "Requires Investment Amount and Price Per Share."
                    : undefined
                }
              />
              <ResultRow
                label="New Option Pool Shares"
                value={fmtNum(r.newOptionShares)}
                note={
                  !isFiniteNum(r.newOptionShares)
                    ? "Enter option pool size above."
                    : undefined
                }
              />
              <ResultRow
                label="Total Shares Post-Round"
                value={fmtNum(r.totalPostRound)}
                note={
                  !isFiniteNum(r.totalPostRound)
                    ? "Enter Total Shares Outstanding to calculate."
                    : undefined
                }
              />
              <ResultRow
                label="New Investor Ownership"
                value={fmtPct(r.newInvestorOwnership)}
                note={
                  !isFiniteNum(r.newInvestorOwnership)
                    ? "Requires Investment Amount and Price Per Share."
                    : undefined
                }
                highlight={isFiniteNum(r.newInvestorOwnership)}
              />
            </div>

            {/* Ownership comparison table */}
            {r.shareholders && r.shareholders.some((s) => s.hasShares) && (
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 overflow-hidden mb-4">
                <div className="grid grid-cols-4 px-3 py-2 bg-slate-700/30 border-b border-slate-700/30">
                  <span className="text-xs font-semibold text-slate-400">Shareholder</span>
                  <span className="text-xs font-semibold text-slate-400 text-right">Before</span>
                  <span className="text-xs font-semibold text-slate-400 text-right">After</span>
                  <span className="text-xs font-semibold text-slate-400 text-right">Dilution</span>
                </div>
                {r.shareholders
                  .filter((s) => s.hasShares)
                  .map((s, idx) => (
                    <div
                      key={s.id}
                      className={`grid grid-cols-4 px-3 py-2 border-b border-slate-700/20 last:border-0 ${
                        idx % 2 !== 0 ? "bg-slate-800/20" : ""
                      }`}
                    >
                      <span className="text-xs text-slate-300 truncate pr-1">
                        {s.name || `Shareholder ${idx + 1}`}
                      </span>
                      <span className="text-xs text-slate-400 text-right">
                        {fmtPct(s.preOwnership, 1)}
                      </span>
                      <span className="text-xs text-white font-medium text-right">
                        {fmtPct(s.postOwnership, 1)}
                      </span>
                      <span
                        className={`text-xs text-right font-medium ${
                          isFiniteNum(s.dilution) && s.dilution > 0.005
                            ? "text-red-400"
                            : "text-slate-500"
                        }`}
                      >
                        {isFiniteNum(s.dilution) && s.dilution > 0.005
                          ? `−${fmtPct(s.dilution, 1)}`
                          : "—"}
                      </span>
                    </div>
                  ))}
                {isFiniteNum(r.newOptionShares) && (
                  <div className="grid grid-cols-4 px-3 py-2 border-b border-slate-700/20 bg-slate-700/10">
                    <span className="text-xs text-slate-400 italic">New Option Pool</span>
                    <span className="text-xs text-slate-600 text-right">—</span>
                    <span className="text-xs text-slate-300 text-right">
                      {fmtPct(r.newOptionOwnership, 1)}
                    </span>
                    <span className="text-xs text-slate-600 text-right italic">new</span>
                  </div>
                )}
                {isFiniteNum(r.newInvestorShares) && (
                  <div className="grid grid-cols-4 px-3 py-2 bg-cyan-950/20">
                    <span className="text-xs text-cyan-400 font-medium">New Investor</span>
                    <span className="text-xs text-slate-600 text-right">—</span>
                    <span className="text-xs text-cyan-300 font-semibold text-right">
                      {fmtPct(r.newInvestorOwnership, 1)}
                    </span>
                    <span className="text-xs text-slate-600 text-right italic">new</span>
                  </div>
                )}
              </div>
            )}

            {/* Stacked horizontal bar chart — Before vs After */}
            {r.barChartData && r.allEntities && r.allEntities.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Ownership — Before vs After
                </p>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={r.barChartData}
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fill: "#475569", fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fill: "#94a3b8", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                      />
                      <Tooltip
                        formatter={(val, name) => [`${Number(val).toFixed(1)}%`, name]}
                        contentStyle={{
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          fontSize: "11px",
                          color: "#cbd5e1",
                        }}
                      />
                      {r.allEntities.map((e, i) => (
                        <Bar
                          key={String(e.id)}
                          dataKey={e.name}
                          stackId="a"
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          radius={
                            i === r.allEntities.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]
                          }
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
                  {r.allEntities.map((e, i) => (
                    <div key={String(e.id)} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-xs text-slate-400 max-w-28 truncate">
                        {e.name || `Shareholder ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CalcCard>
    </>
  );
}

// ─── Calculator 3 — Cap Table Simulator ──────────────────────────────────────

const CAP_TABLE_DEFAULTS = {
  founders: [
    { id: 1, name: "Founder 1", shares: "1000000" },
    { id: 2, name: "Founder 2", shares: "1000000" },
  ],
  initialOptionPool: "500000",
  rounds: [
    { id: 1, name: "Seed",     preMoney: "", investment: "", optionPool: "", investorName: "Seed Investors" },
    { id: 2, name: "Series A", preMoney: "", investment: "", optionPool: "", investorName: "Series A Investors" },
    { id: 3, name: "Series B", preMoney: "", investment: "", optionPool: "", investorName: "Series B Investors" },
    { id: 4, name: "Series C", preMoney: "", investment: "", optionPool: "", investorName: "Series C Investors" },
    { id: 5, name: "Series D", preMoney: "", investment: "", optionPool: "", investorName: "Series D Investors" },
  ],
  activeRoundCount: 1,
};

/** Round all party percentages to 2dp, then correct rounding drift on the largest party. */
function normalizeOwnership(parties, total) {
  if (!isFiniteNum(total) || total <= 0 || parties.length === 0) return parties;
  const rounded = parties.map((p) => ({
    ...p,
    pctDisplay: parseFloat(((p.shares / total) * 100).toFixed(2)),
  }));
  const sum = rounded.reduce((s, p) => s + p.pctDisplay, 0);
  const diff = parseFloat((100 - sum).toFixed(2));
  if (Math.abs(diff) > 0.001) {
    const maxIdx = rounded.reduce(
      (mi, p, i) => (p.pctDisplay > rounded[mi].pctDisplay ? i : mi),
      0
    );
    rounded[maxIdx] = {
      ...rounded[maxIdx],
      pctDisplay: parseFloat((rounded[maxIdx].pctDisplay + diff).toFixed(2)),
    };
  }
  return rounded;
}

function CapTableSimulator({ currency }) {
  const [inputs, setInputs] = useState(CAP_TABLE_DEFAULTS);
  const [subTab, setSubTab] = useState("setup");
  const [expandedRounds, setExpandedRounds] = useState(new Set([1]));
  const [copyFn, CopyModalNode] = useCopyToClipboard();

  const setField = useCallback(
    (field) => (val) => setInputs((prev) => ({ ...prev, [field]: val })),
    []
  );

  // ── Founder helpers ──────────────────────────────────────────────────────
  const addFounder = useCallback(() => {
    setInputs((prev) => {
      if (prev.founders.length >= 10) return prev;
      return {
        ...prev,
        founders: [
          ...prev.founders,
          { id: Date.now(), name: `Founder ${prev.founders.length + 1}`, shares: "" },
        ],
      };
    });
  }, []);

  const removeFounder = useCallback((id) => {
    setInputs((prev) => ({
      ...prev,
      founders: prev.founders.filter((f) => f.id !== id),
    }));
  }, []);

  const updateFounder = useCallback((id, field, val) => {
    setInputs((prev) => ({
      ...prev,
      founders: prev.founders.map((f) => (f.id === id ? { ...f, [field]: val } : f)),
    }));
  }, []);

  // ── Round helpers ────────────────────────────────────────────────────────
  const addRound = useCallback(() => {
    setInputs((prev) => {
      if (prev.activeRoundCount >= 5) return prev;
      const next = prev.activeRoundCount + 1;
      setExpandedRounds((er) => new Set([...er, next]));
      return { ...prev, activeRoundCount: next };
    });
  }, []);

  const updateRound = useCallback((id, field, val) => {
    setInputs((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) => (r.id === id ? { ...r, [field]: val } : r)),
    }));
  }, []);

  const toggleRound = useCallback((id) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Simulation ──────────────────────────────────────────────────────────
  const simResults = useMemo(() => {
    try {
      const founders = inputs.founders
        .map((f) => ({ ...f, sharesNum: parseVal(f.shares) }))
        .filter((f) => isFiniteNum(f.sharesNum) && f.sharesNum > 0);

      if (founders.length === 0) return { noFounders: true };

      const initPool = parseVal(inputs.initialOptionPool);
      const poolShares = isFiniteNum(initPool) && initPool > 0 ? initPool : 0;

      // Initial party list (founding)
      const initialParties = [
        ...founders.map((f) => ({
          id: f.id,
          name: f.name,
          type: "founder",
          shares: f.sharesNum,
        })),
        { id: "pool", name: "Option Pool", type: "pool", shares: poolShares },
      ];

      const foundingTotal = initialParties.reduce((s, p) => s + p.shares, 0);
      const foundingNorm = normalizeOwnership(initialParties, foundingTotal);

      const stages = [
        {
          stageKey: "founding",
          label: "Founding",
          parties: foundingNorm,
          total: foundingTotal,
          pps: null,
          preMoney: null,
          investment: null,
          postMoney: null,
          newInvestorShares: null,
          newOptionShares: null,
          roundId: null,
        },
      ];

      const activeRounds = inputs.rounds.slice(0, inputs.activeRoundCount);

      for (const round of activeRounds) {
        const preMoney = parseVal(round.preMoney);
        const investment = parseVal(round.investment);
        const newOptionShares = parseVal(round.optionPool);

        // Skip rounds with zero inputs entirely (no column in results)
        const hasAny =
          isFiniteNum(preMoney) ||
          isFiniteNum(investment) ||
          (isFiniteNum(newOptionShares) && newOptionShares > 0);
        if (!hasAny) continue;

        const prevStage = stages[stages.length - 1];
        const openingShares = prevStage.total;

        const pps =
          isFiniteNum(preMoney) && openingShares > 0
            ? preMoney / openingShares
            : null;

        const newInvestorShares =
          isFiniteNum(investment) && isFiniteNum(pps) && pps > 0
            ? investment / pps
            : null;

        const postMoney =
          isFiniteNum(preMoney) && isFiniteNum(investment)
            ? preMoney + investment
            : null;

        // Clone parties from previous stage
        let nextParties = prevStage.parties.map((p) => ({ ...p }));

        // Grow option pool
        if (isFiniteNum(newOptionShares) && newOptionShares > 0) {
          const poolIdx = nextParties.findIndex((p) => p.type === "pool");
          if (poolIdx >= 0) {
            nextParties[poolIdx] = {
              ...nextParties[poolIdx],
              shares: nextParties[poolIdx].shares + newOptionShares,
            };
          }
        }

        // Add new investor party
        if (isFiniteNum(newInvestorShares) && newInvestorShares > 0) {
          const investorName = round.investorName?.trim() || `Round ${round.id} Investor`;
          nextParties.push({
            id: `investor-${round.id}`,
            name: investorName,
            type: "investor",
            shares: newInvestorShares,
          });
        }

        const newTotal = nextParties.reduce((s, p) => s + p.shares, 0);
        const normalizedParties = normalizeOwnership(nextParties, newTotal);

        stages.push({
          stageKey: `round-${round.id}`,
          label: round.name || `Round ${round.id}`,
          parties: normalizedParties,
          total: newTotal,
          pps,
          preMoney,
          investment,
          postMoney,
          newInvestorShares,
          newOptionShares,
          roundId: round.id,
        });
      }

      // Collect all unique party names in order of appearance
      const partyOrder = [];
      stages.forEach((stage) => {
        stage.parties.forEach((p) => {
          if (!partyOrder.includes(p.name)) partyOrder.push(p.name);
        });
      });

      // Assign colors by party type
      const founderColors = [
        "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
        "#db2777", "#9333ea", "#7c3aed", "#4f46e5", "#2563eb",
      ];
      const investorColors = ["#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16"];
      const partyColors = {};
      let founderIdx = 0;
      let investorIdx = 0;

      partyOrder.forEach((name) => {
        let type = "other";
        for (const stage of stages) {
          const p = stage.parties.find((pp) => pp.name === name);
          if (p) { type = p.type; break; }
        }
        if (type === "founder") {
          partyColors[name] = founderColors[founderIdx++ % founderColors.length];
        } else if (type === "pool") {
          partyColors[name] = "#64748b";
        } else if (type === "investor") {
          partyColors[name] = investorColors[investorIdx++ % investorColors.length];
        } else {
          partyColors[name] = "#94a3b8";
        }
      });

      // Build area chart data — one data point per stage
      const areaChartData = stages.map((stage) => {
        const point = { stage: stage.label };
        partyOrder.forEach((name) => {
          const p = stage.parties.find((pp) => pp.name === name);
          point[name] = p ? p.pctDisplay : 0;
        });
        return point;
      });

      return { stages, partyOrder, partyColors, areaChartData, noFounders: false };
    } catch {
      return { error: true };
    }
  }, [inputs]);

  // Derived PPS & postMoney per round (for Setup tab read-only display)
  const roundDerived = useMemo(() => {
    const map = {};
    (simResults?.stages || []).forEach((stage) => {
      if (stage.roundId !== null) {
        map[stage.roundId] = { pps: stage.pps, postMoney: stage.postMoney };
      }
    });
    return map;
  }, [simResults]);

  const handleReset = useCallback(() => {
    setInputs(CAP_TABLE_DEFAULTS);
    setExpandedRounds(new Set([1]));
    setSubTab("setup");
  }, []);

  const handleCopy = useCallback(() => {
    const sr = simResults;
    if (!sr || sr.noFounders || !sr.stages) return;
    const { stages, partyOrder } = sr;
    const header = ["Shareholder", ...stages.map((s) => s.label)].join(" | ");
    const rows = partyOrder.map((name) => {
      const cells = stages.map((stage) => {
        const p = stage.parties.find((pp) => pp.name === name);
        return p ? fmtPct(p.pctDisplay, 1) : "—";
      });
      return [name, ...cells].join(" | ");
    });
    const summaryLines = stages
      .filter((s) => s.roundId)
      .map(
        (s) =>
          `  ${s.label}: Pre=${fmtCurrency(s.preMoney, currency)} | Inv=${fmtCurrency(
            s.investment,
            currency
          )} | Post=${fmtCurrency(s.postMoney, currency)} | PPS=${fmtCurrency(
            s.pps,
            currency,
            2
          )}`
      );
    const text = [
      "Cap Table Simulator",
      "====================",
      header,
      header.replace(/./g, "-"),
      ...rows,
      "",
      "Round Summary:",
      ...summaryLines,
    ].join("\n");
    copyFn(text);
  }, [simResults, currency, copyFn]);

  const currSymbol = CURRENCY_META[currency]?.symbol || "$";
  const sr = simResults || {};
  const noFounders =
    sr.noFounders ||
    inputs.founders.every(
      (f) => !isFiniteNum(parseVal(f.shares)) || parseVal(f.shares) <= 0
    );

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="Cap Table Simulator"
        description="Simulate how your cap table evolves across multiple funding rounds. See the full dilution story from founding to Series C."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        {/* Sub-tab bar */}
        <div className="flex gap-1 mb-6 bg-slate-800/40 rounded-xl p-1 w-fit border border-slate-700/30">
          {[
            ["setup", "Setup"],
            ["results", "Results"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={[
                "px-5 py-1.5 rounded-lg text-sm font-medium transition-all",
                subTab === key
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/30"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── SETUP TAB ── */}
        {subTab === "setup" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Founding Team */}
            <div>
              <SectionHeader>Founding Team</SectionHeader>

              {noFounders && (
                <InfoBanner variant="yellow">
                  Add at least one founding shareholder to run the simulation.
                </InfoBanner>
              )}

              <div className="space-y-1.5 mb-3">
                {inputs.founders.map((f, idx) => (
                  <div key={f.id} className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => updateFounder(f.id, "name", e.target.value)}
                      placeholder={`Founder ${idx + 1}`}
                      className="flex-1 min-w-0 bg-slate-800/80 border border-slate-600/70 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <input
                      type="number"
                      value={f.shares}
                      onChange={(e) => updateFounder(f.id, "shares", e.target.value)}
                      placeholder="shares"
                      className="w-32 bg-slate-800/80 border border-slate-600/70 rounded-lg px-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                    />
                    <button
                      onClick={() => removeFounder(f.id)}
                      disabled={inputs.founders.length <= 1}
                      className="text-slate-600 hover:text-red-400 transition-colors w-5 shrink-0 text-lg leading-none text-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {inputs.founders.length < 10 && (
                <button
                  onClick={addFounder}
                  className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-600/30 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-colors w-full mb-4"
                >
                  + Add Founder
                </button>
              )}

              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Initial Option Pool (Shares)
                </label>
                <input
                  type="number"
                  value={inputs.initialOptionPool}
                  onChange={(e) => setField("initialOptionPool")(e.target.value)}
                  placeholder="e.g. 500000"
                  className="w-full bg-slate-800/80 border border-slate-600/70 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors appearance-none"
                />
              </div>

              {/* Founding snapshot */}
              {!noFounders && sr.stages && sr.stages[0] && (
                <div className="mt-4 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Founding Cap Table
                  </p>
                  {sr.stages[0].parties.map((p) => (
                    <div
                      key={String(p.id)}
                      className="flex justify-between items-center py-1.5 border-b border-slate-700/30 last:border-0"
                    >
                      <span className="text-xs text-slate-300">{p.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {fmtNum(p.shares)} shares
                        </span>
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: sr.partyColors?.[p.name] || "#94a3b8" }}
                        >
                          {fmtPct(p.pctDisplay, 1)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 mt-1">
                    <span className="text-xs text-slate-400 font-medium">Total</span>
                    <span className="text-xs text-white font-semibold">
                      {fmtNum(sr.stages[0].total)} shares
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Funding Rounds */}
            <div>
              <SectionHeader>Funding Rounds</SectionHeader>
              <div className="space-y-2">
                {inputs.rounds.slice(0, inputs.activeRoundCount).map((round) => {
                  const isExpanded = expandedRounds.has(round.id);
                  const derived = roundDerived[round.id];
                  const roundColor =
                    sr.partyColors?.[round.investorName?.trim() || `Round ${round.id} Investor`] ||
                    "#0ea5e9";
                  return (
                    <div
                      key={round.id}
                      className="bg-slate-800/40 border border-slate-700/30 rounded-xl overflow-hidden"
                    >
                      {/* Collapsible header */}
                      <button
                        onClick={() => toggleRound(round.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: roundColor }}
                          />
                          <span className="text-sm font-medium text-white">
                            {round.name || `Round ${round.id}`}
                          </span>
                          {isFiniteNum(derived?.pps) && (
                            <span className="text-xs text-cyan-400 ml-1">
                              {fmtCurrency(derived.pps, currency, 2)}/share
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-xs select-none">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-3 space-y-2 border-t border-slate-700/30">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                Round Name
                              </label>
                              <input
                                type="text"
                                value={round.name}
                                onChange={(e) => updateRound(round.id, "name", e.target.value)}
                                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                Investor Name
                              </label>
                              <input
                                type="text"
                                value={round.investorName}
                                onChange={(e) =>
                                  updateRound(round.id, "investorName", e.target.value)
                                }
                                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                Pre-Money Valuation
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                                  {currSymbol}
                                </span>
                                <input
                                  type="number"
                                  value={round.preMoney}
                                  onChange={(e) =>
                                    updateRound(round.id, "preMoney", e.target.value)
                                  }
                                  placeholder="e.g. 5000000"
                                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-6 pr-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">
                                Investment Amount
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                                  {currSymbol}
                                </span>
                                <input
                                  type="number"
                                  value={round.investment}
                                  onChange={(e) =>
                                    updateRound(round.id, "investment", e.target.value)
                                  }
                                  placeholder="e.g. 1000000"
                                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-6 pr-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                              New Option Pool Shares Added
                            </label>
                            <input
                              type="number"
                              value={round.optionPool}
                              onChange={(e) =>
                                updateRound(round.id, "optionPool", e.target.value)
                              }
                              placeholder="e.g. 250000"
                              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                            />
                          </div>

                          {/* Derived read-only fields */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="bg-slate-700/30 rounded-lg px-3 py-2">
                              <p className="text-xs text-slate-500 mb-0.5">Price Per Share</p>
                              <p className="text-sm font-semibold text-cyan-300">
                                {fmtCurrency(derived?.pps, currency, 2)}
                              </p>
                            </div>
                            <div className="bg-slate-700/30 rounded-lg px-3 py-2">
                              <p className="text-xs text-slate-500 mb-0.5">Post-Money</p>
                              <p className="text-sm font-semibold text-cyan-300">
                                {fmtCurrency(derived?.postMoney, currency)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {inputs.activeRoundCount < 5 && (
                <button
                  onClick={addRound}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-600/30 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-colors w-full"
                >
                  + Add Round
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {subTab === "results" && (
          <div>
            {noFounders ? (
              <InfoBanner variant="yellow">
                Add at least one founding shareholder on the Setup tab to see results.
              </InfoBanner>
            ) : !sr.stages || sr.stages.length === 0 ? (
              <InfoBanner variant="slate">
                Configure at least one funding round on the Setup tab to see results.
              </InfoBanner>
            ) : (
              <div className="space-y-8">
                {/* Multi-column ownership evolution table */}
                <div>
                  <SectionHeader>Ownership Evolution</SectionHeader>
                  <div className="overflow-x-auto rounded-xl border border-slate-700/30">
                    <table className="w-full min-w-max text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-700/30">
                          <th className="px-4 py-3 text-left text-slate-400 font-semibold whitespace-nowrap w-36 sticky left-0 bg-slate-700/30">
                            Shareholder
                          </th>
                          {sr.stages.map((stage) => (
                            <th
                              key={stage.stageKey}
                              className="px-4 py-3 text-right text-slate-400 font-semibold whitespace-nowrap"
                            >
                              {stage.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sr.partyOrder.map((name, rowIdx) => (
                          <tr
                            key={name}
                            className={rowIdx % 2 !== 0 ? "bg-slate-800/20" : ""}
                          >
                            <td className="px-4 py-2.5 font-medium whitespace-nowrap sticky left-0 bg-[#1e293b]">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-sm shrink-0"
                                  style={{ background: sr.partyColors?.[name] || "#94a3b8" }}
                                />
                                <span className="text-slate-200 max-w-32 truncate">{name}</span>
                              </div>
                            </td>
                            {sr.stages.map((stage, stageIdx) => {
                              const p = stage.parties.find((pp) => pp.name === name);
                              const prev = stageIdx > 0 ? sr.stages[stageIdx - 1] : null;
                              const prevP = prev?.parties.find((pp) => pp.name === name);
                              const delta =
                                p && prevP
                                  ? parseFloat((p.pctDisplay - prevP.pctDisplay).toFixed(2))
                                  : null;
                              return (
                                <td
                                  key={stage.stageKey}
                                  className="px-4 py-2.5 text-right whitespace-nowrap"
                                >
                                  {p ? (
                                    <div>
                                      <span
                                        className="font-semibold tabular-nums"
                                        style={{ color: sr.partyColors?.[name] || "#e2e8f0" }}
                                      >
                                        {fmtPct(p.pctDisplay, 2)}
                                      </span>
                                      {isFiniteNum(delta) && Math.abs(delta) > 0.005 && (
                                        <div
                                          className={`text-xs mt-0.5 tabular-nums ${
                                            delta < 0 ? "text-red-400" : "text-emerald-400"
                                          }`}
                                        >
                                          {delta < 0 ? "−" : "+"}
                                          {Math.abs(delta).toFixed(2)}%
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Stacked area chart */}
                {sr.areaChartData && sr.areaChartData.length >= 2 && (
                  <div>
                    <SectionHeader>Ownership Over Time</SectionHeader>
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={sr.areaChartData}
                            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                          >
                            <XAxis
                              dataKey="stage"
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tickFormatter={(v) => `${v}%`}
                              tick={{ fill: "#64748b", fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={36}
                            />
                            <Tooltip
                              formatter={(val, name) => [
                                `${Number(val).toFixed(1)}%`,
                                name,
                              ]}
                              contentStyle={{
                                background: "#1e293b",
                                border: "1px solid #334155",
                                borderRadius: "8px",
                                fontSize: "11px",
                                color: "#cbd5e1",
                              }}
                            />
                            {sr.partyOrder.map((name) => (
                              <Area
                                key={name}
                                type="monotone"
                                dataKey={name}
                                stackId="1"
                                stroke={sr.partyColors?.[name] || "#94a3b8"}
                                fill={sr.partyColors?.[name] || "#94a3b8"}
                                fillOpacity={0.72}
                                strokeWidth={1.5}
                              />
                            ))}
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                        {sr.partyOrder.map((name) => (
                          <div key={name} className="flex items-center gap-1.5">
                            <div
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ background: sr.partyColors?.[name] || "#94a3b8" }}
                            />
                            <span className="text-xs text-slate-400">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Round summary table */}
                {sr.stages.filter((s) => s.roundId).length > 0 && (
                  <div>
                    <SectionHeader>Round Summary</SectionHeader>
                    <div className="overflow-x-auto rounded-xl border border-slate-700/30">
                      <table className="w-full min-w-max text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-700/30">
                            {[
                              "Round",
                              "Pre-Money",
                              "Investment",
                              "Post-Money",
                              "Price / Share",
                              "Shares Issued",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-4 py-3 text-left text-slate-400 font-semibold whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sr.stages
                            .filter((s) => s.roundId)
                            .map((stage, idx) => (
                              <tr
                                key={stage.stageKey}
                                className={idx % 2 !== 0 ? "bg-slate-800/20" : ""}
                              >
                                <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                                  {stage.label}
                                </td>
                                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                                  {fmtCurrency(stage.preMoney, currency)}
                                </td>
                                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                                  {fmtCurrency(stage.investment, currency)}
                                </td>
                                <td className="px-4 py-2.5 text-cyan-300 font-medium whitespace-nowrap">
                                  {fmtCurrency(stage.postMoney, currency)}
                                </td>
                                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                                  {fmtCurrency(stage.pps, currency, 2)}
                                </td>
                                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                                  {fmtNum(stage.newInvestorShares)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CalcCard>
    </>
  );
}

// ─── Calculator 4 — IRR / MOIC with XIRR ─────────────────────────────────────

const TODAY_STR = new Date().toISOString().split("T")[0];

/** Newton-Raphson XIRR. Returns annualized rate or null on failure. */
function computeXIRR(cashFlows) {
  try {
    if (!cashFlows || cashFlows.length < 2) return null;
    const cfs = cashFlows
      .map((cf) => ({ date: new Date(cf.date + "T00:00:00"), amount: cf.amount }))
      .sort((a, b) => a.date - b.date);
    const t0 = cfs[0].date.getTime();

    const f = (r) =>
      cfs.reduce((sum, cf) => {
        const t = (cf.date.getTime() - t0) / (1000 * 60 * 60 * 24) / 365;
        if (r <= -1) return NaN;
        return sum + cf.amount / Math.pow(1 + r, t);
      }, 0);

    const df = (r) =>
      cfs.reduce((sum, cf) => {
        const t = (cf.date.getTime() - t0) / (1000 * 60 * 60 * 24) / 365;
        if (r <= -1) return NaN;
        return sum - (cf.amount * t) / Math.pow(1 + r, t + 1);
      }, 0);

    const converge = (guess) => {
      let r = guess;
      for (let i = 0; i < 1000; i++) {
        const fr = f(r);
        if (!isFinite(fr) || isNaN(fr)) return null;
        if (Math.abs(fr) < 1e-7) return r;
        const dfr = df(r);
        if (!isFinite(dfr) || isNaN(dfr) || Math.abs(dfr) < 1e-14) return null;
        const next = r - fr / dfr;
        if (!isFinite(next) || isNaN(next)) return null;
        r = next;
      }
      return Math.abs(f(r)) < 1e-7 ? r : null;
    };

    for (const g of [0.1, -0.5, 0.5, 2.0, -0.9]) {
      const result = converge(g);
      if (result !== null && isFinite(result) && !isNaN(result)) return result;
    }
    return null;
  } catch {
    return null;
  }
}

const IRR_DEFAULTS = {
  mode: "simple",
  initialInvestment: "",
  exitValue: "",
  investmentDate: "",
  exitDate: "",
  cashFlows: [
    { id: 1, date: TODAY_STR, amount: "", label: "Initial Investment" },
    { id: 2, date: "", amount: "", label: "" },
  ],
};

function IRRCalculator({ currency }) {
  const [inputs, setInputs] = useState(IRR_DEFAULTS);
  const [copyFn, CopyModalNode] = useCopyToClipboard();

  const setField = useCallback(
    (field) => (val) => setInputs((prev) => ({ ...prev, [field]: val })),
    []
  );

  const addCashFlow = useCallback(() => {
    setInputs((prev) => {
      if (prev.cashFlows.length >= 50) return prev;
      return {
        ...prev,
        cashFlows: [...prev.cashFlows, { id: Date.now(), date: "", amount: "", label: "" }],
      };
    });
  }, []);

  const removeCashFlow = useCallback((id) => {
    setInputs((prev) => ({
      ...prev,
      cashFlows: prev.cashFlows.filter((cf) => cf.id !== id),
    }));
  }, []);

  const updateCashFlow = useCallback((id, field, val) => {
    setInputs((prev) => ({
      ...prev,
      cashFlows: prev.cashFlows.map((cf) =>
        cf.id === id ? { ...cf, [field]: val } : cf
      ),
    }));
  }, []);

  const moveCashFlow = useCallback((id, dir) => {
    setInputs((prev) => {
      const arr = [...prev.cashFlows];
      const idx = arr.findIndex((cf) => cf.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return prev;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, cashFlows: arr };
    });
  }, []);

  // ── Simple mode ─────────────────────────────────────────────────────────
  const simpleResults = useMemo(() => {
    try {
      const inv = parseVal(inputs.initialInvestment);
      const exit = parseVal(inputs.exitValue);
      const invDate = inputs.investmentDate
        ? new Date(inputs.investmentDate + "T00:00:00")
        : null;
      const exitDate = inputs.exitDate
        ? new Date(inputs.exitDate + "T00:00:00")
        : null;

      const moic =
        isFiniteNum(inv) && inv > 0 && isFiniteNum(exit) ? exit / inv : null;

      let holdingYears = null;
      if (invDate && exitDate && exitDate > invDate) {
        holdingYears =
          (exitDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24) / 365.25;
      }

      let irr = null;
      if (isFiniteNum(moic) && moic > 0 && isFiniteNum(holdingYears) && holdingYears > 0) {
        irr = Math.pow(moic, 1 / holdingYears) - 1;
      }

      const cashOnCash =
        isFiniteNum(inv) && inv > 0 && isFiniteNum(exit)
          ? ((exit - inv) / inv) * 100
          : null;
      const totalProfit =
        isFiniteNum(inv) && isFiniteNum(exit) ? exit - inv : null;

      // Linear interpolation chart
      let chartData = null;
      if (
        invDate &&
        exitDate &&
        exitDate > invDate &&
        isFiniteNum(inv) &&
        isFiniteNum(exit)
      ) {
        const N = 20;
        const t0 = invDate.getTime();
        const t1 = exitDate.getTime();
        chartData = Array.from({ length: N + 1 }, (_, i) => {
          const t = i / N;
          const d = new Date(t0 + t * (t1 - t0));
          return {
            date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            value: parseFloat((inv + t * (exit - inv)).toFixed(0)),
          };
        });
      }

      return { inv, exit, moic, holdingYears, irr, cashOnCash, totalProfit, chartData };
    } catch {
      return {};
    }
  }, [
    inputs.initialInvestment,
    inputs.exitValue,
    inputs.investmentDate,
    inputs.exitDate,
  ]);

  // ── XIRR mode ───────────────────────────────────────────────────────────
  const xirrResults = useMemo(() => {
    try {
      const processedRows = inputs.cashFlows.map((cf) => {
        const hasDate = cf.date && cf.date.trim() !== "";
        const amount = parseVal(cf.amount);
        const hasAmount = isFiniteNum(amount);
        return { ...cf, amountNum: amount, hasDate, hasAmount, excluded: !hasDate || !hasAmount };
      });

      const validCFs = processedRows.filter((cf) => !cf.excluded);

      // Merge same-date flows
      const mergedMap = {};
      validCFs.forEach((cf) => {
        mergedMap[cf.date] = (mergedMap[cf.date] || 0) + cf.amountNum;
      });
      const mergedCFs = Object.entries(mergedMap).map(([date, amount]) => ({
        date,
        amount,
      }));

      if (validCFs.length < 2) {
        return {
          processedRows,
          validationError:
            "Add at least 2 cash flows with dates to calculate XIRR.",
        };
      }

      const hasNeg = mergedCFs.some((cf) => cf.amount < 0);
      const hasPos = mergedCFs.some((cf) => cf.amount > 0);

      if (!hasNeg) {
        return {
          processedRows,
          validationError:
            "XIRR requires at least one negative cash flow (investment/outflow).",
        };
      }
      if (!hasPos) {
        return {
          processedRows,
          validationError:
            "XIRR requires at least one positive cash flow (return/distribution).",
        };
      }

      let xirrRate = null;
      let xirrError = null;
      try {
        xirrRate = computeXIRR(mergedCFs);
        if (xirrRate === null) {
          xirrError =
            "IRR could not be calculated for these cash flows. This can happen when all cash flows are the same sign (all inflows or all outflows), or when multiple IRR solutions exist. Please verify your cash flows include both negative (investment) and positive (return) entries.";
        }
      } catch {
        xirrError = "IRR could not be calculated for these cash flows.";
      }

      const totalPositive = mergedCFs
        .filter((cf) => cf.amount > 0)
        .reduce((s, cf) => s + cf.amount, 0);
      const totalNegative = Math.abs(
        mergedCFs.filter((cf) => cf.amount < 0).reduce((s, cf) => s + cf.amount, 0)
      );
      const moic = totalNegative > 0 ? totalPositive / totalNegative : null;
      const netCF = mergedCFs.reduce((s, cf) => s + cf.amount, 0);

      const dateObjs = mergedCFs.map((cf) => new Date(cf.date + "T00:00:00"));
      const minMs = Math.min(...dateObjs.map((d) => d.getTime()));
      const maxMs = Math.max(...dateObjs.map((d) => d.getTime()));
      const holdingYears = (maxMs - minMs) / (1000 * 60 * 60 * 24) / 365.25;

      // Chart data: sorted cash flows + cumulative line
      const sortedCFs = validCFs
        .map((cf) => ({ date: cf.date, amount: cf.amountNum, label: cf.label }))
        .sort((a, b) => new Date(a.date + "T00:00:00") - new Date(b.date + "T00:00:00"));

      let cumulative = 0;
      const chartData = sortedCFs.map((cf) => {
        cumulative += cf.amount;
        return {
          date: cf.date,
          amount: cf.amount,
          cumulative,
          isPositive: cf.amount >= 0,
        };
      });

      return {
        processedRows,
        xirrRate,
        xirrError,
        moic,
        totalPositive,
        totalNegative,
        netCF,
        holdingYears: isFiniteNum(holdingYears) && holdingYears >= 0 ? holdingYears : null,
        chartData,
      };
    } catch {
      return { processedRows: inputs.cashFlows };
    }
  }, [inputs.cashFlows]);

  const handleReset = useCallback(() => setInputs(IRR_DEFAULTS), []);

  const handleCopy = useCallback(() => {
    const mode = inputs.mode;
    let text;
    if (mode === "simple") {
      const r = simpleResults;
      text = [
        "IRR / MOIC Calculator — Simple Mode",
        "=====================================",
        `Initial Investment:   ${fmtCurrency(r.inv, currency)}`,
        `Exit Value:           ${fmtCurrency(r.exit, currency)}`,
        `MOIC:                 ${isFiniteNum(r.moic) ? r.moic.toFixed(2) + "x" : "—"}`,
        `IRR:                  ${isFiniteNum(r.irr) ? fmtPct(r.irr * 100) : "—"}`,
        `Holding Period:       ${isFiniteNum(r.holdingYears) ? r.holdingYears.toFixed(1) + " years" : "—"}`,
        `Cash-on-Cash Return:  ${fmtPct(r.cashOnCash)}`,
        `Total Profit:         ${fmtCurrency(r.totalProfit, currency)}`,
      ].join("\n");
    } else {
      const xr = xirrResults;
      text = [
        "IRR / MOIC Calculator — XIRR Mode",
        "===================================",
        `XIRR:                   ${isFiniteNum(xr?.xirrRate) ? fmtPct(xr.xirrRate * 100) : "—"}`,
        `MOIC:                   ${isFiniteNum(xr?.moic) ? xr.moic.toFixed(2) + "x" : "—"}`,
        `Total Capital Invested: ${fmtCurrency(xr?.totalNegative, currency)}`,
        `Total Distributions:    ${fmtCurrency(xr?.totalPositive, currency)}`,
        `Net Profit:             ${fmtCurrency(xr?.netCF, currency)}`,
        `Holding Period:         ${isFiniteNum(xr?.holdingYears) ? xr.holdingYears.toFixed(1) + " years" : "—"}`,
        "",
        "Cash Flows:",
        ...(xr?.processedRows || []).map(
          (cf) =>
            `  ${cf.date || "(no date)"} | ${
              isFiniteNum(cf.amountNum) ? fmtCurrency(cf.amountNum, currency) : "(no amount)"
            } | ${cf.label || ""}`
        ),
      ].join("\n");
    }
    copyFn(text);
  }, [inputs.mode, simpleResults, xirrResults, currency, copyFn]);

  const r = simpleResults;
  const xr = xirrResults;
  const currSymbol = CURRENCY_META[currency]?.symbol || "$";

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="IRR / MOIC Calculator"
        description="Calculate the true return on an investment including any interim cash flows — positive or negative — with exact dates, just like Excel's XIRR function."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        {/* Mode toggle */}
        <div className="flex gap-1 mb-6 bg-slate-800/40 rounded-xl p-1 w-fit border border-slate-700/30">
          {[
            ["simple", "Simple Mode"],
            ["xirr", "XIRR Mode"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setField("mode")(key)}
              className={[
                "px-5 py-1.5 rounded-lg text-sm font-medium transition-all",
                inputs.mode === key
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/30"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── SIMPLE MODE ── */}
        {inputs.mode === "simple" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <SectionHeader>Inputs</SectionHeader>
              <InputField
                label="Initial Investment"
                value={inputs.initialInvestment}
                onChange={setField("initialInvestment")}
                placeholder="e.g. 500000"
                prefix={currSymbol}
                hint="Enter as a positive number — treated as outflow internally"
              />
              <InputField
                label="Exit / Final Value"
                value={inputs.exitValue}
                onChange={setField("exitValue")}
                placeholder="e.g. 2000000"
                prefix={currSymbol}
              />
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Investment Date
                </label>
                <input
                  type="date"
                  value={inputs.investmentDate}
                  onChange={(e) => setField("investmentDate")(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-600/70 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
                />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Exit Date
                </label>
                <input
                  type="date"
                  value={inputs.exitDate}
                  onChange={(e) => setField("exitDate")(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-600/70 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <SectionHeader>Results</SectionHeader>
              <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 mb-4">
                <ResultRow
                  label="MOIC"
                  value={isFiniteNum(r.moic) ? `${r.moic.toFixed(2)}x` : "—"}
                  note={!isFiniteNum(r.moic) ? "Enter Initial Investment and Exit Value." : undefined}
                  highlight={isFiniteNum(r.moic)}
                />
                <ResultRow
                  label="IRR (Annualized)"
                  value={isFiniteNum(r.irr) ? fmtPct(r.irr * 100) : "—"}
                  note={!isFiniteNum(r.irr) ? "Enter all four inputs to calculate IRR." : undefined}
                  redValue={isFiniteNum(r.irr) && r.irr < 0}
                />
                <ResultRow
                  label="Holding Period"
                  value={
                    isFiniteNum(r.holdingYears) ? `${r.holdingYears.toFixed(1)} years` : "—"
                  }
                  note={
                    !isFiniteNum(r.holdingYears)
                      ? "Enter Investment Date and Exit Date."
                      : undefined
                  }
                />
                <ResultRow
                  label="Cash-on-Cash Return"
                  value={fmtPct(r.cashOnCash)}
                  note={
                    !isFiniteNum(r.cashOnCash)
                      ? "Enter Initial Investment and Exit Value."
                      : undefined
                  }
                  redValue={isFiniteNum(r.cashOnCash) && r.cashOnCash < 0}
                />
                <ResultRow
                  label="Total Profit"
                  value={fmtCurrency(r.totalProfit, currency)}
                  note={
                    !isFiniteNum(r.totalProfit)
                      ? "Enter Initial Investment and Exit Value."
                      : undefined
                  }
                  redValue={isFiniteNum(r.totalProfit) && r.totalProfit < 0}
                />
              </div>

              {/* Line chart: value over time */}
              {r.chartData && (
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Value Growth Over Time
                  </p>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={r.chartData}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#64748b", fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tickFormatter={(v) => {
                            const abs = Math.abs(v);
                            if (abs >= 1e6) return `${currSymbol}${(v / 1e6).toFixed(1)}M`;
                            if (abs >= 1e3) return `${currSymbol}${(v / 1e3).toFixed(0)}k`;
                            return `${currSymbol}${v}`;
                          }}
                          tick={{ fill: "#64748b", fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          width={52}
                        />
                        <Tooltip
                          formatter={(val) => [fmtCurrency(val, currency), "Value"]}
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            fontSize: "11px",
                            color: "#cbd5e1",
                          }}
                        />
                        <Line
                          type="linear"
                          dataKey="value"
                          stroke="#0ea5e9"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4, fill: "#0ea5e9" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── XIRR MODE ── */}
        {inputs.mode === "xirr" && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
            {/* Cash flow table — 3 cols wide */}
            <div className="xl:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader>Cash Flows</SectionHeader>
                <span className="text-xs text-slate-600 pb-3">
                  {inputs.cashFlows.length}/50
                </span>
              </div>

              {/* Column labels */}
              <div className="grid gap-1 mb-1.5 px-0.5" style={{ gridTemplateColumns: "120px 1fr 130px 28px 28px" }}>
                <span className="text-xs text-slate-500 font-medium">Date</span>
                <span className="text-xs text-slate-500 font-medium">Label (optional)</span>
                <span className="text-xs text-slate-500 font-medium">Amount</span>
                <span />
                <span />
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-0.5">
                {inputs.cashFlows.map((cf, idx) => {
                  const proc = xr?.processedRows?.find((p) => p.id === cf.id);
                  const missingDate = proc ? !proc.hasDate : false;
                  const missingAmt = proc ? !proc.hasAmount : false;
                  const excluded = proc?.excluded;
                  return (
                    <div
                      key={cf.id}
                      className={`grid gap-1 items-center rounded-lg px-1 py-0.5 ${
                        excluded
                          ? "bg-orange-950/20 border border-orange-800/20"
                          : ""
                      }`}
                      style={{ gridTemplateColumns: "120px 1fr 130px 28px 28px" }}
                    >
                      <input
                        type="date"
                        value={cf.date}
                        onChange={(e) => updateCashFlow(cf.id, "date", e.target.value)}
                        className={`w-full bg-slate-800/80 border rounded-lg px-1.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors ${
                          missingDate ? "border-orange-600/50" : "border-slate-600/70"
                        }`}
                      />
                      <input
                        type="text"
                        value={cf.label}
                        onChange={(e) => updateCashFlow(cf.id, "label", e.target.value)}
                        placeholder="Label"
                        className="w-full bg-slate-800/80 border border-slate-600/70 rounded-lg px-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                      <div className="relative">
                        {currSymbol && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                            {currSymbol}
                          </span>
                        )}
                        <input
                          type="number"
                          value={cf.amount}
                          onChange={(e) => updateCashFlow(cf.id, "amount", e.target.value)}
                          placeholder="−250000"
                          className={`w-full bg-slate-800/80 border rounded-lg py-1.5 pr-1 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none ${
                            currSymbol ? "pl-5" : "px-2"
                          } ${missingAmt ? "border-orange-600/50" : "border-slate-600/70"}`}
                        />
                      </div>
                      {/* Up / down */}
                      <div className="flex flex-col gap-0.5 items-center">
                        <button
                          onClick={() => moveCashFlow(cf.id, -1)}
                          disabled={idx === 0}
                          className="text-slate-600 hover:text-slate-300 disabled:opacity-20 text-xs leading-none"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveCashFlow(cf.id, 1)}
                          disabled={idx === inputs.cashFlows.length - 1}
                          className="text-slate-600 hover:text-slate-300 disabled:opacity-20 text-xs leading-none"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        onClick={() => removeCashFlow(cf.id)}
                        disabled={inputs.cashFlows.length <= 1}
                        className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-20 text-center"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              {inputs.cashFlows.length < 50 && (
                <button
                  onClick={addCashFlow}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-600/30 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-colors w-full"
                >
                  + Add Cash Flow
                </button>
              )}

              {xr?.processedRows?.some((p) => p.excluded) && (
                <p className="text-xs text-orange-400/70 mt-2 italic">
                  Rows with a missing date or amount are excluded from XIRR calculation.
                </p>
              )}
            </div>

            {/* Results — 2 cols wide */}
            <div className="xl:col-span-2">
              <SectionHeader>Results</SectionHeader>

              {(xr?.validationError || xr?.xirrError) && (
                <InfoBanner variant="yellow">
                  {xr.validationError || xr.xirrError}
                </InfoBanner>
              )}

              <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 mb-4">
                <ResultRow
                  label="XIRR (Annualized)"
                  value={isFiniteNum(xr?.xirrRate) ? fmtPct(xr.xirrRate * 100) : "—"}
                  highlight={isFiniteNum(xr?.xirrRate)}
                  redValue={isFiniteNum(xr?.xirrRate) && xr.xirrRate < 0}
                />
                <ResultRow
                  label="MOIC"
                  value={isFiniteNum(xr?.moic) ? `${xr.moic.toFixed(2)}x` : "—"}
                />
                <ResultRow
                  label="Total Capital Invested"
                  value={fmtCurrency(xr?.totalNegative, currency)}
                  note={
                    !isFiniteNum(xr?.totalNegative) ? "No negative cash flows." : undefined
                  }
                />
                <ResultRow
                  label="Total Distributions"
                  value={fmtCurrency(xr?.totalPositive, currency)}
                  note={
                    !isFiniteNum(xr?.totalPositive) ? "No positive cash flows." : undefined
                  }
                />
                <ResultRow
                  label="Net Profit"
                  value={fmtCurrency(xr?.netCF, currency)}
                  redValue={isFiniteNum(xr?.netCF) && xr.netCF < 0}
                />
                <ResultRow
                  label="Holding Period"
                  value={
                    isFiniteNum(xr?.holdingYears)
                      ? `${xr.holdingYears.toFixed(1)} years`
                      : "—"
                  }
                />
              </div>

              {/* ComposedChart: bars (cash flows) + line (cumulative) */}
              {xr?.chartData && xr.chartData.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                    Cash Flows &amp; Cumulative Position
                  </p>
                  <p className="text-xs text-slate-600 mb-3">
                    Bars = individual CFs · Line = cumulative
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={xr.chartData}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#64748b", fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tickFormatter={(v) => {
                            const abs = Math.abs(v);
                            if (abs >= 1e6) return `${currSymbol}${(v / 1e6).toFixed(1)}M`;
                            if (abs >= 1e3) return `${currSymbol}${(v / 1e3).toFixed(0)}k`;
                            return `${currSymbol}${v.toFixed(0)}`;
                          }}
                          tick={{ fill: "#64748b", fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          width={50}
                        />
                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                        <Tooltip
                          formatter={(val, name) => [
                            fmtCurrency(val, currency),
                            name === "amount" ? "Cash Flow" : "Cumulative",
                          ]}
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            fontSize: "11px",
                            color: "#cbd5e1",
                          }}
                        />
                        <Bar dataKey="amount" name="amount" maxBarSize={40}>
                          {xr.chartData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.isPositive ? "#22c55e" : "#ef4444"}
                              fillOpacity={0.8}
                            />
                          ))}
                        </Bar>
                        <Line
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "#0ea5e9", strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 mt-2">
                    {[
                      { color: "#22c55e", label: "Inflow" },
                      { color: "#ef4444", label: "Outflow" },
                      { color: "#0ea5e9", label: "Cumulative" },
                    ].map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                        <span className="text-xs text-slate-400">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CalcCard>
    </>
  );
}

// ─── Calculator 5 — VC Portfolio Return Simulator ────────────────────────────

const TIER_COLORS_VC = ["#ef4444", "#f59e0b", "#0ea5e9", "#22c55e", "#8b5cf6"];

const VC_DEFAULTS = {
  fundSize: "",
  managementFeePct: "2",
  feePeriod: "10",
  carryPct: "20",
  hurdleRate: "8",
  numInvestments: "20",
  avgCheckSize: "",
  reserveRatio: "40",
  tiers: [
    { id: 1, label: "Total Loss",          multiple: 0,  pct: "30" },
    { id: 2, label: "Returned Capital",    multiple: 1,  pct: "25" },
    { id: 3, label: "Moderate Return (3x)", multiple: 3, pct: "25" },
    { id: 4, label: "Strong Return (10x)", multiple: 10, pct: "15" },
    { id: 5, label: "Home Run (30x)",      multiple: 30, pct: "5"  },
  ],
};

function VCSimulator({ currency }) {
  const [inputs, setInputs] = useState(VC_DEFAULTS);
  const [copyFn, CopyModalNode] = useCopyToClipboard();

  const setField = useCallback(
    (field) => (val) => setInputs((prev) => ({ ...prev, [field]: val })),
    []
  );

  const updateTier = useCallback((id, val) => {
    setInputs((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.id === id ? { ...t, pct: val } : t)),
    }));
  }, []);

  const results = useMemo(() => {
    try {
      const fundSize = parseVal(inputs.fundSize);
      const mgmtFeePct = parseVal(inputs.managementFeePct);
      const feePeriod = parseVal(inputs.feePeriod);
      const carryPct = parseVal(inputs.carryPct);
      const hurdleRateRaw = inputs.hurdleRate === "" ? 0 : parseVal(inputs.hurdleRate);
      const hurdleRate = isFiniteNum(hurdleRateRaw) ? hurdleRateRaw : 0;
      const numInv = parseVal(inputs.numInvestments);
      const avgCheck = parseVal(inputs.avgCheckSize);
      const reserveRatio = parseVal(inputs.reserveRatio);

      const tierPcts = inputs.tiers.map((t) => ({
        ...t,
        pctNum: parseVal(t.pct),
      }));
      const tierSum = tierPcts.reduce(
        (s, t) => s + (isFiniteNum(t.pctNum) ? t.pctNum : 0),
        0
      );
      const tierSumValid = Math.abs(tierSum - 100) < 0.01;

      // Management fees
      const totalMgmtFees =
        isFiniteNum(fundSize) && isFiniteNum(mgmtFeePct) && isFiniteNum(feePeriod)
          ? fundSize * (mgmtFeePct / 100) * feePeriod
          : null;

      const investableCapital = isFiniteNum(fundSize)
        ? isFiniteNum(totalMgmtFees)
          ? fundSize - totalMgmtFees
          : fundSize
        : null;

      const feesExceedFund =
        isFiniteNum(investableCapital) && investableCapital <= 0;

      if (feesExceedFund) {
        return {
          tierSum,
          tierSumValid,
          feesExceedFund: true,
          fundSize,
          totalMgmtFees,
          investableCapital,
        };
      }

      // Per-tier calculations
      const tierReturns = tierPcts.map((t) => {
        const capitalDeployed =
          isFiniteNum(investableCapital) && isFiniteNum(t.pctNum)
            ? investableCapital * (t.pctNum / 100)
            : null;
        const grossReturn = isFiniteNum(capitalDeployed)
          ? capitalDeployed * t.multiple
          : null;
        return { ...t, capitalDeployed, grossReturn };
      });

      const totalGrossReturn = tierReturns.every((t) => isFiniteNum(t.grossReturn))
        ? tierReturns.reduce((s, t) => s + t.grossReturn, 0)
        : null;

      const grossMOIC =
        isFiniteNum(totalGrossReturn) &&
        isFiniteNum(investableCapital) &&
        investableCapital > 0
          ? totalGrossReturn / investableCapital
          : null;

      const totalGrossProfit =
        isFiniteNum(totalGrossReturn) && isFiniteNum(investableCapital)
          ? totalGrossReturn - investableCapital
          : null;

      // Hurdle amount (compound)
      const hurdleAmount =
        isFiniteNum(fundSize) && isFiniteNum(feePeriod)
          ? hurdleRate > 0
            ? fundSize * Math.pow(1 + hurdleRate / 100, feePeriod)
            : fundSize
          : null;

      // Carry
      const carryBase =
        isFiniteNum(totalGrossReturn) && isFiniteNum(hurdleAmount)
          ? Math.max(0, totalGrossReturn - hurdleAmount)
          : null;

      const gpCarry =
        isFiniteNum(carryBase) && isFiniteNum(carryPct)
          ? carryBase * (carryPct / 100)
          : null;

      const netLPProceeds =
        isFiniteNum(totalGrossReturn) && isFiniteNum(gpCarry)
          ? totalGrossReturn - gpCarry
          : null;

      const netLPMOIC =
        isFiniteNum(netLPProceeds) && isFiniteNum(fundSize) && fundSize > 0
          ? netLPProceeds / fundSize
          : null;

      // Net LP IRR — lump-sum approximation
      const netLPIRR =
        isFiniteNum(netLPMOIC) &&
        netLPMOIC > 0 &&
        isFiniteNum(feePeriod) &&
        feePeriod > 0
          ? Math.pow(netLPMOIC, 1 / feePeriod) - 1
          : null;

      const dpi = netLPMOIC;

      // "Return the Fund" multiple needed from Tier 5 home-run companies
      const tier5 = tierPcts.find((t) => t.id === 5);
      const returnFundThreshold =
        isFiniteNum(fundSize) &&
        isFiniteNum(investableCapital) &&
        isFiniteNum(tier5?.pctNum) &&
        tier5.pctNum > 0
          ? fundSize / (investableCapital * (tier5.pctNum / 100))
          : null;

      // Deployment check
      let deploymentNote = null;
      if (
        isFiniteNum(numInv) &&
        isFiniteNum(avgCheck) &&
        isFiniteNum(investableCapital) &&
        isFiniteNum(reserveRatio)
      ) {
        const totalInitial = numInv * avgCheck;
        const availableForInitial = investableCapital * (1 - reserveRatio / 100);
        if (Math.abs(totalInitial - availableForInitial) > 1) {
          deploymentNote = { totalInitial, availableForInitial };
        }
      }

      // Chart: gross returns by tier
      const tierChartData = tierReturns.map((t) => ({
        name: t.label,
        capitalDeployed: isFiniteNum(t.capitalDeployed) ? t.capitalDeployed : 0,
        grossReturn: isFiniteNum(t.grossReturn) ? t.grossReturn : 0,
        multiple: t.multiple,
      }));

      // Donut chart data
      const lpReturnOfCap =
        isFiniteNum(fundSize) && isFiniteNum(netLPProceeds)
          ? Math.min(fundSize, Math.max(0, netLPProceeds))
          : null;
      const lpProfit =
        isFiniteNum(netLPProceeds) && isFiniteNum(fundSize)
          ? Math.max(0, netLPProceeds - fundSize)
          : null;

      const donutData = [
        isFiniteNum(lpReturnOfCap) && lpReturnOfCap > 0
          ? { name: "LP Return of Capital", value: Math.round(lpReturnOfCap), color: "#3b82f6" }
          : null,
        isFiniteNum(lpProfit) && lpProfit > 0
          ? { name: "LP Profit", value: Math.round(lpProfit), color: "#22c55e" }
          : null,
        isFiniteNum(gpCarry) && gpCarry > 0
          ? { name: "GP Carry", value: Math.round(gpCarry), color: "#f59e0b" }
          : null,
      ].filter(Boolean);

      // Power law: Tier 5 share of total returns
      const tier5Return = tierReturns.find((t) => t.id === 5);
      const powerLawPct =
        isFiniteNum(tier5Return?.grossReturn) &&
        isFiniteNum(totalGrossReturn) &&
        totalGrossReturn > 0
          ? (tier5Return.grossReturn / totalGrossReturn) * 100
          : null;

      return {
        fundSize,
        investableCapital,
        totalMgmtFees,
        totalGrossReturn,
        grossMOIC,
        totalGrossProfit,
        hurdleAmount,
        gpCarry,
        netLPProceeds,
        netLPMOIC,
        netLPIRR,
        dpi,
        returnFundThreshold,
        tierReturns,
        tierChartData,
        donutData,
        tierSum,
        tierSumValid,
        feesExceedFund: false,
        deploymentNote,
        powerLawPct,
        tier5Pct: tier5?.pctNum,
      };
    } catch {
      return { error: true };
    }
  }, [inputs]);

  const handleReset = useCallback(() => setInputs(VC_DEFAULTS), []);

  const handleCopy = useCallback(() => {
    const r = results;
    const text = [
      "VC Portfolio Return Simulator",
      "==============================",
      `Fund Size:             ${fmtCurrency(r.fundSize, currency)}`,
      `Total Mgmt Fees:       ${fmtCurrency(r.totalMgmtFees, currency)}`,
      `Investable Capital:    ${fmtCurrency(r.investableCapital, currency)}`,
      `Total Gross Return:    ${fmtCurrency(r.totalGrossReturn, currency)}`,
      `Gross MOIC:            ${isFiniteNum(r.grossMOIC) ? r.grossMOIC.toFixed(2) + "x" : "—"}`,
      `GP Carry:              ${fmtCurrency(r.gpCarry, currency)}`,
      `Net LP Proceeds:       ${fmtCurrency(r.netLPProceeds, currency)}`,
      `Net LP MOIC:           ${isFiniteNum(r.netLPMOIC) ? r.netLPMOIC.toFixed(2) + "x" : "—"}`,
      `Est. Net LP IRR:       ${isFiniteNum(r.netLPIRR) ? fmtPct(r.netLPIRR * 100) : "—"}`,
      `DPI:                   ${isFiniteNum(r.dpi) ? r.dpi.toFixed(2) + "x" : "—"}`,
      `Return-Fund Threshold: ${isFiniteNum(r.returnFundThreshold) ? r.returnFundThreshold.toFixed(1) + "x needed from Tier 5" : "—"}`,
    ].join("\n");
    copyFn(text);
  }, [results, currency, copyFn]);

  const r = results;
  const currSymbol = CURRENCY_META[currency]?.symbol || "$";

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="VC Portfolio Return Simulator"
        description="Model your fund's expected return distribution across a portfolio of investments. Understand the power law and what it takes to return your fund."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Inputs ── */}
          <div>
            <SectionHeader>Fund Parameters</SectionHeader>
            <div className="grid grid-cols-2 gap-x-3">
              <InputField
                label="Fund Size"
                value={inputs.fundSize}
                onChange={setField("fundSize")}
                placeholder="e.g. 100000000"
                prefix={currSymbol}
              />
              <InputField
                label="Management Fee %"
                value={inputs.managementFeePct}
                onChange={setField("managementFeePct")}
                placeholder="2"
                suffix="%"
              />
              <InputField
                label="Fee Period"
                value={inputs.feePeriod}
                onChange={setField("feePeriod")}
                placeholder="10"
                suffix="yrs"
              />
              <InputField
                label="Carry %"
                value={inputs.carryPct}
                onChange={setField("carryPct")}
                placeholder="20"
                suffix="%"
              />
              <InputField
                label="Hurdle Rate %"
                value={inputs.hurdleRate}
                onChange={setField("hurdleRate")}
                placeholder="8 (blank = 0%)"
                suffix="%"
              />
              <InputField
                label="Reserve Ratio %"
                value={inputs.reserveRatio}
                onChange={setField("reserveRatio")}
                placeholder="40"
                suffix="%"
              />
              <InputField
                label="# of Investments"
                value={inputs.numInvestments}
                onChange={setField("numInvestments")}
                placeholder="20"
              />
              <InputField
                label="Avg. Check Size"
                value={inputs.avgCheckSize}
                onChange={setField("avgCheckSize")}
                placeholder="e.g. 2500000"
                prefix={currSymbol}
              />
            </div>

            {r.deploymentNote && (
              <InfoBanner variant="blue">
                Initial checks would deploy{" "}
                {fmtCurrency(r.deploymentNote.totalInitial, currency)} vs.{" "}
                {fmtCurrency(r.deploymentNote.availableForInitial, currency)} available
                for initial investments (after reserves).
              </InfoBanner>
            )}

            {/* Return tier table */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <SectionHeader>Return Tiers</SectionHeader>
                <span
                  className={`text-xs pb-3 font-semibold tabular-nums ${
                    r.tierSumValid ? "text-emerald-400" : "text-yellow-400"
                  }`}
                >
                  Sum: {isFiniteNum(r.tierSum) ? r.tierSum.toFixed(1) : "0"}%
                </span>
              </div>

              {!r.tierSumValid && (
                <InfoBanner variant="yellow">
                  Tier percentages must sum to 100% — currently {r.tierSum?.toFixed(1) ?? "0"}%.
                  Calculations will proceed using these weights but results may be inconsistent.
                </InfoBanner>
              )}

              <div className="space-y-1.5">
                {inputs.tiers.map((tier, idx) => (
                  <div key={tier.id} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: TIER_COLORS_VC[idx] }}
                    />
                    <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">
                      {tier.label}
                    </span>
                    <span className="text-xs text-slate-500 w-8 text-right shrink-0 tabular-nums">
                      {tier.multiple}x
                    </span>
                    <div className="relative w-20 shrink-0">
                      <input
                        type="number"
                        value={tier.pct}
                        onChange={(e) => updateTier(tier.id, e.target.value)}
                        className="w-full bg-slate-800/80 border border-slate-600/70 rounded-lg px-2 py-1.5 text-white text-xs text-right pr-6 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Results ── */}
          <div>
            <SectionHeader>Fund Returns</SectionHeader>

            {r.feesExceedFund && (
              <InfoBanner variant="yellow">
                Management fees ({fmtCurrency(r.totalMgmtFees, currency)}) exceed fund size (
                {fmtCurrency(r.fundSize, currency)}). Check your inputs.
              </InfoBanner>
            )}

            {!r.feesExceedFund && (
              <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30">
                <ResultRow
                  label="Fund Size"
                  value={fmtCurrency(r.fundSize, currency)}
                  note={!isFiniteNum(r.fundSize) ? "Enter Fund Size above." : undefined}
                />
                <ResultRow
                  label="Total Management Fees"
                  value={fmtCurrency(r.totalMgmtFees, currency)}
                  note={
                    !isFiniteNum(r.totalMgmtFees)
                      ? "Enter Fund Size, Fee %, and Fee Period."
                      : undefined
                  }
                />
                <ResultRow
                  label="Investable Capital"
                  value={fmtCurrency(r.investableCapital, currency)}
                  note={
                    !isFiniteNum(r.investableCapital) ? "Enter Fund Size to calculate." : undefined
                  }
                  highlight={isFiniteNum(r.investableCapital)}
                />
                <ResultRow
                  label="Total Gross Return"
                  value={fmtCurrency(r.totalGrossReturn, currency)}
                  note={
                    !isFiniteNum(r.totalGrossReturn)
                      ? "Enter Fund Size and tier percentages."
                      : undefined
                  }
                />
                <ResultRow
                  label="Gross MOIC"
                  value={isFiniteNum(r.grossMOIC) ? `${r.grossMOIC.toFixed(2)}x` : "—"}
                />
                <ResultRow
                  label="GP Carry"
                  value={fmtCurrency(r.gpCarry, currency)}
                  note={
                    !isFiniteNum(r.gpCarry)
                      ? "Enter Fund Size, Carry %, and Hurdle Rate."
                      : undefined
                  }
                />
                <ResultRow
                  label="Net LP Proceeds"
                  value={fmtCurrency(r.netLPProceeds, currency)}
                  highlight={isFiniteNum(r.netLPProceeds)}
                />
                <ResultRow
                  label="Net LP MOIC"
                  value={isFiniteNum(r.netLPMOIC) ? `${r.netLPMOIC.toFixed(2)}x` : "—"}
                  redValue={isFiniteNum(r.netLPMOIC) && r.netLPMOIC < 1}
                />
                <ResultRow
                  label="Est. Net LP IRR"
                  value={isFiniteNum(r.netLPIRR) ? fmtPct(r.netLPIRR * 100) : "—"}
                  redValue={isFiniteNum(r.netLPIRR) && r.netLPIRR < 0}
                />
                <ResultRow label="DPI" value={isFiniteNum(r.dpi) ? `${r.dpi.toFixed(2)}x` : "—"} />
                <ResultRow
                  label="RVPI"
                  value="—"
                  note="Simulator models full exit — RVPI not applicable."
                />
                <ResultRow
                  label={`"Return the Fund" Threshold (Tier 5)`}
                  value={
                    isFiniteNum(r.returnFundThreshold)
                      ? `${r.returnFundThreshold.toFixed(1)}x`
                      : "—"
                  }
                  note={
                    !isFiniteNum(r.returnFundThreshold)
                      ? "Requires Fund Size and Tier 5 % to calculate."
                      : undefined
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Full-width charts ── */}
        {!r.feesExceedFund && isFiniteNum(r.totalGrossReturn) && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tier returns bar chart (2/3 width) */}
            <div className="lg:col-span-2 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Gross Returns by Tier
              </p>
              <p className="text-xs text-slate-600 mb-3">
                Capital deployed (dark) vs. gross return generated (color) per tier
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={r.tierChartData}
                    margin={{ top: 4, right: 8, left: 0, bottom: 44 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      angle={-28}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tickFormatter={(v) => {
                        if (Math.abs(v) >= 1e6)
                          return `${currSymbol}${(v / 1e6).toFixed(0)}M`;
                        if (Math.abs(v) >= 1e3)
                          return `${currSymbol}${(v / 1e3).toFixed(0)}k`;
                        return `${currSymbol}${v}`;
                      }}
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip
                      formatter={(val, name) => [
                        fmtCurrency(val, currency),
                        name === "capitalDeployed" ? "Capital Deployed" : "Gross Return",
                      ]}
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: "#cbd5e1",
                      }}
                    />
                    <Bar
                      dataKey="capitalDeployed"
                      fill="#1e3a5f"
                      radius={[3, 3, 0, 0]}
                      name="capitalDeployed"
                    />
                    <Bar dataKey="grossReturn" radius={[3, 3, 0, 0]} name="grossReturn">
                      {(r.tierChartData || []).map((_, i) => (
                        <Cell key={i} fill={TIER_COLORS_VC[i]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {(r.tierChartData || []).map((t, i) => (
                  <div key={t.name} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: TIER_COLORS_VC[i] }}
                    />
                    <span className="text-xs text-slate-400">
                      {t.name.split(" ")[0]} ({t.multiple}x)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column: power law callout + donut */}
            <div className="space-y-4">
              {/* Power law stat card */}
              {isFiniteNum(r.powerLawPct) && isFiniteNum(r.tier5Pct) && (
                <div className="bg-gradient-to-br from-violet-900/30 to-cyan-900/20 border border-violet-500/20 rounded-xl p-5 text-center">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Power Law
                  </p>
                  <p className="text-4xl font-black text-white leading-none">
                    {r.tier5Pct?.toFixed(0)}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">of your portfolio</p>
                  <p className="text-xs text-slate-500 my-2 font-light">generates</p>
                  <p className="text-4xl font-black text-cyan-400 leading-none">
                    {r.powerLawPct.toFixed(0)}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">of total gross returns</p>
                </div>
              )}

              {/* Return split donut */}
              {r.donutData && r.donutData.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                    Return Split
                  </p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={r.donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={58}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {r.donutData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val) => [fmtCurrency(val, currency), ""]}
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            fontSize: "11px",
                            color: "#cbd5e1",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {r.donutData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ background: d.color }}
                          />
                          <span className="text-xs text-slate-400">{d.name}</span>
                        </div>
                        <span className="text-xs text-slate-300 font-medium tabular-nums">
                          {fmtCurrency(d.value, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CalcCard>
    </>
  );
}

// ─── Calculator Registry ──────────────────────────────────────────────────────

// ─── Calculator 6 — Waterfall / Exit Distribution ────────────────────────────

const WF_PARTICIPATION_OPTS = ["None", "Participating (Uncapped)", "Participating (Capped)"];
const WF_BAR_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#06b6d4",
  "#10b981","#ef4444","#f97316","#84cc16","#6366f1",
  "#14b8a6","#f43f5e","#a855f7","#22c55e","#0ea5e9",
];

const mkInv = (id, seniority) => ({
  id, name: "", amountInvested: "", prefMultiple: "1",
  participation: "None", capMultiple: "", seniority: String(seniority), ownershipPct: "",
});
const mkCS = (id) => ({ id, name: "", ownershipPct: "" });

const WF_DEFAULTS = {
  exitProceeds: "",
  investors: [mkInv(1, 1), mkInv(2, 2)],
  common: [mkCS(1), mkCS(2)],
};

function runWaterfall(exitProceedsRaw, investors, common) {
  const exit = parseVal(exitProceedsRaw);
  if (!isFiniteNum(exit)) return null;

  const invs = investors
    .map((inv) => ({
      ...inv,
      amountNum: parseVal(inv.amountInvested),
      prefMult: Math.max(0, parseVal(inv.prefMultiple) ?? 1),
      capMult: parseVal(inv.capMultiple),
      seniorityNum: parseVal(inv.seniority) ?? 999,
      ownPct: parseVal(inv.ownershipPct),
    }))
    .filter((inv) => isFiniteNum(inv.amountNum) && inv.amountNum > 0);

  if (invs.length === 0) return { exit, invs: [], csParsed: [], noInvestors: true };

  const sorted = [...invs].sort((a, b) => a.seniorityNum - b.seniorityNum);
  let remaining = exit;

  // Step 1: Liquidation preferences in seniority order
  const prefPaid = {};
  const prefAmt = {};
  for (const inv of sorted) {
    const pa = inv.amountNum * inv.prefMult;
    prefAmt[inv.id] = pa;
    const paid = Math.min(pa, Math.max(0, remaining));
    prefPaid[inv.id] = paid;
    remaining = Math.max(0, remaining - paid);
  }

  const insufficientPrefs = remaining === 0 &&
    sorted.some((inv) => prefPaid[inv.id] < prefAmt[inv.id]);

  // Step 2: Participating preferred — iterative cap resolution
  const csParsed = common
    .map((cs) => ({ ...cs, ownNum: parseVal(cs.ownershipPct) }))
    .filter((cs) => isFiniteNum(cs.ownNum) && cs.ownNum > 0);

  const totalCSOwn = csParsed.reduce((s, c) => s + c.ownNum, 0);
  const partAmt = {};
  invs.forEach((inv) => { partAmt[inv.id] = 0; });

  let pool = remaining;
  let activeParts = invs.filter(
    (inv) => inv.participation !== "None" && isFiniteNum(inv.ownPct) && inv.ownPct > 0
  );

  for (let iter = 0; iter < 20 && pool > 1e-6 && activeParts.length > 0; iter++) {
    const activePartOwn = activeParts.reduce((s, p) => s + p.ownPct, 0);
    const totalOwn = activePartOwn + totalCSOwn;
    if (totalOwn <= 0) break;

    let anyCapped = false;
    let consumed = 0;
    const nextActive = [];

    for (const p of activeParts) {
      const fraction = p.ownPct / totalOwn;
      const tentShare = pool * fraction;
      const currentTotal = (prefPaid[p.id] ?? 0) + partAmt[p.id];

      if (p.participation === "Participating (Capped)" && isFiniteNum(p.capMult) && p.capMult > 0) {
        const cap = p.amountNum * p.capMult;
        if (currentTotal + tentShare > cap) {
          const allowed = Math.max(0, cap - currentTotal);
          partAmt[p.id] += allowed;
          consumed += allowed;
          anyCapped = true;
        } else {
          nextActive.push(p);
        }
      } else {
        nextActive.push(p);
      }
    }

    if (!anyCapped) {
      for (const p of activeParts) {
        partAmt[p.id] += pool * (p.ownPct / totalOwn);
      }
      pool = totalOwn > 0 ? pool * totalCSOwn / totalOwn : 0;
      break;
    } else {
      pool -= consumed;
      activeParts = nextActive;
    }
  }

  const commonPool = Math.max(0, pool);

  // Distribute common pool pro-rata to common shareholders
  const csAmt = {};
  csParsed.forEach((cs) => {
    csAmt[cs.id] = totalCSOwn > 0 ? commonPool * (cs.ownNum / totalCSOwn) : 0;
  });

  // As-converted comparison for non-participating preferred
  const asConverted = {};
  const totalAllOwn =
    invs.reduce((s, p) => s + (isFiniteNum(p.ownPct) ? p.ownPct : 0), 0) + totalCSOwn;

  for (const inv of invs) {
    if (inv.participation !== "None" || !isFiniteNum(inv.ownPct)) {
      asConverted[inv.id] = null;
      continue;
    }
    // Run preferences for all OTHER investors to find pool investor i would share as common
    let remForConv = exit;
    for (const other of sorted) {
      if (other.id === inv.id) continue;
      const op = other.amountNum * other.prefMult;
      remForConv = Math.max(0, remForConv - Math.min(op, remForConv));
    }
    asConverted[inv.id] = totalAllOwn > 0 ? remForConv * (inv.ownPct / totalAllOwn) : 0;
  }

  const totalPrefPaid = Object.values(prefPaid).reduce((s, v) => s + v, 0);
  const totalPartPaid = Object.values(partAmt).reduce((s, v) => s + v, 0);
  const breakeven = invs.reduce((s, inv) => s + inv.amountNum * inv.prefMult, 0);

  return {
    exit, invs, sorted, prefPaid, prefAmt, partAmt,
    csParsed, csAmt, asConverted, commonPool,
    totalPrefPaid, totalPartPaid, totalCommonPaid: commonPool,
    breakeven, insufficientPrefs,
  };
}

function WaterfallCalculator({ currency }) {
  const [inputs, setInputs] = useState(WF_DEFAULTS);
  const [copyFn, CopyModalNode] = useCopyToClipboard();

  const setField = useCallback(
    (field) => (val) => setInputs((prev) => ({ ...prev, [field]: val })), []
  );
  const addInvestor = useCallback(() => {
    setInputs((prev) => {
      if (prev.investors.length >= 15) return prev;
      return { ...prev, investors: [...prev.investors, mkInv(Date.now(), prev.investors.length + 1)] };
    });
  }, []);
  const removeInvestor = useCallback((id) => {
    setInputs((prev) => ({ ...prev, investors: prev.investors.filter((i) => i.id !== id) }));
  }, []);
  const updateInvestor = useCallback((id, field, val) => {
    setInputs((prev) => ({
      ...prev,
      investors: prev.investors.map((inv) => inv.id === id ? { ...inv, [field]: val } : inv),
    }));
  }, []);
  const addCommon = useCallback(() => {
    setInputs((prev) => ({ ...prev, common: [...prev.common, mkCS(Date.now())] }));
  }, []);
  const removeCommon = useCallback((id) => {
    setInputs((prev) => ({ ...prev, common: prev.common.filter((cs) => cs.id !== id) }));
  }, []);
  const updateCommon = useCallback((id, field, val) => {
    setInputs((prev) => ({
      ...prev,
      common: prev.common.map((cs) => cs.id === id ? { ...cs, [field]: val } : cs),
    }));
  }, []);

  const r = useMemo(
    () => runWaterfall(inputs.exitProceeds, inputs.investors, inputs.common),
    [inputs.exitProceeds, inputs.investors, inputs.common]
  );

  const commonSum = useMemo(
    () => inputs.common.reduce((s, cs) => s + (parseVal(cs.ownershipPct) ?? 0), 0),
    [inputs.common]
  );

  // Build stacked bar chart data
  const chartParties = useMemo(() => {
    if (!r || r.noInvestors) return null;
    const parties = [
      ...r.invs.map((inv, i) => ({
        name: inv.name || `Investor ${i + 1}`,
        value: (r.prefPaid[inv.id] ?? 0) + (r.partAmt[inv.id] ?? 0),
        color: WF_BAR_COLORS[i % WF_BAR_COLORS.length],
      })),
      ...r.csParsed.map((cs, i) => ({
        name: cs.name || "Common",
        value: r.csAmt[cs.id] ?? 0,
        color: WF_BAR_COLORS[(r.invs.length + i) % WF_BAR_COLORS.length],
      })),
    ].filter((p) => p.value > 0.01);
    return parties;
  }, [r]);

  const stackedBarData = useMemo(() => {
    if (!chartParties) return null;
    const row = { name: "Exit" };
    chartParties.forEach((p, i) => { row[`p${i}`] = p.value; });
    return [row];
  }, [chartParties]);

  const handleReset = useCallback(() => setInputs(WF_DEFAULTS), []);
  const handleCopy = useCallback(() => {
    if (!r) { copyFn("No results to copy."); return; }
    const lines = [
      "Waterfall / Exit Distribution",
      "==============================",
      `Exit Proceeds:             ${fmt(r.exit, "currency", currency)}`,
      `Breakeven (all prefs):     ${fmt(r.breakeven, "currency", currency)}`,
      `Total to Preferred Stack:  ${fmt(r.totalPrefPaid + r.totalPartPaid, "currency", currency)}`,
      `Total to Common:           ${fmt(r.totalCommonPaid, "currency", currency)}`,
      "",
      "Investor Distribution:",
      ...r.invs.map((inv) => {
        const total = (r.prefPaid[inv.id] ?? 0) + (r.partAmt[inv.id] ?? 0);
        return `  ${inv.name || "(unnamed)"}: ${fmt(total, "currency", currency)}`;
      }),
      "",
      "Common Shareholder Distribution:",
      ...r.csParsed.map((cs) => `  ${cs.name || "(common)"}: ${fmt(r.csAmt[cs.id], "currency", currency)}`),
    ];
    copyFn(lines.join("\n"));
  }, [r, currency, copyFn]);

  const currSymbol = CURRENCY_META[currency]?.symbol || "$";

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="Waterfall / Exit Distribution Calculator"
        description="Model exactly how exit proceeds are distributed to each investor and shareholder, accounting for liquidation preferences, participation rights, and common equity."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Left: Inputs ── */}
          <div>
            <SectionHeader>Exit Proceeds</SectionHeader>
            <InputField
              label="Total Exit Proceeds"
              value={inputs.exitProceeds}
              onChange={setField("exitProceeds")}
              placeholder="e.g. 50000000"
              prefix={currSymbol}
              tooltip="Total amount available to distribute from the exit — acquisition price, IPO net proceeds, etc."
            />

            {/* Investor Preference Stack */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <SectionHeader>Investor Preference Stack</SectionHeader>
                <span className="text-xs text-slate-600 pb-3">{inputs.investors.length}/15</span>
              </div>
              <div className="space-y-3">
                {inputs.investors.map((inv) => {
                  const showCap = inv.participation === "Participating (Capped)";
                  const capNum = parseVal(inv.capMultiple);
                  const prefNum = parseVal(inv.prefMultiple) ?? 1;
                  const capWarn = showCap && isFiniteNum(capNum) && capNum < prefNum
                    ? "Participation cap is lower than liquidation preference — cap has no practical effect."
                    : null;
                  return (
                    <div key={inv.id} className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3 space-y-2">
                      {/* Row 1: name + seniority + remove */}
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={inv.name}
                          onChange={(e) => updateInvestor(inv.id, "name", e.target.value)}
                          placeholder="Investor Name"
                          className="flex-1 bg-slate-900/60 border border-slate-600/70 rounded-lg px-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        <div className="relative w-20 shrink-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] pointer-events-none">Sen.</span>
                          <input
                            type="number"
                            value={inv.seniority}
                            onChange={(e) => updateInvestor(inv.id, "seniority", e.target.value)}
                            min="1"
                            className="w-full bg-slate-900/60 border border-slate-600/70 rounded-lg pl-8 pr-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                          />
                        </div>
                        <button
                          onClick={() => removeInvestor(inv.id)}
                          className="text-slate-600 hover:text-red-400 text-lg leading-none transition-colors shrink-0"
                        >×</button>
                      </div>
                      {/* Row 2: amount + pref multiple */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">{currSymbol}</span>
                          <input
                            type="number"
                            value={inv.amountInvested}
                            onChange={(e) => updateInvestor(inv.id, "amountInvested", e.target.value)}
                            placeholder="Amount invested"
                            className="w-full bg-slate-900/60 border border-slate-600/70 rounded-lg pl-5 pr-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={inv.prefMultiple}
                            onChange={(e) => updateInvestor(inv.id, "prefMultiple", e.target.value)}
                            placeholder="Pref. multiple"
                            className="w-full bg-slate-900/60 border border-slate-600/70 rounded-lg px-2 pr-7 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">×</span>
                        </div>
                      </div>
                      {/* Row 3: participation dropdown + ownership % */}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={inv.participation}
                          onChange={(e) => updateInvestor(inv.id, "participation", e.target.value)}
                          className="w-full bg-slate-900/60 border border-slate-600/70 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                        >
                          {WF_PARTICIPATION_OPTS.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                        <div className="relative">
                          <input
                            type="number"
                            value={inv.ownershipPct}
                            onChange={(e) => updateInvestor(inv.id, "ownershipPct", e.target.value)}
                            placeholder="Common own %"
                            className="w-full bg-slate-900/60 border border-slate-600/70 rounded-lg px-2 pr-6 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">%</span>
                        </div>
                      </div>
                      {/* Conditional cap field */}
                      {showCap && (
                        <>
                          <div className="relative">
                            <input
                              type="number"
                              value={inv.capMultiple}
                              onChange={(e) => updateInvestor(inv.id, "capMultiple", e.target.value)}
                              placeholder="Participation cap (e.g. 3×)"
                              className="w-full bg-slate-900/60 border border-slate-600/70 rounded-lg px-2 pr-7 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">×</span>
                          </div>
                          {capWarn && <p className="text-xs text-yellow-400">{capWarn}</p>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {inputs.investors.length < 15 && (
                <button
                  onClick={addInvestor}
                  className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-600/30 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-colors w-full"
                >
                  + Add Investor
                </button>
              )}
            </div>

            {/* Common Shareholders */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <SectionHeader>Common Shareholders</SectionHeader>
                <span className={`text-xs pb-3 font-semibold tabular-nums ${Math.abs(commonSum - 100) < 0.01 || commonSum === 0 ? "text-slate-600" : "text-yellow-400"}`}>
                  {commonSum.toFixed(1)}%
                </span>
              </div>
              {commonSum > 0 && Math.abs(commonSum - 100) > 0.01 && (
                <InfoBanner variant="yellow">
                  Common ownership percentages sum to {commonSum.toFixed(1)}% — normalized to 100% for distribution.
                </InfoBanner>
              )}
              <div className="space-y-2">
                {inputs.common.map((cs) => (
                  <div key={cs.id} className="flex gap-2">
                    <input
                      type="text"
                      value={cs.name}
                      onChange={(e) => updateCommon(cs.id, "name", e.target.value)}
                      placeholder="Name (e.g. Founders)"
                      className="flex-1 bg-slate-800/60 border border-slate-600/70 rounded-lg px-2 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <div className="relative w-24 shrink-0">
                      <input
                        type="number"
                        value={cs.ownershipPct}
                        onChange={(e) => updateCommon(cs.id, "ownershipPct", e.target.value)}
                        placeholder="Own %"
                        className="w-full bg-slate-800/60 border border-slate-600/70 rounded-lg px-2 pr-6 py-1.5 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">%</span>
                    </div>
                    <button
                      onClick={() => removeCommon(cs.id)}
                      className="text-slate-600 hover:text-red-400 text-lg leading-none transition-colors shrink-0"
                    >×</button>
                  </div>
                ))}
              </div>
              <button
                onClick={addCommon}
                className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-600/30 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-colors w-full"
              >
                + Add Common Shareholder
              </button>
            </div>
          </div>

          {/* ── Right: Results ── */}
          <div>
            <SectionHeader>Distribution Results</SectionHeader>
            {!r && (
              <InfoBanner variant="slate">
                Enter Exit Proceeds and at least one investor with an Amount Invested to calculate the waterfall.
              </InfoBanner>
            )}
            {r?.noInvestors && (
              <InfoBanner variant="slate">
                Add at least one investor with an Amount Invested to calculate the waterfall.
              </InfoBanner>
            )}
            {r?.insufficientPrefs && (
              <InfoBanner variant="red">
                Exit proceeds are insufficient to fully cover all liquidation preferences.
                Senior investors are paid first — junior investors and common shareholders may receive nothing.
              </InfoBanner>
            )}

            {r && !r.noInvestors && (
              <>
                {/* Summary stats */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 mb-4">
                  <ResultRow label="Total Exit Proceeds" value={fmt(r.exit, "currency", currency)} highlight />
                  <ResultRow label="Total to Preferred Stack" value={fmt(r.totalPrefPaid + r.totalPartPaid, "currency", currency)} />
                  <ResultRow label="Total to Common" value={fmt(r.totalCommonPaid, "currency", currency)} />
                  <ResultRow
                    label="% Returned to Investors"
                    value={isFiniteNum(r.exit) && r.exit > 0
                      ? fmt(((r.totalPrefPaid + r.totalPartPaid) / r.exit) * 100, "percent")
                      : "—"}
                  />
                  <ResultRow
                    label="Breakeven Exit (full pref coverage)"
                    value={fmt(r.breakeven, "currency", currency)}
                    note="Minimum exit at which all liquidation preferences are fully covered."
                  />
                </div>

                {/* Per-stakeholder waterfall table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700/50">
                        <th className="text-left pb-2 font-medium pr-2">Name</th>
                        <th className="text-right pb-2 font-medium">Pref</th>
                        <th className="text-right pb-2 font-medium">Part.</th>
                        <th className="text-right pb-2 font-medium">Total</th>
                        <th className="text-right pb-2 font-medium">% Exit</th>
                        <th className="text-right pb-2 font-medium">As-Conv.</th>
                        <th className="text-right pb-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.invs.map((inv) => {
                        const total = (r.prefPaid[inv.id] ?? 0) + (r.partAmt[inv.id] ?? 0);
                        const pctExit = r.exit > 0 ? (total / r.exit) * 100 : null;
                        const ac = r.asConverted[inv.id];
                        const acDiff = isFiniteNum(ac) ? ac - total : null;
                        const action = inv.participation !== "None" ? "—"
                          : isFiniteNum(acDiff) ? (acDiff > 1 ? "Convert" : "Preference") : "—";
                        const actionColor = action === "Convert" ? "text-green-400"
                          : action === "Preference" ? "text-cyan-400" : "text-slate-600";
                        return (
                          <tr key={inv.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                            <td className="py-2 text-slate-300 truncate max-w-[72px] pr-2">
                              {inv.name || "(unnamed)"}
                            </td>
                            <td className="py-2 text-right text-slate-400 tabular-nums">
                              {fmt(r.prefPaid[inv.id], "currency", currency)}
                            </td>
                            <td className="py-2 text-right text-slate-400 tabular-nums">
                              {r.partAmt[inv.id] > 0.01 ? fmt(r.partAmt[inv.id], "currency", currency) : "—"}
                            </td>
                            <td className="py-2 text-right text-white font-semibold tabular-nums">
                              {fmt(total, "currency", currency)}
                            </td>
                            <td className="py-2 text-right text-slate-400 tabular-nums">
                              {fmt(pctExit, "percent")}
                            </td>
                            <td className="py-2 text-right text-slate-400 tabular-nums">
                              {isFiniteNum(ac) ? fmt(ac, "currency", currency) : "—"}
                            </td>
                            <td className={`py-2 text-right font-medium ${actionColor}`}>
                              {action}
                              {isFiniteNum(acDiff) && Math.abs(acDiff) > 1 && inv.participation === "None" && (
                                <span className="block text-[10px] text-slate-500">
                                  {acDiff > 0 ? "+" : ""}{fmt(acDiff, "currency", currency)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {r.csParsed.map((cs) => {
                        const amt = r.csAmt[cs.id] ?? 0;
                        const pctExit = r.exit > 0 ? (amt / r.exit) * 100 : null;
                        return (
                          <tr key={cs.id} className="border-b border-slate-800/40 hover:bg-slate-800/20 opacity-75">
                            <td className="py-2 text-slate-400 truncate max-w-[72px] pr-2">
                              {cs.name || "(common)"}
                            </td>
                            <td className="py-2 text-right text-slate-600">—</td>
                            <td className="py-2 text-right text-slate-600">—</td>
                            <td className="py-2 text-right text-slate-300 font-semibold tabular-nums">
                              {fmt(amt, "currency", currency)}
                            </td>
                            <td className="py-2 text-right text-slate-500 tabular-nums">
                              {fmt(pctExit, "percent")}
                            </td>
                            <td className="py-2 text-right text-slate-600">—</td>
                            <td className="py-2 text-right text-slate-600">—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Full-width stacked bar chart ── */}
        {r && !r.noInvestors && chartParties && chartParties.length > 0 && stackedBarData && (
          <div className="mt-8 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Exit Proceeds Distribution
            </p>
            <p className="text-xs text-slate-600 mb-4">
              How {fmt(r.exit, "currency", currency)} is divided across all stakeholders
            </p>
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={stackedBarData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    type="number"
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 1e6) return `${currSymbol}${(v / 1e6).toFixed(0)}M`;
                      if (Math.abs(v) >= 1e3) return `${currSymbol}${(v / 1e3).toFixed(0)}k`;
                      return `${currSymbol}${v}`;
                    }}
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    formatter={(val, name) => {
                      const i = parseInt(name.replace("p", ""), 10);
                      return [fmt(val, "currency", currency), chartParties[i]?.name || name];
                    }}
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px", color: "#cbd5e1" }}
                  />
                  {chartParties.map((party, i) => (
                    <Bar
                      key={i}
                      dataKey={`p${i}`}
                      stackId="s"
                      fill={party.color}
                      fillOpacity={0.9}
                      radius={
                        i === 0 ? [4, 0, 0, 4]
                          : i === chartParties.length - 1 ? [0, 4, 4, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
              {chartParties.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
                  <span className="text-xs text-slate-400">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CalcCard>
    </>
  );
}

// ─── Calculator 7 — Runway & Burn Rate ───────────────────────────────────────

const RUNWAY_DEFAULTS = {
  cashBalance: "",
  grossBurn: "",
  monthlyRevenue: "0",
  revenueGrowth: "",
  burnGrowth: "",
  targetReserve: "",
};

function simulateRunway(params) {
  const { cashBalance, grossBurn, monthlyRevenue = 0, revenueGrowth = 0, burnGrowth = 0, targetReserve = 0 } = params;
  if (!isFiniteNum(cashBalance) || cashBalance <= 0) return null;
  if (!isFiniteNum(grossBurn) || grossBurn <= 0) return null;

  const rev0 = isFiniteNum(monthlyRevenue) ? Math.max(0, monthlyRevenue) : 0;
  const revGr = isFiniteNum(revenueGrowth) ? revenueGrowth / 100 : 0;
  const burnGr = isFiniteNum(burnGrowth) ? burnGrowth / 100 : 0;
  const reserve = isFiniteNum(targetReserve) ? Math.max(0, targetReserve) : 0;
  const isPositive = grossBurn <= rev0;

  const MAX = 60;
  const monthlyData = [];
  let cash = cashBalance;
  let rev = rev0;
  let burn = grossBurn;
  let runwayMonth = null;
  let cashOutMonth = null;
  let breakevenMonth = null;

  monthlyData.push({ month: 0, cash, rev, burn, net: burn - rev });

  for (let m = 1; m <= MAX; m++) {
    rev = rev * (1 + revGr);
    burn = burn * (1 + burnGr);
    const netBurn = burn - rev;
    cash = Math.max(0, cash - netBurn);
    monthlyData.push({ month: m, cash, rev, burn, net: netBurn });

    if (runwayMonth === null && cash <= reserve) runwayMonth = m;
    if (cashOutMonth === null && cash <= 0) cashOutMonth = m;
    if (breakevenMonth === null && rev >= burn) breakevenMonth = m;
    if (cashOutMonth !== null) break;
  }

  const finalCash = monthlyData[monthlyData.length - 1].cash;

  return {
    monthlyData,
    runwayMonth: runwayMonth ?? (finalCash > reserve ? ">60" : null),
    cashOutMonth: cashOutMonth ?? (finalCash > 0 ? ">60" : null),
    breakevenMonth,
    initialNetBurn: grossBurn - rev0,
    isPositive,
  };
}

function RunwayCalculator({ currency }) {
  const [inputs, setInputs] = useState(RUNWAY_DEFAULTS);
  const [copyFn, CopyModalNode] = useCopyToClipboard();
  const setField = useCallback(
    (field) => (val) => setInputs((prev) => ({ ...prev, [field]: val })), []
  );

  const parsed = useMemo(() => ({
    cashBalance: parseVal(inputs.cashBalance),
    grossBurn: parseVal(inputs.grossBurn),
    monthlyRevenue: parseVal(inputs.monthlyRevenue) ?? 0,
    revenueGrowth: parseVal(inputs.revenueGrowth) ?? 0,
    burnGrowth: parseVal(inputs.burnGrowth) ?? 0,
    targetReserve: parseVal(inputs.targetReserve) ?? 0,
  }), [inputs]);

  const netBurn = useMemo(() => (
    isFiniteNum(parsed.grossBurn) && isFiniteNum(parsed.monthlyRevenue)
      ? parsed.grossBurn - parsed.monthlyRevenue
      : null
  ), [parsed.grossBurn, parsed.monthlyRevenue]);

  const r = useMemo(() => { try { return simulateRunway(parsed); } catch { return null; } }, [parsed]);

  const scenarios = useMemo(() => {
    if (!isFiniteNum(parsed.cashBalance) || !isFiniteNum(parsed.grossBurn)) return null;
    return [
      { label: "Current Trajectory", color: "#0ea5e9", result: simulateRunway(parsed) },
      { label: "−20% Burn", color: "#22c55e", result: simulateRunway({ ...parsed, grossBurn: parsed.grossBurn * 0.8 }) },
      { label: "+20% Revenue", color: "#8b5cf6", result: simulateRunway({ ...parsed, monthlyRevenue: parsed.monthlyRevenue * 1.2 }) },
    ];
  }, [parsed]);

  const cashOutDate = useMemo(() => {
    if (!r || typeof r.runwayMonth !== "number") return null;
    const d = new Date();
    d.setMonth(d.getMonth() + r.runwayMonth);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [r]);

  const handleReset = useCallback(() => setInputs(RUNWAY_DEFAULTS), []);
  const handleCopy = useCallback(() => {
    const lines = [
      "Runway & Burn Rate Calculator",
      "==============================",
      `Cash Balance:      ${fmt(parsed.cashBalance, "currency", currency)}`,
      `Gross Burn/mo:     ${fmt(parsed.grossBurn, "currency", currency)}`,
      `Monthly Revenue:   ${fmt(parsed.monthlyRevenue, "currency", currency)}`,
      `Net Burn/mo:       ${fmt(netBurn, "currency", currency)}`,
      `Target Reserve:    ${fmt(parsed.targetReserve, "currency", currency)}`,
      "",
      `Runway:            ${r?.runwayMonth ?? "—"} months`,
      `Estimated Cash-Out: ${cashOutDate ?? "—"}`,
      `Breakeven Month:   ${r?.breakevenMonth ? `Month ${r.breakevenMonth}` : "—"}`,
    ];
    copyFn(lines.join("\n"));
  }, [parsed, netBurn, r, cashOutDate, currency, copyFn]);

  const currSymbol = CURRENCY_META[currency]?.symbol || "$";
  const targetReserve = parsed.targetReserve;

  const fmtRunway = (res) => {
    if (!res) return "—";
    if (res.isPositive) return "∞";
    const m = res.runwayMonth;
    return typeof m === "number" ? String(m) : m === ">60" ? ">60" : "—";
  };

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="Runway & Burn Rate Calculator"
        description="Know exactly how long your cash will last and what changes to burn rate or revenue growth would buy you more time."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <div>
            <SectionHeader>Inputs</SectionHeader>
            {!isFiniteNum(parsed.cashBalance) && (
              <InfoBanner variant="slate">
                Enter your current cash balance to calculate runway.
              </InfoBanner>
            )}
            {r?.isPositive && isFiniteNum(parsed.cashBalance) && (
              <InfoBanner variant="green">
                Your business is cash flow positive — net burn is negative. Revenue exceeds gross burn; your cash position is growing.
              </InfoBanner>
            )}
            <InputField
              label="Current Cash Balance"
              value={inputs.cashBalance}
              onChange={setField("cashBalance")}
              placeholder="e.g. 3000000"
              prefix={currSymbol}
              tooltip="Total cash and cash equivalents on hand today. This is your starting point for the runway calculation."
            />
            <InputField
              label="Monthly Gross Burn"
              value={inputs.grossBurn}
              onChange={setField("grossBurn")}
              placeholder="e.g. 250000"
              prefix={currSymbol}
              tooltip="Total monthly operating spend before revenue — salaries, rent, software, and all outflows. Typical early-stage startups: $100k–$500k/mo."
            />
            <InputField
              label="Monthly Revenue"
              value={inputs.monthlyRevenue}
              onChange={setField("monthlyRevenue")}
              placeholder="0"
              prefix={currSymbol}
              tooltip="Current monthly revenue (MRR or equivalent). Reduces your effective burn. Default 0 if pre-revenue."
            />
            {/* Net burn — read-only derived field */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Monthly Net Burn <span className="text-slate-600 font-normal">(auto-calculated)</span>
              </label>
              <div className="w-full bg-slate-900/40 border border-slate-700/50 rounded-lg px-3 py-2 text-sm tabular-nums text-slate-400 select-none">
                {isFiniteNum(netBurn)
                  ? `${netBurn <= 0 ? "+" : ""}${fmtCurrency(Math.abs(netBurn), currency)}/mo${netBurn <= 0 ? " (cash-flow positive)" : ""}`
                  : "—"}
              </div>
            </div>
            <InputField
              label="Monthly Revenue Growth Rate"
              value={inputs.revenueGrowth}
              onChange={setField("revenueGrowth")}
              placeholder="e.g. 5 (blank = flat)"
              suffix="% MoM"
              tooltip="Expected month-over-month revenue growth. Leave blank for flat. 5% MoM roughly doubles revenue every 15 months."
            />
            <InputField
              label="Monthly Burn Growth Rate"
              value={inputs.burnGrowth}
              onChange={setField("burnGrowth")}
              placeholder="e.g. 2 (blank = flat)"
              suffix="% MoM"
              tooltip="Expected month-over-month increase in gross burn from planned hires or expansion. Leave blank if burn is flat."
            />
            <InputField
              label="Target Cash Reserve at End"
              value={inputs.targetReserve}
              onChange={setField("targetReserve")}
              placeholder="0"
              prefix={currSymbol}
              tooltip="Minimum cash buffer you want to maintain — e.g. 3 months of expenses. Runway is calculated to this threshold, not to zero."
            />
          </div>

          {/* Results */}
          <div>
            <SectionHeader>Outputs</SectionHeader>
            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 mb-4">
              <ResultRow
                label="Runway"
                value={
                  r
                    ? r.isPositive
                      ? "Cash-flow positive"
                      : typeof r.runwayMonth === "number"
                        ? `${r.runwayMonth} months`
                        : r.runwayMonth === ">60"
                          ? ">60 months"
                          : "—"
                    : "—"
                }
                highlight={!!r}
                note={r?.runwayMonth === ">60" ? "Simulation capped at 60 months — runway exceeds this horizon." : undefined}
              />
              <ResultRow
                label="Estimated Cash-Out Date"
                value={cashOutDate ?? (r?.isPositive ? "N/A — profitable" : "—")}
              />
              <ResultRow
                label="Net Burn Rate"
                value={isFiniteNum(netBurn) ? `${fmtCurrency(netBurn, currency)}/mo` : "—"}
                redValue={isFiniteNum(netBurn) && netBurn > 0}
              />
              <ResultRow
                label="Gross Burn Rate"
                value={isFiniteNum(parsed.grossBurn) ? `${fmtCurrency(parsed.grossBurn, currency)}/mo` : "—"}
              />
              <ResultRow
                label="Monthly Revenue"
                value={isFiniteNum(parsed.monthlyRevenue) ? `${fmtCurrency(parsed.monthlyRevenue, currency)}/mo` : "—"}
              />
              <ResultRow
                label="Months to Breakeven"
                value={
                  r?.isPositive
                    ? "Already profitable"
                    : r?.breakevenMonth
                      ? `Month ${r.breakevenMonth}`
                      : "—"
                }
                note={!r?.breakevenMonth && !r?.isPositive ? "Enter a Revenue Growth Rate to model path to breakeven." : undefined}
              />
            </div>

            {/* Three scenario cards */}
            {scenarios && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Scenario Comparison
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {scenarios.map((sc) => (
                    <div key={sc.label} className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-3 text-center">
                      <div className="text-3xl font-black tabular-nums leading-none" style={{ color: sc.color }}>
                        {fmtRunway(sc.result)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">months</div>
                      <div className="text-xs text-slate-400 mt-1.5 font-medium leading-tight">{sc.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Cash balance area chart ── */}
        {r?.monthlyData && r.monthlyData.length > 1 && (
          <div className="mt-8 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Cash Balance Over Time
            </p>
            <p className="text-xs text-slate-600 mb-4">Month on X-axis · Cash remaining on Y-axis</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.monthlyData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="cashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "Month", position: "insideBottomRight", offset: -4, fill: "#64748b", fontSize: 10 }}
                  />
                  <YAxis
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 1e6) return `${currSymbol}${(v / 1e6).toFixed(1)}M`;
                      if (Math.abs(v) >= 1e3) return `${currSymbol}${(v / 1e3).toFixed(0)}k`;
                      return `${currSymbol}${v}`;
                    }}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    label={{ value: "Cash", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(val) => [fmt(val, "currency", currency), "Cash Balance"]}
                    labelFormatter={(v) => `Month ${v}`}
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px", color: "#cbd5e1" }}
                  />
                  {isFiniteNum(targetReserve) && targetReserve > 0 && (
                    <ReferenceLine
                      y={targetReserve}
                      stroke="#ef4444"
                      strokeDasharray="5 4"
                      label={{ value: "Reserve", position: "insideTopRight", fill: "#ef4444", fontSize: 9 }}
                    />
                  )}
                  {typeof r.runwayMonth === "number" && (
                    <ReferenceLine
                      x={r.runwayMonth}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                      label={{ value: "Cash out", position: "insideTopLeft", fill: "#f59e0b", fontSize: 9 }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="cash"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    fill="url(#cashAreaGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#0ea5e9", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CalcCard>
    </>
  );
}

// ─── Calculator 8 — Unit Economics / LTV:CAC ─────────────────────────────────

const UE_DEFAULTS = {
  arpu: "",
  grossMarginPct: "70",
  churnMode: "monthly",
  monthlyChurn: "",
  annualChurn: "",
  cac: "",
  salesCycle: "",
  paybackTarget: "",
};

function UECalculator({ currency }) {
  const [inputs, setInputs] = useState(UE_DEFAULTS);
  const [copyFn, CopyModalNode] = useCopyToClipboard();
  const setField = useCallback(
    (field) => (val) => setInputs((prev) => ({ ...prev, [field]: val })), []
  );

  const toggleChurnMode = useCallback(() => {
    setInputs((prev) => ({
      ...prev,
      churnMode: prev.churnMode === "monthly" ? "annual" : "monthly",
      monthlyChurn: "",
      annualChurn: "",
    }));
  }, []);

  const r = useMemo(() => {
    try {
      const arpu = parseVal(inputs.arpu);
      const gm = parseVal(inputs.grossMarginPct) ?? 70;
      const cac = parseVal(inputs.cac);
      const salesCycle = parseVal(inputs.salesCycle);
      const paybackTarget = parseVal(inputs.paybackTarget);

      let monthlyChurnDec = null;
      let annualChurnPct = null;
      let zeroChurnWarn = false;

      if (inputs.churnMode === "monthly") {
        const raw = parseVal(inputs.monthlyChurn);
        if (isFiniteNum(raw)) {
          if (raw === 0) { zeroChurnWarn = true; }
          monthlyChurnDec = clamp(Math.max(0, raw), 0, 100) / 100;
          if (monthlyChurnDec < 1e-6) monthlyChurnDec = 1e-6;
          annualChurnPct = (1 - Math.pow(1 - monthlyChurnDec, 12)) * 100;
        }
      } else {
        const raw = parseVal(inputs.annualChurn);
        if (isFiniteNum(raw)) {
          if (raw === 0) { zeroChurnWarn = true; }
          const ac = clamp(Math.max(0, raw), 0, 100) / 100;
          monthlyChurnDec = Math.max(1e-6, 1 - Math.pow(1 - ac, 1 / 12));
          annualChurnPct = raw;
        }
      }

      const monthlyGP = isFiniteNum(arpu) && isFiniteNum(gm) ? arpu * (gm / 100) : null;
      const lifetime = isFiniteNum(monthlyChurnDec) ? 1 / monthlyChurnDec : null;
      const ltv = isFiniteNum(monthlyGP) && isFiniteNum(lifetime) ? monthlyGP * lifetime : null;
      const ltvCac = isFiniteNum(ltv) && isFiniteNum(cac) && cac > 0 ? ltv / cac : null;
      const cacPayback = isFiniteNum(cac) && isFiniteNum(monthlyGP) && monthlyGP > 0
        ? cac / monthlyGP : null;
      const paybackDiff = isFiniteNum(cacPayback) && isFiniteNum(paybackTarget)
        ? paybackTarget - cacPayback : null;

      let badge = null;
      if (isFiniteNum(ltvCac)) {
        if (ltvCac < 1) badge = { label: "Unsustainable", text: "text-red-400", bg: "bg-red-950/30 border-red-700/40" };
        else if (ltvCac < 3) badge = { label: "Marginal", text: "text-yellow-400", bg: "bg-yellow-950/30 border-yellow-700/40" };
        else if (ltvCac <= 5) badge = { label: "Healthy (VC fundable)", text: "text-green-400", bg: "bg-green-950/30 border-green-700/40" };
        else badge = { label: "Exceptional", text: "text-cyan-400", bg: "bg-cyan-950/30 border-cyan-700/40" };
      }

      return {
        arpu, gm, cac, salesCycle, paybackTarget,
        monthlyChurnDec, annualChurnPct, zeroChurnWarn,
        monthlyGP, lifetime, lifetimeYears: isFiniteNum(lifetime) ? lifetime / 12 : null,
        ltv, ltvCac, cacPayback, paybackDiff, badge,
      };
    } catch { return {}; }
  }, [inputs]);

  const handleReset = useCallback(() => setInputs(UE_DEFAULTS), []);
  const handleCopy = useCallback(() => {
    const lines = [
      "Unit Economics (LTV:CAC) Calculator",
      "=====================================",
      `ARPU/mo:              ${fmt(r.arpu, "currency", currency)}`,
      `Gross Margin:         ${fmt(r.gm, "percent")}`,
      `Monthly Churn:        ${isFiniteNum(r.monthlyChurnDec) ? fmt(r.monthlyChurnDec * 100, "percent") : "—"}`,
      `Annual Churn:         ${fmt(r.annualChurnPct, "percent")}`,
      `Avg Lifetime:         ${isFiniteNum(r.lifetime) ? r.lifetime.toFixed(1) + " months" : "—"}`,
      `Monthly GP/Customer:  ${fmt(r.monthlyGP, "currency", currency)}`,
      `LTV:                  ${fmt(r.ltv, "currency", currency)}`,
      `CAC:                  ${fmt(r.cac, "currency", currency)}`,
      `LTV:CAC:              ${isFiniteNum(r.ltvCac) ? r.ltvCac.toFixed(2) + "x" : "—"}${r.badge ? ` (${r.badge.label})` : ""}`,
      `CAC Payback:          ${isFiniteNum(r.cacPayback) ? r.cacPayback.toFixed(1) + " months" : "—"}`,
    ];
    copyFn(lines.join("\n"));
  }, [r, currency, copyFn]);

  const currSymbol = CURRENCY_META[currency]?.symbol || "$";

  return (
    <>
      {CopyModalNode}
      <CalcCard
        title="Unit Economics Calculator (LTV:CAC)"
        description="Measure the health of your business model. Understand whether you're building a sustainable, fundable company or burning cash on unprofitable growth."
        onReset={handleReset}
        onCopy={handleCopy}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Inputs */}
          <div>
            <SectionHeader>Inputs</SectionHeader>
            <InputField
              label="Avg. Revenue Per Customer / Month (ARPU)"
              value={inputs.arpu}
              onChange={setField("arpu")}
              placeholder="e.g. 150"
              prefix={currSymbol}
              tooltip="Average monthly revenue per active customer. For annual contracts divide ARR by 12. Typical SaaS ARPU ranges from $50 (SMB) to $5,000+ (enterprise)."
            />
            <InputField
              label="Gross Margin %"
              value={inputs.grossMarginPct}
              onChange={setField("grossMarginPct")}
              placeholder="70"
              suffix="%"
              tooltip="Revenue remaining after direct cost of goods sold. SaaS companies typically 60–85%. Used to convert revenue to gross profit when calculating LTV."
            />

            {/* Churn toggle */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">
                  Churn Rate
                  <FieldTooltip text="Percentage of customers lost per period. Monthly churn of 2% ≈ 22% annual. Best-in-class SaaS targets sub-1% monthly churn." />
                </label>
                <button
                  onClick={toggleChurnMode}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors border border-cyan-700/30 hover:border-cyan-500/30 px-2 py-0.5 rounded"
                >
                  Switch to {inputs.churnMode === "monthly" ? "Annual" : "Monthly"}
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={inputs.churnMode === "monthly" ? inputs.monthlyChurn : inputs.annualChurn}
                  onChange={(e) => setField(inputs.churnMode === "monthly" ? "monthlyChurn" : "annualChurn")(e.target.value)}
                  placeholder={inputs.churnMode === "monthly" ? "e.g. 2" : "e.g. 20"}
                  className="w-full bg-slate-800/80 border border-slate-600/70 rounded-lg px-3 pr-24 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">
                  % {inputs.churnMode}
                </span>
              </div>
              {/* Derived churn display */}
              {isFiniteNum(r.monthlyChurnDec) && (
                <p className="text-xs text-slate-500 mt-1 italic">
                  {inputs.churnMode === "monthly"
                    ? `≈ ${isFiniteNum(r.annualChurnPct) ? r.annualChurnPct.toFixed(1) : "—"}% annual churn`
                    : `≈ ${isFiniteNum(r.monthlyChurnDec) ? (r.monthlyChurnDec * 100).toFixed(2) : "—"}% monthly churn`}
                </p>
              )}
              {r.zeroChurnWarn && (
                <p className="text-xs text-yellow-400 mt-1">
                  0% churn produces infinite LTV. Verify your churn input.
                </p>
              )}
            </div>

            <InputField
              label="Customer Acquisition Cost (CAC)"
              value={inputs.cac}
              onChange={setField("cac")}
              placeholder="e.g. 1200"
              prefix={currSymbol}
              tooltip="Total cost to acquire one customer — marketing spend + sales salaries + commissions, divided by number of new customers in a period."
            />
            <InputField
              label="Average Sales Cycle"
              value={inputs.salesCycle}
              onChange={setField("salesCycle")}
              placeholder="e.g. 3"
              suffix="months"
              tooltip="Time from first contact to closed deal. Longer cycles increase the effective cost of customer acquisition and delay cash recovery."
            />
            <InputField
              label="Target Payback Period"
              value={inputs.paybackTarget}
              onChange={setField("paybackTarget")}
              placeholder="e.g. 12"
              suffix="months"
              tooltip="Your desired CAC payback benchmark. 12 months is excellent for SaaS; above 24 months signals a capital-efficiency concern."
            />
          </div>

          {/* Results */}
          <div>
            <SectionHeader>Results</SectionHeader>

            {/* LTV:CAC badge */}
            {r.badge && (
              <div className={`border rounded-xl px-4 py-3 mb-4 flex items-center justify-between ${r.badge.bg}`}>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${r.badge.text}`}>
                    {r.badge.label}
                  </p>
                  <p className="text-xs text-slate-500">LTV:CAC benchmark rating</p>
                </div>
                <p className={`text-3xl font-black tabular-nums ${r.badge.text}`}>
                  {isFiniteNum(r.ltvCac) ? `${r.ltvCac.toFixed(1)}x` : "—"}
                </p>
              </div>
            )}

            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 mb-4">
              <ResultRow
                label="LTV"
                value={fmt(r.ltv, "currency", currency)}
                highlight={isFiniteNum(r.ltv)}
                note={!isFiniteNum(r.ltv) ? "Enter ARPU, Gross Margin %, and Churn Rate." : undefined}
              />
              <ResultRow
                label="CAC"
                value={fmt(r.cac, "currency", currency)}
                note={!isFiniteNum(r.cac) ? "Enter Customer Acquisition Cost." : undefined}
              />
              <ResultRow
                label="LTV:CAC Ratio"
                value={isFiniteNum(r.ltvCac) ? `${r.ltvCac.toFixed(2)}x` : "—"}
                redValue={isFiniteNum(r.ltvCac) && r.ltvCac < 1}
              />
              <ResultRow
                label="Monthly Gross Profit / Customer"
                value={fmt(r.monthlyGP, "currency", currency)}
              />
              <ResultRow
                label="Avg. Customer Lifetime"
                value={
                  isFiniteNum(r.lifetime)
                    ? `${r.lifetime.toFixed(1)} mo (${r.lifetimeYears?.toFixed(1)} yrs)`
                    : "—"
                }
              />
              <ResultRow
                label="CAC Payback Period"
                value={isFiniteNum(r.cacPayback) ? `${r.cacPayback.toFixed(1)} months` : "—"}
                redValue={isFiniteNum(r.cacPayback) && isFiniteNum(r.paybackTarget) && r.cacPayback > r.paybackTarget}
              />
            </div>

            {/* Payback vs target bar */}
            {isFiniteNum(r.cacPayback) && isFiniteNum(r.paybackTarget) && (
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 mb-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Payback Period vs. Target
                </p>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">CAC Payback</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{r.cacPayback.toFixed(1)} mo</span>
                </div>
                <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden mb-2">
                  {(() => {
                    const scale = Math.max(r.paybackTarget * 1.5, r.cacPayback * 1.1);
                    const actualPct = Math.min(100, (r.cacPayback / scale) * 100);
                    const targetPct = Math.min(100, (r.paybackTarget / scale) * 100);
                    return (
                      <>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${actualPct}%`, background: r.cacPayback <= r.paybackTarget ? "#22c55e" : "#ef4444" }}
                        />
                        <div
                          className="absolute top-0 h-full w-0.5 bg-white/50"
                          style={{ left: `${targetPct}%` }}
                        />
                      </>
                    );
                  })()}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm bg-white/50" />
                    <span className="text-xs text-slate-500">Target: {r.paybackTarget.toFixed(0)} mo</span>
                  </div>
                  <span className={`text-xs font-semibold ${r.paybackDiff >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {r.paybackDiff >= 0
                      ? `${r.paybackDiff.toFixed(1)} mo under target`
                      : `${Math.abs(r.paybackDiff).toFixed(1)} mo over target`}
                  </span>
                </div>
              </div>
            )}

            {/* Benchmark guide */}
            <div className="bg-slate-800/20 rounded-xl p-4 border border-slate-700/20">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                LTV:CAC Benchmarks
              </p>
              <div className="space-y-2">
                {[
                  { range: "Below 1×", label: "Unsustainable", color: "#ef4444" },
                  { range: "1× – 2×", label: "Marginal", color: "#f59e0b" },
                  { range: "3× – 5×", label: "Healthy (VC fundable)", color: "#22c55e" },
                  { range: "Above 5×", label: "Exceptional", color: "#06b6d4" },
                ].map((b) => (
                  <div key={b.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-sm" style={{ background: b.color }} />
                      <span className="text-xs text-slate-400">{b.range}</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: b.color }}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CalcCard>
    </>
  );
}

// ─── Calculator Registry ──────────────────────────────────────────────────────

const CALCULATORS = [
  {
    id: "safe-note",
    label: "SAFE / Note",
    Component: SafeNoteCalculator,
  },
  {
    id: "dilution",
    label: "Dilution",
    Component: DilutionCalculator,
  },
  {
    id: "cap-table",
    label: "Cap Table",
    Component: CapTableSimulator,
  },
  {
    id: "irr-moic",
    label: "IRR / XIRR",
    Component: IRRCalculator,
  },
  {
    id: "vc-simulator",
    label: "Fund Returns",
    Component: VCSimulator,
  },
  {
    id: "waterfall",
    label: "Waterfall",
    Component: WaterfallCalculator,
  },
  {
    id: "runway",
    label: "Runway",
    Component: RunwayCalculator,
  },
  {
    id: "unit-economics",
    label: "Unit Economics",
    Component: UECalculator,
  },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "OTHER", label: "Other" },
];

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function FinanceTools() {
  const [activeTab, setActiveTab] = useState("safe-note");
  const [currency, setCurrency] = useState("USD");

  const activeCalc = useMemo(
    () => CALCULATORS.find((c) => c.id === activeTab),
    [activeTab]
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white antialiased">
      {/* ── Sticky Navigation ── */}
      <header className="sticky top-0 z-40 bg-[#0c1525]/95 backdrop-blur-md border-b border-slate-800/80 shadow-xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-14 gap-3">
            {/* Brand */}
            <span className="text-sm font-bold text-white shrink-0 tracking-tight">
              Finance Tools
            </span>
            <div className="w-px h-5 bg-slate-700 shrink-0" />

            {/* Currency selector */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-slate-800 border border-slate-700/50 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 shrink-0 cursor-pointer"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Scrollable tab bar */}
            <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <div className="flex gap-1 min-w-max py-1">
                {CALCULATORS.map((calc) => (
                  <button
                    key={calc.id}
                    onClick={() => setActiveTab(calc.id)}
                    className={[
                      "text-sm px-4 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all",
                      activeTab === calc.id
                        ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/40"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60",
                    ].join(" ")}
                  >
                    {calc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Calculator Area ── */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeCalc && (
          <CalcErrorBoundary key={activeCalc.id}>
            <activeCalc.Component currency={currency} />
          </CalcErrorBoundary>
        )}
      </main>
    </div>
  );
}

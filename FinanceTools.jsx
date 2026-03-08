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
}) {
  const currSymbol = prefix || "";
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
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
  };
  return (
    <div className={`border rounded-lg px-4 py-3 mb-4 text-xs leading-relaxed ${styles[variant]}`}>
      {children}
    </div>
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

// ─── Calculator Registry ──────────────────────────────────────────────────────

const CALCULATORS = [
  {
    id: "safe-note",
    label: "SAFE / Note",
    Component: SafeNoteCalculator,
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

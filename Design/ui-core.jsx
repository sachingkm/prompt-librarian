// Shared utilities, theme tokens, icons, and tiny primitives for Prompt Librarian.

const PL = {};

// --------------- Tokens ---------------
PL.tokens = {
  light: {
    bg: "#f7f8fa",
    bgPanel: "#ffffff",
    bgPanelAlt: "#f0f2f5",
    bgHover: "#eef0f3",
    bgActive: "#e3e7ec",
    bgInput: "#ffffff",
    border: "#e1e4e8",
    borderStrong: "#c8ced6",
    text: "#1a1f24",
    textDim: "#5a6470",
    textMuted: "#8a94a0",
    danger: "#c92a2a",
    warn: "#b3611f",
    ok: "#1a7a3e",
    selBg: "#e6efff",
    selText: "#0a3d8c",
  },
  dark: {
    bg: "#161a1f",
    bgPanel: "#1c2127",
    bgPanelAlt: "#21262d",
    bgHover: "#252a31",
    bgActive: "#2f3640",
    bgInput: "#11151a",
    border: "#2a3038",
    borderStrong: "#3a4150",
    text: "#e6edf3",
    textDim: "#a3acb9",
    textMuted: "#6f7886",
    danger: "#ff6b6b",
    warn: "#e0a64a",
    ok: "#5cc97a",
    selBg: "#1a3360",
    selText: "#cfe2ff",
  },
};

PL.accents = {
  blue:   { name: "Blue",   hex: "#3b82f6" },
  amber:  { name: "Amber",  hex: "#d97706" },
  violet: { name: "Violet", hex: "#7c3aed" },
  green:  { name: "Green",  hex: "#16a34a" },
};

// --------------- Icons (16px, monoline, Lucide-ish) ---------------
PL.Icon = ({ name, size = 16, style, className }) => {
  const paths = {
    folder:        <><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 2h4.5A1.5 1.5 0 0 1 14 6.5v6A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-8z"/></>,
    "folder-open": <><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 2h4.5A1.5 1.5 0 0 1 14 6.5V7H2V4.5z"/><path d="M2 7h12.5L13 13.2a1 1 0 0 1-1 .8H3a1 1 0 0 1-1-.8L2 7z"/></>,
    file:          <><path d="M3.5 1.5h6L13 5v9.5H3.5v-13z"/><path d="M9 1.5V5h4"/></>,
    "file-md":     <><path d="M3.5 1.5h6L13 5v9.5H3.5v-13z"/><path d="M9 1.5V5h4"/><path d="M5.5 12V8.5l1.5 1.5L8.5 8.5V12M10.5 8.5V12M9.5 11l1 1 1-1"/></>,
    plus:          <><path d="M8 3v10M3 8h10"/></>,
    search:        <><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></>,
    settings:      <><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M1 8h2M13 8h2M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4"/></>,
    cmd:           <><path d="M5 4a2 2 0 1 1-2 2h10a2 2 0 1 1-2-2v8a2 2 0 1 1 2-2H3a2 2 0 1 1 2 2V4z"/></>,
    sparkle:       <><path d="M8 1.5 9.2 6.2 13.8 7.5 9.2 8.8 8 13.5 6.8 8.8 2.2 7.5 6.8 6.2 8 1.5z"/></>,
    inbox:         <><path d="M2 9.5 4 3h8l2 6.5v3H2v-3z"/><path d="M2 9.5h3.5l1 1.5h3l1-1.5H14"/></>,
    archive:       <><rect x="2" y="3" width="12" height="3"/><path d="M3 6v7h10V6"/><path d="M6.5 9h3"/></>,
    star:          <><path d="m8 1.8 1.9 4 4.4.4-3.3 3 1 4.3L8 11.2 4 13.5l1-4.3-3.3-3 4.4-.4z"/></>,
    clock:         <><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></>,
    chevron:       <><path d="m5 4 4 4-4 4"/></>,
    "chevron-down":<><path d="m4 6 4 4 4-4"/></>,
    check:         <><path d="m3 8.5 3 3 7-7"/></>,
    x:             <><path d="m4 4 8 8M12 4l-8 8"/></>,
    edit:          <><path d="M3 13l1-3L11 3l3 3-7 7-3 1z"/></>,
    copy:          <><rect x="5" y="5" width="9" height="9" rx="1"/><path d="M3 10V3a1 1 0 0 1 1-1h7"/></>,
    move:          <><path d="M8 2v12M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3M5 5l3-3 3 3M5 11l3 3 3-3"/></>,
    trash:         <><path d="M3 4h10M6 4V2.5h4V4M5 4l.7 9h4.6L11 4"/></>,
    tag:           <><path d="M2 2v6l7 7 6-6-7-7H2z"/><circle cx="5" cy="5" r="1"/></>,
    info:          <><circle cx="8" cy="8" r="6"/><path d="M8 11V7M8 5h.01"/></>,
    warning:       <><path d="M8 1.5 14.5 13h-13L8 1.5z"/><path d="M8 6v3.5M8 11h.01"/></>,
    minimize:      <><path d="M3 8h10"/></>,
    maximize:      <><rect x="3" y="3" width="10" height="10"/></>,
    close:         <><path d="m4 4 8 8M12 4l-8 8"/></>,
    sun:           <><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3"/></>,
    moon:          <><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"/></>,
    keyboard:      <><rect x="1.5" y="4" width="13" height="8" rx="1"/><path d="M4 7h.01M6 7h.01M8 7h.01M10 7h.01M12 7h.01M4 9.5h8"/></>,
    pin:           <><path d="M10 1 15 6l-4 1-2 4-3-3-4 1 1-4 4-2L8 1l2 0z"/></>,
    dot:           <><circle cx="8" cy="8" r="2.5"/></>,
    "arrow-right": <><path d="M3 8h10M9 4l4 4-4 4"/></>,
    refresh:       <><path d="M2 8a6 6 0 0 1 10.5-4M14 8a6 6 0 0 1-10.5 4"/><path d="M12.5 1.5V4h-2.5M3.5 14.5V12H6"/></>,
    eye:           <><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></>,
    "eye-off":     <><path d="M2 2l12 12M5 5C2.5 6.5 1 8 1 8s2.5 5 7 5c1.5 0 2.8-.4 4-1M9.5 4c4 .5 5.5 4 5.5 4s-.5 1-1.5 2"/></>,
    download:      <><path d="M8 2v9M4 7l4 4 4-4M2 13h12"/></>,
    history:       <><path d="M2 8a6 6 0 1 1 2 4.5"/><path d="M2 14v-3h3"/><path d="M8 5v3l2 1.5"/></>,
    grid:          <><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></>,
    list:          <><path d="M3 4h10M3 8h10M3 12h10"/></>,
    filter:        <><path d="M2 3h12l-4.5 5v5L6.5 14V8L2 3z"/></>,
  };
  const path = paths[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
    >
      {path}
    </svg>
  );
};

// --------------- Format helpers ---------------
PL.fmt = {
  relTime(iso) {
    if (!iso) return "—";
    const now = new Date(2026, 4, 6, 14, 0, 0); // anchored "now"
    const then = new Date(iso);
    const diff = (now - then) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const d = Math.floor(diff / 86400);
    if (d < 30) return `${d}d ago`;
    const m = Math.floor(d / 30);
    if (m < 12) return `${m}mo ago`;
    return `${Math.floor(m / 12)}y ago`;
  },
  date(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  },
  bytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  },
  fnLabel(fn) {
    if (!fn) return "—";
    return fn[0].toUpperCase() + fn.slice(1);
  },
};

// --------------- Markdown serialization (frontmatter + body) ---------------
PL.toMarkdown = (p) => {
  const fm = [
    "---",
    `title: ${p.title}`,
    p.category && `category: ${p.category}`,
    p.subcategory && `subcategory: ${p.subcategory}`,
    p.function && `function: ${p.function}`,
    p.domain && `domain: ${p.domain}`,
    p.project && `project: ${p.project}`,
    p.tags && p.tags.length && `tags:\n${p.tags.map(t => `  - ${t}`).join("\n")}`,
    p.reuse && `reuse: ${p.reuse}`,
    p.scope && `scope: ${p.scope}`,
    p.created_at && `created_at: ${p.created_at}`,
    p.updated_at && `updated_at: ${p.updated_at}`,
    "---",
  ].filter(Boolean).join("\n");
  const body = `\n\n# ${p.title}\n\n## Purpose\n${p.purpose || ""}\n\n## Inputs Required\n${p.inputs || ""}\n\n## Output\n${p.output || ""}\n\n## Prompt\n${p.body || ""}\n\n## Notes\n${p.notes || ""}\n${p.compatibility ? `\n## Compatibility Notes\n${p.compatibility}\n` : ""}`;
  return fm + body;
};

// --------------- Slugify ---------------
PL.slugify = (s) => (s || "")
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, "")
  .trim()
  .replace(/\s+/g, "-")
  .slice(0, 64);

// --------------- Tiny primitives ---------------
PL.Kbd = ({ children }) => (
  <kbd style={{
    fontFamily: "var(--mono)",
    fontSize: 11,
    padding: "1px 5px",
    background: "var(--bg-panel-alt)",
    border: "1px solid var(--border)",
    borderBottomWidth: 2,
    borderRadius: 3,
    color: "var(--text-dim)",
    lineHeight: 1.4,
  }}>{children}</kbd>
);

PL.Pill = ({ children, color, style }) => (
  <span style={{
    fontSize: 11,
    fontFamily: "var(--mono)",
    padding: "1px 6px",
    borderRadius: 3,
    background: color ? `${color}22` : "var(--bg-panel-alt)",
    color: color || "var(--text-dim)",
    border: `1px solid ${color ? `${color}44` : "var(--border)"}`,
    whiteSpace: "nowrap",
    ...style,
  }}>{children}</span>
);

PL.Btn = ({ children, onClick, variant = "default", size = "md", icon, kbd, disabled, style, title }) => {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: size === "sm" ? 12 : 13,
    height: size === "sm" ? 24 : 28,
    padding: size === "sm" ? "0 8px" : "0 10px",
    borderRadius: 4,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid var(--border)",
    background: "var(--bg-panel)",
    color: "var(--text)",
    fontFamily: "var(--sans)",
    transition: "background 80ms",
    opacity: disabled ? 0.5 : 1,
    userSelect: "none",
  };
  const variants = {
    default: {},
    primary: { background: "var(--accent)", borderColor: "var(--accent)", color: "#fff" },
    ghost:   { background: "transparent", borderColor: "transparent" },
    danger:  { color: "var(--danger)", borderColor: "var(--border)" },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = variant === "primary" ? "var(--accent)" : "var(--bg-hover)")}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = variants[variant].background || "var(--bg-panel)")}
    >
      {icon && <PL.Icon name={icon} size={13}/>}
      <span>{children}</span>
      {kbd && <PL.Kbd>{kbd}</PL.Kbd>}
    </button>
  );
};

PL.Field = ({ label, hint, children, span }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: span ? `span ${span}` : undefined }}>
    <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
    {children}
    {hint && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</span>}
  </label>
);

PL.Input = React.forwardRef(({ style, ...props }, ref) => (
  <input ref={ref} {...props} style={{
    height: 28, padding: "0 8px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    fontFamily: "var(--sans)",
    fontSize: 13,
    outline: "none",
    ...style,
  }}
  onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
  />
));

PL.Select = ({ value, onChange, options, style }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} style={{
    height: 28, padding: "0 8px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    fontFamily: "var(--sans)",
    fontSize: 13,
    outline: "none",
    ...style,
  }}>
    {options.map(o => typeof o === "string"
      ? <option key={o} value={o}>{o}</option>
      : <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

PL.Textarea = ({ style, ...props }) => (
  <textarea {...props} style={{
    padding: 8,
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text)",
    fontFamily: "var(--mono)",
    fontSize: 13,
    lineHeight: 1.5,
    outline: "none",
    resize: "none",
    ...style,
  }}
  onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
  onBlur={(e) => e.target.style.borderColor = "var(--border)"}
  />
);

// Confidence bar (0–1)
PL.ConfidenceBar = ({ value, label }) => {
  const v = Math.max(0, Math.min(1, value || 0));
  const color = v >= 0.75 ? "var(--ok)" : v >= 0.5 ? "var(--warn)" : "var(--danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: "var(--bg-panel-alt)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${v * 100}%`, height: "100%", background: color, transition: "width 240ms" }}/>
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", minWidth: 28, textAlign: "right" }}>{Math.round(v * 100)}%</span>
      {label && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>}
    </div>
  );
};

window.PL = PL;

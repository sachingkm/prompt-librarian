// Main library views: home dashboard, browse list, search, hygiene, archive.

const { Icon, Btn, Pill, Kbd, ConfidenceBar, fmt } = PL;

// -------- Prompt list row (shared) --------
const PromptRow = ({ p, selected, onClick, onOpen, density }) => {
  const compact = density === "compact";
  return (
    <div
      onClick={onClick}
      onDoubleClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 2.4fr) minmax(0, 1fr) 80px 80px 80px 92px",
        alignItems: "center",
        gap: 12,
        height: compact ? 28 : 34,
        padding: "0 14px",
        cursor: "pointer",
        background: selected ? "var(--sel-bg)" : "transparent",
        color: selected ? "var(--sel-text)" : "var(--text)",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
      }}
      onMouseEnter={(e) => !selected && (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={(e) => !selected && (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Icon name="file-md" size={13} style={{ color: "var(--text-muted)" }}/>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
          {p.title}
        </span>
        {p.needsTriage && <Pill color="var(--warn)" style={{ fontSize: 10 }}>needs triage</Pill>}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.folder}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{p.function ? fmt.fnLabel(p.function) : "—"}</div>
      <div>
        {p.reuse && <Pill color={p.reuse === "high" ? "var(--ok)" : p.reuse === "medium" ? "var(--warn)" : null}>{p.reuse}</Pill>}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{p.reuseCount || 0}×</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{fmt.relTime(p.updated_at)}</div>
    </div>
  );
};

const TableHeader = () => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "minmax(0, 2.4fr) minmax(0, 1fr) 80px 80px 80px 92px",
    alignItems: "center",
    gap: 12,
    height: 28,
    padding: "0 14px",
    background: "var(--bg-panel-alt)",
    borderBottom: "1px solid var(--border)",
    fontSize: 11,
    fontFamily: "var(--mono)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "var(--text-muted)",
    position: "sticky", top: 0, zIndex: 1,
  }}>
    <div>Title</div>
    <div>Folder</div>
    <div>Function</div>
    <div>Reuse</div>
    <div>Used</div>
    <div>Updated</div>
  </div>
);

// -------- Browse view --------
PL.BrowseView = ({ prompts, selectedFolder, selectedId, onSelect, onOpen, density, onChangeFolder, query, onQuery, filter, onFilter }) => {
  const filtered = React.useMemo(() => {
    let list = prompts;
    if (selectedFolder) list = list.filter(p => p.folder === selectedFolder || p.folder.startsWith(selectedFolder + "/"));
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (p.body || "").toLowerCase().includes(q) ||
        (p.purpose || "").toLowerCase().includes(q));
    }
    if (filter.fn) list = list.filter(p => p.function === filter.fn);
    if (filter.reuse) list = list.filter(p => p.reuse === filter.reuse);
    return list;
  }, [prompts, selectedFolder, query, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Path crumb + filters */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 38, padding: "0 14px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel)",
        flexShrink: 0,
      }}>
        <Icon name="folder-open" size={13} style={{ color: "var(--text-muted)" }}/>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {selectedFolder || "All prompts"}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>
          · {filtered.length} prompt{filtered.length !== 1 && "s"}
        </span>
        <span style={{ flex: 1 }}/>
        <PL.Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter this folder…"
          style={{ width: 220 }}
        />
        <PL.Select
          value={filter.fn || ""}
          onChange={(v) => onFilter({ ...filter, fn: v || null })}
          options={[
            { value: "", label: "Any function" },
            ...["transform","summarize","extract","classify","rewrite","compare","generate","critique","plan"].map(f => ({ value: f, label: fmt.fnLabel(f) })),
          ]}
          style={{ width: 130 }}
        />
        <PL.Select
          value={filter.reuse || ""}
          onChange={(v) => onFilter({ ...filter, reuse: v || null })}
          options={[
            { value: "", label: "Any reuse" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
          style={{ width: 110 }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-panel)" }}>
        <TableHeader/>
        {filtered.length === 0 ? (
          <EmptyFolder onCapture={onChangeFolder}/>
        ) : filtered.map(p => (
          <PromptRow
            key={p.id}
            p={p}
            density={density}
            selected={selectedId === p.id}
            onClick={() => onSelect(p.id)}
            onOpen={() => onOpen(p.id)}
          />
        ))}
      </div>
    </div>
  );
};

const EmptyFolder = ({ onCapture }) => (
  <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)" }}>
    <div style={{ fontSize: 13, marginBottom: 6 }}>Nothing in this folder yet.</div>
    <div style={{ fontSize: 12 }}>
      Drop a prompt into <Kbd>Ctrl N</Kbd> intake to file one here, or open the folder in your file manager —
      Markdown files added there will show up automatically.
    </div>
  </div>
);

// -------- Home: capture-first --------
// Paste box is the page. Metadata auto-infers as you type (debounced).
// Save in 1 click — no separate "Classify" step.
PL.HomeView = ({ prompts, onOpen, onView, onNew, rootPath, onSave }) => {
  const [body, setBody] = React.useState("");
  const [meta, setMeta] = React.useState(null); // inferred metadata
  const [inferring, setInferring] = React.useState(false);
  const [usedFallback, setUsedFallback] = React.useState(false);
  const [overrides, setOverrides] = React.useState({}); // user edits to inferred fields
  const debRef = React.useRef();

  // Debounced auto-infer as user types/pastes
  React.useEffect(() => {
    clearTimeout(debRef.current);
    if (!body.trim() || body.trim().length < 12) {
      setMeta(null); setOverrides({}); return;
    }
    setInferring(true);
    debRef.current = setTimeout(async () => {
      let result = null;
      try {
        if (window.claude && window.claude.complete) {
          const sys = `Infer prompt metadata. Return ONLY JSON with: title, function (one of transform|summarize|extract|classify|rewrite|compare|generate|critique|plan), category, subcategory, domain, project (or null), tags (2-5 lowercase), reuse (high|medium|low), scope (reusable|project reusable|one-off), folder (e.g. "01-Core Transforms/Summarization"), filename (kebab-case .md), confidence (0..1), rationale (1 sentence). Never use LLM vendor in folder. Never create _gpt/_cld/_ag variants.`;
          const reply = await window.claude.complete({
            messages: [{ role: "user", content: `${sys}\n\nPrompt:\n"""\n${body}\n"""` }],
          });
          const m = reply.match(/\{[\s\S]*\}/);
          if (m) result = JSON.parse(m[0]);
        }
      } catch (e) { /* fall through */ }
      if (!result) { setUsedFallback(true); result = heuristicQuick(body); }
      else setUsedFallback(false);
      setMeta(result);
      setInferring(false);
    }, 700);
    return () => clearTimeout(debRef.current);
  }, [body]);

  const merged = meta ? { ...meta, ...overrides } : null;
  const setField = (k, v) => setOverrides(o => ({ ...o, [k]: v }));

  const canSave = body.trim().length >= 12 && merged;
  const handleSave = () => {
    if (!canSave) return;
    const draft = {
      id: "p_new_" + Math.random().toString(36).slice(2, 6),
      title: merged.title || "Untitled",
      filename: (merged.filename || PL.slugify(merged.title || "untitled")) + (String(merged.filename||"").endsWith(".md") ? "" : ".md"),
      folder: merged.folder || "00-Index",
      category: merged.category || null,
      subcategory: merged.subcategory || null,
      function: merged.function || null,
      domain: merged.domain || null,
      project: merged.project || null,
      tags: merged.tags || [],
      reuse: merged.reuse || "medium",
      scope: merged.scope || "reusable",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      purpose: merged.purpose || "",
      inputs: merged.inputs || "",
      output: merged.output || "",
      body, notes: "", compatibility: "", reuseCount: 0,
    };
    onSave(draft, merged);
    setBody(""); setMeta(null); setOverrides({});
  };

  const handleKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSave(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-panel)" }}>
      {/* Header */}
      <div style={{ padding: "14px 28px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Capture</h1>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>
          Paste a prompt — metadata fills in as you type. Save with <Kbd>Ctrl ↵</Kbd>.
        </span>
        <span style={{ flex: 1 }}/>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>
          {prompts.length} prompts in library
        </span>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", minHeight: 0 }}>
        {/* Left: paste box */}
        <div style={{ display: "flex", flexDirection: "column", padding: "14px 28px 0", minWidth: 0, minHeight: 0 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKey}
            placeholder={"Paste your prompt here.\n\nThe app will infer title, function, folder, tags, and reuse level automatically. Save with Ctrl+Enter."}
            autoFocus
            style={{
              flex: 1, minHeight: 0, resize: "none",
              background: "var(--bg-input)",
              border: "1px solid var(--border)", borderRadius: 4,
              padding: 16, color: "var(--text)",
              fontFamily: "var(--mono)", fontSize: 13.5, lineHeight: 1.6,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", padding: "10px 0 14px", gap: 12, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
            <span>{body.length.toLocaleString()} chars · {body.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
            <span style={{ flex: 1 }}/>
            {body && (
              <Btn size="sm" onClick={() => { setBody(""); setMeta(null); setOverrides({}); }}>Clear</Btn>
            )}
            <Btn variant="primary" icon="check" kbd="Ctrl ↵" disabled={!canSave} onClick={handleSave}>
              Save to library
            </Btn>
          </div>
        </div>

        {/* Right: inferred metadata, inline-editable */}
        <div style={{
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-panel-alt)",
          display: "flex", flexDirection: "column", minHeight: 0,
        }}>
          <div style={{ padding: "12px 18px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="sparkle" size={13} style={{ color: "var(--accent)" }}/>
            <span style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", flex: 1 }}>
              Inferred metadata
            </span>
            {inferring && <Pill>inferring…</Pill>}
            {!inferring && merged && (usedFallback
              ? <Pill color="var(--warn)">heuristic</Pill>
              : <Pill color="var(--ok)">auto</Pill>)}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
            {!merged && (
              <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "20px 0", textAlign: "center" }}>
                Start typing or paste a prompt — the app will fill this in.
              </div>
            )}
            {merged && (
              <>
                <ConfidenceBar value={merged.confidence || 0.7}/>
                {merged.rationale && (
                  <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 4 }}>
                    {merged.rationale}
                  </div>
                )}
                <InlineField label="Title">
                  <input value={merged.title || ""} onChange={(e) => setField("title", e.target.value)} style={inlineStyle}/>
                </InlineField>
                <InlineField label="Function">
                  <select value={merged.function || ""} onChange={(e) => setField("function", e.target.value)} style={inlineStyle}>
                    {["transform","summarize","extract","classify","rewrite","compare","generate","critique","plan"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </InlineField>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <InlineField label="Reuse">
                    <select value={merged.reuse || ""} onChange={(e) => setField("reuse", e.target.value)} style={inlineStyle}>
                      {["high","medium","low"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </InlineField>
                  <InlineField label="Scope">
                    <select value={merged.scope || ""} onChange={(e) => setField("scope", e.target.value)} style={inlineStyle}>
                      {["reusable","project reusable","one-off"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </InlineField>
                </div>
                <InlineField label="Folder" hint="auto-creates if missing">
                  <input value={merged.folder || ""} onChange={(e) => setField("folder", e.target.value)} style={{...inlineStyle, fontFamily: "var(--mono)", fontSize: 12}}/>
                </InlineField>
                <InlineField label="Filename">
                  <input value={merged.filename || ""} onChange={(e) => setField("filename", e.target.value)} style={{...inlineStyle, fontFamily: "var(--mono)", fontSize: 12}}/>
                </InlineField>
                <InlineField label="Tags" hint="comma-separated">
                  <input
                    value={(merged.tags || []).join(", ")}
                    onChange={(e) => setField("tags", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                    style={inlineStyle}
                  />
                </InlineField>
              </>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: "10px 18px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Icon name="info" size={12} style={{ color: "var(--accent)", marginTop: 2 }}/>
            <span>Will write to <span style={{fontFamily:"var(--mono)", color:"var(--text-dim)"}}>{merged ? `${merged.folder}/${merged.filename}` : "—"}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

const inlineStyle = {
  width: "100%",
  background: "var(--bg-input)",
  border: "1px solid var(--border)",
  borderRadius: 3,
  padding: "5px 8px",
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "var(--sans)",
  outline: "none",
};

const InlineField = ({ label, hint, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <span style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>
      <span>{label}</span>
      {hint && <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--text-muted)", opacity: 0.7 }}>{hint}</span>}
    </span>
    {children}
  </label>
);

// Lightweight heuristic for the home page (mirror of intake's, kept inline to avoid coupling)
const heuristicQuick = (raw) => {
  const t = raw.toLowerCase();
  const has = (...w) => w.some(x => t.includes(x));
  let fn = "generate";
  if (has("summari","tl;dr")) fn = "summarize";
  else if (has("extract","pull","find all")) fn = "extract";
  else if (has("classify","categorize")) fn = "classify";
  else if (has("rewrite","tighten","rephrase","edit")) fn = "rewrite";
  else if (has("compare","diff","versus")) fn = "compare";
  else if (has("critique","review","feedback")) fn = "critique";
  else if (has("plan","outline","roadmap")) fn = "plan";
  else if (has("transform","convert")) fn = "transform";
  let folder = "01-Core Transforms";
  if (has("interview","behavioral","system design")) folder = `02-Interview/${has("behavioral","star") ? "Behavioral" : has("system design") ? "System Design" : "Coding"}`;
  else if (has("resume","cover letter","outreach","job ")) folder = `03-Job Search/${has("resume") ? "Resume" : has("cover letter") ? "Cover Letters" : "Outreach"}`;
  else if (has("prd","spec ","user story")) folder = `04-Product Specs/${has("user story") ? "User Stories" : "PRDs"}`;
  else if (has("paper","competitive","research")) folder = `05-Research/${has("competitive") ? "Competitive" : "Literature"}`;
  else if (fn === "summarize") folder = "01-Core Transforms/Summarization";
  else if (fn === "extract") folder = "01-Core Transforms/Extraction";
  else if (fn === "rewrite") folder = "01-Core Transforms/Rewrite";
  const seed = (raw.split(/\n/).find(Boolean) || raw).replace(/^[#\s>*-]+/, "").slice(0, 60).trim();
  const title = seed || "Untitled prompt";
  const tags = ["transcript","resume","prd","interview","outreach","summary","cover letter","triage"]
    .filter(k => t.includes(k)).slice(0, 4).map(k => k.replace(" ", "-"));
  return {
    title, function: fn, folder,
    filename: PL.slugify(title) + ".md",
    tags, reuse: raw.length > 400 ? "high" : "medium",
    scope: "reusable",
    confidence: 0.62,
    rationale: `Inferred function "${fn}" from verbs; placed in ${folder} based on keywords. Heuristic — review before save.`,
  };
};

const Card = ({ title, action, onAction, children }) => (
  <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
    <div style={{
      display: "flex", alignItems: "center", height: 32, padding: "0 14px",
      background: "var(--bg-panel-alt)", borderBottom: "1px solid var(--border)",
      fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)",
    }}>
      <span style={{ flex: 1 }}>{title}</span>
      {action && <span onClick={onAction} style={{ cursor: "pointer", color: "var(--accent)", textTransform: "none", letterSpacing: 0 }}>{action}</span>}
    </div>
    <div>{children}</div>
  </div>
);

const DashRow = ({ p, onClick, right }) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 10,
    height: 32, padding: "0 14px", cursor: "pointer",
    borderBottom: "1px solid var(--border)",
    fontSize: 13,
  }}
  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
  >
    <Icon name="file-md" size={12} style={{ color: "var(--text-muted)" }}/>
    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{right}</span>
  </div>
);

// -------- Hygiene view --------
PL.HygieneView = ({ prompts, onOpen, onSelect }) => {
  const issues = prompts.map(p => {
    const list = [];
    if (!p.category) list.push("missing category");
    if (!p.function) list.push("no function tag");
    if (!p.tags || p.tags.length === 0) list.push("no tags");
    if (!p.purpose) list.push("no purpose");
    if (!p.reuse) list.push("no reuse level");
    if (p.folder === "00-Index" && p.title.startsWith("Untitled")) list.push("uncategorized capture");
    return { p, list };
  }).filter(x => x.list.length >= 2);

  return (
    <div style={{ overflowY: "auto", height: "100%", background: "var(--bg-panel)", padding: "24px 32px 80px" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Library Hygiene</h1>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 22 }}>
        Prompts missing metadata or filed poorly. Reclassify or archive to keep search clean.
      </div>
      {issues.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }}>Library is clean. ✓</div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
          {issues.map(({ p, list }) => (
            <div key={p.id} style={{
              display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 2fr) 90px",
              padding: "10px 14px", borderBottom: "1px solid var(--border)",
              alignItems: "center", gap: 12, fontSize: 13, cursor: "pointer",
            }}
            onClick={() => { onSelect(p.id); onOpen(p.id); }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{p.title}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{p.folder}/{p.filename}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {list.map(l => <Pill key={l} color="var(--warn)">{l}</Pill>)}
              </div>
              <Btn size="sm" icon="sparkle">Reclassify</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// -------- Recent / High-reuse / Archive (simple list pages) --------
PL.ListView = ({ title, subtitle, prompts, onOpen, onSelect, selectedId, density }) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-panel)" }}>
    <div style={{ padding: "20px 32px 14px", borderBottom: "1px solid var(--border)" }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
      {subtitle && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{subtitle}</div>}
    </div>
    <div style={{ flex: 1, overflowY: "auto" }}>
      <TableHeader/>
      {prompts.map(p => (
        <PromptRow
          key={p.id}
          p={p}
          density={density}
          selected={selectedId === p.id}
          onClick={() => onSelect(p.id)}
          onOpen={() => onOpen(p.id)}
        />
      ))}
    </div>
  </div>
);

PL.PromptRow = PromptRow;
PL.TableHeader = TableHeader;

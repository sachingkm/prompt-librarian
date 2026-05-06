// Right-hand panel: prompt detail + classification metadata.
// Plus the editor view (when a prompt is opened in the center for editing).

const { Icon, Btn, Pill, Kbd, Field, Input, Select, Textarea, ConfidenceBar, fmt } = PL;

// ---- Right metadata panel for a selected prompt ----
PL.MetadataPanel = ({ prompt, onChange, onArchive, onMove, onDuplicate, onCopy, classification, onClose }) => {
  if (!prompt) return (
    <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
      Select a prompt to see metadata.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 38, padding: "0 12px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel-alt)",
      }}>
        <Icon name="info" size={13} style={{ color: "var(--text-muted)" }}/>
        <span style={{ fontSize: 12, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", flex: 1 }}>
          Metadata
        </span>
        {onClose && <PL.IconBtn icon="x" onClick={onClose} title="Hide panel"/>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Title">
          <Input value={prompt.title} onChange={(e) => onChange({ title: e.target.value })}/>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Function">
            <Select
              value={prompt.function || ""}
              onChange={(v) => onChange({ function: v || null })}
              options={[
                { value: "", label: "—" },
                ...["transform","summarize","extract","classify","rewrite","compare","generate","critique","plan"].map(f => ({ value: f, label: fmt.fnLabel(f) })),
              ]}
            />
          </Field>
          <Field label="Reuse level">
            <Select
              value={prompt.reuse || ""}
              onChange={(v) => onChange({ reuse: v || null })}
              options={[{ value: "", label: "—" }, "high", "medium", "low"]}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Category">
            <Input value={prompt.category || ""} onChange={(e) => onChange({ category: e.target.value })}/>
          </Field>
          <Field label="Subcategory">
            <Input value={prompt.subcategory || ""} onChange={(e) => onChange({ subcategory: e.target.value })}/>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Domain">
            <Select
              value={prompt.domain || ""}
              onChange={(v) => onChange({ domain: v || null })}
              options={[{ value: "", label: "—" }, "interview", "job search", "product specs", "research", "project prompts"]}
            />
          </Field>
          <Field label="Project">
            <Input value={prompt.project || ""} placeholder="e.g. Career Buddy" onChange={(e) => onChange({ project: e.target.value })}/>
          </Field>
        </div>

        <Field label="Scope">
          <Select
            value={prompt.scope || ""}
            onChange={(v) => onChange({ scope: v || null })}
            options={[{ value: "", label: "—" }, "reusable", "project reusable", "one-off"]}
          />
        </Field>

        <Field label="Tags" hint="Comma-separated">
          <Input
            value={(prompt.tags || []).join(", ")}
            onChange={(e) => onChange({ tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          />
        </Field>

        <Field label="Folder path">
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 8px",
            background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4,
            fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)",
          }}>
            <Icon name="folder" size={12} style={{ color: "var(--text-muted)" }}/>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prompt.folder}</span>
            <Btn size="sm" variant="ghost" icon="move" onClick={onMove}>Move</Btn>
          </div>
        </Field>

        <Field label="Filename">
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 8px",
            background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4,
            fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)",
          }}>
            <Icon name="file" size={12} style={{ color: "var(--text-muted)" }}/>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prompt.filename}</span>
          </div>
        </Field>

        {classification && (
          <div style={{ marginTop: 4, padding: 10, background: "var(--bg-panel-alt)", border: "1px dashed var(--border)", borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Icon name="sparkle" size={12} style={{ color: "var(--accent)" }}/>
              <span style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>Classifier rationale</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
              {classification.rationale}
            </div>
            <div style={{ marginTop: 8 }}>
              <ConfidenceBar value={classification.confidence} label="confidence"/>
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 6, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-muted)" }}>
          <div>created {fmt.date(prompt.created_at)}</div>
          <div>updated {fmt.date(prompt.updated_at)} ({fmt.relTime(prompt.updated_at)})</div>
          <div>used {prompt.reuseCount || 0}× in copy actions</div>
        </div>
      </div>

      <div style={{
        borderTop: "1px solid var(--border)",
        padding: 10,
        display: "flex", gap: 6, flexWrap: "wrap",
        background: "var(--bg-panel-alt)",
      }}>
        <Btn icon="copy" size="sm" onClick={onCopy} title="Copy prompt body">Copy</Btn>
        <Btn icon="copy" size="sm" onClick={onDuplicate} title="Duplicate file">Duplicate</Btn>
        <Btn icon="archive" size="sm" onClick={onArchive} variant="danger">Archive</Btn>
      </div>
    </div>
  );
};

// ---- Editor (center pane when a prompt is opened) ----
PL.EditorView = ({ prompt, onChange, onClose, onSave, classification }) => {
  if (!prompt) return null;
  const [activeTab, setActiveTab] = React.useState("editor");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-panel)" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        height: 38, padding: "0 14px",
        borderBottom: "1px solid var(--border)",
      }}>
        <Icon name="file-md" size={13} style={{ color: "var(--text-muted)" }}/>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {prompt.folder}/<span style={{ color: "var(--text)" }}>{prompt.filename}</span>
        </span>
        <span style={{ flex: 1 }}/>
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
          {["editor", "preview", "raw"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} type="button" style={{
              height: 24, padding: "0 10px",
              background: activeTab === t ? "var(--bg-active)" : "transparent",
              color: activeTab === t ? "var(--text)" : "var(--text-dim)",
              border: "none",
              borderRight: t !== "raw" ? "1px solid var(--border)" : "none",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "var(--sans)",
            }}>{t}</button>
          ))}
        </div>
        <Btn size="sm" icon="copy">Copy prompt</Btn>
        <Btn size="sm" icon="check" variant="primary" kbd="Ctrl S" onClick={onSave}>Save</Btn>
        <PL.IconBtn icon="x" onClick={onClose} title="Close (Esc)"/>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {activeTab === "editor" && <EditorTab prompt={prompt} onChange={onChange}/>}
        {activeTab === "preview" && <PreviewTab prompt={prompt}/>}
        {activeTab === "raw" && <RawTab prompt={prompt}/>}
      </div>
    </div>
  );
};

const EditorTab = ({ prompt, onChange }) => (
  <div style={{ height: "100%", overflowY: "auto", padding: "20px 28px 80px" }}>
    <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <input
        type="text"
        value={prompt.title}
        onChange={(e) => onChange({ title: e.target.value })}
        style={{
          fontSize: 22, fontWeight: 600,
          background: "transparent", border: "none", outline: "none",
          color: "var(--text)", padding: "4px 0",
          fontFamily: "var(--sans)",
        }}
      />
      <Section label="Purpose">
        <Textarea
          value={prompt.purpose || ""} rows={2}
          onChange={(e) => onChange({ purpose: e.target.value })}
          style={{ width: "100%", fontFamily: "var(--sans)" }}
        />
      </Section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Section label="Inputs Required">
          <Textarea value={prompt.inputs || ""} rows={3} onChange={(e) => onChange({ inputs: e.target.value })} style={{ width: "100%", fontFamily: "var(--sans)" }}/>
        </Section>
        <Section label="Output">
          <Textarea value={prompt.output || ""} rows={3} onChange={(e) => onChange({ output: e.target.value })} style={{ width: "100%", fontFamily: "var(--sans)" }}/>
        </Section>
      </div>
      <Section label="Prompt" mono>
        <Textarea
          value={prompt.body || ""} rows={14}
          onChange={(e) => onChange({ body: e.target.value })}
          style={{ width: "100%" }}
        />
      </Section>
      <Section label="Notes">
        <Textarea value={prompt.notes || ""} rows={3} onChange={(e) => onChange({ notes: e.target.value })} style={{ width: "100%", fontFamily: "var(--sans)" }}/>
      </Section>
      <Section label="Compatibility Notes" hint="Optional. Model-specific behavior. Never used for folder placement.">
        <Textarea value={prompt.compatibility || ""} rows={2} onChange={(e) => onChange({ compatibility: e.target.value })} style={{ width: "100%", fontFamily: "var(--sans)" }}/>
      </Section>
    </div>
  </div>
);

const Section = ({ label, hint, children, mono }) => (
  <div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
      <h3 style={{ margin: 0, fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", fontWeight: 600 }}>{label}</h3>
      {hint && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</span>}
    </div>
    {children}
  </div>
);

const PreviewTab = ({ prompt }) => (
  <div style={{ height: "100%", overflowY: "auto", padding: "28px 32px 80px", fontFamily: "var(--sans)" }}>
    <div style={{ maxWidth: 720, margin: "0 auto", lineHeight: 1.6, fontSize: 14, color: "var(--text)" }}>
      <h1 style={{ marginTop: 0, fontSize: 24, fontWeight: 600 }}>{prompt.title}</h1>
      <p style={{ color: "var(--text-dim)" }}>{prompt.purpose}</p>
      <h2 style={{ fontSize: 14, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", marginTop: 22 }}>Inputs Required</h2>
      <p style={{ whiteSpace: "pre-wrap" }}>{prompt.inputs}</p>
      <h2 style={{ fontSize: 14, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", marginTop: 22 }}>Output</h2>
      <p style={{ whiteSpace: "pre-wrap" }}>{prompt.output}</p>
      <h2 style={{ fontSize: 14, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", marginTop: 22 }}>Prompt</h2>
      <pre style={{
        background: "var(--bg-panel-alt)", padding: 14, borderRadius: 4,
        fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.55,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        border: "1px solid var(--border)",
      }}>{prompt.body}</pre>
      {prompt.notes && (<>
        <h2 style={{ fontSize: 14, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", marginTop: 22 }}>Notes</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{prompt.notes}</p>
      </>)}
      {prompt.compatibility && (<>
        <h2 style={{ fontSize: 14, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", marginTop: 22 }}>Compatibility Notes</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{prompt.compatibility}</p>
      </>)}
    </div>
  </div>
);

const RawTab = ({ prompt }) => (
  <div style={{ height: "100%", overflowY: "auto", padding: "20px 28px 80px" }}>
    <pre style={{
      background: "var(--bg-input)", padding: 14, borderRadius: 4,
      fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.55,
      whiteSpace: "pre-wrap", wordBreak: "break-word",
      border: "1px solid var(--border)",
      color: "var(--text)",
      maxWidth: 900, margin: "0 auto",
    }}>{PL.toMarkdown(prompt)}</pre>
  </div>
);

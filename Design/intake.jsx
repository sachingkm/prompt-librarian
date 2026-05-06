// Intake & classify view + first-run setup + settings.

const { Icon, Btn, Pill, Kbd, Field, Input, Select, Textarea, ConfidenceBar, fmt } = PL;

// ---- Intake / classify ----
PL.IntakeView = ({ onSave, onCancel, initialText = "", folders, accent }) => {
  const [step, setStep] = React.useState("paste"); // paste | classifying | review
  const [raw, setRaw] = React.useState(initialText);
  const [draft, setDraft] = React.useState(null);
  const [classification, setClassification] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [usedFallback, setUsedFallback] = React.useState(false);

  const classify = async () => {
    setStep("classifying");
    setError(null);
    setUsedFallback(false);

    // Try Claude first.
    let result = null;
    try {
      if (window.claude && window.claude.complete) {
        const sys = `You are a prompt librarian. Given a raw prompt, infer:
- title (concise, 3–8 words)
- function: one of [transform, summarize, extract, classify, rewrite, compare, generate, critique, plan]
- category: one of [Core Transforms, Interview, Job Search, Product Specs, Research, Project Prompts, Examples]
- subcategory: short, e.g. "Resume", "PRDs", "Transcript Cleanup"
- domain: optional, one of [interview, job search, product specs, research, project prompts] or null
- project: optional, e.g. "Career Buddy", or null
- tags: 2–5 short lowercase tags
- reuse: high | medium | low
- scope: reusable | project reusable | one-off
- folder: a relative folder path under the library root using the format like "01-Core Transforms/Summarization"
- filename: kebab-case .md filename
- confidence: 0..1 number
- rationale: 1–2 sentences explaining the placement

Return ONLY a JSON object. Do not include any LLM-vendor specific notes in the folder. Do not create _gpt/_cld/_ag variants.`;
        const reply = await window.claude.complete({
          messages: [
            { role: "user", content: `${sys}\n\nPrompt:\n"""\n${raw}\n"""` },
          ],
        });
        const m = reply.match(/\{[\s\S]*\}/);
        if (m) result = JSON.parse(m[0]);
      }
    } catch (e) {
      console.warn("classify: claude failed, falling back", e);
    }

    if (!result) {
      // Heuristic fallback
      setUsedFallback(true);
      result = heuristicClassify(raw);
    }

    setClassification(result);
    setDraft({
      id: "p_new_" + Math.random().toString(36).slice(2, 6),
      title: result.title || "Untitled",
      filename: (result.filename || PL.slugify(result.title || "untitled")) + (result.filename?.endsWith(".md") ? "" : ".md"),
      folder: result.folder || "00-Index",
      category: result.category || null,
      subcategory: result.subcategory || null,
      function: result.function || null,
      domain: result.domain || null,
      project: result.project || null,
      tags: result.tags || [],
      reuse: result.reuse || "medium",
      scope: result.scope || "reusable",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      purpose: result.purpose || "",
      inputs: result.inputs || "",
      output: result.output || "",
      body: raw,
      notes: "",
      compatibility: "",
      reuseCount: 0,
    });
    setStep("review");
  };

  if (step === "paste") {
    return (
      <Shell title="New Prompt" subtitle="Paste raw prompt text. The classifier will infer title, folder, tags, reuse level, and filename. You can edit anything before save." onClose={onCancel}>
        <div style={{ flex: 1, padding: "0 28px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste your prompt here…"
            autoFocus
            style={{ flex: 1, minHeight: 0, width: "100%", fontFamily: "var(--mono)", fontSize: 13 }}
          />
          <div style={{ display: "flex", alignItems: "center", padding: "12px 0", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {raw.length.toLocaleString()} chars · {raw.split(/\s+/).filter(Boolean).length.toLocaleString()} words
            </span>
            <span style={{ flex: 1 }}/>
            <Btn onClick={onCancel}>Cancel</Btn>
            <Btn variant="primary" icon="sparkle" kbd="Ctrl ↵" disabled={!raw.trim()} onClick={classify}>Classify</Btn>
          </div>
        </div>
      </Shell>
    );
  }

  if (step === "classifying") {
    return (
      <Shell title="Classifying…" onClose={onCancel}>
        <div style={{ padding: "60px 28px", textAlign: "center" }}>
          <div style={{ display: "inline-block", animation: "spin 800ms linear infinite", marginBottom: 14 }}>
            <Icon name="sparkle" size={32} style={{ color: "var(--accent)" }}/>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Inferring title, function, folder, and tags…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Shell>
    );
  }

  // step === "review"
  return (
    <Shell title="Review classification" subtitle="Edit anything before save. The Markdown file will be written to disk only after you confirm." onClose={onCancel}>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 14px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
        {/* Left: editable preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/>
          </Field>
          <Field label="Prompt body" hint={`${(draft.body||"").length.toLocaleString()} chars`}>
            <Textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              style={{ width: "100%", minHeight: 220 }}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Purpose">
              <Textarea value={draft.purpose} rows={3} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} style={{ width: "100%", fontFamily: "var(--sans)" }}/>
            </Field>
            <Field label="Output">
              <Textarea value={draft.output} rows={3} onChange={(e) => setDraft({ ...draft, output: e.target.value })} style={{ width: "100%", fontFamily: "var(--sans)" }}/>
            </Field>
          </div>
        </div>

        {/* Right: classifier output */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: 12, background: "var(--bg-panel-alt)", border: "1px solid var(--border)", borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Icon name="sparkle" size={13} style={{ color: "var(--accent)" }}/>
              <span style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", flex: 1 }}>
                Classifier
              </span>
              {usedFallback
                ? <Pill color="var(--warn)">heuristic fallback</Pill>
                : <Pill color="var(--ok)">claude</Pill>}
            </div>
            <ConfidenceBar value={classification.confidence || 0.7}/>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.5 }}>
              {classification.rationale}
            </div>
          </div>

          <Field label="Function">
            <Select value={draft.function || ""} onChange={(v) => setDraft({ ...draft, function: v || null })} options={[{value:"",label:"—"}, "transform","summarize","extract","classify","rewrite","compare","generate","critique","plan"]}/>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Reuse">
              <Select value={draft.reuse || ""} onChange={(v) => setDraft({ ...draft, reuse: v })} options={["high","medium","low"]}/>
            </Field>
            <Field label="Scope">
              <Select value={draft.scope || ""} onChange={(v) => setDraft({ ...draft, scope: v })} options={["reusable","project reusable","one-off"]}/>
            </Field>
          </div>
          <Field label="Category">
            <Input value={draft.category || ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })}/>
          </Field>
          <Field label="Subcategory">
            <Input value={draft.subcategory || ""} onChange={(e) => setDraft({ ...draft, subcategory: e.target.value })}/>
          </Field>
          <Field label="Project (optional)">
            <Input value={draft.project || ""} onChange={(e) => setDraft({ ...draft, project: e.target.value || null })}/>
          </Field>
          <Field label="Tags" hint="Comma-separated">
            <Input value={(draft.tags || []).join(", ")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })}/>
          </Field>
          <Field label="Folder" hint="Relative to library root. App will create missing folders.">
            <Input value={draft.folder} onChange={(e) => setDraft({ ...draft, folder: e.target.value })}/>
          </Field>
          <Field label="Filename">
            <Input value={draft.filename} onChange={(e) => setDraft({ ...draft, filename: e.target.value })}/>
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", padding: "10px 28px", borderTop: "1px solid var(--border)", gap: 10 }}>
        <Pill>Will write: <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{draft.folder}/{draft.filename}</span></Pill>
        <span style={{ flex: 1 }}/>
        <Btn icon="refresh" onClick={() => setStep("paste")}>Re-classify</Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" icon="check" kbd="Ctrl S" onClick={() => onSave(draft, classification)}>Save to disk</Btn>
      </div>
    </Shell>
  );
};

const Shell = ({ title, subtitle, children, onClose }) => (
  <div style={{
    position: "absolute", inset: 0,
    background: "var(--bg)",
    display: "flex", flexDirection: "column",
  }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "16px 28px 10px",
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      <PL.IconBtn icon="x" onClick={onClose} title="Close"/>
    </div>
    {children}
  </div>
);
PL.Shell = Shell;

// Heuristic classifier (fallback if Claude unavailable)
const heuristicClassify = (raw) => {
  const t = raw.toLowerCase();
  const has = (...words) => words.some(w => t.includes(w));

  let fn = "generate";
  if (has("summari", "tl;dr")) fn = "summarize";
  else if (has("extract", "pull", "find all")) fn = "extract";
  else if (has("classify", "categorize", "tag")) fn = "classify";
  else if (has("rewrite", "tighten", "rephrase", "edit")) fn = "rewrite";
  else if (has("compare", "diff", "versus")) fn = "compare";
  else if (has("critique", "review", "feedback")) fn = "critique";
  else if (has("plan", "outline", "roadmap")) fn = "plan";
  else if (has("transform", "convert", "translate")) fn = "transform";

  let cat = "Core Transforms", sub = "", folder = "01-Core Transforms";
  if (has("interview", "behavioral", "system design")) { cat = "Interview"; sub = has("behavioral","star") ? "Behavioral" : has("system design","architecture") ? "System Design" : "Coding"; folder = `02-Interview/${sub}`; }
  else if (has("resume", "cover letter", "job ", "outreach")) { cat = "Job Search"; sub = has("resume") ? "Resume" : has("cover letter") ? "Cover Letters" : "Outreach"; folder = `03-Job Search/${sub}`; }
  else if (has("prd", "user story", "spec ")) { cat = "Product Specs"; sub = has("user story") ? "User Stories" : "PRDs"; folder = `04-Product Specs/${sub}`; }
  else if (has("paper", "literature", "competitive", "research")) { cat = "Research"; sub = has("competitive") ? "Competitive" : "Literature"; folder = `05-Research/${sub}`; }
  else if (fn === "summarize") { sub = "Summarization"; folder = "01-Core Transforms/Summarization"; }
  else if (fn === "extract") { sub = "Extraction"; folder = "01-Core Transforms/Extraction"; }
  else if (fn === "rewrite") { sub = "Rewrite"; folder = "01-Core Transforms/Rewrite"; }

  const titleSeed = raw.split(/\n/).find(Boolean) || raw;
  const title = (titleSeed.replace(/^[#\s>*-]+/, "").slice(0, 60).trim()) || "Untitled prompt";
  const filename = PL.slugify(title) + ".md";

  const tags = [];
  ["transcript","resume","prd","interview","outreach","summary","cover letter","triage"].forEach(k => {
    if (t.includes(k)) tags.push(k.replace(" ", "-"));
  });

  return {
    title, function: fn, category: cat, subcategory: sub, domain: null, project: null,
    tags: tags.slice(0, 4),
    reuse: raw.length > 400 ? "high" : "medium",
    scope: "reusable",
    folder, filename,
    confidence: 0.62,
    rationale: `Detected function "${fn}" from verbs in the prompt; placed in ${folder} based on domain keywords. Heuristic classifier — confirm before save.`,
    purpose: "",
    inputs: "",
    output: "",
  };
};

// ---- First-run setup ----
PL.FirstRun = ({ onComplete, defaultStructure, onChooseExisting, onCreateNew, onInit }) => {
  const [step, setStep] = React.useState("welcome"); // welcome | choose | path | confirm
  const [mode, setMode] = React.useState(null); // "new" | "existing"
  const [path, setPath] = React.useState("");
  const [initStructure, setInitStructure] = React.useState(true);

  const isWindows = path.match(/^[A-Z]:\\/);

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "grid", placeItems: "center",
      background: "var(--bg)",
      overflow: "auto",
    }}>
      <div style={{
        width: "min(720px, 92vw)",
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
        overflow: "hidden",
      }}>
        {/* Title bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 22px",
          background: "var(--bg-panel-alt)",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 4,
            background: "var(--accent)", color: "#fff",
            display: "grid", placeItems: "center",
            fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12,
          }}>P</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Prompt Librarian — first-run setup</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
              Step {step === "welcome" ? "1" : step === "choose" ? "2" : step === "path" ? "3" : "4"} of 4
            </div>
          </div>
        </div>

        <div style={{ padding: 28 }}>
          {step === "welcome" && (
            <>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, marginBottom: 10 }}>Welcome.</h2>
              <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 18 }}>
                Prompt Librarian helps you capture, classify, and reuse prompts you write — locally, on your computer.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text)", marginBottom: 22 }}>
                <Bullet><b>Markdown files on disk</b> are the source of truth. The app reads and writes ordinary <code style={{fontFamily:"var(--mono)"}}>.md</code> files you can open with any editor.</Bullet>
                <Bullet>You choose <b>where</b> the library lives. The app will only ever write inside that folder.</Bullet>
                <Bullet>Prompts are organized by <b>function, domain, and project</b> — never by LLM vendor.</Bullet>
                <Bullet>No cloud account. No login. No database.</Bullet>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="primary" icon="arrow-right" onClick={() => setStep("choose")}>Get started</Btn>
              </div>
            </>
          )}

          {step === "choose" && (
            <>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Pick your library</h2>
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 18 }}>
                You can either start fresh or point the app at a folder of prompts you already have.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ModeCard
                  selected={mode === "new"}
                  icon="plus"
                  title="Create new library"
                  body="Choose an empty folder. The app will write the default folder structure into it."
                  onClick={() => setMode("new")}
                />
                <ModeCard
                  selected={mode === "existing"}
                  icon="folder-open"
                  title="Use existing library"
                  body="Point the app at a folder that already contains prompt Markdown files. We'll index them in place."
                  onClick={() => setMode("existing")}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
                <Btn onClick={() => setStep("welcome")}>Back</Btn>
                <Btn variant="primary" icon="arrow-right" disabled={!mode} onClick={() => setStep("path")}>Continue</Btn>
              </div>
            </>
          )}

          {step === "path" && (
            <>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Choose folder</h2>
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 18 }}>
                {mode === "new"
                  ? "The app will treat this folder as your library root and create the default structure inside it."
                  : "The app will index every .md file inside this folder. Files outside the library are never touched."}
              </p>

              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={mode === "new" ? "e.g. ~/Documents/Prompt Library" : "e.g. ~/Notes/prompts"}
                  style={{ flex: 1, fontFamily: "var(--mono)" }}
                />
                <Btn icon="folder-open" onClick={() => setPath(mode === "new" ? "~/Documents/Prompt Library" : "~/Notes/prompts")}>Browse…</Btn>
              </div>

              {mode === "new" && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, background: "var(--bg-panel-alt)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", marginBottom: 14 }}>
                  <input type="checkbox" checked={initStructure} onChange={(e) => setInitStructure(e.target.checked)} style={{ marginTop: 3 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Initialize default folder structure</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>Creates the folders below. You can rename, delete, or add to them later.</div>
                    <div style={{
                      marginTop: 10, padding: 10,
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)", borderRadius: 4,
                      fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7,
                      color: "var(--text-dim)",
                    }}>
                      <div>00-Index/</div>
                      <div>01-Core Transforms/</div>
                      <div>02-Interview/</div>
                      <div>03-Job Search/</div>
                      <div>04-Product Specs/</div>
                      <div>05-Research/</div>
                      <div>06-Project Prompts/</div>
                      <div style={{ paddingLeft: 16 }}>(your project folders here)</div>
                      <div>90-Examples/</div>
                      <div>99-Archive/</div>
                    </div>
                  </div>
                </label>
              )}

              <div style={{ padding: 12, background: "var(--bg-panel-alt)", border: "1px dashed var(--border)", borderRadius: 4, fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Icon name="info" size={14} style={{ color: "var(--accent)", marginTop: 2 }}/>
                <div>
                  The app will only read and write inside this folder. You can change the root later in Settings → Library. Tip: if you sync this folder with iCloud, Dropbox, or Google Drive, your prompts sync too — but the app does not require it.
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
                <Btn onClick={() => setStep("choose")}>Back</Btn>
                <Btn variant="primary" icon="check" disabled={!path.trim()} onClick={() => setStep("confirm")}>
                  {mode === "new" ? "Create library" : "Use this folder"}
                </Btn>
              </div>
            </>
          )}

          {step === "confirm" && (
            <>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Ready to go</h2>
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 18 }}>
                The app will treat the following folder as your writable library root.
              </p>
              <div style={{
                padding: 14, background: "var(--bg-panel-alt)",
                border: "1px solid var(--border)", borderRadius: 4,
                fontFamily: "var(--mono)", fontSize: 13, marginBottom: 18,
                display: "flex", gap: 8, alignItems: "center",
              }}>
                <Icon name="folder-open" size={14} style={{ color: "var(--accent)" }}/>
                <span style={{ flex: 1 }}>{path}</span>
                <Pill color="var(--ok)">writable</Pill>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <CheckLine ok>Will <b>read</b> .md files inside this folder</CheckLine>
                <CheckLine ok>Will <b>write</b> new prompts as .md files here</CheckLine>
                {mode === "new" && initStructure && <CheckLine ok>Will <b>create</b> the default folder structure</CheckLine>}
                <CheckLine ok>Will <b>watch</b> the folder for outside edits</CheckLine>
                <CheckLine warn>Will <b>never</b> write outside this folder</CheckLine>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
                <Btn onClick={() => setStep("path")}>Back</Btn>
                <Btn variant="primary" icon="check" onClick={() => onComplete(path, { initStructure: mode === "new" && initStructure, mode })}>Open library</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Bullet = ({ children }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
    <Icon name="check" size={13} style={{ color: "var(--ok)", marginTop: 4 }}/>
    <span style={{ flex: 1, lineHeight: 1.5 }}>{children}</span>
  </div>
);

const CheckLine = ({ children, ok, warn }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: warn ? "var(--warn)" : "var(--text)" }}>
    <Icon name={warn ? "warning" : "check"} size={13} style={{ color: warn ? "var(--warn)" : "var(--ok)", marginTop: 4 }}/>
    <span>{children}</span>
  </div>
);

const ModeCard = ({ selected, icon, title, body, onClick }) => (
  <div onClick={onClick} style={{
    padding: 16,
    background: selected ? "var(--bg-active)" : "var(--bg-panel-alt)",
    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 4,
    cursor: "pointer",
    transition: "all 80ms",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <Icon name={icon} size={14} style={{ color: selected ? "var(--accent)" : "var(--text-dim)" }}/>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
    </div>
    <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{body}</div>
  </div>
);

// ---- Settings ----
PL.SettingsView = ({ rootPath, onChangeRoot, onClose, hotkeys }) => (
  <div style={{ position: "absolute", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
    <Shell title="Settings" onClose={onClose}>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 60px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
          <Group title="Library">
            <Field label="Root folder" hint="Markdown files inside this folder are the source of truth.">
              <div style={{ display: "flex", gap: 6 }}>
                <Input value={rootPath || ""} readOnly style={{ flex: 1, fontFamily: "var(--mono)" }}/>
                <Btn icon="folder-open" onClick={onChangeRoot}>Change…</Btn>
              </div>
            </Field>
            <Field label="On change" hint="Switching root won't move existing files. The new folder becomes writable; the old one is no longer read.">
              <div/>
            </Field>
            <Field label="Watch for outside edits">
              <Select value="enabled" onChange={() => {}} options={["enabled", "disabled"]}/>
            </Field>
            <Field label="Conflict policy" hint="What to do when a save would overwrite a file.">
              <Select value="ask" onChange={() => {}} options={[
                { value: "ask", label: "Ask me (recommended)" },
                { value: "rename", label: "Auto-rename with -1, -2…" },
                { value: "overwrite", label: "Always overwrite (not recommended)" },
              ]}/>
            </Field>
          </Group>
          <Group title="Defaults for new prompts">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Default reuse"><Select value="medium" onChange={() => {}} options={["high","medium","low"]}/></Field>
              <Field label="Default scope"><Select value="reusable" onChange={() => {}} options={["reusable","project reusable","one-off"]}/></Field>
            </div>
            <Field label="Filename format" hint="Template variables: {slug}, {date}, {fn}, {category}.">
              <Input value="{slug}.md" onChange={() => {}}/>
            </Field>
          </Group>
          <Group title="Classifier">
            <Field label="Provider" hint="Falls back to local heuristics if unavailable. Model is only used to suggest metadata; never determines folder placement by vendor.">
              <Select value="claude" onChange={() => {}} options={["claude", "local heuristics only"]}/>
            </Field>
          </Group>
          <Group title="Hotkeys">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px" }}>
              {hotkeys.map(([k, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-dim)", flex: 1 }}>{label}</span>
                  <Kbd>{k}</Kbd>
                </div>
              ))}
            </div>
          </Group>
        </div>
      </div>
    </Shell>
  </div>
);

const Group = ({ title, children }) => (
  <section>
    <div style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
      {title}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
  </section>
);

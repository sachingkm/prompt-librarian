// Main app for Prompt Librarian.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "blue",
  "showRightPanel": true,
  "density": "comfortable",
  "stage": "main",
  "library": "seeded"
}/*EDITMODE-END*/;

const ACCENTS = PL.accents;

const App = () => {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // ---- App-level state ----
  const [view, setView] = React.useState("home"); // home | browse | recent | reuse | hygiene | archive
  const [overlay, setOverlay] = React.useState(null); // intake | settings | folders | conflict | shortcuts | tray | move | first-run
  const [overlayCtx, setOverlayCtx] = React.useState({});
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [selectedFolder, setSelectedFolder] = React.useState("01-Core Transforms");
  const [selectedId, setSelectedId] = React.useState("p001");
  const [editingId, setEditingId] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState({ fn: null, reuse: null });
  const [toast, setToast] = React.useState(null);
  const [showSidebar, setShowSidebar] = React.useState(true);

  const stage = tweaks.stage; // "main" or "first-run"
  const seeded = tweaks.library === "seeded";

  // Library + tree state (mutable)
  const [prompts, setPrompts] = React.useState(() => seeded ? window.PROMPTS : []);
  const [tree, setTree] = React.useState(window.FOLDER_TREE);
  const [rootPath, setRootPath] = React.useState("~/Documents/Prompt Library");

  // React to tweaks changes
  React.useEffect(() => {
    setPrompts(tweaks.library === "seeded" ? window.PROMPTS : []);
  }, [tweaks.library]);

  // Theme application + accent
  React.useEffect(() => {
    const tok = PL.tokens[tweaks.theme === "dark" ? "dark" : "light"];
    const accent = ACCENTS[tweaks.accent]?.hex || ACCENTS.blue.hex;
    const root = document.documentElement;
    Object.entries(tok).forEach(([k, v]) => {
      // bg, bgPanel -> --bg, --bg-panel
      const cssVar = "--" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
      root.style.setProperty(cssVar, v);
    });
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--mono", `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`);
    root.style.setProperty("--sans", `-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", sans-serif`);
    root.style.setProperty("--bg-color-page", tok.bg);
    document.body.style.background = tok.bg;
    document.body.style.color = tok.text;
  }, [tweaks.theme, tweaks.accent]);

  const selected = React.useMemo(() => prompts.find(p => p.id === selectedId), [prompts, selectedId]);
  const editing = React.useMemo(() => prompts.find(p => p.id === editingId), [prompts, editingId]);

  // Derived counts
  const recentList = React.useMemo(() => [...prompts].sort((a,b) => (b.updated_at||"").localeCompare(a.updated_at||"")), [prompts]);
  const highReuseList = React.useMemo(() => prompts.filter(p => p.reuse === "high"), [prompts]);
  const archiveList = React.useMemo(() => prompts.filter(p => p.folder.startsWith("99-Archive")), [prompts]);
  const hygieneList = React.useMemo(() => prompts.filter(p => p.needsTriage || !p.category || !p.function), [prompts]);

  // ---- Hotkeys ----
  React.useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen(true); }
      else if (meta && e.key.toLowerCase() === "n" && !e.shiftKey) { e.preventDefault(); openOverlay("intake"); }
      else if (meta && e.shiftKey && e.key.toLowerCase() === "n") { e.preventDefault(); openOverlay("tray"); }
      else if (meta && e.key === "/") { e.preventDefault(); openOverlay("shortcuts"); }
      else if (meta && e.key.toLowerCase() === ",") { e.preventDefault(); openOverlay("settings"); }
      else if (e.key === "Escape") {
        if (cmdOpen) setCmdOpen(false);
        else if (overlay) closeOverlay();
        else if (editingId) setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cmdOpen, overlay, editingId]);

  const openOverlay = (kind, ctx = {}) => { setOverlay(kind); setOverlayCtx(ctx); };
  const closeOverlay = () => { setOverlay(null); setOverlayCtx({}); };

  const updatePrompt = (id, patch) => {
    setPrompts(ps => ps.map(p => p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p));
  };

  // ---- Save (with collision handling) ----
  const savePrompt = (draft, classification, opts = {}) => {
    const collision = prompts.find(p => p.folder === draft.folder && p.filename === draft.filename && p.id !== draft.id);
    if (collision && !opts.allowOverwrite && !opts.renamedTo) {
      openOverlay("conflict", { existing: collision, incoming: draft });
      return;
    }
    let toSave = draft;
    if (opts.renamedTo) toSave = { ...draft, filename: opts.renamedTo };
    setPrompts(ps => {
      const exists = ps.some(p => p.id === toSave.id);
      return exists ? ps.map(p => p.id === toSave.id ? toSave : p) : [toSave, ...ps];
    });
    closeOverlay();
    setSelectedId(toSave.id);
    setEditingId(null);
    setToast({ kind: "ok", msg: `Saved ${toSave.folder}/${toSave.filename}` });
  };

  const archivePrompt = (id) => {
    const p = prompts.find(x => x.id === id);
    if (!p) return;
    updatePrompt(id, { folder: "99-Archive" });
    setToast({ kind: "ok", msg: `Archived ${p.title}` });
  };

  const duplicatePrompt = (id) => {
    const p = prompts.find(x => x.id === id);
    if (!p) return;
    const np = { ...p, id: "p" + Math.random().toString(36).slice(2,7), filename: p.filename.replace(/\.md$/, "-copy.md"), title: p.title + " (copy)", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reuseCount: 0 };
    setPrompts(ps => [np, ...ps]);
    setSelectedId(np.id);
    setToast({ kind: "ok", msg: `Duplicated as ${np.filename}` });
  };

  const copyBody = (id) => {
    const p = prompts.find(x => x.id === id);
    if (!p) return;
    if (navigator.clipboard) navigator.clipboard.writeText(p.body || "").catch(() => {});
    updatePrompt(id, { reuseCount: (p.reuseCount || 0) + 1 });
    setToast({ kind: "ok", msg: `Copied "${p.title}"` });
  };

  const movePrompt = (id, dest) => {
    updatePrompt(id, { folder: dest });
    closeOverlay();
    setToast({ kind: "ok", msg: `Moved to ${dest}` });
  };

  // ---- Command palette commands ----
  const commands = [
    { id: "new", label: "New prompt — paste & classify", kbd: "Ctrl N", icon: "plus" },
    { id: "tray", label: "Open quick capture window", kbd: "Ctrl+Shift N", icon: "inbox" },
    { id: "home", label: "Go to: Library Home", icon: "grid" },
    { id: "browse", label: "Go to: Browse library", icon: "folder" },
    { id: "recent", label: "Go to: Recently added", icon: "clock" },
    { id: "reuse", label: "Go to: High reuse", icon: "star" },
    { id: "hygiene", label: "Go to: Library hygiene", icon: "warning" },
    { id: "archive", label: "Go to: Archive", icon: "archive" },
    { id: "settings", label: "Open Settings", kbd: "Ctrl ,", icon: "settings" },
    { id: "folders", label: "Manage folders", icon: "folder-open" },
    { id: "shortcuts", label: "Show keyboard shortcuts", kbd: "Ctrl /", icon: "keyboard" },
    { id: "theme", label: "Toggle theme", icon: tweaks.theme === "dark" ? "sun" : "moon" },
    { id: "first-run", label: "Re-run first-time setup", icon: "refresh" },
  ];

  const runCommand = (id) => {
    if (id === "new") openOverlay("intake");
    else if (id === "tray") openOverlay("tray");
    else if (id === "settings") openOverlay("settings");
    else if (id === "folders") openOverlay("folders");
    else if (id === "shortcuts") openOverlay("shortcuts");
    else if (id === "theme") setTweak("theme", tweaks.theme === "dark" ? "light" : "dark");
    else if (id === "first-run") setTweak("stage", "first-run");
    else if (["home","browse","recent","reuse","hygiene","archive"].includes(id)) setView(id);
  };

  const HOTKEYS = [
    ["Ctrl K", "Open command palette / search"],
    ["Ctrl N", "New prompt (paste & classify)"],
    ["Ctrl+Shift N", "Quick capture (tray window)"],
    ["Ctrl S", "Save current prompt"],
    ["Ctrl ,", "Open Settings"],
    ["Ctrl /", "Show this shortcut sheet"],
    ["Esc", "Close overlay or editor"],
    ["Enter", "Open selected prompt"],
    ["↑↓", "Move selection in lists"],
    ["Ctrl D", "Duplicate prompt"],
    ["Ctrl E", "Edit metadata of selection"],
    ["Ctrl ⇧ A", "Archive selected prompt"],
    ["Ctrl ⇧ C", "Copy prompt body"],
    ["Ctrl ⇧ M", "Move prompt to another folder"],
  ];

  // ---- First-run stage ----
  if (stage === "first-run") {
    return (
      <div style={{ position: "fixed", inset: 0, fontFamily: "var(--sans)", color: "var(--text)" }}>
        <PL.FirstRun
          onComplete={(path, opts) => {
            setRootPath(path);
            if (opts.initStructure) setTree(window.FOLDER_TREE);
            if (opts.mode === "new") setPrompts([]);
            setTweak({ stage: "main", library: opts.mode === "new" ? "empty" : tweaks.library });
            setToast({ kind: "ok", msg: `Library set to ${path}` });
          }}
        />
        {/* Tweaks panel still mounted */}
        <window.TweaksPanel title="Tweaks" tweaks={t} onChange={setTweak}>
          <PrototypeTweaks tweaks={tweaks} setTweak={setTweak}/>
        </window.TweaksPanel>
      </div>
    );
  }

  // ---- Main app ----
  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
      fontFamily: "var(--sans)",
      color: "var(--text)",
      background: "var(--bg)",
      overflow: "hidden",
    }}>
      <PL.TitleBar
        rootPath={rootPath}
        onCmdK={() => setCmdOpen(true)}
        onTheme={() => setTweak("theme", tweaks.theme === "dark" ? "light" : "dark")}
        themeDark={tweaks.theme === "dark"}
        onSettings={() => openOverlay("settings")}
        onQuickCapture={() => openOverlay("tray")}
        onTrayDemo={() => openOverlay("tray")}
      />

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {showSidebar && (
          <PL.Sidebar
            view={view}
            onView={(v) => { setView(v); setEditingId(null); }}
            tree={tree}
            prompts={prompts}
            selectedFolder={selectedFolder}
            onSelectFolder={(p) => { setSelectedFolder(p); setEditingId(null); }}
            recentCount={recentList.length}
            highReuseCount={highReuseList.length}
            hygieneCount={hygieneList.length}
            archiveCount={archiveList.length}
            onNew={() => openOverlay("intake")}
          />
        )}

        {/* Center */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", background: "var(--bg-panel)" }}>
          {editing ? (
            <PL.EditorView
              prompt={editing}
              onChange={(patch) => updatePrompt(editing.id, patch)}
              onClose={() => setEditingId(null)}
              onSave={() => { setToast({ kind: "ok", msg: `Saved ${editing.folder}/${editing.filename}` }); }}
            />
          ) : view === "home" ? (
            <PL.HomeView
              prompts={prompts}
              onOpen={(id) => { setSelectedId(id); setEditingId(id); }}
              onView={setView}
              onNew={() => openOverlay("intake")}
              onSave={(draft, cls) => savePrompt(draft, cls)}
              rootPath={rootPath}
            />
          ) : view === "browse" ? (
            <PL.BrowseView
              prompts={prompts}
              selectedFolder={selectedFolder}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpen={(id) => { setSelectedId(id); setEditingId(id); }}
              density={tweaks.density}
              onChangeFolder={() => openOverlay("intake")}
              query={query}
              onQuery={setQuery}
              filter={filter}
              onFilter={setFilter}
            />
          ) : view === "recent" ? (
            <PL.ListView title="Recently added" subtitle="Sorted by last edit. Recent captures land here first." prompts={recentList} onOpen={(id) => { setSelectedId(id); setEditingId(id); }} onSelect={setSelectedId} selectedId={selectedId} density={tweaks.density}/>
          ) : view === "reuse" ? (
            <PL.ListView title="High reuse" subtitle="Prompts you copy or insert most often. Keep these clean and well-tagged." prompts={[...highReuseList].sort((a,b) => (b.reuseCount||0) - (a.reuseCount||0))} onOpen={(id) => { setSelectedId(id); setEditingId(id); }} onSelect={setSelectedId} selectedId={selectedId} density={tweaks.density}/>
          ) : view === "archive" ? (
            <PL.ListView title="Archive" subtitle="Read-only by convention. Move out of 99-Archive to revive." prompts={archiveList} onOpen={(id) => { setSelectedId(id); setEditingId(id); }} onSelect={setSelectedId} selectedId={selectedId} density={tweaks.density}/>
          ) : view === "hygiene" ? (
            <PL.HygieneView prompts={prompts} onSelect={setSelectedId} onOpen={(id) => setEditingId(id)}/>
          ) : null}
        </div>

        {/* Right panel */}
        {tweaks.showRightPanel && !editing && (
          <div style={{ width: 320, background: "var(--bg-panel)", borderLeft: "1px solid var(--border)", flexShrink: 0, overflow: "hidden" }}>
            <PL.MetadataPanel
              prompt={selected}
              onChange={(patch) => updatePrompt(selected.id, patch)}
              onArchive={() => archivePrompt(selected.id)}
              onMove={() => openOverlay("move", { id: selected.id })}
              onDuplicate={() => duplicatePrompt(selected.id)}
              onCopy={() => copyBody(selected.id)}
              classification={selected?.id === "p001" ? {
                confidence: 0.92,
                rationale: "Verbs 'remove', 'preserve' and the 'transcript' noun signal a transform on text. Domain keyword 'transcript' maps to Core Transforms / Transcript Cleanup.",
              } : null}
            />
          </div>
        )}
      </div>

      <PL.StatusBar
        rootPath={rootPath}
        promptCount={prompts.length}
        selection={selected ? `selected: ${selected.title}` : null}
        view={view}
        syncedAt="just now"
      />

      {/* Overlays */}
      {cmdOpen && (
        <PL.CommandPalette
          onClose={() => setCmdOpen(false)}
          prompts={prompts}
          onOpenPrompt={(id) => { setSelectedId(id); setEditingId(id); }}
          onCommand={runCommand}
          commands={commands}
        />
      )}

      {overlay === "intake" && (
        <PL.IntakeView
          onCancel={closeOverlay}
          onSave={(draft, cls) => savePrompt(draft, cls)}
          initialText={overlayCtx.initialText || ""}
          accent={tweaks.accent}
        />
      )}
      {overlay === "settings" && (
        <PL.SettingsView
          rootPath={rootPath}
          onChangeRoot={() => setTweak("stage", "first-run")}
          onClose={closeOverlay}
          hotkeys={HOTKEYS}
        />
      )}
      {overlay === "folders" && (
        <PL.FolderManager tree={tree} prompts={prompts} onClose={closeOverlay} onRename={() => { closeOverlay(); setToast({ kind: "ok", msg: "Folders updated. Files moved on disk." }); }}/>
      )}
      {overlay === "conflict" && (
        <PL.ConflictModal
          existing={overlayCtx.existing}
          incoming={overlayCtx.incoming}
          onClose={closeOverlay}
          onResolve={(mode, newName) => {
            if (mode === "rename") savePrompt(overlayCtx.incoming, null, { renamedTo: newName });
            else if (mode === "overwrite") savePrompt(overlayCtx.incoming, null, { allowOverwrite: true });
            else { closeOverlay(); setToast({ kind: "warn", msg: "Diff view would open here (not implemented in mockup)." }); }
          }}
        />
      )}
      {overlay === "shortcuts" && <PL.ShortcutsOverlay onClose={closeOverlay} hotkeys={HOTKEYS}/>}
      {overlay === "tray" && (
        <PL.TrayCapture
          onClose={closeOverlay}
          onSend={(text) => { closeOverlay(); openOverlay("intake", { initialText: text }); }}
        />
      )}
      {overlay === "move" && (
        <PL.MoveModal
          tree={tree}
          current={selected?.folder}
          onClose={closeOverlay}
          onMove={(dest) => movePrompt(overlayCtx.id, dest)}
        />
      )}

      {toast && <PL.Toast kind={toast.kind} onClose={() => setToast(null)}>{toast.msg}</PL.Toast>}

      {/* Tweaks */}
      <window.TweaksPanel title="Tweaks">
        <PrototypeTweaks tweaks={tweaks} setTweak={setTweak}/>
      </window.TweaksPanel>
    </div>
  );
};

const PrototypeTweaks = ({ tweaks, setTweak }) => {
  const { TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakColor, TweakButton } = window;
  return (
    <>
      <TweakSection title="Appearance">
        <TweakRadio label="Theme" value={tweaks.theme} options={[{value:"dark",label:"Dark"},{value:"light",label:"Light"}]} onChange={(v) => setTweak("theme", v)}/>
        <TweakRadio label="Density" value={tweaks.density} options={[{value:"comfortable",label:"Comfy"},{value:"compact",label:"Compact"}]} onChange={(v) => setTweak("density", v)}/>
        <TweakColor
          label="Accent"
          value={tweaks.accent}
          options={Object.entries(PL.accents).map(([k, v]) => ({ value: k, label: v.name, color: v.hex }))}
          onChange={(v) => setTweak("accent", v)}
        />
      </TweakSection>
      <TweakSection title="Stage">
        <TweakRadio
          label="Stage"
          value={tweaks.stage}
          options={[{value:"main",label:"Main app"},{value:"first-run",label:"First-run"}]}
          onChange={(v) => setTweak("stage", v)}
        />
        <TweakRadio
          label="Library"
          value={tweaks.library}
          options={[{value:"seeded",label:"Seeded (33)"},{value:"empty",label:"Empty"}]}
          onChange={(v) => setTweak("library", v)}
        />
      </TweakSection>
      <TweakSection title="Layout">
        <TweakToggle label="Right metadata panel" value={tweaks.showRightPanel} onChange={(v) => setTweak("showRightPanel", v)}/>
      </TweakSection>
    </>
  );
};

// Custom TweakColor swatches (the helper expects array; we supply named options).
// We pass options with {value,label,color}; the TweakColor component handles strings;
// we'll wrap in a custom row to render labeled swatches.
// We rely on TweakColor's handling of array-of-strings; quick adapter:
window.TweakColor = ({ label, value, options, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
    <span style={{ fontSize: 11, color: "var(--text-dim)", flex: 1 }}>{label}</span>
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(o => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.label}
          style={{
            width: 22, height: 22, borderRadius: 4,
            background: o.color, cursor: "pointer",
            border: `2px solid ${value === o.value ? "var(--text)" : "transparent"}`,
            outline: value === o.value ? "1px solid var(--text)" : "none",
            outlineOffset: 1,
          }}
        />
      ))}
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);

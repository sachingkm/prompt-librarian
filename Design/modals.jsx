// Modals: command palette, conflict modal, shortcuts overlay, tray quick-capture, move modal.

const { Icon, Btn, Pill, Kbd, Field, Input, fmt } = PL;

// Backdrop wrapper
const Backdrop = ({ onClose, children, align = "top" }) => (
  <div style={{
    position: "absolute", inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex", justifyContent: "center", alignItems: align === "top" ? "flex-start" : "center",
    paddingTop: align === "top" ? 80 : 0,
    zIndex: 100,
  }} onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>
);
PL.Backdrop = Backdrop;

// ---- Command palette ----
PL.CommandPalette = ({ onClose, prompts, onOpenPrompt, onCommand, commands }) => {
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const inputRef = React.useRef();

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const items = React.useMemo(() => {
    const ql = q.toLowerCase();
    const cmdItems = commands
      .filter(c => !ql || c.label.toLowerCase().includes(ql) || (c.kw||"").toLowerCase().includes(ql))
      .map(c => ({ kind: "cmd", id: c.id, label: c.label, kbd: c.kbd, icon: c.icon || "cmd", section: "Commands" }));
    const promptItems = ql
      ? prompts.filter(p =>
          p.title.toLowerCase().includes(ql) ||
          (p.tags||[]).some(t => t.toLowerCase().includes(ql)) ||
          p.folder.toLowerCase().includes(ql) ||
          (p.body||"").toLowerCase().includes(ql)
        ).slice(0, 12).map(p => ({ kind: "prompt", id: p.id, label: p.title, hint: p.folder, icon: "file-md", section: "Prompts" }))
      : [];
    return [...cmdItems, ...promptItems];
  }, [q, prompts, commands]);

  React.useEffect(() => { setIdx(0); }, [q]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      const it = items[idx];
      if (!it) return;
      if (it.kind === "cmd") onCommand(it.id);
      else onOpenPrompt(it.id);
      onClose();
    } else if (e.key === "Escape") onClose();
  };

  let lastSection = null;
  return (
    <Backdrop onClose={onClose}>
      <div style={{
        width: 600,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 12px", borderBottom: "1px solid var(--border)" }}>
          <Icon name="search" size={14} style={{ color: "var(--text-muted)", marginRight: 8 }}/>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search prompts, run a command…"
            style={{
              flex: 1, height: 44, background: "transparent",
              border: "none", outline: "none",
              color: "var(--text)", fontSize: 14,
              fontFamily: "var(--sans)",
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "6px 0" }}>
          {items.length === 0 && (
            <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>No results.</div>
          )}
          {items.map((it, i) => {
            const showHeader = it.section !== lastSection;
            lastSection = it.section;
            const active = i === idx;
            return (
              <React.Fragment key={`${it.kind}:${it.id}`}>
                {showHeader && (
                  <div style={{ padding: "6px 14px 4px", fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>
                    {it.section}
                  </div>
                )}
                <div
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => onKey({ key: "Enter", preventDefault: () => {} })}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "0 14px", height: 30,
                    cursor: "pointer",
                    background: active ? "var(--bg-active)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-dim)",
                    borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                    fontSize: 13,
                  }}
                >
                  <Icon name={it.icon} size={13} style={{ color: "var(--text-muted)" }}/>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                  {it.hint && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{it.hint}</span>}
                  {it.kbd && <Kbd>{it.kbd}</Kbd>}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "6px 12px", borderTop: "1px solid var(--border)", background: "var(--bg-panel-alt)", gap: 14, fontSize: 11, color: "var(--text-muted)" }}>
          <span><Kbd>↑↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> select</span>
          <span><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </Backdrop>
  );
};

// ---- Conflict modal ----
PL.ConflictModal = ({ existing, incoming, onClose, onResolve }) => {
  const [mode, setMode] = React.useState("rename");
  const [newName, setNewName] = React.useState(() => {
    const m = incoming.filename.match(/^(.+?)(\.md)$/);
    return m ? `${m[1]}-1.md` : `${incoming.filename}-1`;
  });

  return (
    <Backdrop onClose={onClose} align="center">
      <div style={{
        width: 720,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-panel-alt)" }}>
          <Icon name="warning" size={16} style={{ color: "var(--warn)" }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Filename collision</div>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-muted)" }}>{incoming.folder}/{incoming.filename}</div>
          </div>
          <PL.IconBtn icon="x" onClick={onClose}/>
        </div>

        <div style={{ padding: 18 }}>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0, marginBottom: 14, lineHeight: 1.5 }}>
            A file with that name already exists at this path. Pick how to handle it. The app will not silently overwrite.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <DiffPane label="Existing on disk" p={existing} muted/>
            <DiffPane label="Incoming (this save)" p={incoming}/>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Choice
              selected={mode === "rename"}
              onClick={() => setMode("rename")}
              icon="edit"
              title="Save as new file"
              body="Keep the existing file untouched. Save the incoming prompt under a new filename."
            >
              {mode === "rename" && (
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ marginTop: 8, width: "100%", fontFamily: "var(--mono)" }}/>
              )}
            </Choice>
            <Choice
              selected={mode === "overwrite"}
              onClick={() => setMode("overwrite")}
              icon="warning"
              title="Replace existing"
              danger
              body="Overwrite the file on disk. The previous version will be lost unless you keep a backup."
            />
            <Choice
              selected={mode === "merge"}
              onClick={() => setMode("merge")}
              icon="copy"
              title="Open both side-by-side"
              body="Open the existing and incoming versions in a diff view so you can hand-merge into a single file."
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant={mode === "overwrite" ? "danger" : "primary"} icon="check" onClick={() => onResolve(mode, newName)}>
              {mode === "rename" ? "Save as new file" : mode === "overwrite" ? "Replace existing" : "Open diff"}
            </Btn>
          </div>
        </div>
      </div>
    </Backdrop>
  );
};

const DiffPane = ({ label, p, muted }) => (
  <div style={{
    background: muted ? "var(--bg-panel-alt)" : "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    overflow: "hidden",
    opacity: muted ? 0.85 : 1,
  }}>
    <div style={{ padding: "6px 10px", fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{label}</div>
    <div style={{ padding: 10, fontSize: 12, color: "var(--text)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.title}</div>
      <Row k="updated" v={fmt.relTime(p.updated_at)}/>
      <Row k="size" v={`${(p.body||"").length.toLocaleString()} chars`}/>
      <Row k="reuse" v={p.reuse || "—"}/>
      <Row k="tags" v={(p.tags||[]).join(", ") || "—"}/>
    </div>
  </div>
);
const Row = ({ k, v }) => (
  <div style={{ display: "flex", gap: 6, fontFamily: "var(--mono)", fontSize: 11 }}>
    <span style={{ color: "var(--text-muted)", minWidth: 56 }}>{k}</span>
    <span style={{ color: "var(--text-dim)" }}>{v}</span>
  </div>
);
const Choice = ({ selected, onClick, icon, title, body, children, danger }) => (
  <div onClick={onClick} style={{
    padding: 12,
    background: selected ? "var(--bg-active)" : "var(--bg-panel-alt)",
    border: `1px solid ${selected ? (danger ? "var(--danger)" : "var(--accent)") : "var(--border)"}`,
    borderRadius: 4, cursor: "pointer",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Icon name={icon} size={14} style={{ color: danger ? "var(--danger)" : selected ? "var(--accent)" : "var(--text-dim)" }}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: danger ? "var(--danger)" : "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{body}</div>
      </div>
      <span style={{
        width: 14, height: 14, borderRadius: "50%",
        border: `2px solid ${selected ? (danger ? "var(--danger)" : "var(--accent)") : "var(--border-strong)"}`,
        background: selected ? (danger ? "var(--danger)" : "var(--accent)") : "transparent",
      }}/>
    </div>
    {children}
  </div>
);

// ---- Move modal ----
PL.MoveModal = ({ tree, current, onClose, onMove }) => {
  const [dest, setDest] = React.useState(current);
  const flat = [];
  const walk = (nodes, depth = 0) => nodes.forEach(n => { flat.push({ ...n, depth }); walk(n.children || [], depth + 1); });
  walk(tree);
  return (
    <Backdrop onClose={onClose} align="center">
      <div style={{ width: 480, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, background: "var(--bg-panel-alt)" }}>
          <Icon name="move" size={14}/>
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Move prompt</div>
          <PL.IconBtn icon="x" onClick={onClose}/>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: "6px 0" }}>
          {flat.map(n => (
            <div key={n.path} onClick={() => setDest(n.path)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 14px", paddingLeft: 14 + n.depth * 14,
              cursor: "pointer", fontSize: 13,
              background: dest === n.path ? "var(--bg-active)" : "transparent",
              color: dest === n.path ? "var(--text)" : "var(--text-dim)",
              borderLeft: dest === n.path ? "2px solid var(--accent)" : "2px solid transparent",
            }}>
              <Icon name="folder" size={12} style={{ color: "var(--text-muted)" }}/>
              <span>{n.name}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderTop: "1px solid var(--border)", background: "var(--bg-panel-alt)" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>→ {dest}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" icon="check" onClick={() => onMove(dest)}>Move here</Btn>
          </div>
        </div>
      </div>
    </Backdrop>
  );
};

// ---- Shortcuts overlay ----
PL.ShortcutsOverlay = ({ onClose, hotkeys }) => (
  <Backdrop onClose={onClose} align="center">
    <div style={{ width: 640, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, background: "var(--bg-panel-alt)" }}>
        <Icon name="keyboard" size={14}/>
        <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Keyboard shortcuts</div>
        <PL.IconBtn icon="x" onClick={onClose}/>
      </div>
      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 6 }}>
        {hotkeys.map(([k, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)", flex: 1 }}>{label}</span>
            <Kbd>{k}</Kbd>
          </div>
        ))}
      </div>
    </div>
  </Backdrop>
);

// ---- Tray quick-capture ----
PL.TrayCapture = ({ onClose, onSend }) => {
  const [text, setText] = React.useState("");
  const ref = React.useRef();
  React.useEffect(() => { ref.current?.focus(); }, []);
  return (
    <Backdrop onClose={onClose} align="center">
      <div style={{
        width: 380,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 16px 50px rgba(0,0,0,0.45)",
      }}>
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", background: "var(--bg-panel-alt)" }}>
          <div style={{ width: 16, height: 16, borderRadius: 3, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 10 }}>P</div>
          <div style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>Quick capture</div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)" }}>Tray window</span>
        </div>
        <div style={{ padding: 12 }}>
          <PL.Textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a prompt. Send to library to classify on the main app."
            rows={6}
            style={{ width: "100%", fontFamily: "var(--mono)" }}
          />
          <div style={{ display: "flex", alignItems: "center", marginTop: 10, gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{text.length} chars</span>
            <span style={{ flex: 1 }}/>
            <Btn size="sm" onClick={onClose}>Esc</Btn>
            <Btn size="sm" variant="primary" icon="arrow-right" kbd="Ctrl ↵" disabled={!text.trim()} onClick={() => onSend(text)}>Send to library</Btn>
          </div>
        </div>
      </div>
    </Backdrop>
  );
};

// ---- Folder management modal (simple) ----
PL.FolderManager = ({ tree, prompts, onClose, onRename }) => {
  const [edits, setEdits] = React.useState({});
  const flat = [];
  const walk = (nodes, depth = 0) => nodes.forEach(n => { flat.push({ ...n, depth }); walk(n.children || [], depth + 1); });
  walk(tree);
  const counts = {};
  prompts.forEach(p => { counts[p.folder] = (counts[p.folder]||0) + 1; });
  return (
    <Backdrop onClose={onClose} align="center">
      <div style={{ width: 720, maxHeight: "80vh", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, background: "var(--bg-panel-alt)" }}>
          <Icon name="folder-open" size={14}/>
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Manage folders</div>
          <PL.IconBtn icon="x" onClick={onClose}/>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
          {flat.map(n => (
            <div key={n.path} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", paddingLeft: 12 + n.depth * 16,
              borderBottom: "1px solid var(--border)",
            }}>
              <Icon name="folder" size={13} style={{ color: "var(--text-muted)" }}/>
              <Input
                value={edits[n.path] ?? n.name}
                onChange={(e) => setEdits({ ...edits, [n.path]: e.target.value })}
                style={{ flex: 1 }}
              />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)", minWidth: 80, textAlign: "right" }}>{counts[n.path]||0} prompts</span>
              <PL.IconBtn icon="trash" title="Delete folder"/>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderTop: "1px solid var(--border)", background: "var(--bg-panel-alt)" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Renaming a folder rewrites every file path inside it. The app moves files atomically.</span>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" icon="check" onClick={() => onRename(edits)}>Apply</Btn>
          </div>
        </div>
      </div>
    </Backdrop>
  );
};

// ---- Toast ----
PL.Toast = ({ kind = "ok", children, onClose }) => (
  <div style={{
    position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
    background: "var(--bg-panel)",
    border: `1px solid ${kind === "ok" ? "var(--ok)" : kind === "warn" ? "var(--warn)" : "var(--danger)"}`,
    borderLeftWidth: 3,
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    borderRadius: 4, padding: "10px 16px",
    display: "flex", alignItems: "center", gap: 10,
    fontSize: 13, color: "var(--text)",
    zIndex: 200, minWidth: 280,
  }}>
    <Icon name={kind === "ok" ? "check" : "warning"} size={14} style={{ color: kind === "ok" ? "var(--ok)" : "var(--warn)" }}/>
    <span style={{ flex: 1 }}>{children}</span>
    <PL.IconBtn icon="x" onClick={onClose}/>
  </div>
);

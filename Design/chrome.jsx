// Title bar + status bar + sidebar for Prompt Librarian.

const { Icon, Btn, Pill, Kbd } = PL;

// ---------------- Title Bar ----------------
PL.TitleBar = ({ rootPath, onCmdK, onTheme, themeDark, onSettings, onQuickCapture, onTrayDemo, density, onDensity }) => {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      height: 36,
      background: "var(--bg-panel-alt)",
      borderBottom: "1px solid var(--border)",
      paddingLeft: 12,
      WebkitAppRegion: "drag",
      userSelect: "none",
      flexShrink: 0,
    }}>
      {/* Traffic-light style left dots — neutral, not OS-specific */}
      <div style={{ display: "flex", gap: 6, marginRight: 14 }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ed6a5e", opacity: 0.85 }}/>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#f5bf4f", opacity: 0.85 }}/>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#62c554", opacity: 0.85 }}/>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
        <div style={{
          width: 16, height: 16, borderRadius: 3,
          background: "var(--accent)", color: "#fff",
          display: "grid", placeItems: "center",
          fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700,
        }}>P</div>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>Prompt Librarian</span>
        <span style={{ color: "var(--text-muted)" }}>—</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }} title={rootPath}>
          {rootPath ? rootPath.replace(/^.+[\\\/]/, "…/") + rootPath.match(/[\\\/]([^\\\/]+)$/)?.[1] || rootPath : "no library selected"}
        </span>
      </div>

      <div style={{ flex: 1 }}/>

      {/* Center search hint button */}
      <button
        type="button"
        onClick={onCmdK}
        style={{
          WebkitAppRegion: "no-drag",
          display: "flex", alignItems: "center", gap: 6,
          height: 22, padding: "0 8px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--text-muted)",
          fontSize: 12,
          cursor: "pointer",
          minWidth: 280,
        }}
      >
        <Icon name="search" size={12}/>
        <span>Search prompts, run a command…</span>
        <span style={{ flex: 1 }}/>
        <Kbd>Ctrl K</Kbd>
      </button>

      <div style={{ flex: 1 }}/>

      <div style={{ display: "flex", gap: 2, paddingRight: 10, WebkitAppRegion: "no-drag" }}>
        <IconBtn icon="inbox" title="Quick capture (Ctrl+Shift+N)" onClick={onQuickCapture}/>
        <IconBtn icon="grid" title="Tray demo" onClick={onTrayDemo}/>
        <IconBtn icon={themeDark ? "sun" : "moon"} title="Toggle theme" onClick={onTheme}/>
        <IconBtn icon="settings" title="Settings" onClick={onSettings}/>
      </div>
    </div>
  );
};

const IconBtn = ({ icon, title, onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      width: 26, height: 26, display: "grid", placeItems: "center",
      background: active ? "var(--bg-active)" : "transparent",
      border: "none",
      borderRadius: 4,
      color: "var(--text-dim)",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
    onMouseLeave={(e) => e.currentTarget.style.background = active ? "var(--bg-active)" : "transparent"}
  >
    <Icon name={icon} size={14}/>
  </button>
);
PL.IconBtn = IconBtn;

// ---------------- Status Bar ----------------
PL.StatusBar = ({ rootPath, promptCount, selection, syncedAt, view }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 14,
    height: 22, paddingLeft: 10, paddingRight: 10,
    background: "var(--bg-panel-alt)",
    borderTop: "1px solid var(--border)",
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--text-muted)",
    flexShrink: 0,
  }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)" }}/>
      Watching {rootPath || "—"}
    </span>
    <span>•</span>
    <span>{promptCount} prompts</span>
    {selection && <><span>•</span><span>{selection}</span></>}
    <span style={{ flex: 1 }}/>
    <span>view: {view}</span>
    <span>•</span>
    <span>last scan {syncedAt}</span>
  </div>
);

// ---------------- Sidebar (folder tree + nav) ----------------
PL.Sidebar = ({
  view, onView,
  tree, prompts, selectedFolder, onSelectFolder,
  recentCount, highReuseCount, hygieneCount, archiveCount,
  onNew,
}) => {
  const [expanded, setExpanded] = React.useState(() => new Set([
    "01-Core Transforms", "02-Interview", "03-Job Search", "04-Product Specs",
    "05-Research", "06-Project Prompts",
  ]));

  const toggle = (path) => {
    const next = new Set(expanded);
    next.has(path) ? next.delete(path) : next.add(path);
    setExpanded(next);
  };

  const counts = React.useMemo(() => {
    const m = {};
    prompts.forEach(p => {
      const parts = p.folder.split("/");
      for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(0, i + 1).join("/");
        m[sub] = (m[sub] || 0) + 1;
      }
    });
    return m;
  }, [prompts]);

  const NavRow = ({ icon, label, count, k, accent }) => (
    <div
      onClick={() => onView(k)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 26, padding: "0 10px",
        cursor: "pointer",
        background: view === k ? "var(--bg-active)" : "transparent",
        color: view === k ? "var(--text)" : "var(--text-dim)",
        borderLeft: view === k ? "2px solid var(--accent)" : "2px solid transparent",
      }}
      onMouseEnter={(e) => view !== k && (e.currentTarget.style.background = "var(--bg-hover)")}
      onMouseLeave={(e) => view !== k && (e.currentTarget.style.background = "transparent")}
    >
      <Icon name={icon} size={13} style={{ color: accent || "currentColor" }}/>
      <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
      {count != null && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-muted)" }}>{count}</span>}
    </div>
  );

  const renderNode = (node, depth = 0) => {
    const isExpanded = expanded.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedFolder === node.path && view === "browse";
    const count = counts[node.path] || 0;
    return (
      <React.Fragment key={node.path}>
        <div
          onClick={() => { onSelectFolder(node.path); onView("browse"); }}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            height: 24, paddingLeft: 8 + depth * 12, paddingRight: 8,
            cursor: "pointer",
            background: isSelected ? "var(--bg-active)" : "transparent",
            color: isSelected ? "var(--text)" : "var(--text-dim)",
            borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
            fontSize: 13,
          }}
          onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = "transparent")}
        >
          <span
            onClick={(e) => { if (hasChildren) { e.stopPropagation(); toggle(node.path); } }}
            style={{ width: 12, display: "grid", placeItems: "center", opacity: hasChildren ? 1 : 0 }}
          >
            <Icon name={isExpanded ? "chevron-down" : "chevron"} size={10}/>
          </span>
          <Icon name={isExpanded && hasChildren ? "folder-open" : "folder"} size={13} style={{ color: "var(--text-muted)" }}/>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
          {count > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)" }}>{count}</span>}
        </div>
        {isExpanded && hasChildren && node.children.map(c => renderNode(c, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div style={{
      width: 256,
      background: "var(--bg-panel)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      {/* Primary nav — Capture is home */}
      <div style={{ padding: "6px 0 4px" }}>
        <NavRow icon="plus" label="Capture" k="home" accent="var(--accent)"/>
      </div>

      {/* Secondary nav */}
      <div style={{ padding: "2px 0 6px", borderBottom: "1px solid var(--border)" }}>
        <NavRow icon="clock" label="Recently added" count={recentCount} k="recent"/>
        <NavRow icon="star" label="High reuse" count={highReuseCount} k="reuse"/>
        <NavRow icon="warning" label="Needs metadata" count={hygieneCount} k="hygiene" accent="var(--warn)"/>
        <NavRow icon="archive" label="Archive" count={archiveCount} k="archive"/>
      </div>

      {/* Folder tree section */}
      <div style={{
        padding: "8px 10px 4px",
        fontSize: 10, fontFamily: "var(--mono)",
        textTransform: "uppercase", letterSpacing: 0.6,
        color: "var(--text-muted)",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span style={{ flex: 1 }}>Library</span>
        <span title="New folder" style={{ cursor: "pointer", padding: 2 }}><Icon name="plus" size={10}/></span>
      </div>

      <div style={{ overflowY: "auto", paddingBottom: 8, maxHeight: "40%", flexShrink: 0 }}>
        {tree.map(n => renderNode(n))}
      </div>

      {/* History — recent captures, quick reopen */}
      <div style={{
        padding: "8px 10px 4px",
        fontSize: 10, fontFamily: "var(--mono)",
        textTransform: "uppercase", letterSpacing: 0.6,
        color: "var(--text-muted)",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <Icon name="clock" size={10} style={{ color: "var(--text-muted)" }}/>
        <span style={{ flex: 1 }}>History</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {[...prompts]
          .sort((a,b) => (b.updated_at||"").localeCompare(a.updated_at||""))
          .slice(0, 12)
          .map(p => (
            <div
              key={p.id}
              onClick={() => { onSelectFolder(p.folder); onView("browse"); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 24, padding: "0 12px",
                cursor: "pointer", fontSize: 12,
                color: "var(--text-dim)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              title={`${p.folder}/${p.filename}`}
            >
              <Icon name="file-md" size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }}/>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
            </div>
          ))}
        {prompts.length === 0 && (
          <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
            No captures yet.
          </div>
        )}
      </div>
    </div>
  );
};

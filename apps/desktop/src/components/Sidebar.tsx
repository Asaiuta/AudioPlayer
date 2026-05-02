export type ActivePage = "queue" | "library" | "history" | "settings";

interface NavItem {
  key: ActivePage;
  label: string;
  hint: string;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { key: "queue", label: "Queue", hint: "Now playing list" },
  { key: "library", label: "Library", hint: "Scanned tracks" },
  { key: "history", label: "History", hint: "Recent events" },
  { key: "settings", label: "Settings", hint: "Engine controls" }
];

interface SidebarProps {
  activePage: ActivePage;
  onChange: (page: ActivePage) => void;
  onRefresh: () => void;
}

export function Sidebar({ activePage, onChange, onRefresh }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar-brand">
        <div className="sidebar-eyebrow">High-Fidelity</div>
        <div className="sidebar-title">Listening Console</div>
      </div>

      <ul className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activePage;
          return (
            <li key={item.key}>
              <button
                type="button"
                className={`sidebar-nav-item${isActive ? " is-active" : ""}`}
                onClick={() => onChange(item.key)}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="sidebar-nav-label">{item.label}</span>
                <span className="sidebar-nav-hint">{item.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-footer">
        <button type="button" className="ghost-button" onClick={onRefresh}>
          Refresh state
        </button>
      </div>
    </nav>
  );
}

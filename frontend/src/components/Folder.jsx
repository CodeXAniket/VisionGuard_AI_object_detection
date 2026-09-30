import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// Inactive tabs get slightly darker the further back they sit.
const INACTIVE_SHADES = ['#bcb7ad', '#b3aea4', '#aaa59b'];

/**
 * A manila folder: tabs on top, a graph-paper sheet below.
 *
 * tabs: [{ key, to, label: ['Live', 'Camera'] }]
 * The sheet is re-mounted (key = active tab) whenever the tab changes, which
 * replays its slide-in animation. It slides in from the right when moving to
 * a tab further right, and from the left when moving back.
 */
export default function Folder({ tabs, activeKey, children }) {
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeKey));
  const previousIndex = useRef(activeIndex);
  const direction = activeIndex >= previousIndex.current ? 'right' : 'left';

  useEffect(() => {
    previousIndex.current = activeIndex;
  }, [activeIndex]);

  return (
    <div className="folder">
      <nav className="folder-tabs" aria-label="Sections">
        {tabs.map((tab, index) => {
          const isActive = index === activeIndex;
          return (
            <Link
              key={tab.key}
              to={tab.to}
              aria-current={isActive ? 'page' : undefined}
              className={`folder-tab ${isActive ? 'is-active' : ''}`}
              style={{
                zIndex: isActive ? 30 : 20 - index,
                '--tab-bg': isActive ? 'var(--color-folder)' : INACTIVE_SHADES[index % INACTIVE_SHADES.length],
              }}
            >
              <span>{tab.label[0]}</span>
              <span>{tab.label[1]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="folder-body">
        <div key={activeKey} className={`grid-paper sheet-in-${direction}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

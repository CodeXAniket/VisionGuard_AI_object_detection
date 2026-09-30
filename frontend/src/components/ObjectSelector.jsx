import { useMemo, useState } from 'react';
import { COMMON_CLASSES, MARKER_COLORS } from '../constants';

export default function ObjectSelector({ classes = [], selected = [], onChange, disabled = false }) {
  const [query, setQuery] = useState('');

  // Common monitoring classes first, then the rest of the COCO list.
  const orderedClasses = useMemo(
    () => [...COMMON_CLASSES.filter((c) => classes.includes(c)), ...classes.filter((c) => !COMMON_CLASSES.includes(c))],
    [classes]
  );
  const visibleClasses = orderedClasses.filter((name) => name.includes(query.trim().toLowerCase()));

  function toggle(name) {
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name]);
  }

  return (
    <div>
      {/* Selected objects look like highlighter-pen labels */}
      <div className="mb-3 flex min-h-7 flex-wrap gap-x-2 gap-y-1.5">
        {selected.length === 0 && <p className="text-[12px] text-muted">No objects selected yet.</p>}
        {selected.map((name, index) => (
          <span key={name} className="marker pop-in text-ink" style={{ backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length] }}>
            {name}
            <button
              type="button"
              onClick={() => toggle(name)}
              disabled={disabled}
              aria-label={`Remove ${name}`}
              className="cursor-pointer text-ink/50 hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${classes.length} object classes…`}
        className="field"
        disabled={disabled}
      />

      <div className="mt-2 max-h-40 overflow-y-auto rounded-[2px] bg-cell">
        {visibleClasses.length === 0 && <p className="px-3 py-2 text-[12px] text-muted">No matching classes.</p>}
        {visibleClasses.map((name) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-2 border-b border-folder px-3 py-1.5 text-[12.5px] text-ink last:border-b-0 hover:bg-paper"
          >
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={() => toggle(name)}
              disabled={disabled}
              className="accent-ink"
            />
            {name}
          </label>
        ))}
      </div>
    </div>
  );
}

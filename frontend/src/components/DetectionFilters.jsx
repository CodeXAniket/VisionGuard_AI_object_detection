const CONFIDENCE_OPTIONS = [
  { value: '', label: 'Any confidence' },
  { value: '0.5', label: '≥ 50%' },
  { value: '0.7', label: '≥ 70%' },
  { value: '0.8', label: '≥ 80%' },
  { value: '0.9', label: '≥ 90%' },
];

const hasFilters = (filters) => Object.values(filters).some(Boolean);

// filters: { objectClass, date, minConfidence } - all strings, '' means "no filter"
export default function DetectionFilters({ classes = [], filters, onChange, onReset }) {
  function update(field, value) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <>
      <select
        aria-label="Filter by object"
        className="pill cursor-pointer appearance-none pr-3 focus:outline-none"
        value={filters.objectClass}
        onChange={(e) => update('objectClass', e.target.value)}
      >
        <option value="">All objects ▾</option>
        {classes.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      <input
        aria-label="Filter by date"
        type="date"
        className="pill cursor-pointer focus:outline-none"
        value={filters.date}
        onChange={(e) => update('date', e.target.value)}
      />

      <select
        aria-label="Filter by confidence"
        className="pill cursor-pointer appearance-none pr-3 focus:outline-none"
        value={filters.minConfidence}
        onChange={(e) => update('minConfidence', e.target.value)}
      >
        {CONFIDENCE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      {hasFilters(filters) && (
        <button type="button" className="pill rise-in" onClick={onReset}>
          Clear ×
        </button>
      )}
    </>
  );
}

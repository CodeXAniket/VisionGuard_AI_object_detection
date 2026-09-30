// "Table / Insight" switch in the corner of the Detection Log sheet.
export default function ViewToggle({ value, options, onChange }) {
  return (
    <div className="toggle" role="group" aria-label="View">
      {options.map((option, index) => (
        <span key={option.value} className="flex items-center gap-1">
          {index > 0 && <span className="text-rule">/</span>}
          <button type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// Top row of a folder sheet: small pills on the left, controls on the right.
export default function SheetBar({ left, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

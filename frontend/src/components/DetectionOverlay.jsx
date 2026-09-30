import { formatConfidence } from '../utils/format';

const TARGET_COLOR = '#c4512e'; // selected objects (accent red)
const OTHER_COLOR = '#3f7fc6'; // everything else YOLO found (accent blue)

/**
 * Draws bounding boxes over a video/image.
 *
 * The SVG viewBox uses the pixel size of the frame YOLO analysed, so the
 * [x1, y1, x2, y2] coordinates can be used as-is. `preserveAspectRatio`
 * matches the `object-contain` scaling of the <video>/<img> underneath.
 *
 * detections: [{ class, confidence, bbox: [x1, y1, x2, y2], target }]
 */
export default function DetectionOverlay({ detections = [], frameWidth, frameHeight, showNonTargets = true }) {
  if (!frameWidth || !frameHeight) return null;

  const visible = showNonTargets ? detections : detections.filter((d) => d.target);
  const strokeWidth = Math.max(2, frameWidth / 320);
  const fontSize = Math.max(12, frameWidth / 40);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${frameWidth} ${frameHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {visible.map((detection, index) => {
        const [x1, y1, x2, y2] = detection.bbox;
        const color = detection.target ? TARGET_COLOR : OTHER_COLOR;
        const label = `${detection.class} ${formatConfidence(detection.confidence)}`;
        const labelWidth = label.length * fontSize * 0.6 + 8;
        const labelY = Math.max(0, y1 - fontSize - 6);

        return (
          <g key={`${detection.class}-${index}`} data-testid="bounding-box">
            <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke={color} strokeWidth={strokeWidth} />
            <rect x={x1} y={labelY} width={labelWidth} height={fontSize + 6} fill={color} />
            <text x={x1 + 4} y={labelY + fontSize} fill="white" fontSize={fontSize} fontFamily="JetBrains Mono, ui-monospace, monospace">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

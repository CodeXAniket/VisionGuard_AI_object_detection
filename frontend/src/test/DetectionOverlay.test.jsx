import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DetectionOverlay from '../components/DetectionOverlay';

const detections = [
  { class: 'person', confidence: 0.91, bbox: [10, 20, 110, 220], target: true },
  { class: 'chair', confidence: 0.55, bbox: [200, 50, 300, 150], target: false },
];

describe('DetectionOverlay', () => {
  it('draws one box per detection with class and confidence', () => {
    render(<DetectionOverlay detections={detections} frameWidth={640} frameHeight={480} />);
    expect(screen.getAllByTestId('bounding-box')).toHaveLength(2);
    expect(screen.getByText('person 91.0%')).toBeInTheDocument();
  });

  it('uses the frame size as the SVG coordinate system', () => {
    const { container } = render(<DetectionOverlay detections={detections} frameWidth={640} frameHeight={480} />);
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 640 480');
    const rect = container.querySelector('rect');
    expect(rect).toHaveAttribute('width', '100');
    expect(rect).toHaveAttribute('height', '200');
  });

  it('can hide objects that are not being monitored', () => {
    render(<DetectionOverlay detections={detections} frameWidth={640} frameHeight={480} showNonTargets={false} />);
    expect(screen.getAllByTestId('bounding-box')).toHaveLength(1);
    expect(screen.queryByText(/chair/)).not.toBeInTheDocument();
  });

  it('renders nothing without a frame size', () => {
    const { container } = render(<DetectionOverlay detections={detections} />);
    expect(container).toBeEmptyDOMElement();
  });
});

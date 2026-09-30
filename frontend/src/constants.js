// Minimum time between two frames sent for detection (ms).
// The loop also waits for each response before sending the next frame,
// so a slow backend automatically lowers the frame rate.
export const FRAME_INTERVAL_MS = 250;

// Wait this long before retrying after a failed detection request.
export const ERROR_RETRY_MS = 2000;

// Frames are downscaled to this width before upload.
export const MAX_FRAME_WIDTH = 640;

export const DETECTION_STATUSES = ['new', 'reviewed', 'dismissed'];

// Text colour for each event status (tracker-style coloured status column).
export const STATUS_COLORS = {
  new: 'text-accent-blue',
  reviewed: 'text-accent-green',
  dismissed: 'text-accent-olive',
};

// Shown first in the object selector - the most useful classes for monitoring.
export const COMMON_CLASSES = ['person', 'car', 'dog', 'cat', 'cell phone', 'backpack', 'laptop', 'bottle'];

// Highlighter-pen colours for object labels (orange, yellow, blue, pink).
export const MARKER_COLORS = ['#eab775', '#e8e05c', '#8cc4ec', '#eca2d4'];

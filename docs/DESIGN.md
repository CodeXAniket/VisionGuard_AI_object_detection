# VisionGuard AI: Design Decisions

Short answers to the questions this project is built to answer in an interview, each pointing at the code that implements it.

---

## Technology choices

**Why Python for computer vision?**
The CV/ML ecosystem (PyTorch, Ultralytics, OpenCV, NumPy) is Python-first. Running YOLO from Node would mean ONNX bindings or shelling out to Python anyway.

**Why YOLO?**
It is a single-stage detector: one forward pass predicts every box and class, so it's fast enough for real time on a CPU. `yolov8n` ("nano") is the smallest variant (~6 MB) and trades a little accuracy for speed. It's pretrained on COCO (80 everyday classes), so no training is needed. *This project integrates a pretrained model; it does not train one.*

**Why OpenCV?**
Decoding JPEG bytes into pixel arrays (`cv2.imdecode`), resizing (`cv2.resize`), webcam capture (`cv2.VideoCapture`) and drawing boxes for the local monitor. See `vision/utils/image.py` and `vision/camera.py`.

**Why NumPy?**
A frame *is* a NumPy array of shape `(height, width, 3)`. OpenCV produces one and YOLO consumes one. Box coordinates come out as arrays too (`parse_results` in `detector.py`).

**Why React?**
The monitoring page has a lot of live state (camera status, latest detections, session events, settings). React's state + component model keeps it manageable, and hooks (`useCamera`, `useDetectionLoop`) isolate the tricky browser APIs.

**Why Node.js/Express?**
The API is I/O-bound work: waiting on MongoDB, S3 and the vision service. Node's event loop handles that well, and Express is small enough that every route is easy to read.

**Why MongoDB?**
Detection events are self-contained documents (class, confidence, a nested bounding box, image reference) with no joins. MongoDB stores them as-is, and compound indexes make the main query ("this user's events, newest first, optionally one class") fast.

**Why AWS S3?**
Images are large binary blobs. Storing them in MongoDB would bloat the database and slow backups. S3 is cheap, durable and serves files directly to the browser. MongoDB keeps only the `s3Key`.

**Why JWT?**
The frame endpoint is called several times per second. A JWT is verified with a signature check only, with no database lookup per request (`middleware/auth.js`). It's also stateless, so the API could run on several servers without shared sessions.

**Why separate Python from Node?**
- Each part uses the best language for its job.
- Heavy inference can't block the API's event loop.
- They scale independently: add GPU machines for Python without touching the API.
- A clear contract (`POST /detect`) means either side can be replaced or tested alone (`tests/test_server.py` uses a fake detector; backend tests stub `visionService`).
- Python has no database credentials, so a bug there can't touch stored data.

---

## How it works

**How does the frontend communicate with the backend?**
REST over HTTP using Axios (`frontend/src/services/`). A request interceptor adds `Authorization: Bearer <jwt>`. A response interceptor logs the user out on a 401. Frames are sent as `multipart/form-data`; everything else is JSON.

**How does an image get from the webcam to S3?**
1. `getUserMedia` gives the browser a `MediaStream` (`hooks/useCamera.js`).
2. The frame is drawn on a `<canvas>`, downscaled to 640 px and encoded as JPEG (`utils/frameCapture.js`).
3. It's POSTed to `/api/monitoring/detect`. Multer keeps it **in memory** (`middleware/upload.js`).
4. Node forwards the bytes to Python, which decodes, runs YOLO and applies the cooldown.
5. If Python reports an event, Node uploads **that same buffer** to S3 (`services/detectionService.js`), then saves metadata with the `s3Key` in MongoDB.
6. To display it later, the API creates a **presigned URL** (valid 1 h) because the bucket is private.

**How does a detection event work?**
`person` detected at 0.93 → is `person` selected? → is 0.93 ≥ threshold? → is the `person` cooldown for this user active? If not → event. See `filter_detections` in `detector.py` and `EventHandler.process` in `event_handler.py`.

**How are duplicate detections prevented?**
`EventHandler` stores the time of the last event per class. A new event is only created once `cooldown_seconds` have passed. If one frame has two people, only the most confident one becomes the event. Cooldowns are per user (`EventHandlerRegistry`) and per class (a dog can still trigger while the person cooldown is active). `time.monotonic()` is used because it never jumps when the system clock changes. The tests use a fake clock: `tests/test_event_handler.py`.

Also, **ordinary frames are never uploaded**. Only event frames go to S3.

**How does authentication work?**
Register: validate → bcrypt hash (cost 10) → save → sign JWT `{ sub: userId }`. Login: compare bcrypt → same error for "no user" and "wrong password" (no account enumeration) → JWT. Protected routes: `requireAuth` verifies signature and expiry and sets `req.user`. Every detection query is filtered by `userId`, and accessing someone else's event returns 403.

**How is input validated?**
`backend/utils/validators.js` has plain functions that check types, ranges and allowed values (COCO class list) and list every problem in one 400 response. Checking `typeof === 'string'` also blocks NoSQL-injection payloads like `{ "$gt": "" }`.

---

## Failure handling

| Failure | What happens |
|---|---|
| **Camera permission denied / no camera / camera busy** | `describeCameraError` maps the browser error to a clear message on the Live page; nothing is sent. |
| **Camera unplugged mid-session** | The track's `ended` event sets camera status to "error" and shows a message. |
| **Vision service down** | Node's fetch fails → `503 "Vision service is unavailable..."`. The frontend shows a warning and retries every 2 s, so it recovers automatically when Python is back. The dashboard shows "Offline". |
| **YOLO model missing / invalid path** | Python logs the error but **keeps running**. `/health` reports `modelLoaded: false` with the reason, `/detect` returns 503 with it, and the UI displays it. |
| **S3 upload fails** | The event is **still saved** with `imageStatus: "failed"` (the detection itself is the important data). The error is logged. The UI shows "Upload failed" instead of a thumbnail. |
| **MongoDB insert fails after upload** | The just-uploaded S3 object is deleted so nothing is orphaned. |
| **MongoDB down at startup** | The API logs a clear error and exits (fail fast). If it drops later, queries return 503 "Database is unavailable". |
| **Invalid / expired JWT** | 401 with a specific message; the frontend clears the token and redirects to login. |
| **Unexpected error** | Logged with stack trace; the client gets a generic 500 (no internals leaked). |

---

## Performance

What's implemented:
- **One frame in flight**: the browser waits for each response before sending the next frame. A slow backend lowers the frame rate instead of building a queue of stale frames.
- **Frame interval**: at most one frame per 250 ms (~4 FPS). That's plenty for event detection.
- **Downscaling**: to 640 px wide in the browser (smaller upload) and again in Python if needed (`MAX_FRAME_WIDTH`). Boxes are scaled back to frame coordinates.
- **Confidence threshold passed to YOLO** (`conf=`) so weak boxes are dropped before non-maximum suppression.
- **Model warm-up** at startup so the first real frame isn't slow.
- **Only events are uploaded**; ordinary frames are never stored.
- **Skip frames** in the local monitor (`--every 2`).
- **Camera release**: `Camera` is a context manager, and the browser stops all tracks when monitoring stops or the user logs out.
- **Quiet logs**: per-frame requests aren't logged; only events and errors are.

**How would you improve inference performance?**
GPU (CUDA), a smaller input size, exporting to ONNX/TensorRT/OpenVINO, FP16/INT8 quantization, batching frames from several cameras, and several worker processes (the current service serialises inference with a lock).

**How would the system scale?**
- The **API** is stateless (JWT), so you can run N instances behind a load balancer.
- The **vision service** is the bottleneck. Run several GPU instances behind a load balancer and move the cooldown state (currently in memory, per process) into a shared store such as Redis, or use sticky sessions per user.
- For many cameras, switch from HTTP-per-frame to a **WebSocket** or a **queue** (frames in, results out) so producers and inference workers scale separately.
- **MongoDB**: the indexes already match the queries; later, shard by `userId`, and archive old events with a TTL index.
- **S3** scales on its own; add lifecycle rules to expire old snapshots and a CDN (CloudFront) for delivery.

---

## Known limitations (honest list)

- Cooldown state lives in the Python process's memory: restarting it resets cooldowns, and it isn't shared between multiple Python instances.
- Monitoring runs in the browser tab: closing the tab stops it (the local monitor is the "headless" alternative).
- The time-based cooldown can't tell two different people apart; object tracking would.
- JWT in `localStorage` is vulnerable if the page has an XSS bug. httpOnly cookies would be stricter.
- The Flask development server is fine for a demo, not for production traffic.

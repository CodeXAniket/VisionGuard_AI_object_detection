# VisionGuard AI

**AI-powered real-time object detection & event monitoring platform**

React · Node.js/Express · MongoDB · Python · OpenCV · Ultralytics YOLO · AWS S3 · JWT

---

## Overview

VisionGuard AI turns a normal webcam into a monitoring camera. You pick the objects you care about (for example `person` or `cell phone`), and the platform runs YOLO object detection on the live feed. When a selected object appears, it records a **detection event**: a snapshot goes to AWS S3 and the event metadata goes to MongoDB, where you can browse, filter and review it later.

> **Note on the model:** this project integrates a **pretrained** Ultralytics YOLO model (`yolov8n.pt`, trained on the 80-class COCO dataset). No custom model training is done. The work here is the system around the model: frame capture, inference service, event logic, storage and UI.

## Architecture

```
                    ┌──────────────────────────┐
                    │      React Frontend      │  webcam (getUserMedia),
                    │  Tailwind · Axios · JWT  │  bounding-box overlay
                    └────────────┬─────────────┘
                                 │  REST (JSON / multipart), Bearer JWT
                    ┌────────────▼─────────────┐
                    │   Node.js + Express API  │  auth, validation, events,
                    │                          │  statistics
                    └──┬──────────┬─────────┬──┘
                       │          │         │ HTTP (multipart) + shared API key
             Mongoose  │          │ AWS SDK ▼
                ┌──────▼───┐ ┌────▼─────┐ ┌─────────────────────────────┐
                │ MongoDB  │ │  AWS S3  │ │  Python vision service      │
                │ metadata │ │ snapshots│ │  Flask · OpenCV · NumPy     │
                └──────────┘ └──────────┘ │  YOLO inference + cooldown  │
                                          └─────────────────────────────┘
```

**Responsibilities are split cleanly:**

| Component | Owns | Does *not* do |
|---|---|---|
| React | Camera access, frame capture, drawing boxes, UI | Talk to Python, S3 or MongoDB directly |
| Node/Express | Auth, validation, persistence (MongoDB + S3), stats | Any image analysis |
| Python | Frame decoding, YOLO inference, filtering, event cooldown | Any database or S3 access |

## Features

- **Authentication**: register/login with bcrypt-hashed passwords and JWT-protected APIs
- **Folder-style workspace UI**: the app is one manila folder with two tabs; switching tabs slides the new graph-paper sheet in from the side
  - **Live Camera** (first tab): browser webcam feed with real-time bounding boxes, class names and confidence scores; objects in frame; recent events on a sticky note
  - **Detection Log**: *Table* view (history with snapshot thumbnails, full-size snapshot on "View", status (`new` / `reviewed` / `dismissed`) and delete per row, filters by object, date and minimum confidence, pagination) and *Insight* view (status breakdown, detections today, object "stamps", generated summary)
- **Object selection**: choose any of the 80 COCO classes to monitor
- **Configurable confidence threshold** and **event cooldown**, saved per user automatically as you change them, so they apply to the running monitor immediately
- **Duplicate suppression**: per-class cooldown so a person standing in view creates one event, not hundreds
- **Snapshots to S3**: only the frame that triggered an event is uploaded; the bucket stays private and images are served through presigned URLs
- **Standalone local monitor**: `local_monitor.py` runs YOLO on a local camera in an OpenCV window and can post events to the same API
- **Graceful failure handling**: camera denied or missing, vision service down, model missing, S3 failure, MongoDB down, invalid or expired JWT
- **Tests**: backend API tests (node:test + supertest + in-memory MongoDB), Python unit tests (pytest) and frontend component tests (Vitest + Testing Library)

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19, React Router, Tailwind CSS 4, Axios, Vite | Component-based UI; Axios interceptors attach the JWT in one place |
| Backend | Node.js, Express 5, Mongoose, Multer, jsonwebtoken, bcryptjs | Lightweight REST API; Express 5 forwards async errors to the error handler |
| Database | MongoDB | Flexible document model for event metadata; good fit for time-sorted queries |
| Computer vision | Python, Ultralytics YOLO, OpenCV, NumPy, Flask | Python is where the CV ecosystem lives; Flask is enough for a small internal API |
| Cloud storage | AWS S3 (AWS SDK v3, presigned URLs) | Cheap, durable object storage; keeps binaries out of the database |
| Testing | node:test, supertest, mongodb-memory-server, pytest, Vitest | Fast, isolated tests with no external services |

## Project Structure

```
visionguard-ai/
├── frontend/                  React + Tailwind (Vite)
│   └── src/
│       ├── components/        Folder (tabs + slide animation), Layout, DetectionOverlay, ObjectSelector,
│       │                      DetectionTable, LogInsight, EventList (sticky note), SummaryNote, ...
│       ├── pages/             Login, Register, LiveMonitoring (/camera), DetectionHistory (/log)
│       ├── services/          apiClient (Axios + JWT), auth/detection/monitoring/dashboard services
│       ├── hooks/             useCamera, useDetectionLoop, useApi
│       ├── context/           AuthContext, MonitoringContext
│       ├── utils/             frameCapture (canvas → JPEG), format helpers
│       ├── test/              Vitest tests
│       └── App.jsx            routes
├── backend/                   Node.js + Express
│   ├── config/                env.js (all env vars), db.js (MongoDB connection)
│   ├── controllers/           auth, detection, monitoring, dashboard
│   ├── middleware/            auth (JWT), upload (Multer), errorHandler, requestLogger
│   ├── models/                User, Detection, MonitoringConfig
│   ├── routes/                one router per resource
│   ├── services/              s3Service, visionService, detectionService
│   ├── utils/                 validators, ApiError, logger, cocoClasses
│   ├── tests/                 API tests
│   ├── app.js                 Express app (importable by tests)
│   └── server.js              startup: env check, DB connect, listen
├── vision/                    Python computer-vision service
│   ├── detector.py            YOLO loading, inference, result parsing, filtering
│   ├── event_handler.py       cooldown / duplicate-suppression logic
│   ├── camera.py              OpenCV camera wrapper (local monitor)
│   ├── server.py              Flask HTTP API used by the backend
│   ├── local_monitor.py       standalone webcam → YOLO → OpenCV window
│   ├── utils/                 config, logger, image helpers, API client
│   ├── tests/                 pytest tests
│   └── requirements.txt
├── docs/DESIGN.md             design decisions & interview Q&A
├── legacy/                    the original single-file YOLO webcam prototype
├── start-dev.ps1              starts all three services on Windows
├── .env.example
└── README.md
```

## Setup

### Prerequisites

- **Node.js 20+** (developed on Node 24)
- **Python 3.10–3.12** (3.12 recommended; PyTorch wheels for the newest Python versions can lag behind)
- **MongoDB** running locally (Community Server) or a MongoDB Atlas connection string
- An **AWS account** with an S3 bucket (optional for a first run; see below)
- A webcam

### 1. Clone and configure

```bash
git clone https://github.com/CodeXAniket/VisionGuard_AI_object_detection.git visionguard-ai
cd visionguard-ai
cp backend/.env.example backend/.env
cp vision/.env.example vision/.env
cp frontend/.env.example frontend/.env
```

Then edit the files:

1. Set `JWT_SECRET` in `backend/.env` to a long random string:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. Set the **same** random value for `VISION_API_KEY` in both `backend/.env` and `vision/.env`.
3. Add your AWS values (see [AWS S3 Setup](#aws-s3-setup)).

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `PORT` | backend | API port (default `5000`) |
| `MONGODB_URI` | backend | MongoDB connection string |
| `JWT_SECRET` | backend | Secret used to sign JWTs (**required**) |
| `JWT_EXPIRES_IN` | backend | Token lifetime, e.g. `1d` |
| `CLIENT_ORIGIN` | backend | Allowed CORS origin (the React dev server) |
| `VISION_SERVICE_URL` | backend | URL of the Python service |
| `VISION_API_KEY` | backend + vision | Shared secret between Node and Python |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | backend | IAM user credentials (read by the AWS SDK) |
| `AWS_REGION` / `AWS_S3_BUCKET` | backend | Bucket location and name |
| `S3_URL_EXPIRES_SECONDS` | backend | Lifetime of presigned image URLs (default 3600) |
| `YOLO_MODEL` | vision | Weights file, default `yolov8n.pt` (auto-downloaded) |
| `MAX_FRAME_WIDTH` | vision | Frames wider than this are downscaled before inference |
| `VITE_API_URL` | frontend | Public URL of the API. **No secrets here**: Vite ships it to the browser |

AWS credentials exist **only** in `backend/.env`. The browser never sees them; it only receives time-limited presigned URLs.

## Running Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest
```

## Running Backend

```bash
cd backend
npm install
npm run dev          # nodemon, http://localhost:5000
npm test             # node:test + supertest + in-memory MongoDB
```

On startup the API logs whether MongoDB, S3 and the vision service are available:

```
[INFO] MongoDB connected: 127.0.0.1/visionguard
[INFO] VisionGuard API listening on http://localhost:5000
[INFO] AWS S3 bucket: visionguard-snapshots (ap-south-1)
[INFO] Vision service ready (model: yolov8n.pt)
```

## Running Python Vision Service

```bash
cd vision
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt       # installs PyTorch (CPU build), large download
python server.py                      # http://127.0.0.1:8000
pytest                                # unit tests
```

On the first run, Ultralytics downloads `yolov8n.pt` (~6 MB).

**Standalone local monitor** (no browser; handy for testing YOLO on its own):

```bash
python local_monitor.py --classes "person,cell phone" --conf 0.5 --cooldown 10
python local_monitor.py --classes person --save-dir snapshots    # save event images locally
python local_monitor.py --classes person --post                  # send events to the API
```

`--post` needs `VISIONGUARD_TOKEN` (the `token` returned by `POST /api/auth/login`) in the environment.

### Start order

1. MongoDB → 2. `vision/server.py` → 3. `backend` → 4. `frontend` → open http://localhost:5173

**Windows shortcut:** start all three in separate windows with

```powershell
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
```

> **Windows PowerShell 5.1 note:** `&&` doesn't work there (it only exists in PowerShell 7+). Chain commands with `;` instead, e.g. `cd backend; npm run dev`.

## AWS S3 Setup

1. **Create a bucket** (S3 console → Create bucket) in your region, e.g. `visionguard-snapshots-<yourname>`. Keep **"Block all public access" ON**. Images are served with presigned URLs, so the bucket never needs to be public.
2. **Add CORS** (bucket → Permissions → CORS) so the browser can load presigned images:
   ```json
   [{ "AllowedMethods": ["GET"], "AllowedOrigins": ["http://localhost:5173"], "AllowedHeaders": ["*"] }]
   ```
3. **Create an IAM user** for the app, with *programmatic access only*, and attach this least-privilege policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::visionguard-snapshots-<yourname>/detections/*"
     }]
   }
   ```
4. Create an access key for that user and put the values in `backend/.env` together with `AWS_REGION` and `AWS_S3_BUCKET`.

Objects are stored as `detections/<userId>/<yyyy-mm-dd>/<timestamp>-<uuid>.jpg`.

**Without S3 configured** the app still works: events are saved with `imageStatus: "failed"` and the UI shows "Upload failed" instead of a thumbnail.

## MongoDB Setup

- **Local:** install MongoDB Community Server and start it. The default `MONGODB_URI=mongodb://127.0.0.1:27017/visionguard` works as is.
- **Atlas:** create a free cluster, add a database user, allow your IP, and use the `mongodb+srv://...` connection string as `MONGODB_URI`.

Collections (`users`, `detections`, `monitoringconfigs`) and their indexes are created automatically by Mongoose.

**Indexes on `detections`:**

| Index | Serves |
|---|---|
| `{ userId: 1, timestamp: -1 }` | history sorted newest-first, "detections today", recent events; also any userId-only query (index prefix) |
| `{ userId: 1, objectClass: 1, timestamp: -1 }` | history filtered by object class, already sorted |

Without indexes, MongoDB scans every document in the collection (a `COLLSCAN`) for each history page. With them it reads only the matching entries, already in timestamp order, so no in-memory sort is needed. That difference grows as the number of events grows. `userId` comes first because every query is scoped to one user.

## API Endpoints

All responses use `{ "success": true, "data": ... }` or `{ "success": false, "message": "..." }`. Protected routes need `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | – | `{ name, email, password }` → `201 { token, user }` |
| POST | `/api/auth/login` | – | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | ✔ | Current user (used to restore a session) |
| POST | `/api/detections` | ✔ | Multipart: `image`, `objectClass`, `confidence`, `bbox` (JSON `[x1,y1,x2,y2]`), `frameWidth`, `frameHeight` → `201` event |
| GET | `/api/detections` | ✔ | Query: `objectClass`, `from`, `to`, `minConfidence`, `status`, `page`, `limit` → `{ items, pagination }` |
| GET | `/api/detections/:id` | ✔ | One event (with presigned `imageUrl`) |
| PATCH | `/api/detections/:id` | ✔ | `{ status: "new" \| "reviewed" \| "dismissed" }` |
| DELETE | `/api/detections/:id` | ✔ | Delete event (and its S3 object) |
| GET | `/api/monitoring/config` | ✔ | `{ targetClasses, confidenceThreshold, cooldownSeconds }` |
| PUT | `/api/monitoring/config` | ✔ | Replace the config (validated against COCO classes and ranges) |
| GET | `/api/monitoring/classes` | ✔ | The 80 COCO class names |
| GET | `/api/monitoring/health` | ✔ | Database, vision service and S3 status |
| POST | `/api/monitoring/detect` | ✔ | Multipart `frame` → `{ detections, events, frameWidth, frameHeight, inferenceMs }` |
| GET | `/api/dashboard/stats` | ✔ | `?since=<ISO>` → `{ detectionsToday, totalDetections, topObjectsToday, topObjects, statusCounts, failedUploads, recentEvents, lastDetectionAt }` |
| GET | `/api/health` | – | Liveness check |

**Status codes used:** `200` OK · `201` created · `400` validation error · `401` missing/invalid/expired token or bad credentials · `403` another user's event · `404` not found · `409` email already registered · `500` unexpected error · `502` vision service error · `503` vision service or database unavailable.

**Python vision service** (internal, called only by the backend; requires `X-API-Key`):

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | `{ modelLoaded, model, message }` (no key needed) |
| GET | `/classes` | Class names from the loaded model |
| POST | `/detect` | Multipart `frame`, `session_id`, `target_classes`, `confidence_threshold`, `cooldown_seconds` |

## Detection Workflow

```
Live Monitoring page → Start Monitoring
  → browser asks for camera permission (getUserMedia)
  → loop: draw <video> frame on a canvas, downscale to 640px, encode JPEG
        → POST /api/monitoring/detect            (one frame in flight at a time)
          → Node loads the user's config from MongoDB
          → Node → Python POST /detect
               → OpenCV decodes JPEG → NumPy array → YOLO inference
               → filter: selected classes AND confidence ≥ threshold
               → cooldown check per class → events
          ← detections (for boxes) + events
          → if events: upload THIS frame to S3 → save metadata in MongoDB
        ← response → React draws boxes; new events appear in "Recent events"
  → Detection Log reads from MongoDB + presigned S3 URLs
```

**Duplicate prevention:** `vision/event_handler.py` remembers when it last created an event for each class, per user. A detection only becomes an event if the cooldown (default 30 s, configurable 5–3600 s) has passed since the last event for that class. Frames that don't produce events are never stored or uploaded.

## UI

The app is a single "folder" with two tabs (Live Camera, Detection Log); switching tabs slides the next graph-paper sheet in. The visual style (manila folder tabs, graph-paper sheets, sticky notes, highlighter labels) was inspired by the "Feather Room" workspace design.

## Future Improvements

Not implemented, but natural next steps:

- **GPU inference**: run the vision service on a CUDA machine (Ultralytics uses the GPU automatically), typically several times faster than CPU
- **Model optimization**: export to ONNX/TensorRT/OpenVINO, use FP16 or INT8 quantization
- **WebSocket streaming**: push results over Socket.IO instead of one HTTP request per frame
- **Frame queues / multiprocessing**: several inference workers behind a queue for multiple cameras
- **Batching**: run inference on frames from several cameras in one batch
- **Object tracking** (e.g. ByteTrack) so that "the same person" is recognized across frames, instead of relying on a time-based cooldown
- **Notifications**: email or push when an event is created
- **httpOnly cookie auth** instead of localStorage, plus refresh tokens
- **Rate limiting** on the auth endpoints; production WSGI server (waitress/gunicorn) for Python
- **S3 lifecycle rules** to expire old snapshots automatically
- **Docker Compose** for one-command startup; CI pipeline running all three test suites
- **Multiple cameras per user** and RTSP/IP camera support in the web UI

See [docs/DESIGN.md](docs/DESIGN.md) for the design decisions behind the architecture.

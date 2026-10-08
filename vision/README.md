---
title: VisionGuard Vision Service
colorFrom: gray
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# VisionGuard AI - vision service

Python service that runs pretrained YOLOv8 object detection for the
[VisionGuard AI](https://github.com/CodeXAniket/VisionGuard_AI_object_detection) platform.
It is called only by the VisionGuard backend.

- `GET /health` - model status
- `POST /detect` - multipart frame, requires the `X-API-Key` header

The block at the top of this file configures Hugging Face Spaces (Docker, port 7860).

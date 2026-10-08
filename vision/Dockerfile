# VisionGuard vision service - container image (used by Hugging Face Spaces).
FROM python:3.12-slim-bookworm

# OpenCV needs these system libraries even without a display.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run containers as a non-root user with id 1000.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    VISION_HOST=0.0.0.0 \
    VISION_PORT=7860 \
    VISION_SERVER=waitress \
    YOLO_MODEL=yolov8n.pt
WORKDIR /home/user/app

# CPU-only PyTorch first: the default Linux wheel bundles CUDA and is several GB.
RUN pip install --no-cache-dir --user torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

COPY --chown=user . .

# Download the pretrained weights during the build so the service starts quickly.
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

EXPOSE 7860
CMD ["python", "server.py"]

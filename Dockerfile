# Stage 1: Build React Dashboard
FROM node:20-alpine AS frontend-builder
WORKDIR /app/doctor-dashboard
COPY doctor-dashboard/package*.json ./
RUN npm install
COPY doctor-dashboard/ ./
RUN npm run build

# Stage 2: Python FastAPI + OpenCV Runtime
FROM python:3.11-slim
WORKDIR /app

# Install system libraries for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend & cv modules
COPY backend/ ./backend/
COPY cv/ ./cv/
COPY ml/ ./ml/
COPY data/ ./data/

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/doctor-dashboard/dist ./doctor-dashboard/dist

ENV PYTHONPATH=/app
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

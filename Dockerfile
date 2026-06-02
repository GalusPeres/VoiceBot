# ─── Stage 1: Builder (kompiliert native Module) ──────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y \
    cmake make g++ git python3 wget curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
# Kompiliert node-llama-cpp (llama.cpp) + nodejs-whisper (whisper.cpp)
RUN npm ci

# Piper TTS Binary herunterladen
RUN wget -q https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz \
    && tar xzf piper_linux_x86_64.tar.gz \
    && rm piper_linux_x86_64.tar.gz

COPY . .

# ─── Stage 2: Runtime (nur was gebraucht wird) ────────────────────────────────
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y \
    libstdc++6 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Kompilierte node_modules + Piper-Binary aus Builder kopieren
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/piper ./piper

# Bot-Code kopieren
COPY . .

# Data-Ordner anlegen (wird auf Unraid als Volume gemountet)
RUN mkdir -p /data/models/whisper /data/models/llm /data/models/tts /data/temp

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PIPER_BIN=/app/piper/piper

EXPOSE 3003

CMD ["node", "bot.js"]

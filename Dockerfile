# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y \
    cmake make g++ git python3 wget curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

# whisper.cpp kompilieren, dann alles außer Binary + Download-Script löschen
RUN cd /app/node_modules/nodejs-whisper/cpp/whisper.cpp \
    && cmake -B build -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF -DGGML_AVX512=OFF -DGGML_AVX512_VBMI=OFF -DGGML_AVX512_VNNI=OFF -DGGML_AVX512_BF16=OFF \
    && cmake --build build -j$(nproc) --config Release \
    && BINARY=$(find build -name "whisper-cli" 2>/dev/null | head -1) \
    && [ -z "$BINARY" ] && BINARY=$(find build -name "main" 2>/dev/null | head -1) || true \
    && cp "$BINARY" /tmp/whisper-cli \
    && cp models/download-ggml-model.sh /tmp/download-ggml-model.sh \
    && cd /app/node_modules/nodejs-whisper/cpp \
    && rm -rf whisper.cpp \
    && mkdir -p whisper.cpp/build/bin whisper.cpp/models \
    && mv /tmp/whisper-cli whisper.cpp/build/bin/whisper-cli \
    && mv /tmp/download-ggml-model.sh whisper.cpp/models/download-ggml-model.sh \
    && chmod +x whisper.cpp/models/download-ggml-model.sh

# Piper TTS Binary herunterladen
RUN wget -q https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz \
    && tar xzf piper_linux_x86_64.tar.gz \
    && rm piper_linux_x86_64.tar.gz

COPY . .

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y \
    libstdc++6 ffmpeg wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# node_modules inkl. kompiliertem whisper-cli + Piper aus Builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/piper ./piper
COPY . .

RUN mkdir -p /data/models/whisper /data/models/llm /data/models/tts /data/temp

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PIPER_BIN=/app/piper/piper

EXPOSE 3003
CMD ["node", "bot.js"]

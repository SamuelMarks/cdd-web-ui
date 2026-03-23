FROM node:22-alpine AS builder

WORKDIR /app

# Install git and rust toolchain for WASM compilation
RUN apk add --no-cache git curl build-base
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-wasi

# Pull cdd-ctl which manages the generators and SDKs
RUN git clone https://github.com/SamuelMarks/cdd-ctl ../cdd-ctl

COPY package*.json ./
RUN npm ci

COPY . .

# Build the WASM binaries and place them into public/assets/wasm
RUN npm run build:wasm

# Bake the ts + html + css into a build artifact
RUN npm run build -- --configuration production

# Serve statically using NGINX
FROM nginx:alpine
# Copy custom nginx config if we had one for fallback routing (SPA), but default is okay if we just add a small tweak
COPY --from=builder /app/dist/tmp-app/browser /usr/share/nginx/html/

# Add a default nginx config for Angular routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    # Ensure correct MIME type for WASM files \
    location ~ \.wasm$ { \
        types { application/wasm wasm; } \
        default_type application/wasm; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

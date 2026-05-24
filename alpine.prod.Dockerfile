FROM node:22-alpine AS builder

WORKDIR /app

# Pull cdd-ctl which manages the generators and SDKs
RUN apk add --no-cache git
RUN git clone https://github.com/SamuelMarks/cdd-ctl ../cdd-ctl

COPY package*.json ./
RUN npm ci

COPY . .

# Bake the ts + html + css into a build artifact
RUN npm run build:prod

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
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

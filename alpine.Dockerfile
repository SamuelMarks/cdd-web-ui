FROM node:22-alpine AS builder

WORKDIR /app

# Install git to bring in cdd-* projects
RUN apk add --no-cache git

WORKDIR /app/cdd-projects
# Bring in the cdd-* projects as requested
RUN git clone https://github.com/SamuelMarks/cdd-c.git || true; \
    git clone https://github.com/SamuelMarks/cdd-cpp.git || true; \
    git clone https://github.com/SamuelMarks/cdd-csharp.git || true; \
    git clone https://github.com/SamuelMarks/cdd-go.git || true; \
    git clone https://github.com/SamuelMarks/cdd-java.git || true; \
    git clone https://github.com/SamuelMarks/cdd-kotlin.git || true; \
    git clone https://github.com/SamuelMarks/cdd-php.git || true; \
    git clone https://github.com/offscale/cdd-python-client.git || true; \
    git clone https://github.com/SamuelMarks/cdd-ruby.git || true; \
    git clone https://github.com/offscale/cdd-rust.git || true; \
    git clone https://github.com/SamuelMarks/cdd-sh.git || true; \
    git clone https://github.com/offscale/cdd-swift.git || true; \
    git clone https://github.com/offscale/cdd-web-ng.git || true;

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
# Bake the ts + html + css into a build artifact
RUN npm run build -- --configuration production

# Serve statically
FROM nginx:alpine
COPY --from=builder /app/dist/tmp-app/browser /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

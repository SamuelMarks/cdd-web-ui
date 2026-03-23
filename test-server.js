const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, 'dist', 'tmp-app', 'browser');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'audio/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((request, response) => {
  console.log(`request ${request.url}`);

  let filePath = request.url === '/' ? '/index.html' : request.url;
  filePath = path.join(PUBLIC_DIR, filePath);

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (error, content) => {
           response.writeHead(200, { 'Content-Type': 'text/html' });
           response.end(content, 'utf-8');
        });
      }
      else {
        response.writeHead(500);
        response.end(`Server Error: ${error.code} ..\n`);
        response.end(); 
      }
    }
    else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
  process.exit(0);
});

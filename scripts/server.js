import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT = process.env.PORT || 3015;
const DIST_DIR = path.resolve('./dist');
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};
const server = http.createServer((req, res) => {
  console.log(`[Local Server] ${req.method} ${req.url}`);
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Access Denied');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!req.url.includes('.') && fs.existsSync(filePath + '.json')) {
        filePath += '.json';
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('404 Not Found');
        return;
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error(`Error streaming file: ${streamErr.message}`);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  });
});
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 BedrockBuilds Local Dev Server is Running!`);
  console.log(`==================================================`);
  console.log(`🌐 Local URL: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`📂 Serving directory: ${DIST_DIR}`);
  console.log(`✨ Press Ctrl+C to stop the server.`);
  console.log(`==================================================\n`);
});

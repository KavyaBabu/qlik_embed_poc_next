const { createServer } = require('https');
const { parse } = require('url');
const fs = require('fs');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Load your cert and key
const httpsOptions = {
  key: fs.readFileSync('./certs/192.168.1.128-key.pem'),
  cert: fs.readFileSync('./certs/192.168.1.128.pem'),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(5500, '192.168.1.128', () => {
    console.log('> 🔐 HTTPS server ready at https://192.168.1.128:5500');
  });
});

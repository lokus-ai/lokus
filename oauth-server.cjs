const http = require('http');
const url = require('url');
const { exec } = require('child_process');

const PORT = 8080;

console.log('[OAUTH SERVER] 🚀 Starting Gmail OAuth callback server on port', PORT);

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  console.log('[OAUTH SERVER] 📥 Received request:', req.url);
  
  if (parsedUrl.pathname === '/gmail-callback') {
    const { code, state, error } = parsedUrl.query;
    
    if (error) {
      console.error('[OAUTH SERVER] ❌ OAuth error:', error);
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">❌ Authentication Failed</h1>
            <p>Error: ${error}</p>
            <p>You can close this window and try again.</p>
          </body>
        </html>
      `);
      return;
    }
    
    if (!code || !state) {
      console.error('[OAUTH SERVER] ❌ Missing code or state');
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">❌ Authentication Failed</h1>
            <p>Missing authorization code or state parameter.</p>
            <p>You can close this window and try again.</p>
          </body>
        </html>
      `);
      return;
    }
    
    console.log('[OAUTH SERVER] ✅ Received valid OAuth callback');
    console.log('[OAUTH SERVER] 📋 Code:', code.substring(0, 20) + '...');
    console.log('[OAUTH SERVER] 📋 State:', state);
    
    // Send success response to user
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #28a745;">✅ Authentication Successful!</h1>
          <p>Gmail connection completed successfully.</p>
          <p>You can close this window and return to Lokus.</p>
          <script>
            // Send message to Lokus app
            fetch('http://localhost:8080/complete-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: '${code}', state: '${state}' })
            }).catch(e => console.log('App notification sent'));
            
            // Auto-close after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
    
    // Notify the Tauri app through a separate endpoint
    setTimeout(() => {
      const postData = JSON.stringify({ code, state });
      
      const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/complete-auth',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = http.request(options, (res) => {
        console.log('[OAUTH SERVER] 📨 Auth completion notification sent');
      });
      
      req.on('error', (e) => {
        console.log('[OAUTH SERVER] ⚠️ Could not notify app (expected in this setup)');
      });
      
      req.write(postData);
      req.end();
    }, 100);
    
  } else if (parsedUrl.pathname === '/complete-auth' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { code, state } = JSON.parse(body);
        console.log('[OAUTH SERVER] 🔄 Processing auth completion...');
        
        // Write the auth data to a temporary file for the Tauri app to pick up
        const fs = require('fs');
        const path = require('path');
        const tempDir = path.join(require('os').homedir(), '.lokus', 'temp');
        
        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const authFile = path.join(tempDir, 'gmail_auth_callback.json');
        fs.writeFileSync(authFile, JSON.stringify({ code, state, timestamp: Date.now() }));
        
        console.log('[OAUTH SERVER] 💾 Auth data written to:', authFile);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        
      } catch (error) {
        console.error('[OAUTH SERVER] ❌ Error processing auth completion:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    
  } else {
    // Health check endpoint
    if (parsedUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', port: PORT }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
});

server.listen(PORT, 'localhost', () => {
  console.log('[OAUTH SERVER] 🌐 Gmail OAuth callback server running at http://localhost:' + PORT);
  console.log('[OAUTH SERVER] 📍 Callback URL: http://localhost:' + PORT + '/gmail-callback');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[OAUTH SERVER] 🛑 Shutting down OAuth server...');
  server.close(() => {
    console.log('[OAUTH SERVER] ✅ OAuth server stopped');
    process.exit(0);
  });
});
/**
 * start-tunnel.js — v4 FINAL
 *
 * Strategy: Start Metro with --host lan first (so it binds to 0.0.0.0),
 * THEN open localtunnel pointing at it. This separates the two concerns
 * and avoids the race condition where Metro starts before the tunnel URL
 * is known, causing it to embed localhost in the manifest.
 *
 * The manifest rewrite proxy below intercepts every /index.bundle and
 * manifest request and rewrites any localhost/127.0.0.1 URLs to the
 * tunnel host — this is the definitive fix for "failed to download".
 *
 * Run: node start-tunnel.js
 */

const http        = require('http');
const httpProxy   = require('http-proxy');   // we'll use http manually, no dep needed
const localtunnel = require('localtunnel');
const { spawn }   = require('child_process');
const os          = require('os');

const METRO_PORT  = 8081;
const PROXY_PORT  = 8082;   // tunnel points here; this proxy rewrites & forwards to 8081

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

async function waitForMetro(port, maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      await new Promise((res, rej) => {
        const req = http.get(`http://127.0.0.1:${port}/status`, res);
        req.on('error', rej);
        req.setTimeout(1000, () => { req.destroy(); rej(new Error('timeout')); });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return false;
}

async function main() {
  const lanIp = getLanIp();
  console.log('\n🚀  Starting Metro on LAN (' + lanIp + ':' + METRO_PORT + ')...\n');

  // ── 1. Start Expo/Metro in LAN mode ────────────────────────────────────
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;

  const expo = spawn(
    'npx',
    ['expo', 'start', '--lan', '--port', String(METRO_PORT), '--clear'],
    {
      stdio : ['ignore', 'pipe', 'pipe'],
      shell : true,
      cwd   : __dirname,
      env   : { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: lanIp },
    }
  );

  // Stream Expo output but filter for the tunnel lines
  expo.stdout.on('data', d => process.stdout.write(d));
  expo.stderr.on('data', d => process.stderr.write(d));

  expo.on('close', code => {
    console.log('\nExpo exited:', code);
    process.exit(code ?? 0);
  });

  // ── 2. Wait for Metro to be ready ──────────────────────────────────────
  console.log('⏳  Waiting for Metro to start...');
  const ready = await waitForMetro(METRO_PORT);
  if (!ready) {
    console.error('❌  Metro did not start in time. Check Expo output above.');
    process.exit(1);
  }
  console.log('✅  Metro is ready on port', METRO_PORT);

  // ── 3. Start a rewriting proxy on PROXY_PORT ───────────────────────────
  // This proxy forwards requests from the tunnel to Metro,
  // and rewrites any lanIp/localhost in responses to the tunnel hostname.
  let tunnelHost = '';

  const proxy = http.createServer((req, res) => {
    let body = [];
    const options = {
      hostname: '127.0.0.1',
      port    : METRO_PORT,
      path    : req.url,
      method  : req.method,
      headers : { ...req.headers, host: `127.0.0.1:${METRO_PORT}` },
    };

    const proxyReq = http.request(options, proxyRes => {
      const ct = proxyRes.headers['content-type'] || '';
      const isText = ct.includes('json') || ct.includes('javascript') || ct.includes('text');

      if (isText && tunnelHost) {
        proxyRes.on('data', chunk => body.push(chunk));
        proxyRes.on('end', () => {
          let text = Buffer.concat(body).toString('utf8');
          // Rewrite all localhost / lanIp references to the tunnel host
          text = text
            .replace(new RegExp(`${lanIp}:${METRO_PORT}`, 'g'), tunnelHost)
            .replace(new RegExp(`127\\.0\\.0\\.1:${METRO_PORT}`, 'g'), tunnelHost)
            .replace(new RegExp(`localhost:${METRO_PORT}`, 'g'), tunnelHost);

          const buf = Buffer.from(text, 'utf8');
          const headers = { ...proxyRes.headers };
          headers['content-length'] = String(buf.length);
          delete headers['transfer-encoding'];
          res.writeHead(proxyRes.statusCode, headers);
          res.end(buf);
        });
      } else {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on('error', err => {
      res.writeHead(502);
      res.end('Proxy error: ' + err.message);
    });

    req.pipe(proxyReq);
  });

  proxy.listen(PROXY_PORT, '0.0.0.0', async () => {
    console.log('🔀  Rewriting proxy running on port', PROXY_PORT);

    // ── 4. Open tunnel pointing at the proxy ─────────────────────────────
    console.log('🚇  Opening localtunnel...');
    let tunnel;
    try {
      tunnel = await localtunnel({ port: PROXY_PORT, subdomain: 'launchedgelabs' });
    } catch {
      tunnel = await localtunnel({ port: PROXY_PORT });
    }

    tunnelHost = new URL(tunnel.url).hostname;
    printBanner(tunnel.url);

    tunnel.on('error', err => console.error('⚠️  Tunnel error:', err.message));
    tunnel.on('close', ()  => console.log('\n⚠️  Tunnel closed remotely.'));

    process.on('SIGINT', async () => {
      console.log('\n🛑  Shutting down...');
      await tunnel.close().catch(() => {});
      proxy.close();
      expo.kill('SIGINT');
      process.exit(0);
    });
  });
}

function printBanner(url) {
  const L = '═'.repeat(62);
  console.log('\n' + L);
  console.log('  ✅  TUNNEL READY: ' + url);
  console.log(L);
  console.log('');
  console.log('  📱  ON YOUR PHONE — do this BEFORE scanning:');
  console.log('');
  console.log('  1. Open Chrome, go to: ' + url);
  console.log('  2. Tap "Click to Continue"');
  console.log('  3. Scan the QR code in Expo Go');
  console.log('');
  console.log('  💡  "failed to download" = repeat steps 1-2, then');
  console.log('      shake phone → Reload');
  console.log('');
  console.log(L + '\n');
}

main().catch(err => {
  console.error('\n❌  Fatal:', err.message);
  process.exit(1);
});

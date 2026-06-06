import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { RouterOSAPI } from 'node-routeros';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { networkInterfaces } from 'os';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 🆫 Serve the built React frontend (Option A: Local Network Deployment)
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log(`🆫 Serving React frontend from: ${distPath}`);
} else {
  console.log('⚠️  dist/ not found - run "npm run build" to generate it.');
}

// 🔥 MONKEY-PATCH: prevent node-routeros from crashing on "!empty" replies
// These often happen when filtering scripts on a busy router.
try {
    const { Channel } = await import('node-routeros/dist/Channel.js');
    if (Channel && Channel.prototype && Channel.prototype.onUnknown) {
        Channel.prototype.onUnknown = function(reply) {
            console.warn(`⚠️ Intercepted unknown reply type: "${reply}" (ignored to prevent crash)`);
            this.close(); // Cleanly close the channel instead of throwing
        };
        console.log('✅ node-routeros crash-protection patch applied.');
    }
} catch (e) {
    console.warn('⚠️ Could not apply crash-protection patch:', e.message);
}

// Connection Pool to keep sessions alive
const connectionPool = new Map();
const responseCache = new Map();

// CACHE SYSTEM for heavy requests
const DEFAULT_CACHE_TTL = 30000; // 30 seconds default
const ENDPOINT_TTLS = {
  '/system/script': 60000,     // ⚡ 60s (Heavy Mikhmon parsing)
  '/ip/hotspot/user': 30000,   // ⚡ 30s (Voucher list)
  '/ip/hotspot/active': 10000,  // ⚡ 10s (Live monitoring)
  '/system/resource': 10000,    // ⚡ 10s (Performance)
  '/interface/monitor-traffic': 2000, // 2s (Live graph)
};

function getCacheKey(ip, endpoint, cmd, params, dateFilter) {
  return `${ip}:${endpoint}:${cmd}:${JSON.stringify(params)}:${dateFilter || 'none'}`;
}

// PREVENT CRASHES: Global handlers for unexpected async errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
});

/**
 * Gets or creates a persistent connection to a MikroTik router
 */
async function getConnection(ip, username, password, port) {
    const key = `${username}@${ip}:${port}`;
    
    try {
        if (connectionPool.has(key)) {
            const existing = connectionPool.get(key);
            if (existing.connected) return existing;
            
            if (existing.lastError && Date.now() - existing.lastError < 5000) {
                throw new Error('Lockout: Attente de 5s avant nouvel essai.');
            }
        }

        console.log(`📡 [PROBE] Tentative de connexion TCP vers ${ip}:${port}...`);
        
        const conn = new RouterOSAPI({
            host: ip,
            user: username,
            password: password || '',
            port: parseInt(port) || 8728,
            timeout: 20,
            tls: port === '8729' ? { rejectUnauthorized: false } : false
        });

        const connPromise = conn.connect();
        
        // Timeout watchdog for the connect promise itself
        const result = await Promise.race([
            connPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_BRIDGE: Le tunnel Playit ne répond pas.')), 18000))
        ]);

        const errorHandler = (err) => {
            console.error(`🔌 [DISCONNECT] ${key}:`, err.message);
            connectionPool.delete(key);
            try { conn.close(); } catch(e) {}
        };

        conn.on('error', errorHandler);
        connectionPool.set(key, conn);
        console.log(`✅ [ESTABLISHED] Connexion réussie : ${key}`);
        return conn;
    } catch (err) {
        const key = `${username}@${ip}:${port}`;
        connectionPool.set(key, { connected: false, lastError: Date.now() });
        console.error(`❌ [FAILURE] @ ${ip}:${port} -> Error: ${err.message || err.code || 'UNKNOWN'}`);
        throw err;
    }
}

// Map command paths to RouterOS API commands
const endpointToCommand = (endpoint, method, data) => {
  const parts = endpoint.replace(/^\//, '').split('/');
  
  if (endpoint === '/interface/monitor-traffic') {
    return { 
      cmd: '/interface/monitor-traffic', 
      params: [`=interface=${data?.interface || 'ether1'}`, '=once='] 
    };
  }

  const path = '/' + parts.join('/');
  let cmd = '';
  
  if (method === 'GET' || !method) {
    cmd = `${path}/print`;
  } else if (method === 'PUT') {
    cmd = `${path}/add`;
  } else if (method === 'DELETE') {
    cmd = `${path}/remove`;
  } else if (method === 'PATCH') {
    cmd = `${path}/set`;
  } else {
    cmd = `${path}/print`;
  }

  const params = data ? Object.entries(data).map(([k, v]) => {
      if (k.startsWith('?') || k.startsWith('#')) {
          return `${k}=${v}`; // API Query format
      }
      return `=${k}=${v}`; // Standard parameter format
  }) : [];
  return { cmd, params };
};

// Health Check
app.get('/health', (req, res) => res.send('OK'));

// Get server network IP and QR code for mobile login access
app.get('/api/network-info', async (req, res) => {
  try {
    const nets = networkInterfaces();
    let ip = '127.0.0.1';
    
    // Sort interfaces to prioritize physical adapters (Wi-Fi, Ethernet) over virtual cards (WSL, Docker, etc.)
    const sortedInterfaces = Object.keys(nets).sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        const aIsVirtual = aLower.includes('virtual') || aLower.includes('wsl') || aLower.includes('docker') || aLower.includes('vbox') || aLower.includes('vmware') || aLower.includes('vethernet');
        const bIsVirtual = bLower.includes('virtual') || bLower.includes('wsl') || bLower.includes('docker') || bLower.includes('vbox') || bLower.includes('vmware') || bLower.includes('vethernet');
        
        const aIsPhysical = aLower.includes('wi-fi') || aLower.includes('wifi') || aLower.includes('wlan') || aLower.includes('ethernet') || aLower.includes('sans fil');
        const bIsPhysical = bLower.includes('wi-fi') || bLower.includes('wifi') || bLower.includes('wlan') || bLower.includes('ethernet') || bLower.includes('sans fil');
        
        if (aIsVirtual && !bIsVirtual) return 1;
        if (!aIsVirtual && bIsVirtual) return -1;
        if (aIsPhysical && !bIsPhysical) return -1;
        if (!aIsPhysical && bIsPhysical) return 1;
        return 0;
    });

    for (const name of sortedInterfaces) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ip = net.address;
                break;
            }
        }
        if (ip !== '127.0.0.1') break;
    }

    const appUrl = `http://${ip}:${PORT}`;
    const qrCodeDataUrl = await QRCode.toDataURL(appUrl);

    res.status(200).json({
      ip,
      port: PORT,
      url: appUrl,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Failed to generate network info or QR code:', error);
    res.status(500).json({ error: 'Failed to retrieve network info.' });
  }
});

// Authentication Middleware for API security
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const secret = process.env.API_SECRET || '15f707c1a3ad318c6b01e7e10695bf46d461929dbdeb53cefc8cc6673c39f1f5';
  
  // Skip auth only if no secret is configured at all
  if (!secret) return next();
  
  if (apiKey === secret) {
    return next();
  }
  
  console.warn(`🛑 Unauthorized access attempt from ${req.ip}`);
  res.status(401).json({ error: 'Accès non autorisé. Clé API invalide.' });
};

// Main Proxy Endpoint - Protected by authenticate
app.post('/api/mikrotik', authenticate, async (req, res) => {
  const { ip, port, username, password, endpoint, method, data, dateFilter } = req.body;

  if (!ip || !username) {
    return res.status(400).json({ error: 'Configuration manquante.' });
  }

  const start = Date.now();
  console.log(`📡 [${method || 'GET'}] ${endpoint} @ ${ip}`);

  try {
    const conn = await getConnection(ip, username, password, port);
    
    const cleanData = data ? { ...data } : {};
    let proplist = cleanData.proplist;
    delete cleanData.proplist;

    // AUTO-OPTIMIZATION for speed
    if (!proplist && (endpoint.includes('/user') || endpoint.includes('/active')) && (method === 'GET' || !method)) {
        proplist = '.id,name,profile,comment,uptime,disabled';
    }

    const { cmd, params: baseParams } = endpointToCommand(endpoint, method, cleanData);
    
    let finalParams = [...baseParams];
    if (proplist) {
      finalParams.push(`=.proplist=${proplist}`);
    }

    // CACHE LOOKUP — Robust detection of read operations
    const isReadOperation = method === 'GET' || !method || cmd.endsWith('/print') || (method === 'POST' && (endpoint.includes('print') || !['SET','PUT','PATCH','DELETE'].includes(method)));
    const cacheKey = getCacheKey(ip, endpoint, cmd, finalParams, dateFilter);
    
    if (isReadOperation && responseCache.has(cacheKey)) {
        const cachedEntry = responseCache.get(cacheKey);
        const specificTTL = ENDPOINT_TTLS[endpoint] || DEFAULT_CACHE_TTL;
        
        if (Date.now() - cachedEntry.timestamp < specificTTL) {
            const duration = Date.now() - start;
            console.log(`⚡ [CACHE HIT] ${endpoint} (${Math.round(specificTTL/1000)}s TTL) ${Array.isArray(cachedEntry.data) ? cachedEntry.data.length + ' items' : '1 item'} en ${duration}ms @ ${ip}`);
            return res.status(200).json(cachedEntry.data);
        }
    }
    
    // EXECUTE COMMAND — with !empty reply protection & streaming for large payloads
    let result;
    try {
      if (cmd === '/system/script/print') {
          console.log(`🌊 Streaming large data for ${endpoint} @ ${ip}...`);
          result = await new Promise((resolve, reject) => {
              const streamItems = [];
              const stream = conn.stream(cmd, finalParams);
              stream.on('data', pkt => streamItems.push(pkt));
              stream.on('trap', err => reject(new Error('RouterOS Trap: ' + JSON.stringify(err))));
              stream.on('done', () => resolve(streamItems));
              
              // Failsafe timeout in case stream hangs without closing
              setTimeout(() => { if (!streamItems.length || streamItems.length < 50000) resolve(streamItems); }, 170000);
          });
      } else {
          result = await conn.write(cmd, finalParams);
      }
    } catch (writeErr) {
      // RouterOS responds with !empty when a filter matches nothing — that's OK
      if (writeErr.errno === 'UNKNOWNREPLY' || (writeErr.message && (writeErr.message.includes('!empty') || writeErr.message.includes('unknown reply')))) {
        console.log(`📭 [EMPTY result] ${endpoint} — Likely no match or busy @ ${ip}`);
        const emptyResult = [];
        // Only cache it for a short time if it's empty to allow recovery
        responseCache.set(cacheKey, { data: emptyResult, timestamp: Date.now() });
        return res.status(200).json(emptyResult);
      }
      
      // Handle busy/timeout errors
      const key = `${username}@${ip}:${port || 8728}`;
      if (writeErr.message.includes('busy') || writeErr.message.includes('Timed out') || writeErr.message.includes('UNKNOWNREPLY')) {
          console.warn(`🔄 Dropping connection for ${key} due to fatal command error.`);
          connectionPool.delete(key);
          try { conn.close(); } catch(e) {}
      }
      throw writeErr;
    }
    
    let output = result;
    if (endpoint.endsWith('/resource') && Array.isArray(result)) {
      output = result[0] || {};
    }

    // 🔍 SERVER-SIDE JS FILTERING for /system/script (Mobile Optimization)
    // Filter after stream so mobile gets <200KB instead of ~3MB
    if (cmd === '/system/script/print' && Array.isArray(output)) {
      const before = output.length;
      // Step 1: Keep only Mikhmon-format scripts
      output = output.filter(s => s.name && s.name.includes('-|-'));
      // Step 2: If a date prefix is given (e.g. '2026-04' or '2026-04-11'), filter by it
      if (dateFilter) {
        output = output.filter(s => s.name.startsWith(dateFilter));
      }
      const after = output.length;
      console.log(`🔍 [FILTERED] Script payload: ${before} → ${after} (dateFilter: ${dateFilter || 'none'})`);
    }

    // CACHE STORAGE for all read-like operations
    responseCache.set(cacheKey, {
        data: output,
        timestamp: Date.now()
    });

    const duration = Date.now() - start;
    console.log(`✅ ${endpoint} (${Array.isArray(output) ? output.length : '1'} items) en ${duration}ms`);
    res.status(200).json(output);

  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
    const errorCode = error.code || 'UNKNOWN';
    
    console.error(`❌ Échec de la connexion (${duration}ms) @ ${ip}:${port} : [${errorCode}] ${errorMsg}`);
    
    let tip = 'Vérifiez que le service API du MikroTik (/ip service api) est activé sur le port 8728.';
    if (errorCode === 'ETIMEDOUT') tip = 'Le routeur ne répond pas. Vérifiez la connexion Starlink ou l\'adresse IP.';
    if (errorMsg.includes('invalid') || errorMsg.includes('credentials') || errorMsg.includes('password')) tip = 'Utilisateur ou mot de passe MikroTik incorrect. Vérifiez les réglages du routeur dans le SaaS.';
    if (errorCode === 'ECONNREFUSED') tip = 'Connexion refusée. Vérifiez que le port 8728 est ouvert dans "/ip service".';

    res.status(500).json({ 
      error: `[${errorCode}] ${errorMsg}`,
      tip: tip
    });
  }
});

// 🌐 Catch-all for React Router (SPA) — Express 5 syntax: '/{*path}'
if (existsSync(distPath)) {
  app.get('/{*path}', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

let server = null;

export const startServer = (port = PORT) => {
  return new Promise((resolve) => {
    server = app.listen(port, '0.0.0.0', () => {
      console.log(`\n🚀 Proxy MikroTik RÉSILIENT (Port ${port})`);
      console.log(`   → API:      http://localhost:${port}/api/mikrotik`);
      console.log(`   → Dashboard: http://localhost:${port}`);
      console.log(`   → Réseau:    http://<votre-IP-locale>:${port} (mobile)\n`);
      resolve(server);
    });
  });
};

export const stopServer = () => {
  if (server) {
    server.close();
    server = null;
    console.log('🛑 Serveur Hotspot arrêté.');
  }
};

// Auto-start if run directly
import { realpathSync } from 'fs';
const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (isMain || import.meta.url === `file://${fileURLToPath(import.meta.url)}`.replace(/\\/g, '/')) {
  startServer();
}


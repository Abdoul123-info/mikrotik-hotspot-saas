import express from 'express';
import cors from 'cors';
import { RouterOSAPI } from 'node-routeros';
import { adminDb } from './firebaseAdmin.js';
import { requireAuth } from './middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import QRCode from 'qrcode';

// URL publique du backend (ex: https://mon-app.onrender.com)
// À définir dans .env pour la production
const BACKEND_URL = process.env.BACKEND_URL || null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json());

// 🔥 MONKEY-PATCH: prevent node-routeros from crashing on "!empty" replies
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

// 🚀 Connection Pool and Caching
const connectionPool = new Map();
const responseCache = new Map();

const DEFAULT_CACHE_TTL = 30000;
const ENDPOINT_TTLS = {
  '/system/script': 60000,     
  '/ip/hotspot/user': 30000,   
  '/ip/hotspot/active': 10000,  
  '/system/resource': 10000,    
  '/interface/monitor-traffic': 2000, 
};

function getCacheKey(ip, endpoint, cmd, params, dateFilter) {
  return `${ip}:${endpoint}:${cmd}:${JSON.stringify(params)}:${dateFilter || 'none'}`;
}

async function getConnection(ip, username, password, port, connectTimeout = 18000) {
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
            timeout: Math.max(20, Math.round(connectTimeout / 1000) + 5),
            tls: port === '8729' ? { rejectUnauthorized: false } : false
        });

        const connPromise = conn.connect();
        
        const result = await Promise.race([
            connPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_BRIDGE: Le routeur ne répond pas.')), connectTimeout))
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
        connectionPool.set(key, { connected: false, lastError: Date.now() });
        console.error(`❌ [FAILURE] @ ${ip}:${port} -> Error: ${err.message || err.code || 'UNKNOWN'}`);
        throw err;
    }
}

// Helper function: convert REST-style endpoint to RouterOS command
const endpointToCommand = (endpoint, method, data) => {
  const parts = endpoint.replace(/^\//, '').split('/');
  
  if (endpoint === '/interface/monitor-traffic') {
    return { cmd: '/interface/monitor-traffic', params: [`=interface=${data?.interface || 'ether1'}`, '=once='] };
  }

  const path = '/' + parts.join('/');
  let cmd = '';
  if (path.endsWith('/print') || path.endsWith('/add') || path.endsWith('/remove') || path.endsWith('/set')) {
    cmd = path;
  } else if (method === 'GET' || !method) cmd = `${path}/print`;
  else if (method === 'PUT') cmd = `${path}/add`;
  else if (method === 'DELETE') cmd = `${path}/remove`;
  else if (method === 'PATCH') cmd = `${path}/set`;
  else cmd = `${path}/print`;

  const cleanData = data ? { ...data } : {};
  if (cmd.endsWith('/remove') && cleanData['.id'] && !cleanData.numbers) {
    cleanData.numbers = cleanData['.id'];
  }

  const params = Object.entries(cleanData).map(([k, v]) => {
    if (k.startsWith('?') || k.startsWith('&') || k.startsWith('#')) return `${k}=${v}`;
    return `=${k}=${v}`;
  });
  
  return { cmd, params };
};

const compileToRouterOsCli = (endpoint, method, data) => {
  const cleanEndpoint = endpoint.replace(/^\/|\/$/g, '');
  
  // 1. Add User / Voucher
  if (cleanEndpoint === 'ip/hotspot/user' && method === 'PUT') {
    const name = data.name;
    const password = data.password || '';
    const profile = data.profile || 'default';
    const comment = data.comment || '';
    return `/ip hotspot user add name="${name}" password="${password}" profile="${profile}" comment="${comment}"`;
  }
  
  // 2. Set/Modify User (e.g. block/unblock)
  if (cleanEndpoint === 'ip/hotspot/user/set' && method === 'POST') {
    const id = data['.id'] || data.name;
    if (!id) return null;
    const updates = [];
    if (data.disabled !== undefined) updates.push(`disabled=${data.disabled}`);
    if (data.profile !== undefined) updates.push(`profile="${data.profile}"`);
    if (data.comment !== undefined) updates.push(`comment="${data.comment}"`);
    if (updates.length === 0) return null;
    return `/ip hotspot user set [find where name="${id}"] ${updates.join(' ')}`;
  }
  
  // 3. Remove User / Profile
  if ((cleanEndpoint === 'ip/hotspot/user/remove' || cleanEndpoint === 'ip/hotspot/user/profile/remove') && method === 'POST') {
    const id = data['.id'] || data.name;
    if (!id) return null;
    const path = cleanEndpoint.includes('profile') ? '/ip hotspot user profile' : '/ip hotspot user';
    return `${path} remove [find where name="${id}"]`;
  }
  
  // 4. Remove Active User Session (Disconnect)
  if (cleanEndpoint === 'ip/hotspot/active/remove' && method === 'POST') {
    const id = data['.id'];
    if (!id) return null;
    return `/ip hotspot active remove [find where user="${id}"]`;
  }

  // 5. Add Profile
  if (cleanEndpoint === 'ip/hotspot/user/profile' && method === 'PUT') {
    const name = data.name;
    const updates = [`name="${name}"`];
    if (data['session-timeout'] && data['session-timeout'] !== 'none') updates.push(`session-timeout="${data['session-timeout']}"`);
    if (data['idle-timeout'] && data['idle-timeout'] !== 'none') updates.push(`idle-timeout="${data['idle-timeout']}"`);
    if (data['shared-users']) updates.push(`shared-users=${data['shared-users']}`);
    if (data['rate-limit']) updates.push(`rate-limit="${data['rate-limit']}"`);
    if (data['on-login']) updates.push(`on-login="${data['on-login']}"`);
    if (data.comment) updates.push(`comment="${data.comment}"`);
    return `/ip hotspot user profile add ${updates.join(' ')}`;
  }

  // 6. Set Profile
  if (cleanEndpoint === 'ip/hotspot/user/profile/set' && method === 'POST') {
    const id = data['.id'] || data.name;
    if (!id) return null;
    const updates = [];
    if (data.name) updates.push(`name="${data.name}"`);
    if (data['session-timeout'] !== undefined) updates.push(`session-timeout="${data['session-timeout'] || 'none'}"`);
    if (data['idle-timeout'] !== undefined) updates.push(`idle-timeout="${data['idle-timeout'] || 'none'}"`);
    if (data['shared-users']) updates.push(`shared-users=${data['shared-users']}`);
    if (data['rate-limit']) updates.push(`rate-limit="${data['rate-limit']}"`);
    if (data['on-login']) updates.push(`on-login="${data['on-login']}"`);
    if (data.comment !== undefined) updates.push(`comment="${data.comment}"`);
    if (updates.length === 0) return null;
    return `/ip hotspot user profile set [find where name="${data.name || id}" or .id="${id}"] ${updates.join(' ')}`;
  }

  return null;
};

// Get server network IP and QR code for mobile login access
app.get('/api/network-info', async (req, res) => {
  try {
    const nets = networkInterfaces();
    let ip = '127.0.0.1';
    
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

    const clientPort = req.query.port || PORT;
    const isDefaultPort = clientPort === '80' || clientPort === '443';
    const appUrl = isDefaultPort ? `http://${ip}` : `http://${ip}:${clientPort}`;
    const qrCodeDataUrl = await QRCode.toDataURL(appUrl);

    res.status(200).json({
      ip,
      port: clientPort,
      url: appUrl,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Failed to generate network info or QR code:', error);
    res.status(500).json({ error: 'Failed to retrieve network info.' });
  }
});

// Secure MikroTik Proxy - fetches router credentials from Firestore
app.post('/api/mikrotik', requireAuth, async (req, res) => {
  const { routerId, endpoint, method, data, dateFilter } = req.body;

  if (!routerId) return res.status(400).json({ error: 'routerId manquant.' });

  const start = Date.now();

  // Déterminer tôt si c'est une opération de lecture (nécessaire dans le catch pour le fallback agent)
  const isReadOperation = method === 'GET' || !method || (method === 'POST' && !['set','add','remove'].some(op => endpoint.includes(op)));

  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    
    if (!routerDoc.exists) {
      return res.status(404).json({ error: 'Routeur introuvable.' });
    }

    const router = routerDoc.data();

    if (router.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Accès refusé à ce routeur.' });
    }

    const apiPort = parseInt(router.port) || 8728;
    const candidateHosts = [];
    if (router.ztIp) candidateHosts.push({ ip: router.ztIp, label: 'ZeroTier' });
    if (router.ip && (!router.ztIp || router.ip !== router.ztIp)) {
      const isZt = router.ip.startsWith('10.') || router.ip.startsWith('172.');
      candidateHosts.push({ ip: router.ip, label: isZt ? 'ZeroTier' : 'Local' });
    }
    if (candidateHosts.length === 0 && router.host) {
      candidateHosts.push({ ip: router.host, label: 'Host' });
    }

    let conn = null;
    let targetHost = router.ztIp || router.ip;
    let lastConnError = null;
    const probeTimeout = router.agentKey ? 3500 : 15000;

    for (const cand of candidateHosts) {
      try {
        console.log(`📡 [User:${req.user.userId}] API:${apiPort} ${method || 'GET'} ${endpoint} @ ${cand.ip} (${cand.label})`);
        conn = await getConnection(cand.ip, router.login, router.password, apiPort, probeTimeout);
        targetHost = cand.ip;
        break;
      } catch (err) {
        lastConnError = err;
      }
    }

    if (!conn) {
      // Si la connexion TCP directe échoue, vérifier si l'Agent Push est actif pour basculer sur le cache ou la file
      if (router.agentKey) {
        if (isReadOperation) {
          const agentData = router.agentData || {};
          const syncAge = agentData.lastSync ? Date.now() - new Date(agentData.lastSync).getTime() : null;
          
          let cachedResult;
          if (endpoint.includes('/active')) {
            const leases = agentData.dhcpLeases || [];
            const leaseMap = new Map();
            leases.forEach(l => {
              if (l && l['mac-address']) leaseMap.set(l['mac-address'].toLowerCase(), l['host-name']);
              if (l && l.address) leaseMap.set(l.address, l['host-name']);
            });

            cachedResult = (agentData.activeUsers || []).map(u => ({
              ...u,
              '.id': u.user,
              host: leaseMap.get((u['mac-address'] || '').toLowerCase()) || leaseMap.get(u.address) || ''
            }));
          } else if (endpoint.includes('/resource')) {
            cachedResult = agentData.systemResource || {};
          } else if (endpoint.includes('/monitor-traffic')) {
            cachedResult = [{ 'rx-bits-per-second': '0', 'tx-bits-per-second': '0' }];
          } else if (endpoint.includes('/user/profile')) {
            cachedResult = agentData.userProfiles || [];
          } else if (endpoint.includes('/user')) {
            cachedResult = agentData.hotspotUsers || [];
          } else if (endpoint.includes('/script')) {
            cachedResult = agentData.mikhmonSales || [];
          } else if (endpoint.includes('/dhcp-server/lease')) {
            cachedResult = agentData.dhcpLeases || [];
          } else if (endpoint.includes('/hotspot/server')) {
            cachedResult = agentData.hotspotServers || [];
          } else {
            cachedResult = [];
          }

          console.log(`✅ [AGENT CACHE DIRECT] ${endpoint} (syncAge: ${syncAge !== null ? Math.round(syncAge/1000) + 's' : 'never'})`);
          res.setHeader('X-Data-Source', 'agent-cache');
          if (syncAge !== null) {
            res.setHeader('X-Cache-Age', Math.round(syncAge / 1000));
          }
          return res.status(200).json(cachedResult);
        } else {
          // Opération d'écriture : mettre directement en file d'attente
          console.log(`📥 [QUEUING DIRECT] Mise en file d'attente de la commande ${method} ${endpoint} pour le routeur ${routerId}`);
          await adminDb.collection('routers').doc(routerId).collection('commands').add({
            endpoint,
            method,
            data: data || {},
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          return res.status(200).json({
            success: true,
            queued: true,
            message: "Le routeur est actuellement injoignable via TCP (ZeroTier/Local). La commande a été mise en file d'attente."
          });
        }
      }
      throw lastConnError || new Error(`Injoignable aux adresses : ${candidateHosts.map(c => c.ip).join(', ')}`);
    }
    
    const cleanData = data ? { ...data } : {};
    let proplist = cleanData.proplist;
    delete cleanData.proplist; 

    if (!proplist && (endpoint.includes('/user') || endpoint.includes('/active')) && (method === 'GET' || !method)) {
        proplist = '.id,name,user,profile,comment,uptime,disabled,mac-address,address,bytes-in,bytes-out,session-time-left,idle-time';
    }

    const { cmd, params: baseParams } = endpointToCommand(endpoint, method, cleanData);
    
    let finalParams = [...baseParams];
    if (proplist) finalParams.push(`=.proplist=${proplist}`);
    
    // isReadOperation déjà déterminé avant le try (pour le fallback agent dans le catch)
    const cacheKey = getCacheKey(router.ip, endpoint, cmd, finalParams, dateFilter);

    if (isReadOperation && responseCache.has(cacheKey)) {
        const cachedEntry = responseCache.get(cacheKey);
        const specificTTL = ENDPOINT_TTLS[endpoint] || DEFAULT_CACHE_TTL;
        
        if (Date.now() - cachedEntry.timestamp < specificTTL) {
            const duration = Date.now() - start;
            console.log(`⚡ [CACHE HIT] ${endpoint} (${Math.round(specificTTL/1000)}s TTL) ${Array.isArray(cachedEntry.data) ? cachedEntry.data.length + ' items' : '1 item'} en ${duration}ms`);
            return res.status(200).json(cachedEntry.data);
        }
    }

    let result;
    try {
      if (cmd === '/system/script/print') {
          result = await new Promise((resolve, reject) => {
              const streamItems = [];
              const stream = conn.stream(cmd, finalParams);
              stream.on('data', pkt => streamItems.push(pkt));
              stream.on('trap', err => reject(new Error('RouterOS Trap: ' + JSON.stringify(err))));
              stream.on('done', () => resolve(streamItems));
              setTimeout(() => { if (!streamItems.length || streamItems.length < 50000) resolve(streamItems); }, 170000);
          });
      } else {
          result = await conn.write(cmd, finalParams);
      }
    } catch (writeErr) {
      if (writeErr.errno === 'UNKNOWNREPLY' || (writeErr.message && (writeErr.message.includes('!empty') || writeErr.message.includes('unknown reply')))) {
        const emptyResult = [];
        responseCache.set(cacheKey, { data: emptyResult, timestamp: Date.now() });
        return res.status(200).json(emptyResult);
      }
      
      const key = `${router.login}@${router.ip}:${apiPort}`;
      if (writeErr.message && (writeErr.message.includes('busy') || writeErr.message.includes('Timed out') || writeErr.message.includes('UNKNOWNREPLY'))) {
          connectionPool.delete(key);
          try { conn.close(); } catch(e) {}
      }
      throw writeErr;
    }

    let output = result;
    if (endpoint.endsWith('/resource') && Array.isArray(result)) output = result[0] || {};

    if (cmd === '/system/script/print' && Array.isArray(output)) {
      output = output.filter(s => s.name && s.name.includes('-|-'));
      if (dateFilter) {
        output = output.filter(s => s.name.startsWith(dateFilter));
      }
    }

    if (!isReadOperation) {
      responseCache.clear();
    } else {
      responseCache.set(cacheKey, {
        data: output,
        timestamp: Date.now()
      });
    }

    const duration = Date.now() - start;
    console.log(`✅ ${endpoint} (${Array.isArray(output) ? output.length : '1'} items) en ${duration}ms`);

    // 🔄 Sync live data to Firestore agentData asynchronously so remote/mobile dashboards stay fresh
    if (router.agentKey && isReadOperation) {
      try {
        const updateField = {};
        if (endpoint.includes('/active')) updateField['agentData.activeUsers'] = output;
        else if (endpoint.includes('/resource')) updateField['agentData.systemResource'] = normalizeResource(output);
        else if (endpoint.includes('/user/profile')) updateField['agentData.userProfiles'] = output;
        else if (endpoint.includes('/user')) {
          // Hotspot users (tickets)
          updateField['agentData.hotspotUsers'] = Array.isArray(output) ? output.slice(-1000) : output;
        }
        else if (endpoint.includes('/script')) {
          // Mikhmon sales scripts
          updateField['agentData.mikhmonSales'] = Array.isArray(output) ? output.slice(-2500) : output;
        }
        else if (endpoint.includes('/dhcp-server/lease')) {
          updateField['agentData.dhcpLeases'] = output;
        }
        else if (endpoint.includes('/hotspot/server') || endpoint.includes('/hotspot')) {
          updateField['agentData.hotspotServers'] = output;
        }
        
        if (Object.keys(updateField).length > 0) {
          updateField['agentData.lastSync'] = new Date().toISOString();
          adminDb.collection('routers').doc(routerId).update(updateField).catch(() => {});
        }
      } catch (_) {}
    }

    res.status(200).json(output);

  } catch (error) {
    // 🔄 FALLBACK: Si connexion directe échoue, vérifier le cache agent Firestore ou mettre en file d'attente
    if (error.message && (error.message.includes('TIMEOUT') || error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED') || error.message.includes('Lockout'))) {
      try {
        const freshDoc = await adminDb.collection('routers').doc(routerId).get();
        const routerData = freshDoc.data() || {};
        
        // Si c'est une opération d'écriture et que le routeur utilise l'Agent Push
        if (!isReadOperation && routerData.agentKey) {
          console.log(`📥 [QUEUING] Mise en file d'attente de la commande ${method} ${endpoint} pour le routeur ${routerId}`);
          await adminDb.collection('routers').doc(routerId).collection('commands').add({
            endpoint,
            method,
            data: data || {},
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          return res.status(200).json({
            success: true,
            queued: true,
            message: "Le routeur est actuellement injoignable (NAT/CGNAT/Hors-ligne). La commande a été mise en file d'attente et sera exécutée dès que le routeur se synchronisera (environ 1 min)."
          });
        }

        const agentData = routerData.agentData;
        if (agentData) {
          const syncAge = agentData.lastSync ? Date.now() - new Date(agentData.lastSync).getTime() : null;
          let cachedResult;
            if (endpoint.includes('/active')) {
              const leases = agentData.dhcpLeases || [];
              const leaseMap = new Map();
              leases.forEach(l => {
                if (l && l['mac-address']) leaseMap.set(l['mac-address'].toLowerCase(), l['host-name']);
                if (l && l.address) leaseMap.set(l.address, l['host-name']);
              });

              cachedResult = (agentData.activeUsers || []).map(u => ({
                ...u,
                '.id': u.user,
                host: leaseMap.get((u['mac-address'] || '').toLowerCase()) || leaseMap.get(u.address) || ''
              }));
            }
            else if (endpoint.includes('/resource')) cachedResult = agentData.systemResource || {};
            else if (endpoint.includes('/monitor-traffic')) {
              // Pas de données de trafic en temps réel via agent — retourner des zéros
              cachedResult = [{ 'rx-bits-per-second': '0', 'tx-bits-per-second': '0' }];
            }
            else if (endpoint.includes('/user/profile')) cachedResult = agentData.userProfiles || [];
            else if (endpoint.includes('/user')) cachedResult = agentData.hotspotUsers || [];
            else if (endpoint.includes('/script')) cachedResult = agentData.mikhmonSales || [];
            else if (endpoint.includes('/dhcp-server/lease')) cachedResult = agentData.dhcpLeases || [];
            else if (endpoint.includes('/hotspot/server')) cachedResult = agentData.hotspotServers || [];
            
            if (cachedResult !== undefined) {
              const ageStr = syncAge !== null ? `${Math.round(syncAge/1000)}s` : 'unknown';
              console.log(`✅ [AGENT CACHE] ${endpoint} depuis cache (${ageStr})`);
              res.setHeader('X-Data-Source', 'agent-cache');
              if (syncAge !== null) res.setHeader('X-Cache-Age', Math.round(syncAge / 1000));
              return res.status(200).json(cachedResult);
            }
        }
      } catch (cacheErr) { /* ignore */ }
    }

    console.error(`❌ [Erreur RouterOS]`, error);
    let errMsg = 'Erreur inconnue';
    if (error.code === 'ETIMEDOUT' || error.errno === -4039 || (error.message && error.message.includes('ETIMEDOUT'))) {
      errMsg = "Le routeur est injoignable (ETIMEDOUT). Si vous êtes en 4G/Starlink, activez le script Agent sur votre MikroTik.";
    } else if (error.message && error.message !== 'RosException') {
      errMsg = error.message;
    } else if (error.trap) {
      errMsg = JSON.stringify(error.trap);
    }

    res.status(500).json({ 
      error: errMsg,
      tip: "Vérifiez l'adresse IP ou activez le script Agent MikroTik pour les connexions CGNAT."
    });
  }
});

// Bulk or Single Delete Hotspot Users / Coupons
app.post('/api/mikrotik/delete-users', requireAuth, async (req, res) => {
  const { routerId, usernames, ids } = req.body;

  if (!routerId) return res.status(400).json({ error: 'routerId manquant.' });
  if ((!usernames || !usernames.length) && (!ids || !ids.length)) {
    return res.status(400).json({ error: 'Aucun coupon spécifié pour la suppression.' });
  }

  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    if (!routerDoc.exists) return res.status(404).json({ error: 'Routeur introuvable.' });

    const router = routerDoc.data();
    if (router.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Accès refusé à ce routeur.' });
    }

    const apiPort = parseInt(router.port) || 8728;
    const candidateHosts = [];
    if (router.ztIp) candidateHosts.push({ ip: router.ztIp, label: 'ZeroTier' });
    if (router.ip && (!router.ztIp || router.ip !== router.ztIp)) {
      const isZt = router.ip.startsWith('10.') || router.ip.startsWith('172.');
      candidateHosts.push({ ip: router.ip, label: isZt ? 'ZeroTier' : 'Local' });
    }
    if (candidateHosts.length === 0 && router.host) {
      candidateHosts.push({ ip: router.host, label: 'Host' });
    }

    let conn = null;
    let lastConnError = null;
    const probeTimeout = router.agentKey ? 3500 : 15000;

    for (const cand of candidateHosts) {
      try {
        conn = await getConnection(cand.ip, router.login, router.password, apiPort, probeTimeout);
        break;
      } catch (err) {
        lastConnError = err;
      }
    }

    const targetUsernames = Array.isArray(usernames) ? usernames.filter(Boolean) : [];
    const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    const usernameSet = new Set(targetUsernames.map(u => String(u).toLowerCase()));

    let deletedCount = 0;

    if (conn) {
      try {
        let userRecords = [];
        try {
          userRecords = await conn.write('/ip/hotspot/user/print', ['=.proplist=.id,name']);
        } catch (e) {
          console.warn('Could not print hotspot users for removal:', e.message);
        }

        const idsToRemove = new Set(targetIds);
        if (Array.isArray(userRecords)) {
          userRecords.forEach(u => {
            const uName = (u.name || '').toLowerCase();
            if (usernameSet.has(uName)) {
              if (u['.id']) idsToRemove.add(u['.id']);
            }
          });
        }

        if (idsToRemove.size > 0) {
          const idList = Array.from(idsToRemove);
          for (let i = 0; i < idList.length; i += 50) {
            const chunk = idList.slice(i, i + 50);
            try {
              await conn.write('/ip/hotspot/user/remove', [`=numbers=${chunk.join(',')}`]);
              deletedCount += chunk.length;
            } catch (removeErr) {
              console.warn('Batch remove chunk failed, removing individually:', removeErr.message);
              for (const singleId of chunk) {
                try {
                  await conn.write('/ip/hotspot/user/remove', [`=numbers=${singleId}`]);
                  deletedCount++;
                } catch (_) {}
              }
            }
          }
        }

        // Clean up active sessions
        try {
          const activeSessions = await conn.write('/ip/hotspot/active/print', ['=.proplist=.id,user']);
          if (Array.isArray(activeSessions)) {
            const activeToRemove = activeSessions
              .filter(a => usernameSet.has((a.user || '').toLowerCase()))
              .map(a => a['.id'])
              .filter(Boolean);
            if (activeToRemove.length > 0) {
              await conn.write('/ip/hotspot/active/remove', [`=numbers=${activeToRemove.join(',')}`]);
            }
          }
        } catch (_) {}

        responseCache.clear();
      } catch (err) {
        console.error('Direct deletion error:', err);
      }
    } else if (router.agentKey) {
      // Offline / Push Agent fallback
      for (const uname of targetUsernames) {
        await adminDb.collection('routers').doc(routerId).collection('commands').add({
          endpoint: '/ip/hotspot/user/remove',
          method: 'POST',
          data: { name: uname },
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        deletedCount++;
      }

      if (router.agentData && Array.isArray(router.agentData.hotspotUsers)) {
        const remainingUsers = router.agentData.hotspotUsers.filter(u => {
          const uName = (u.name || u.user || '').toLowerCase();
          return !usernameSet.has(uName);
        });
        await adminDb.collection('routers').doc(routerId).update({
          'agentData.hotspotUsers': remainingUsers
        });
      }
    } else {
      throw lastConnError || new Error(`Routeur injoignable.`);
    }

    return res.status(200).json({
      success: true,
      deletedCount: deletedCount || targetUsernames.length || targetIds.length,
      message: `${deletedCount || targetUsernames.length} coupon(s) supprimé(s) avec succès.`
    });
  } catch (error) {
    console.error('Delete users error:', error);
    res.status(500).json({ error: error.message || 'Échec de la suppression des coupons.' });
  }
});

// ──────────────────────────────────────────────
// 🤖 Push Agent API (MikroTik → Render → Firestore)
// ──────────────────────────────────────────────

/**
 * Normalise les champs resource envoyés par le script MikroTik (camelCase)
 * en champs kebab-case attendus par le frontend (RouterOS standard).
 * Ex: cpuLoad → cpu-load, freeMemory → free-memory, totalMemory → total-memory
 */
function normalizeResource(resource) {
  if (!resource || typeof resource !== 'object') return {};
  return {
    'cpu-load':     resource['cpu-load']     ?? resource['cpuLoad']     ?? 0,
    'free-memory':  resource['free-memory']  ?? resource['freeMemory']  ?? 0,
    'total-memory': resource['total-memory'] ?? resource['totalMemory'] ?? 0,
    'uptime':       resource['uptime']       ?? resource['upTime']      ?? '',
    'version':      resource['version']      ?? '',
    'board-name':   resource['board-name']   ?? resource['boardName']   ?? '',
    'platform':     resource['platform']     ?? '',
    'cpu-count':    resource['cpu-count']    ?? resource['cpuCount']    ?? 1,
    'cpu-frequency':resource['cpu-frequency']?? resource['cpuFrequency']?? 0,
  };
}

function generateAgentPushScript(routerId, agentKey, backendHost) {
  return `:local agentKey "${agentKey}"
:local routerId "${routerId}"
:local backendUrl "${backendHost}/api/agent/push"
:local pendingUrl "${backendHost}/api/agent/pending-script/${routerId}?key=${agentKey}"

:local cpuLoad [/system resource get cpu-load]
:local freeMemory [/system resource get free-memory]
:local totalMemory [/system resource get total-memory]
:local uptime [/system resource get uptime]

:local activeUsersList ""
:foreach i in=[/ip hotspot active find] do={
  :local uName [/ip hotspot active get $i user]
  :local uMac ""
  :do { :set uMac [/ip hotspot active get $i mac-address] } on-error={}
  :local uIp ""
  :do { :set uIp [/ip hotspot active get $i address] } on-error={}
  :local uUptime ""
  :do { :set uUptime [/ip hotspot active get $i uptime] } on-error={}
  :local uBytesIn "0"
  :do { :set uBytesIn [/ip hotspot active get $i bytes-in] } on-error={}
  :local uBytesOut "0"
  :do { :set uBytesOut [/ip hotspot active get $i bytes-out] } on-error={}
  :local uTimeLeft ""
  :do { :set uTimeLeft [/ip hotspot active get $i session-time-left] } on-error={}
  :local uIdleTime ""
  :do { :set uIdleTime [/ip hotspot active get $i idle-time] } on-error={}
  :local uServer ""
  :do { :set uServer [/ip hotspot active get $i server] } on-error={}
  :local uProf ""
  :do { :set uProf [/ip hotspot user get [find name=$uName] profile] } on-error={}
  
  :local uObj "{\\"user\\":\\"$uName\\",\\"mac-address\\":\\"$uMac\\",\\"address\\":\\"$uIp\\",\\"uptime\\":\\"$uUptime\\",\\"bytes-in\\":\\"$uBytesIn\\",\\"bytes-out\\":\\"$uBytesOut\\",\\"session-time-left\\":\\"$uTimeLeft\\",\\"idle-time\\":\\"$uIdleTime\\",\\"server\\":\\"$uServer\\",\\"profile\\":\\"$uProf\\"}"
  :if ([:len $activeUsersList] > 0) do={ 
    :set activeUsersList "$activeUsersList,$uObj" 
  } else={ 
    :set activeUsersList $uObj 
  }
}

:local profilesList ""
:foreach i in=[/ip hotspot user profile find] do={
  :local pName [/ip hotspot user profile get $i name]
  :local pComment ""
  :do { :set pComment [/ip hotspot user profile get $i comment] } on-error={}
  :local pRate ""
  :do { :set pRate [/ip hotspot user profile get $i rate-limit] } on-error={}
  :local pShared "1"
  :do { :set pShared [/ip hotspot user profile get $i shared-users] } on-error={}
  
  :local pObj "{\\"name\\":\\"$pName\\",\\"comment\\":\\"$pComment\\",\\"rate-limit\\":\\"$pRate\\",\\"shared-users\\":\\"$pShared\\"}"
  :if ([:len $profilesList] > 0) do={
    :set profilesList "$profilesList,$pObj"
  } else={
    :set profilesList $pObj
  }
}

:local usersList ""
:foreach p in=[/ip hotspot user profile find] do={
  :local pName [/ip hotspot user profile get $p name]
  :local pUsers [/ip hotspot user find profile=$pName]
  :local pLen [:len $pUsers]
  :if ($pLen > 0) do={
    :local startIdx ($pLen - 1)
    :local endIdx ($pLen - 30)
    :if ($endIdx < 0) do={ :set endIdx 0 }
    :for idx from=$startIdx to=$endIdx step=-1 do={
      :local i [:pick $pUsers $idx]
      :local uName [/ip hotspot user get $i name]
      :local uPassword ""
      :do { :set uPassword [/ip hotspot user get $i password] } on-error={}
      :local uProfile ""
      :do { :set uProfile [/ip hotspot user get $i profile] } on-error={}
      :local uComment ""
      :do { :set uComment [/ip hotspot user get $i comment] } on-error={}
      :local uUptime "0s"
      :do { :set uUptime [/ip hotspot user get $i uptime] } on-error={}
      :local uBytesIn "0"
      :do { :set uBytesIn [/ip hotspot user get $i bytes-in] } on-error={}
      :local uBytesOut "0"
      :do { :set uBytesOut [/ip hotspot user get $i bytes-out] } on-error={}
      :local uLimitUptime ""
      :do { :set uLimitUptime [/ip hotspot user get $i limit-uptime] } on-error={}
      :local uLimitBytes ""
      :do { :set uLimitBytes [/ip hotspot user get $i limit-bytes-total] } on-error={}
      :local uDisabled false
      :do { :set uDisabled [/ip hotspot user get $i disabled] } on-error={}

      :local uDisStr "false"
      :if ($uDisabled = true) do={ :set uDisStr "true" }

      :local uObj "{\\"name\\":\\"$uName\\",\\"password\\":\\"$uPassword\\",\\"profile\\":\\"$uProfile\\",\\"comment\\":\\"$uComment\\",\\"uptime\\":\\"$uUptime\\",\\"bytes-in\\":\\"$uBytesIn\\",\\"bytes-out\\":\\"$uBytesOut\\",\\"limit-uptime\\":\\"$uLimitUptime\\",\\"limit-bytes-total\\":\\"$uLimitBytes\\",\\"disabled\\":$uDisStr}"
      :if ([:len $usersList] > 0) do={
        :set usersList "$usersList,$uObj"
      } else={
        :set usersList $uObj
      }
    }
  }
}

:local salesList ""
:local sales [/system script find comment="mikhmon"]
:local salesLen [:len $sales]
:if ($salesLen > 0) do={
  :local startIdx ($salesLen - 1)
  :local endIdx ($salesLen - 100)
  :if ($endIdx < 0) do={ :set endIdx 0 }
  :for idx from=$startIdx to=$endIdx step=-1 do={
    :local i [:pick $sales $idx]
    :local sName [/system script get $i name]
    :local sComment ""
    :do { :set sComment [/system script get $i comment] } on-error={}
    
    :local sObj "{\\"name\\":\\"$sName\\",\\"comment\\":\\"$sComment\\"}"
    :if ([:len $salesList] > 0) do={
      :set salesList "$salesList,$sObj"
    } else={
      :set salesList $sObj
    }
  }
}

:local serversList ""
:foreach i in=[/ip hotspot find] do={
  :local sName [/ip hotspot get $i name]
  :local sProfile [/ip hotspot get $i profile]
  
  :local sObj "{\\"name\\":\\"$sName\\",\\"profile\\":\\"$sProfile\\"}"
  :if ([:len $serversList] > 0) do={
    :set serversList "$serversList,$sObj"
  } else={
    :set serversList $sObj
  }
}

:local leasesList ""
:local leases [/ip dhcp-server lease find]
:local leasesLen [:len $leases]
:if ($leasesLen > 0) do={
  :local startIdx ($leasesLen - 1)
  :local endIdx ($leasesLen - 30)
  :if ($endIdx < 0) do={ :set endIdx 0 }
  :for idx from=$startIdx to=$endIdx step=-1 do={
    :local i [:pick $leases $idx]
    :local lAddress ""
    :do { :set lAddress [/ip dhcp-server lease get $i address] } on-error={}
    :local lMac ""
    :do { :set lMac [/ip dhcp-server lease get $i mac-address] } on-error={}
    :local lHost ""
    :do { :set lHost [/ip dhcp-server lease get $i host-name] } on-error={}
    :local lStatus ""
    :do { :set lStatus [/ip dhcp-server lease get $i status] } on-error={}
    :local lComment ""
    :do { :set lComment [/ip dhcp-server lease get $i comment] } on-error={}
    :local lLastSeen ""
    :do { :set lLastSeen [/ip dhcp-server lease get $i last-seen] } on-error={}
    
    :local lObj "{\\"address\\":\\"$lAddress\\",\\"mac-address\\":\\"$lMac\\",\\"host-name\\":\\"$lHost\\",\\"status\\":\\"$lStatus\\",\\"comment\\":\\"$lComment\\",\\"last-seen\\":\\"$lLastSeen\\"}"
    :if ([:len $leasesList] > 0) do={
      :set leasesList "$leasesList,$lObj"
    } else={
      :set leasesList $lObj
    }
  }
}

:local json "{\\"routerId\\":\\"$routerId\\",\\"agentKey\\":\\"$agentKey\\",\\"activeUsers\\":[$activeUsersList],\\"userProfiles\\":[$profilesList],\\"hotspotUsers\\":[$usersList],\\"mikhmonSales\\":[$salesList],\\"hotspotServers\\":[$serversList],\\"dhcpLeases\\":[$leasesList],\\"resource\\":{\\"cpuLoad\\":$cpuLoad,\\"freeMemory\\":$freeMemory,\\"totalMemory\\":$totalMemory,\\"uptime\\":\\"$uptime\\"}}"

# 1. Envoyer les statistiques au serveur
:do {
  /tool fetch url=$backendUrl http-method=post http-header-field="Content-Type: application/json" http-data=$json keep-result=no check-certificate=no
  :log info "Agent Push: sync complete"
} on-error={
  :log warning "Agent Push: echec de l envoi des statistiques"
}

# 2. Recuperer et executer les commandes en attente
:do {
  /tool fetch url=$pendingUrl dst-path="pending.rsc" check-certificate=no
  :delay 2s
  :if ([:len [/file find name="pending.rsc"]] > 0) do={
    :log info "Agent Push: execution des commandes en attente..."
    :do {
      /import file-name="pending.rsc"
    } on-error={
      /file remove "pending.rsc"
    }
  }
} on-error={
  :log warning "Agent Push: echec de la recuperation des commandes"
}
`;
}

// Obtenir/générer la clé agent d'un routeur
app.get('/api/agent/key/:routerId', requireAuth, async (req, res) => {
  const { routerId } = req.params;
  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    if (!routerDoc.exists) return res.status(404).json({ error: 'Routeur introuvable.' });
    const router = routerDoc.data();
    if (router.ownerId !== req.user.userId) return res.status(403).json({ error: 'Accès refusé.' });

    let agentKey = router.agentKey;
    if (!agentKey) {
      agentKey = [...Array(40)].map(() => Math.random().toString(36)[2]).join('');
      await adminDb.collection('routers').doc(routerId).update({ agentKey });
    }
    res.json({ agentKey, routerId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Injection automatique directe du script dans le MikroTik via l'API RouterOS (port 8728)
app.post('/api/agent/inject/:routerId', requireAuth, async (req, res) => {
  const { routerId } = req.params;
  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    if (!routerDoc.exists) return res.status(404).json({ error: 'Routeur introuvable.' });
    const router = routerDoc.data();
    if (router.ownerId !== req.user.userId) return res.status(403).json({ error: 'Accès refusé.' });

    let agentKey = router.agentKey;
    if (!agentKey) {
      agentKey = [...Array(40)].map(() => Math.random().toString(36)[2]).join('');
      await adminDb.collection('routers').doc(routerId).update({ agentKey });
    }

    const host = req.headers.host || '';
    const backendHost = BACKEND_URL || (host.includes('localhost') || host.includes('127.0.0.1')
      ? 'https://mikrotik-hotspot-saas-1.onrender.com'
      : `${req.protocol}://${host}`);

    const scriptSource = generateAgentPushScript(routerId, agentKey, backendHost);

    const { targetIp, mode, password: reqPassword, login: reqLogin } = req.body || {};
    const localIp = router.ip || router.host;
    const remoteIp = router.ztIp || router.remoteIp || router.vpnIp || ((localIp && (localIp.startsWith('10.') || localIp.startsWith('172.'))) ? localIp : null);
    const login = reqLogin || router.login || router.user || router.username || 'admin';
    const password = (reqPassword !== undefined && reqPassword !== '') ? reqPassword : (router.password || '');
    const port = parseInt(req.body?.port || router.port) || 8728;

    // Déterminer la liste des IPs candidates à tester dans l'ordre approprié
    let candidateIps = [];

    if (targetIp && targetIp.trim()) {
      const tip = targetIp.trim();
      const isZt = tip.startsWith('10.') || tip.startsWith('172.');
      candidateIps.push({ ip: tip, label: isZt ? 'ZeroTier (IP manuelle)' : 'IP manuelle' });
    }
    
    if (remoteIp && (!targetIp || targetIp.trim() !== remoteIp)) {
      candidateIps.push({ ip: remoteIp, label: 'ZeroTier / VPN' });
    }

    if (localIp && (!targetIp || targetIp.trim() !== localIp) && (!remoteIp || localIp !== remoteIp)) {
      const isZt = localIp.startsWith('10.');
      candidateIps.push({ ip: localIp, label: isZt ? 'ZeroTier (IP routeur)' : 'Réseau Local' });
    }

    // Réordonner selon le mode choisi
    if (mode === 'remote' || mode === 'vpn' || mode === 'zerotier') {
      candidateIps.sort((a, b) => (b.label.includes('ZeroTier') ? 1 : 0) - (a.label.includes('ZeroTier') ? 1 : 0));
    } else if (mode === 'local') {
      candidateIps.sort((a, b) => (b.label.includes('Local') ? 1 : 0) - (a.label.includes('Local') ? 1 : 0));
    }

    if (candidateIps.length === 0) {
      return res.status(400).json({ error: "Aucune adresse IP (locale ou ZeroTier) n'est configurée pour ce routeur." });
    }

    let conn = null;
    let successfulCandidate = null;
    let failedAttempts = [];

    for (const cand of candidateIps) {
      console.log(`⚡ [INJECTION] Tentative vers ${cand.ip}:${port} (${cand.label}) pour ${router.name || routerId}...`);
      try {
        conn = await getConnection(cand.ip, login, password, port, 8000);
        successfulCandidate = cand;
        console.log(`✅ [INJECTION] Connexion établie avec succès via ${cand.ip} (${cand.label}) !`);
        break;
      } catch (connErr) {
        console.warn(`⚠️ [INJECTION] Échec vers ${cand.ip}:${port} (${cand.label}) : ${connErr.message}`);
        failedAttempts.push(`${cand.label} [${cand.ip}]: ${connErr.message}`);
      }
    }

    if (!conn) {
      const summary = failedAttempts.join(' | ');
      return res.status(502).json({
        error: `Impossible de joindre le MikroTik sur le(s) adresse(s) testée(s) : ${summary}`,
        tip: "Si vous êtes à distance, assurez-vous d'être connecté à ZeroTier/VPN et que le port 8728 est ouvert (/ip service). Si vous êtes à côté, connectez-vous au Wi-Fi du routeur.",
        failedAttempts
      });
    }

    // 1. Script
    const scripts = await conn.write('/system/script/print', ['=.proplist=.id,name']);
    const existingScript = scripts.find(s => s.name === 'agent_push' || s.name === 'agent-push');

    if (existingScript) {
      console.log(`⚡ [INJECTION] Mise à jour du script existant (${existingScript['.id']})...`);
      await conn.write('/system/script/set', [
        `=.id=${existingScript['.id']}`,
        `=source=${scriptSource}`,
        '=policy=read,write,policy,test'
      ]);
    } else {
      console.log(`⚡ [INJECTION] Création du script 'agent-push'...`);
      await conn.write('/system/script/add', [
        '=name=agent-push',
        `=source=${scriptSource}`,
        '=policy=read,write,policy,test'
      ]);
    }

    // 2. Scheduler
    const schedulers = await conn.write('/system/scheduler/print', ['=.proplist=.id,name']);
    const existingSched = schedulers.find(s => s.name === 'run_agent_push' || s.name === 'agent-push');

    if (existingSched) {
      console.log(`⚡ [INJECTION] Mise à jour du scheduler existant (${existingSched['.id']})...`);
      await conn.write('/system/scheduler/set', [
        `=.id=${existingSched['.id']}`,
        '=interval=1m',
        '=on-event=/system script run agent-push'
      ]);
    } else {
      console.log(`⚡ [INJECTION] Création du scheduler 'agent-push'...`);
      await conn.write('/system/scheduler/add', [
        '=name=agent-push',
        '=interval=1m',
        '=on-event=/system script run agent-push'
      ]);
    }

    // 3. Déclenchement initial
    try {
      console.log(`⚡ [INJECTION] Déclenchement du test initial...`);
      await conn.write('/system/script/run', ['=number=agent-push']);
    } catch (runErr) {
      console.warn(`⚠️ [INJECTION] Déclenchement initial:`, runErr.message);
    }

    // 4. Vérification de sécurité RouterOS v7 (device-mode)
    let deviceModeNotice = null;
    try {
      const dm = await conn.write('/system/device-mode/print');
      if (dm && dm[0] && (dm[0].fetch === 'false' || dm[0].mode === 'home')) {
        deviceModeNotice = "Note RouterOS v7 : Votre MikroTik a le mode sécurité actif ('device-mode: home', fetch désactivé). La connexion directe et l'administration via ZeroTier fonctionnent à 100%. Si vous souhaitez que le script MikroTik utilise /tool fetch en toute autonomie, exécutez '/system device-mode update mode=enterprise' puis confirmez physiquement.";
      }
    } catch (dmErr) {}

    // 5. Mettre à jour Firestore
    const firestoreUpdates = {
      agentKey,
      agentInstalled: true,
      agentInstalledAt: new Date().toISOString()
    };
    if (successfulCandidate.ip.startsWith('10.') || successfulCandidate.label.includes('ZeroTier')) {
      firestoreUpdates.ztIp = successfulCandidate.ip;
    }
    if (reqPassword && reqPassword !== router.password) {
      firestoreUpdates.password = reqPassword;
    }
    if (reqLogin && reqLogin !== router.login) {
      firestoreUpdates.login = reqLogin;
    }
    await adminDb.collection('routers').doc(routerId).update(firestoreUpdates);

    console.log(`✅ [INJECTION] Réussie pour ${router.name || routerId} via ${successfulCandidate.label} (${successfulCandidate.ip}) !`);
    res.json({
      success: true,
      message: `Script Agent Push injecté et activé avec succès via ${successfulCandidate.label} (${successfulCandidate.ip}) !`,
      connectedIp: successfulCandidate.ip,
      modeUsed: successfulCandidate.label,
      deviceModeNotice
    });
  } catch (err) {
    console.error('❌ [INJECTION ERROR]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint pour télécharger ou importer le script d'installation (.rsc)
app.get('/api/agent/install-script/:routerId', async (req, res) => {
  const { routerId } = req.params;
  const { key } = req.query;

  if (!routerId) return res.status(400).type('text/plain').send('# error: routerId requis\n');

  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    if (!routerDoc.exists) return res.status(404).type('text/plain').send('# error: routeur introuvable\n');
    const router = routerDoc.data();
    if (key && router.agentKey !== key) return res.status(403).type('text/plain').send('# error: cle invalide\n');

    const agentKey = router.agentKey || key || '';
    const host = req.headers.host || '';
    const backendHost = BACKEND_URL || (host.includes('localhost') || host.includes('127.0.0.1')
      ? 'https://mikrotik-hotspot-saas-1.onrender.com'
      : `${req.protocol}://${host}`);

    const scriptSource = generateAgentPushScript(routerId, agentKey, backendHost);
    const escapedSource = scriptSource
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    const rscContent = `# ====================================================
# Installation Automatique Agent Push MikroTik SaaS
# ====================================================

:do { /system script remove [find name="agent-push"] } on-error={}
:do { /system script remove [find name="agent_push"] } on-error={}
/system script add name="agent-push" policy=read,write,policy,test source="${escapedSource}"

:do { /system scheduler remove [find name="agent-push"] } on-error={}
:do { /system scheduler remove [find name="run_agent_push"] } on-error={}
/system scheduler add name="agent-push" interval=1m on-event="/system script run agent-push"

:log info "Agent Push installe avec succes ! Declenchement du premier test..."
:delay 1s
:do { /system script run agent-push } on-error={}
:log info "Agent Push actif et en cours d execution !"
`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="agent-setup.rsc"');
    res.send(rscContent);
  } catch (err) {
    res.status(500).type('text/plain').send(`# error: ${err.message}\n`);
  }
});

// Endpoint pour retourner les commandes en attente sous forme de script RouterOS (.rsc)
app.get('/api/agent/pending-script/:routerId', async (req, res) => {
  const { routerId } = req.params;
  const { key } = req.query;

  if (!routerId || !key) {
    return res.status(400).type('text/plain').send('# error: routerId et key requis\n');
  }

  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    if (!routerDoc.exists) {
      return res.status(404).type('text/plain').send('# error: routeur introuvable\n');
    }
    
    const router = routerDoc.data();
    if (router.agentKey !== key) {
      return res.status(403).type('text/plain').send('# error: cle invalide\n');
    }

    // Récupérer les commandes en attente
    const commandsSnap = await adminDb.collection('routers').doc(routerId)
      .collection('commands')
      .where('status', '==', 'pending')
      .get();

    let sortedDocs = commandsSnap.docs;
    sortedDocs.sort((a, b) => {
      const aTime = a.data().createdAt || '';
      const bTime = b.data().createdAt || '';
      return aTime.localeCompare(bTime);
    });
    sortedDocs = sortedDocs.slice(0, 10);

    if (sortedDocs.length === 0) {
      return res.type('text/plain').send('# pas de commandes en attente\n');
    }

    let scriptContent = '# commandes en attente\n\n';

    // Déterminer l'URL de base pour le callback
    const nets = networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIp = net.address;
          break;
        }
      }
      if (localIp !== '127.0.0.1') break;
    }
    
    // Utiliser BACKEND_URL si défini (prod), sinon l'IP locale (réseau local)
    const callbackHost = BACKEND_URL || `http://${localIp}:${PORT}`;

    for (const doc of sortedDocs) {
      const cmdData = doc.data();
      const commandId = doc.id;
      
      const cliCommand = compileToRouterOsCli(cmdData.endpoint, cmdData.method, cmdData.data);
      if (cliCommand) {
        scriptContent += `${cliCommand}\n`;
        const doneUrl = `${callbackHost}/api/agent/commands/${commandId}/done`;
        scriptContent += `/tool fetch url="${doneUrl}" http-method=post http-header-field="Content-Type: application/json" http-data="{\\"routerId\\":\\"${routerId}\\",\\"agentKey\\":\\"${key}\\",\\"result\\":\\"ok\\"}" keep-result=no\n\n`;
      } else {
        // Commande non supportée, marquée comme sautée
        await doc.ref.update({
          status: 'skipped',
          result: 'unsupported cli conversion',
          executedAt: new Date().toISOString()
        });
      }
    }

    res.type('text/plain').send(scriptContent);
  } catch (err) {
    console.error('Erreur pending script:', err);
    res.status(500).type('text/plain').send(`# error: ${err.message}\n`);
  }
});

// Réception des données poussées par MikroTik
app.post('/api/agent/push', async (req, res) => {
  const { routerId, agentKey, activeUsers, resource, userProfiles, hotspotUsers, mikhmonSales, hotspotServers, dhcpLeases } = req.body;
  if (!routerId || !agentKey) return res.status(400).json({ error: 'routerId et agentKey requis.' });

  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    if (!routerDoc.exists) return res.status(404).json({ error: 'Routeur introuvable.' });
    const router = routerDoc.data();
    if (router.agentKey !== agentKey) return res.status(403).json({ error: 'Clé agent invalide.' });

    // 🔧 Normaliser camelCase → kebab-case (le script MikroTik envoie cpuLoad, freeMemory, etc.)
    const normalizedResource = normalizeResource(resource);
    console.log(`📊 [AGENT PUSH] Resource reçue:`, JSON.stringify(resource));
    console.log(`📊 [AGENT PUSH] Resource normalisée:`, JSON.stringify(normalizedResource));

    // 🔧 Fusionner les ventes et les utilisateurs avec le cache existant pour préserver l'historique
    const existingAgent = router.agentData || {};

    let mergedSales = existingAgent.mikhmonSales || [];
    if (Array.isArray(mikhmonSales) && mikhmonSales.length > 0) {
      const salesMap = new Map();
      mergedSales.forEach(s => { if (s && s.name) salesMap.set(s.name, s); });
      mikhmonSales.forEach(s => { if (s && s.name) salesMap.set(s.name, s); });
      mergedSales = Array.from(salesMap.values());
      if (mergedSales.length > 2500) {
        mergedSales = mergedSales.slice(-2500);
      }
    }

    let mergedUsers = existingAgent.hotspotUsers || [];
    if (Array.isArray(hotspotUsers) && hotspotUsers.length > 0) {
      const usersMap = new Map();
      mergedUsers.forEach(u => { if (u && u.name) usersMap.set(u.name, u); });
      hotspotUsers.forEach(u => { if (u && u.name) usersMap.set(u.name, u); });
      mergedUsers = Array.from(usersMap.values());
      if (mergedUsers.length > 600) {
        mergedUsers = mergedUsers.slice(-600);
      }
    }

    await adminDb.collection('routers').doc(routerId).update({
      'agentData.activeUsers': activeUsers || [],
      'agentData.systemResource': normalizedResource,
      'agentData.userProfiles': (userProfiles && userProfiles.length > 0) ? userProfiles : (existingAgent.userProfiles || []),
      'agentData.hotspotUsers': mergedUsers,
      'agentData.mikhmonSales': mergedSales,
      'agentData.hotspotServers': (hotspotServers && hotspotServers.length > 0) ? hotspotServers : (existingAgent.hotspotServers || []),
      'agentData.dhcpLeases': (dhcpLeases && dhcpLeases.length > 0) ? dhcpLeases : (existingAgent.dhcpLeases || []),
      'agentData.lastSync': new Date().toISOString(),
    });

    // Invalider le cache mémoire
    for (const [key] of responseCache) {
      if (key.startsWith(router.ip + ':')) responseCache.delete(key);
    }

    // Retourner les commandes en attente
    const commandsSnap = await adminDb.collection('routers').doc(routerId)
      .collection('commands')
      .where('status', '==', 'pending')
      .get();

    let sortedDocs = commandsSnap.docs;
    sortedDocs.sort((a, b) => {
      const aTime = a.data().createdAt || '';
      const bTime = b.data().createdAt || '';
      return aTime.localeCompare(bTime);
    });
    sortedDocs = sortedDocs.slice(0, 5);

    const commands = sortedDocs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`📥 [AGENT] ${routerId} → ${(activeUsers || []).length} actifs`);
    res.json({ success: true, commands });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MikroTik marque une commande comme exécutée
app.post('/api/agent/commands/:commandId/done', async (req, res) => {
  const { commandId } = req.params;
  const { routerId, agentKey, result } = req.body;
  if (!routerId || !agentKey) return res.status(400).json({ error: 'requis.' });
  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    if (!routerDoc.exists) return res.status(404).json({ error: 'Routeur introuvable.' });
    if (routerDoc.data().agentKey !== agentKey) return res.status(403).json({ error: 'Clé invalide.' });
    await adminDb.collection('routers').doc(routerId).collection('commands').doc(commandId).update({
      status: 'done', result: result || 'ok', executedAt: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: '🚀 MikroTik Hotspot SaaS Backend is running!' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Backend SaaS MikroTik + Firebase (Port ${PORT})`);
  console.log(`   → Agent Push: POST /api/agent/push`);
  console.log(`   → Prêt pour accepter des connexions\n`);
});

server.timeout = 180000;
server.keepAliveTimeout = 180000;

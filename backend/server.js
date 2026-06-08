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
        
        const result = await Promise.race([
            connPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_BRIDGE: Le routeur ne répond pas.')), 18000))
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
  if (method === 'GET' || !method) cmd = `${path}/print`;
  else if (method === 'PUT') cmd = `${path}/add`;
  else if (method === 'DELETE') cmd = `${path}/remove`;
  else if (method === 'PATCH') cmd = `${path}/set`;
  else cmd = `${path}/print`;

  const params = data ? Object.entries(data).map(([k, v]) => {
    if (k.startsWith('?') || k.startsWith('&') || k.startsWith('#')) return `${k}=${v}`;
    return `=${k}=${v}`;
  }) : [];
  
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
    if (data['session-timeout'] !== undefined) updates.push(`session-timeout="${data['session-timeout']}"`);
    if (data['idle-timeout'] !== undefined) updates.push(`idle-timeout="${data['idle-timeout']}"`);
    if (data['shared-users'] !== undefined) updates.push(`shared-users=${data['shared-users']}`);
    if (data['rate-limit'] !== undefined) updates.push(`rate-limit="${data['rate-limit']}"`);
    if (data.comment !== undefined) updates.push(`comment="${data.comment}"`);
    return `/ip hotspot user profile add ${updates.join(' ')}`;
  }

  // 6. Set Profile
  if (cleanEndpoint === 'ip/hotspot/user/profile/set' && method === 'POST') {
    const id = data['.id'] || data.name;
    if (!id) return null;
    const updates = [];
    if (data.name !== undefined) updates.push(`name="${data.name}"`);
    if (data['session-timeout'] !== undefined) updates.push(`session-timeout="${data['session-timeout']}"`);
    if (data['idle-timeout'] !== undefined) updates.push(`idle-timeout="${data['idle-timeout']}"`);
    if (data['shared-users'] !== undefined) updates.push(`shared-users=${data['shared-users']}`);
    if (data['rate-limit'] !== undefined) updates.push(`rate-limit="${data['rate-limit']}"`);
    if (data.comment !== undefined) updates.push(`comment="${data.comment}"`);
    if (updates.length === 0) return null;
    return `/ip hotspot user profile set [find where name="${id}"] ${updates.join(' ')}`;
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

    // 📡 [AGENT PUSH DIRECT FALLBACK]
    // Si le routeur est configuré en mode Agent (CGNAT/NAT), on ne tente jamais de connexion directe TCP
    if (router.agentKey) {
      if (isReadOperation) {
        const agentData = router.agentData || {};
        const syncAge = agentData.lastSync ? Date.now() - new Date(agentData.lastSync).getTime() : null;
        
        let cachedResult;
        if (endpoint.includes('/active')) {
          cachedResult = (agentData.activeUsers || []).map(u => ({
            ...u,
            '.id': u.user
          }));
        } else if (endpoint.includes('/resource')) {
          cachedResult = agentData.systemResource || {};
        } else if (endpoint.includes('/monitor-traffic')) {
          cachedResult = [{ 'rx-bits-per-second': '0', 'tx-bits-per-second': '0' }];
        } else if (endpoint.includes('/user/profile')) {
          cachedResult = [];
        } else if (endpoint.includes('/user')) {
          cachedResult = [];
        } else if (endpoint.includes('/script')) {
          cachedResult = [];
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
          message: "Le routeur est actuellement injoignable (NAT/CGNAT). La commande a été mise en file d'attente et sera exécutée dès que le routeur se synchronisera (environ 1 min)."
        });
      }
    }

    const apiPort = parseInt(router.port) || 8728;
    console.log(`📡 [User:${req.user.userId}] API:${apiPort} ${method || 'GET'} ${endpoint} @ ${router.ip}`);

    const conn = await getConnection(router.ip, router.login, router.password, apiPort);
    
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

    responseCache.set(cacheKey, {
        data: output,
        timestamp: Date.now()
    });

    const duration = Date.now() - start;
    console.log(`✅ ${endpoint} (${Array.isArray(output) ? output.length : '1'} items) en ${duration}ms`);

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
        if (agentData?.lastSync) {
          const syncAge = Date.now() - new Date(agentData.lastSync).getTime();
          if (syncAge < 300000) { // Cache valide jusqu'à 5 minutes
            let cachedResult;
            if (endpoint.includes('/active')) {
              // Populer le champ .id avec le nom d'utilisateur pour pouvoir déconnecter plus tard via CLI
              cachedResult = (agentData.activeUsers || []).map(u => ({
                ...u,
                '.id': u.user
              }));
            }
            else if (endpoint.includes('/resource')) cachedResult = agentData.systemResource || {};
            else if (endpoint.includes('/monitor-traffic')) {
              // Pas de données de trafic en temps réel via agent — retourner des zéros
              cachedResult = [{ 'rx-bits-per-second': '0', 'tx-bits-per-second': '0' }];
            }
            
            if (cachedResult !== undefined) {
              console.log(`✅ [AGENT CACHE] ${endpoint} depuis cache (${Math.round(syncAge/1000)}s)`);
              res.setHeader('X-Data-Source', 'agent-cache');
              res.setHeader('X-Cache-Age', Math.round(syncAge / 1000));
              return res.status(200).json(cachedResult);
            }
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

// ──────────────────────────────────────────────
// 🤖 Push Agent API (MikroTik → Render → Firestore)
// ──────────────────────────────────────────────

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
  const { routerId, agentKey, activeUsers, resource } = req.body;
  if (!routerId || !agentKey) return res.status(400).json({ error: 'routerId et agentKey requis.' });

  try {
    const routerDoc = await adminDb.collection('routers').doc(routerId).get();
    if (!routerDoc.exists) return res.status(404).json({ error: 'Routeur introuvable.' });
    const router = routerDoc.data();
    if (router.agentKey !== agentKey) return res.status(403).json({ error: 'Clé agent invalide.' });

    await adminDb.collection('routers').doc(routerId).update({
      'agentData.activeUsers': activeUsers || [],
      'agentData.systemResource': resource || {},
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

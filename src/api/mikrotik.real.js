import { BASE_URL } from '../config/api';
const API_URL = `${BASE_URL}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('hspot_token');
  return {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_API_SECRET || '15f707c1a3ad318c6b01e7e10695bf46d461929dbdeb53cefc8cc6673c39f1f5',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const callRouter = async (router, endpoint, method = 'GET', data = null) => {
  if (!router || !router.id) throw new Error('Routeur non sélectionné.');

  const response = await fetch(`${API_URL}/mikrotik`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      routerId: router.id,
      endpoint: endpoint,
      method: method,
      data: data
    })
  });

  if (!response.ok) {
    let err;
    try { err = await response.json(); } catch { err = { error: `HTTP ${response.status}` }; }
    throw new Error(err.error + (err.tip ? ` (${err.tip})` : ''));
  }

  return response.json();
};

export const getRouters = () => {
  return Promise.resolve([]);
};

export const connectRouter = async (router) => {
  const start = Date.now();
  try {
    await callRouter(router, '/system/resource');
    return { success: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getTrafficStats = async (router, iface = 'ether1') => {
  try {
    const list = await callRouter(router, '/interface/monitor-traffic', 'POST', { interface: iface });
    if (Array.isArray(list) && list.length > 0) {
      return {
        rx: parseInt(list[0]['rx-bits-per-second'] || 0),
        tx: parseInt(list[0]['tx-bits-per-second'] || 0)
      };
    }
    return { rx: 0, tx: 0 };
  } catch (err) {
    console.error('Traffic mon failed:', err);
    return { rx: 0, tx: 0 };
  }
};

export const getMonitoringSnapshot = async (router) => {
  try {
    // Parallel fetch for better performance
    const [res, traffic, activeUsers] = await Promise.all([
      callRouter(router, '/system/resource'),
      getTrafficStats(router),
      getActiveHotspotUsers(router)
    ]);

    const totalMem = parseInt(res['total-memory'] || 0);
    const freeMem = parseInt(res['free-memory'] || 0);

    return {
      timestamp: new Date().toLocaleTimeString(),
      rxBps: traffic.rx,
      txBps: traffic.tx,
      cpuPercent: parseInt(res['cpu-load'] || 0),
      ramPercent: totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0,
      activeUsers: activeUsers
    };
  } catch (err) {
    console.error('Monitoring snapshot failed:', err);
    return null;
  }
};

export const getActiveHotspotUsers = async (router) => {
  try {
    const list = await callRouter(router, '/ip/hotspot/active');
    return Array.isArray(list) ? list.length : 0;
  } catch (err) {
    return 0;
  }
};

export const getVoucherProfiles = async (router) => {
  try {
    const list = await callRouter(router, '/ip/hotspot/user/profile');
    if (!Array.isArray(list)) return [];
    return list.map(p => {
      // 1. Try to find price in comment (App style or flexible price)
      // Matches "prix:1000", "price=1000", "1000 FCFA", "1k"
      const comment = (p.comment || '').toLowerCase();
      const commentMatch = comment.match(/(?:prix|price|amount)[:=]\s*(\d+)/i) || 
                           comment.match(/(\d+)\s*(?:fcfa|gnf|cfa|fr)/i);
      
      let price = commentMatch ? parseInt(commentMatch[1]) : 0;
      
      // 2. Comprehensive Script Detection (Mikhmon v3/v4 variants)
      if (price === 0 && p['on-login']) {
        const script = p['on-login'];
        // Search for patterns like ,remc,PRICE, | ,rem,PRICE, | ,vc,PRICE, | ;:local getPrice PRICE;
        const scriptMatch = script.match(/,(?:remc|rem|vc),(\d+),/i) || 
                            script.match(/getPrice\s+(\d+)/i) ||
                            script.match(/price=(\d+)/i);
        
        if (scriptMatch) {
          price = parseInt(scriptMatch[1]);
        }
      }

      // 3. Last resort: if comment IS just a number, it might be the price
      if (price === 0 && comment.match(/^\d+$/)) {
        price = parseInt(comment);
      }
      
      return {
        id: p['.id'],
        name: p.name || 'Sans nom',
        price: price,
        timeLimit: p['session-timeout'] || 'Illimité',
        dataLimit: p['limit-bytes-total']
          ? `${Math.round(parseInt(p['limit-bytes-total']) / 1024 / 1024)} MB`
          : 'Illimité'
      };
    });
  } catch (err) {
    console.error('Profils non chargés:', err);
    return [];
  }
};

// ────────────────────────────────────────────────────────────────────
// Helper : génère un code aléatoire selon le jeu de caractères choisi
// ────────────────────────────────────────────────────────────────────
const CHAR_SETS = {
  mixed:     'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789',
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  lowercase: 'abcdefghjkmnpqrstuvwxyz23456789',
  numeric:   '0123456789',
};

function generateCode(length = 6, charSet = 'mixed', prefix = '') {
  const chars = CHAR_SETS[charSet] || CHAR_SETS.mixed;
  let code = prefix;
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ────────────────────────────────────────────────────────────────────
// Génération de vouchers style Mikhmon avec options avancées
// options: { qty, userMode, length, prefix, characterSet,
//            timeLimit, dataLimit, logSales, mikhmonCompat }
// ────────────────────────────────────────────────────────────────────
export const generateVouchers = async (router, profile, qty, options = {}) => {
  const {
    userMode      = 'up',      // 'up' = user+pass distincts | 'u=p' = user==pass
    length        = 6,
    prefix        = '',
    characterSet  = 'mixed',
    timeLimit: timeLimitOpt,
    dataLimit: dataLimitOpt,
    logSales      = true,
    mikhmonCompat = true,
  } = options;

  const numQty  = parseInt(qty) || 1;
  const now     = new Date();
  const nowISO  = now.toISOString();
  const dateStr = now.toLocaleDateString('fr-FR'); // "06/06/2026"

  // Format date Mikhmon : YYYY-MM-DD
  const mikhmonDate = now.toISOString().split('T')[0];

  const vouchers = [];
  const usedCodes = new Set(); // évite les doublons dans le même batch

  for (let i = 0; i < numQty; i++) {
    // Générer username unique
    let username;
    let attempts = 0;
    do {
      username = generateCode(length, characterSet, prefix);
      attempts++;
    } while (usedCodes.has(username) && attempts < 50);
    usedCodes.add(username);

    // Password : user=pass ou password distinct (numérique 4 chiffres par défaut)
    const password = userMode === 'u=p'
      ? username
      : generateCode(4, 'numeric', '');

    // Durée / données (override possible par l'utilisateur)
    const finalTimeLimit = timeLimitOpt || profile.timeLimit || '';
    const finalDataLimit = dataLimitOpt || '';

    // Commentaire style Mikhmon (compatible avec la page Ventes)
    // Format Mikhmon v4: "YYYY-MM-DD-|-HH:MM-|-user-|-price-|-ip-|-mac-|-validity-|-profile"
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const mikhmonComment = mikhmonCompat
      ? `${mikhmonDate}-|-${hh}:${mm}-|-${username}-|-${profile.price || 0}-|-App-|-${i+1}-|-${finalTimeLimit || 'Illimité'}-|-${profile.name}`
      : `App ${dateStr}`;

    try {
      // Paramètres pour l'API MikroTik
      const apiData = {
        name:     username,
        password: password,
        profile:  profile.name,
        comment:  mikhmonComment,
      };
      if (finalTimeLimit) apiData['limit-uptime'] = finalTimeLimit;
      if (finalDataLimit) apiData['limit-bytes-total'] =
        String(parseInt(finalDataLimit) * 1024 * 1024); // MB → bytes

      await callRouter(router, '/ip/hotspot/user', 'PUT', apiData);

      // Log de vente dans /system/script (compatible Mikhmon)
      if (logSales && mikhmonCompat) {
        const salesScriptName = `${mikhmonDate}-|-${hh}:${mm}-|-${username}-|-${profile.price || 0}-|-App-|-${i+1}-|-${finalTimeLimit || profile.timeLimit || 'Illimité'}-|-${profile.name}`;
        try {
          await callRouter(router, '/system/script', 'PUT', {
            name:    salesScriptName,
            source:  mikhmonDate,
            comment: 'mikhmon',
          });
        } catch (_) { /* log optionnel, on ignore les erreurs */ }
      }

      vouchers.push({
        id:          `${Date.now()}-${i}`,
        username,
        password,
        profileId:   profile.id,
        profileName: profile.name,
        timeLimit:   finalTimeLimit || profile.timeLimit || 'Illimité',
        dataLimit:   finalDataLimit
          ? `${dataLimitOpt} MB`
          : profile.dataLimit || 'Illimité',
        price:       profile.price || 0,
        createdAt:   nowISO,
        status:      'unused',
        comment:     mikhmonComment,
      });
    } catch (e) {
      console.error(`Coupon ${i + 1} non créé:`, e.message);
    }
  }

  // Persistance locale (historique hors-ligne + cache)
  const history = JSON.parse(localStorage.getItem('hspot_history') || '[]');
  localStorage.setItem('hspot_history', JSON.stringify([...vouchers, ...history]));

  return vouchers;
};

export const getHotspotUsers = async (router) => {
  try {
    // Sequential fetch to avoid overloading the MikroTik API CPU
    const users = await callRouter(router, '/ip/hotspot/user', 'POST', { 
      // Minimal set + metrics for usage tracking
      proplist: '.id,name,password,profile,comment,uptime,bytes-in,bytes-out'
    });
    
    if (!Array.isArray(users)) return [];

    const active = await callRouter(router, '/ip/hotspot/active');
    const profiles = await getVoucherProfiles(router);

    const activeMap = new Map();
    if (Array.isArray(active)) {
      // Use lowercase keys for case-insensitive matching (abdoul == Abdoul)
      active.forEach(a => activeMap.set((a.user || '').toLowerCase(), a));
    }

    const profileMap = new Map();
    profiles.forEach(p => profileMap.set(p.name, p));

    return users.map(u => {
      // Case-insensitive lookup: "Abdoul", "abdoul", "ABDOUL" all match
      const activeSession = activeMap.get((u.name || '').toLowerCase());
      const profile = profileMap.get(u.profile) || {};
      
      const uptime = u.uptime || '0s';
      const bytesOut = parseInt(u['bytes-out'] || 0);
      const bytesIn = parseInt(u['bytes-in'] || 0);

      // Determine status
      let status = 'unused';
      if (activeSession) {
        status = 'online';
      } else if (uptime !== '0s' || bytesOut > 0) {
        status = 'used';
      }

      // Password: show real value, or mark as hidden if not returned by router
      const password = u.password && u.password.trim() !== '' 
        ? u.password 
        : (u.uptime || bytesOut > 0 ? '(caché)' : '---');

      return {
        id: u['.id'],
        username: u.name,
        password: password,
        profileId: u.profile,
        profileName: u.profile,
        price: profile.price || 0,
        timeLimit: u['limit-uptime'] || profile.timeLimit || 'Illimité',
        dataLimit: u['limit-bytes-total'] 
          ? `${Math.round(parseInt(u['limit-bytes-total']) / 1024 / 1024)} MB` 
          : profile.dataLimit || 'Illimité',
        // Pass the raw comment — SalesPage will parse the date from it (handles all Mikhmon formats)
        createdAt: u.comment || null,
        comment: u.comment || '',
        status: status,
        // Live stats from active session or stored usage
        stats: {
          uptime: activeSession?.uptime || uptime,
          bytesOut: parseInt(activeSession?.['bytes-out'] || bytesOut),
          bytesIn: parseInt(activeSession?.['bytes-in'] || bytesIn),
          ip: activeSession?.address || '',
          mac: activeSession?.['mac-address'] || ''
        }
      };
    });
  } catch (err) {
    console.error('Fetch users failed:', err);
    return [];
  }
};

/**
 * Fetches sales records stored as Mikhmon scripts in /system/script.
 * This is the most accurate way to match Mikhmon's internal accounting.
 */
export const getMikhmonSales = async (router) => {
  try {
    // Optimization: Use native MikroTik filtering (?comment=mikhmon) 
    // to avoid downloading thousands of unrelated scripts.
    const scripts = await callRouter(router, '/system/script', 'POST', {
      proplist: '.id,name,comment',
      '?comment': 'mikhmon'
    });

    if (!Array.isArray(scripts)) return [];

    // Filter scripts created by Mikhmon
    return scripts
      .filter(s => s.comment === 'mikhmon' && s.name.includes('-|-'))
      .map(s => {
        const parts = s.name.split('-|-');
        // Format: date-|-time-|-user-|-price-|-address-|-mac-|-validity-|-profile-|-comment
        return {
          id: s['.id'],
          dateRaw: parts[0],
          price: parseInt(parts[3]) || 0,
          user: parts[2],
          profile: parts[7] || '',
          // Use the source (which is usually the date in Mikhmon) or the name date part
          date: s.source || parts[0]
        };
      });
  } catch (err) {
    console.error('Fetch Mikhmon sales failed:', err);
    return [];
  }
};

export const getHotspotServers = async (router) => {
  try {
    const list = await callRouter(router, '/ip/hotspot/server');
    if (!Array.isArray(list)) return [];
    return list.map(s => ({
      id: s['.id'],
      name: s.name,
      profile: s.profile
    }));
  } catch (err) {
    console.error('Fetch servers failed:', err);
    return [];
  }
};

export const blockHotspotUser = async (router, usernameOrId, block = true, sessionId = null) => {
  try {
    // block/unblock the user account in /ip/hotspot/user
    await callRouter(router, '/ip/hotspot/user/set', 'POST', {
      '.id': usernameOrId,
      disabled: block ? 'yes' : 'no'
    });
    // If blocking and session active, also remove the active session
    if (block && sessionId) {
      try {
        await callRouter(router, '/ip/hotspot/active/remove', 'POST', { '.id': sessionId });
      } catch (_) { /* ignore if session already gone */ }
    }
    return { success: true };
  } catch (err) {
    console.error('Block/unblock user failed:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Returns full list of active hotspot sessions with rich fields.
 */
export const getFullActiveUsers = async (router) => {
  try {
    const list = await callRouter(router, '/ip/hotspot/active');
    if (!Array.isArray(list)) return [];
    return list.map(u => ({
      id: u['.id'],
      user: u.user || u.name || '',
      address: u.address || '',
      macAddress: u['mac-address'] || '',
      hostname: u.host || u.comment || '',
      uptime: u.uptime || '0s',
      idleTime: u['idle-time'] || '',
      sessionTimeLeft: u['session-time-left'] || '',
      bytesIn: parseInt(u['bytes-in'] || 0),
      bytesOut: parseInt(u['bytes-out'] || 0),
      profile: u.profile || '',
      server: u.server || '',
    }));
  } catch (err) {
    console.error('getFullActiveUsers failed:', err);
    return [];
  }
};

/**
 * Disconnects (removes) an active hotspot session by session ID.
 */
export const disconnectActiveUser = async (router, sessionId) => {
  try {
    await callRouter(router, '/ip/hotspot/active/remove', 'POST', { '.id': sessionId });
    return { success: true };
  } catch (err) {
    console.error('Disconnect user failed:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Returns config details for a specific hotspot user account (from /ip/hotspot/user).
 */
export const getHotspotUserDetails = async (router, username) => {
  try {
    const list = await callRouter(router, '/ip/hotspot/user', 'POST', {
      proplist: '.id,name,password,profile,comment,disabled,limit-uptime,limit-bytes-total'
    });
    if (!Array.isArray(list)) return null;
    const user = list.find(u => (u.name || '').toLowerCase() === username.toLowerCase());
    if (!user) return null;
    return {
      id: user['.id'],
      name: user.name,
      password: user.password,
      profile: user.profile,
      comment: user.comment,
      disabled: user.disabled === 'true' || user.disabled === true,
      limitUptime: user['limit-uptime'] || 'Illimité',
      limitBytes: user['limit-bytes-total']
        ? `${Math.round(parseInt(user['limit-bytes-total']) / 1024 / 1024)} MB`
        : 'Illimité'
    };
  } catch (err) {
    console.error('getHotspotUserDetails failed:', err);
    return null;
  }
};

/**
 * Returns DHCP server leases from /ip/dhcp-server/lease.
 */
export const getDhcpLeases = async (router) => {
  try {
    const list = await callRouter(router, '/ip/dhcp-server/lease');
    if (!Array.isArray(list)) return [];
    return list.map(l => ({
      id: l['.id'],
      address: l.address || '',
      macAddress: l['mac-address'] || '',
      hostname: l.host || l['host-name'] || l.comment || '',
      status: l.status || 'unknown',
      comment: l.comment || '',
      lastSeen: l['last-seen'] || '',
    }));
  } catch (err) {
    console.error('getDhcpLeases failed:', err);
    return [];
  }
};

/**
 * Returns wireless registration table clients.
 */
export const getWirelessClients = async (router) => {
  try {
    const list = await callRouter(router, '/interface/wireless/registration-table');
    if (!Array.isArray(list)) return [];
    return list.map(w => ({
      id: w['.id'],
      macAddress: w['mac-address'] || '',
      interface: w.interface || '',
      signal: w['signal-strength'] || '',
      txCcq: parseInt(w['tx-ccq'] || 0),
      throughput: w['tx-rate'] || w['rx-rate'] || '',
      uptime: w.uptime || '',
    }));
  } catch (err) {
    // Wireless not available on all routers — fail silently
    return [];
  }
};

/**
 * Returns IP neighbor discovery table.
 */
export const getNeighbors = async (router) => {
  try {
    const list = await callRouter(router, '/ip/neighbor');
    if (!Array.isArray(list)) return [];
    return list.map(n => ({
      id: n['.id'],
      macAddress: n['mac-address'] || '',
      address: n.address || '',
      identity: n.identity || '',
      platform: n.platform || '',
      board: n.board || '',
      interface: n.interface || '',
    }));
  } catch (err) {
    return [];
  }
};

/**
 * Creates a new hotspot user profile.
 */
export const createHotspotProfile = async (router, profileData) => {
  try {
    const payload = {
      name: profileData.name,
      'session-timeout': profileData.sessionTimeout || '',
      'idle-timeout': profileData.idleTimeout || '',
      'shared-users': profileData.sharedUsers || '1',
    };
    if (profileData.rateLimit) payload['rate-limit'] = profileData.rateLimit;
    if (profileData.comment) payload.comment = profileData.comment;
    await callRouter(router, '/ip/hotspot/user/profile', 'PUT', payload);
    return { success: true };
  } catch (err) {
    console.error('createHotspotProfile failed:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Updates an existing hotspot user profile by .id.
 */
export const updateHotspotProfile = async (router, id, profileData) => {
  try {
    const payload = { '.id': id };
    if (profileData.name !== undefined) payload.name = profileData.name;
    if (profileData.sessionTimeout !== undefined) payload['session-timeout'] = profileData.sessionTimeout;
    if (profileData.idleTimeout !== undefined) payload['idle-timeout'] = profileData.idleTimeout;
    if (profileData.sharedUsers !== undefined) payload['shared-users'] = profileData.sharedUsers;
    if (profileData.rateLimit !== undefined) payload['rate-limit'] = profileData.rateLimit;
    if (profileData.comment !== undefined) payload.comment = profileData.comment;
    await callRouter(router, '/ip/hotspot/user/profile/set', 'POST', payload);
    return { success: true };
  } catch (err) {
    console.error('updateHotspotProfile failed:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Deletes a hotspot user profile by .id.
 */
export const deleteHotspotProfile = async (router, id) => {
  try {
    await callRouter(router, '/ip/hotspot/user/profile/remove', 'POST', { '.id': id });
    return { success: true };
  } catch (err) {
    console.error('deleteHotspotProfile failed:', err);
    return { success: false, error: err.message };
  }
};

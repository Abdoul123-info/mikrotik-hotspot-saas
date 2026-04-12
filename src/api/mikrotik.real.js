const PROXY_IP = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
// In production (served by proxy), API is on same host+port. In dev (Vite :5173), proxy is on :3001.
const isDev = typeof window !== 'undefined' && window.location.port === '5173';
const PROXY_URL = isDev
  ? `http://${PROXY_IP}:3001/api/mikrotik`
  : `${window.location.origin}/api/mikrotik`;

// Helper to call MikroTik via the Proxy (uses RouterOS API port 8728)
const callRouter = async (router, endpoint, method = 'GET', data = null, dateFilter = null) => {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-API-Key': import.meta.env.VITE_API_SECRET || '15f707c1a3ad318c6b01e7e10695bf46d461929dbdeb53cefc8cc6673c39f1f5'
    },
    body: JSON.stringify({
      ip: router.ip,
      port: String(router.port || '8728'),
      username: router.login,
      password: router.password || '',
      endpoint: endpoint,
      method: method,
      data: data,
      dateFilter: dateFilter  // 📱 Mobile optimization: server-side filtering
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
  const saved = localStorage.getItem('hspot_routers');
  return Promise.resolve(saved ? JSON.parse(saved) : []);
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

export const getFullActiveUsers = async (router) => {
  try {
    // Proplist explicite pour éviter l'auto-optimisation du proxy
    const list = await callRouter(router, '/ip/hotspot/active', 'POST', {
      proplist: '.id,user,address,mac-address,uptime,bytes-in,bytes-out,login-by,comment'
    });
    if (!Array.isArray(list)) return [];
    
    return list.map(a => ({
      id: a['.id'],
      user: a.user || a.name || 'Inconnu',
      address: a.address || '',
      macAddress: a['mac-address'] || '',
      uptime: a.uptime || '0s',
      bytesIn: parseInt(a['bytes-in'] || 0),
      bytesOut: parseInt(a['bytes-out'] || 0),
      comment: a.comment || '',
      loginBy: a['login-by'] || ''
    }));
  } catch (err) {
    console.error('Fetch full active users failed:', err);
    return [];
  }
};

export const disconnectActiveUser = async (router, userId) => {
  try {
    await callRouter(router, '/ip/hotspot/active', 'DELETE', { '.id': userId });
    return { success: true };
  } catch (err) {
    console.error('Disconnect active user failed:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Block or unblock a hotspot user by username (sets disabled=yes/no on the user account).
 * Optionally also disconnects the active session when blocking.
 */
export const blockHotspotUser = async (router, username, block, activeSessionId = null) => {
  try {
    // Find user ID by name
    const users = await callRouter(router, '/ip/hotspot/user', 'POST', {
      proplist: '.id,name,disabled',
      '?name': username
    });
    if (!Array.isArray(users) || users.length === 0) {
      return { success: false, error: 'Utilisateur introuvable' };
    }
    const userId = users[0]['.id'];

    // Set disabled=yes or disabled=no
    await callRouter(router, '/ip/hotspot/user', 'PATCH', {
      '.id': userId,
      disabled: block ? 'yes' : 'no'
    });

    // If blocking, also kick the active session
    if (block && activeSessionId) {
      await callRouter(router, '/ip/hotspot/active', 'DELETE', { '.id': activeSessionId });
    }

    return { success: true };
  } catch (err) {
    console.error('Block user failed:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Get full details of a hotspot user by username, including profile limits.
 */
export const getHotspotUserDetails = async (router, username) => {
  try {
    const users = await callRouter(router, '/ip/hotspot/user', 'POST', {
      proplist: '.id,name,profile,comment,uptime,bytes-in,bytes-out,disabled,limit-uptime,limit-bytes-total,password',
      '?name': username
    });
    if (!Array.isArray(users) || users.length === 0) return null;
    const u = users[0];
    return {
      id: u['.id'],
      username: u.name,
      profile: u.profile || '',
      disabled: u.disabled === 'true' || u.disabled === 'yes',
      comment: u.comment || '',
      uptime: u.uptime || '0s',
      bytesIn: parseInt(u['bytes-in'] || 0),
      bytesOut: parseInt(u['bytes-out'] || 0),
      limitUptime: u['limit-uptime'] || 'Illimité',
      limitBytes: u['limit-bytes-total']
        ? `${Math.round(parseInt(u['limit-bytes-total']) / 1024 / 1024)} MB`
        : 'Illimité',
    };
  } catch (err) {
    console.error('Get user details failed:', err);
    return null;
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

export const generateVouchers = async (router, profile, qty) => {
  const vouchers = [];
  const now = new Date().toISOString();
  const numQty = parseInt(qty) || 1;

  for (let i = 0; i < numQty; i++) {
    const user = Math.random().toString(36).substring(2, 8).toUpperCase();
    const pass = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      await callRouter(router, '/ip/hotspot/user', 'PUT', {
        name: user,
        password: pass,
        profile: profile.name,
        comment: `App ${new Date().toLocaleDateString('fr-FR')}`
      });

      vouchers.push({
        id: `${Date.now()}-${i}`,
        username: user,
        password: pass,
        profileId: profile.id,
        profileName: profile.name,
        timeLimit: profile.timeLimit,
        dataLimit: profile.dataLimit,
        price: profile.price,
        createdAt: now,
        status: 'unused'
      });
    } catch (e) {
      console.error(`Coupon ${i + 1} non créé:`, e.message);
    }
  }

  // Persist to local history (Still used for offline/newly created)
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

    const filteredUsers = users.filter(u => 
      u.name !== 'default-trial' && u.name !== 'default'
    );

    const active = await callRouter(router, '/ip/hotspot/active', 'POST', {
      proplist: '.id,user,address,mac-address,uptime,bytes-in,bytes-out'
    });
    const profiles = await getVoucherProfiles(router);

    const activeMap = new Map();
    if (Array.isArray(active)) {
      active.forEach(a => activeMap.set((a.user || '').toLowerCase(), a));
    }

    const profileMap = new Map();
    profiles.forEach(p => profileMap.set(p.name, p));

    return filteredUsers.map(u => {
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
export const getMikhmonSales = async (router, query = {}, mode = 'full') => {
  try {
    // Build the dateFilter for server-side proxy filtering (📱 Mobile Optimization)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    let dateFilter = null;
    if (mode === 'today') dateFilter = `${yyyy}-${mm}-${dd}`;
    else if (mode === 'month') dateFilter = `${yyyy}-${mm}`;
    // mode === 'full': no date filter, get everything

    const finalQuery = {
      '.proplist': '.id,name',
      ...query
    };

    const allScripts = await callRouter(router, '/system/script', 'POST', finalQuery, dateFilter);

    if (!Array.isArray(allScripts)) {
      console.warn('Fallback: scripts non reçus sous forme d\'array');
      return [];
    }

    // Local JS filter as double-check (proxy already does it, this is a safety net)
    const mikhmonScripts = allScripts.filter(s => s.name && s.name.includes('-|-'));
    console.log(`[MikroTik API] Found ${mikhmonScripts.length} matching scripts out of ${allScripts.length}`);
    return parseMikhmonScripts(mikhmonScripts);

  } catch (err) {
    console.error('Fetch Mikhmon sales failed:', err);
    return [];
  }
};

const parseMikhmonScripts = (scripts) => {
  return scripts
    .filter(s => s.name && s.name.includes('-|-'))
    .map(s => {
      const parts = s.name.split('-|-');
      // Mikhmon name format: date-|-time-|-user-|-price-|-address-|-mac-|-validity-|-profile-|-comment
      // parts[0] is the date (e.g., apr/10/2026)
      // parts[3] is the price
      const rawPrice = parts[3] || '0';
      const cleanPrice = parseInt(rawPrice.replace(/[^0-9]/g, '')) || 0;
      
      return {
        id: s['.id'],
        dateRaw: parts[0],
        price: cleanPrice,
        user: parts[2],
        profile: parts[7] || '',
        date: parts[0] // Use the date from the name directly instead of the heavy source
      };
    });
};

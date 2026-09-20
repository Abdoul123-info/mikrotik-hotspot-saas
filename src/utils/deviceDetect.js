/**
 * Device Type Detector
 * Priorité : Hostname DHCP (fiable) → OUI MAC → MAC Aléatoire (Android/iOS)
 * Retourne : 'mobile' | 'pc' | 'unknown'
 */

// ─── Détection par Hostname ───────────────────────────────────────────────────

const MOBILE_KEYWORDS = [
  'iphone', 'ipad',
  'android', 'galaxy', 'samsung',
  'xiaomi', 'redmi', 'poco',
  'huawei', 'honor',
  'tecno', 'infinix', 'itel',
  'oppo', 'vivo', 'realme',
  'oneplus', 'motorola', 'moto',
  'nokia', 'phone', 'mobile',
  // Modèles fréquents (Afrique & Global)
  'spark', 'pop', 'camon', 'pova', 'phantom',
  'smart', 'hot', 'note', 'zero',
  'pixel', 'tab', 'pad',
  'a0', 'a1', 'a2', 'a3', 'a5', // Galaxy A04s, A05, A14, A15, A24, etc.
  's20', 's21', 's22', 's23', 's24', // Galaxy S23 Ultra, etc.
  'y1', 'y2', 'y3', 'y0', // Vivo Y19, Y20, Y02, etc.
  'cph', 'rmx', 'sm-', 'm20', 'm30', // Préfixes modèles Oppo, Realme, Samsung
  'ldn', 'nam', 'bkk', 'pot', // Préfixes modèles Huawei
];

const PC_KEYWORDS = [
  'desktop', 'laptop', 'notebook',
  'workstation', 'macbook', 'imac',
  'pc-', '-pc', 'pc ', ' pc', 'lenovo', 'dell',
  'hp-', 'asus', 'acer', 'toshiba',
  'thinkpad', 'ideapad', 'pavilion',
  'inspiron', 'surface', 'win-', 'ordi', 'ordinateur', 'poste', 'windows'
];

// Windows génère des noms comme "DESKTOP-A1B2C3", "LAPTOP-X9Y8Z7" ou "WIN-XYZ"
const WINDOWS_PC_PATTERN = /^(desktop|laptop|pc|win)-[a-z0-9]+$/i;

const detectFromHostname = (hostname) => {
  if (!hostname) return null;
  const h = hostname.toLowerCase();

  // 1. Windows PC (très fiable)
  if (WINDOWS_PC_PATTERN.test(hostname)) return 'pc';

  // 2. Keywords PC
  if (PC_KEYWORDS.some(k => h.includes(k))) return 'pc';

  // 3. Keywords Mobile
  if (MOBILE_KEYWORDS.some(k => h.includes(k))) return 'mobile';

  // 4. Modèles de téléphone avec tiret (ex: A04s, NAM-LX9, LDN-L21B)
  if (/^[a-z]{2,4}-[a-z0-9]+$/i.test(hostname)) return 'mobile';

  return null;
};

// ─── Détection par OUI (constructeur MAC) ─────────────────────────────────────

const MOBILE_OUIS = new Set([
  // Apple iPhone/iPad
  'A4C3F0','A886DD','00CDFE','3C0754','F01898','DC2B2A','8C8590',
  '7C6D62','B8FF61','2CF0A2','A45E60','E0B946','98FE94','4C74BF',
  // Samsung Mobile
  '002637','00E064','1449E0','2C0E3D','3425E2','4C3C16','549B12',
  '6C2F2C','8425DB','A82060','BC7745','CC07AB','D87D76','E45D75','F4428F',
  // Xiaomi
  '00EC0A','28D127','6C5AB5','748D3C','8C97EA','A086C6','B0E235','F48B32',
  'F8633F','64CC22','7802F8','04B167','584498','7C1C4E','ACF7F3',
  // Huawei Mobile
  '001882','001E10','0025E2','286ED4','3C4706','48DB50','54BA44','6C96CF',
  // Tecno, Infinix, itel (Transsion)
  '3C5A37','BC3400','2C3071','A04CE6','10BF48','384B76','8038BC','84262B',
  // Oppo/Realme
  '0003C0','140F39','2CCE2F','546918','E8BBA8','70288B',
  // Vivo
  'A8568C','E89235','14C4E2','687A1E',
  // OnePlus
  'AC3743','94652D',
  // Nokia / HMD
  '0021F2','7CBB8A','A4C33B',
  // Motorola Mobile
  'AC37F1','203D66','E458E7',
]);

const PC_OUIS = new Set([
  // Dell
  '001422','14B31F','BCEE7B','F8BC12',
  // HP
  '001A4B','3C4A92','9CB654','B499BA',
  // Lenovo
  '000FFA','54EEA8','E4E749',
  // Asus
  '049226','1C872C','AC9E17',
  // Acer
  '6045CB','E4A7C5',
]);

const normalizeOUI = (mac) => {
  if (!mac) return '';
  return mac.replace(/[:\-\.]/g, '').toUpperCase().substring(0, 6);
};

const detectFromOUI = (mac) => {
  const oui = normalizeOUI(mac);
  if (!oui) return null;
  if (MOBILE_OUIS.has(oui)) return 'mobile';
  if (PC_OUIS.has(oui)) return 'pc';
  return null;
};

// ─── Détection par MAC Aléatoire (IEEE 802 LAA) ──────────────────────────────
// Les smartphones (iOS 14+, Android 10+) utilisent par défaut des adresses MAC privées
// dont le 2e caractère hexadécimal est toujours 2, 6, A ou E.
const isRandomizedMac = (mac) => {
  if (!mac) return false;
  const clean = mac.replace(/[:\-\.]/g, '').toUpperCase();
  if (clean.length < 2) return false;
  const secondChar = clean.charAt(1);
  return secondChar === '2' || secondChar === '6' || secondChar === 'A' || secondChar === 'E';
};

// ─── API Publique ─────────────────────────────────────────────────────────────

/**
 * Détecte le type d'appareil.
 * @param {string} hostname - Nom d'hôte DHCP (prioritaire)
 * @param {string} mac      - Adresse MAC (fallback OUI / LAA)
 * @param {string} username - Nom d'utilisateur Hotspot (fallback si hostname vide)
 * @returns {{ type: 'mobile'|'pc'|'unknown', icon: string, label: string, color: string }}
 */
export const detectDevice = (hostname, mac, username = '') => {
  let type = detectFromHostname(hostname);
  
  if (!type && username) {
    type = detectFromHostname(username);
  }

  if (!type) {
    type = detectFromOUI(mac);
  }

  // Si toujours pas détecté et que la MAC est aléatoire (signature standard smartphone Wi-Fi)
  if (!type && isRandomizedMac(mac)) {
    type = 'mobile';
  }

  type = type || 'unknown';

  const MAP = {
    mobile:  { icon: '📱', label: 'Mobile',   color: 'text-primary' },
    pc:      { icon: '💻', label: 'PC / Ordi', color: 'text-blue-400' },
    unknown: { icon: '❓', label: 'Autre',    color: 'text-white/40' },
  };

  return { type, ...MAP[type] };
};

/**
 * Device Type Detector
 * Priorité : Hostname DHCP (fiable) → OUI MAC (fallback)
 * Retourne uniquement : 'mobile' | 'pc' | 'unknown'
 */

// ─── Détection par Hostname ───────────────────────────────────────────────────
// Les noms d'hôtes DHCP sont bien plus fiables que les OUI (MACs aléatoires)

const MOBILE_KEYWORDS = [
  'iphone', 'ipad',
  'android', 'galaxy', 'samsung',
  'xiaomi', 'redmi', 'poco',
  'huawei', 'honor',
  'tecno', 'infinix', 'itel',
  'oppo', 'vivo', 'realme',
  'oneplus', 'motorola', 'moto',
  'nokia', 'phone', 'mobile',
];

const PC_KEYWORDS = [
  'desktop', 'laptop', 'notebook',
  'workstation', 'macbook', 'imac',
  'pc-', '-pc', 'lenovo', 'dell',
  'hp-', 'asus', 'acer', 'toshiba',
  'thinkpad', 'ideapad', 'pavilion',
  'inspiron', 'surface',
];

// Windows génère des noms comme "DESKTOP-A1B2C3" ou "LAPTOP-X9Y8Z7"
const WINDOWS_PC_PATTERN = /^(desktop|laptop|pc)-[a-z0-9]+$/i;

const detectFromHostname = (hostname) => {
  if (!hostname) return null;
  const h = hostname.toLowerCase();

  // Windows PC (très fiable)
  if (WINDOWS_PC_PATTERN.test(hostname)) return 'pc';

  // Keywords PC
  if (PC_KEYWORDS.some(k => h.includes(k))) return 'pc';

  // Keywords Mobile
  if (MOBILE_KEYWORDS.some(k => h.includes(k))) return 'mobile';

  return null;
};

// ─── Détection par OUI (fallback si hostname vide) ───────────────────────────
// Seulement les OUI qui sont TOUJOURS des mobiles (fabricants 100% mobile)

const MOBILE_OUIS = new Set([
  // Apple iPhone/iPad (non-Mac)
  'A4C3F0','A886DD','00CDFE','3C0754','F01898','DC2B2A','8C8590',
  '7C6D62','B8FF61','2CF0A2','A45E60','E0B946','98FE94','4C74BF',
  // Samsung Mobile
  '002637','00E064','1449E0','2C0E3D','3425E2','4C3C16','549B12',
  '6C2F2C','8425DB','A82060','BC7745','CC07AB','D87D76','E45D75','F4428F',
  // Xiaomi
  '00EC0A','28D127','6C5AB5','748D3C','8C97EA','A086C6','B0E235','F48B32',
  // Huawei Mobile
  '001882','001E10','0025E2','286ED4','3C4706','48DB50','54BA44','6C96CF',
  // Tecno (Afrique)
  '3C5A37','BC3400','2C3071','A04CE6',
  // Infinix, Itel
  '10BF48','384B76',
  // Oppo/Realme
  '0003C0','140F39','2CCE2F','546918','E8BBA8',
  // Vivo
  'A8568C','E89235','14C4E2',
  // OnePlus
  'AC3743','94652D',
  // Nokia
  '0021F2','7CBB8A',
  // Motorola Mobile
  'AC37F1','203D66',
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

// ─── API Publique ─────────────────────────────────────────────────────────────

/**
 * Détecte le type d'appareil.
 * @param {string} hostname - Nom d'hôte DHCP (prioritaire)
 * @param {string} mac     - Adresse MAC (fallback OUI)
 * @returns {{ type: 'mobile'|'pc'|'unknown', icon: string, label: string, color: string }}
 */
export const detectDevice = (hostname, mac) => {
  const type = detectFromHostname(hostname) || detectFromOUI(mac) || 'unknown';

  const MAP = {
    mobile:  { icon: '📱', label: 'Mobile',   color: 'text-primary' },
    pc:      { icon: '💻', label: 'PC / Ordi', color: 'text-blue-400' },
    unknown: { icon: '❓', label: 'Inconnu',   color: 'text-white/20' },
  };

  return { type, ...MAP[type] };
};

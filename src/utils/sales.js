/**
 * Utilities for parsing and calculating sales from MikroTik Hotspot user data.
 */

/**
 * Parses the creation date from a ticket's comment or createdAt field.
 * Handles Mikhmon and App formats.
 * @param {Object} ticket - The ticket object from getHotspotUsers
 * @returns {Date|null}
 */
const MONTHS_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  'janv.': 0, 'févr.': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5, 'juil.': 6, 'août': 7, 'sept.': 8, 'oct.': 9, 'nov.': 10, 'déc.': 11,
  'janv': 0, 'févr': 1, 'avr': 3, 'sept': 8, 'oct': 9, 'nov': 10, 'déc': 11
};

export const parseTicketDate = (ticket) => {
  const comment = (ticket.comment || '').trim().toLowerCase();
  if (!comment) return null;

  // 1. Activation format (Mikhmon)
  // Must contain "up-" or be a sales record
  const isMikhmon = comment.includes('up-') || comment.includes('-|-');
  const cleanComment = comment.replace(/^up-/, '');

  // A. Format with Month Names (MikroTik native: apr/10/2026 or 10/apr/2026)
  const fmtMonth = cleanComment.match(/([a-z]{3,5})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (fmtMonth) {
    const month = MONTHS_MAP[fmtMonth[1].substring(0, 3)] ?? -1;
    if (month !== -1) return new Date(parseInt(fmtMonth[3]), month, parseInt(fmtMonth[2]));
  }
  const fmtMonthInv = cleanComment.match(/(\d{1,2})[\/.-]([a-z]{3,5})[\/.-](\d{4})/);
  if (fmtMonthInv) {
    const month = MONTHS_MAP[fmtMonthInv[2].substring(0, 3)] ?? -1;
    if (month !== -1) return new Date(parseInt(fmtMonthInv[3]), month, parseInt(fmtMonthInv[1]));
  }

  // B. Standard ISO: up-2026-04-10 21:55:13
  const fmtISO = cleanComment.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (fmtISO) {
    return new Date(parseInt(fmtISO[1]), parseInt(fmtISO[2]) - 1, parseInt(fmtISO[3]), 
                    parseInt(fmtISO[4] || 0), parseInt(fmtISO[5] || 0), parseInt(fmtISO[6] || 0));
  }

  // C. Generalized numeric match for DD[./-]MM[./-]YY[YY] or MM[./-]DD[./-]YY[YY]
  const fmtGen = cleanComment.match(/(\d{1,4})[.\/-](\d{1,2})[.\/-](\d{1,4})/);
  if (fmtGen) {
    let p1 = parseInt(fmtGen[1]);
    let p2 = parseInt(fmtGen[2]);
    let p3 = parseInt(fmtGen[3]);
    
    if (p1 > 1000) return new Date(p1, p2 - 1, p3); // yyyy-mm-dd
    let year = p3 < 100 ? 2000 + p3 : p3;
    if (p1 > 12) return new Date(year, p2 - 1, p1); // dd-mm-yyyy
    if (p2 > 12) return new Date(year, p1 - 1, p2); // mm-dd-yyyy
    return new Date(year, p2 - 1, p1); // default dd-mm-yyyy
  }

  // 2. Creator format ("App 10/04/2026")
  if (comment.startsWith('App ')) {
    const fmtApp = comment.match(/^App\s+(\d{2})\/(\d{2})\/(\d{4})/);
    if (fmtApp) {
      return new Date(parseInt(fmtApp[3]), parseInt(fmtApp[2]) - 1, parseInt(fmtApp[1]));
    }
  }
  
  // 3. Exact date format (if the comment is ONLY a date, likely a manual entry)
  const fmtPlain = comment.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fmtPlain) {
    return new Date(parseInt(fmtPlain[3]), parseInt(fmtPlain[2]) - 1, parseInt(fmtPlain[1]));
  }

  return null;
};

/**
 * Checks if a ticket belongs to a specific date.
 */
export const isSameDay = (ticketDate, targetDate) => {
  if (!ticketDate || isNaN(ticketDate.getTime())) return false;
  return (
    ticketDate.getDate() === targetDate.getDate() &&
    ticketDate.getMonth() === targetDate.getMonth() &&
    ticketDate.getFullYear() === targetDate.getFullYear()
  );
};

/**
 * Calculates total revenue and ticket count.
 * Excludes 'admin' and anything without a valid parsed date.
 */
export const calculateStats = (tickets, targetDate = new Date()) => {
  const stats = tickets.reduce((acc, t) => {
    // 1. Exclude system accounts
    if (t.username === 'admin' || t.username === 'default') return acc;

    // 2. Must have a price
    const price = parseInt(t.price) || 0;
    if (price <= 0) return acc;

    // 3. Must have a valid ticket date that matches targetDate
    const d = parseTicketDate(t);
    if (!isSameDay(d, targetDate)) return acc;

    // 4. Must be activated (online or used)
    if (t.status === 'used' || t.status === 'online') {
      acc.revenue += price;
      acc.count += 1;
    }
    
    return acc;
  }, { revenue: 0, count: 0 });

  // Diagnostic log (will show in browser console)
  if (stats.revenue === 0 && tickets.length > 0) {
    console.warn(`[Diag] Revenue is 0 but processed ${tickets.length} tickets. Check comment formats or profile prices.`);
  }

  return stats;
};

/**
 * Calculates stats specifically for Mikhmon Script-based sales.
 */
export const calculateMikhmonStats = (sales, targetDate = new Date()) => {
  const result = sales.reduce((acc, s) => {
    // Basic date check on s.date (which is parts[0] or s.source)
    const d = parseTicketDate({ comment: s.date });
    
    if (d && isSameDay(d, targetDate)) {
      acc.revenue += s.price;
      acc.count += 1;
    }
    return acc;
  }, { revenue: 0, count: 0 });

  // DIAGNOSTIC LOG: To confirm data is flowing but maybe not matching
  if (sales.length > 0) {
    console.log(`[Sales Engine] Parsed ${sales.length} scripts. Match for ${targetDate.toLocaleDateString()}: ${result.count} scripts, ${result.revenue} income.`);
    if (result.revenue === 0) {
      console.log(`[Sales Engine] Sample script date found: "${sales[0]?.date}"`);
    }
  }

  return result;
};

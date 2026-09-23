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
  if (!ticket) return null;
  if (ticket instanceof Date) return isNaN(ticket.getTime()) ? null : ticket;

  const rawComment = typeof ticket === 'string'
    ? ticket
    : (ticket.comment || ticket.date || ticket.dateRaw || ticket.createdAt || '');
  
  const comment = String(rawComment).trim();
  if (!comment) return null;

  const explicitTime = typeof ticket === 'object' && ticket.time ? String(ticket.time).trim() : null;

  const applyTime = (d, str) => {
    if (!d || isNaN(d.getTime())) return null;
    const timeMatch = explicitTime 
      ? explicitTime.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
      : (str ? str.match(/(?:[\sT]+)(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/) : null);
    if (timeMatch) {
      d.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), parseInt(timeMatch[3] || 0, 10), 0);
    }
    return d;
  };

  const lowerComment = comment.toLowerCase();
  const cleanComment = lowerComment.replace(/^up-/, '');

  // A. Standard ISO: 2026-09-23 15:36:17 or 2026-09-01
  const fmtISO = cleanComment.match(/^(\d{4})-(\d{2})-(\d{2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (fmtISO) {
    const d = new Date(
      parseInt(fmtISO[1], 10),
      parseInt(fmtISO[2], 10) - 1,
      parseInt(fmtISO[3], 10),
      parseInt(fmtISO[4] || 0, 10),
      parseInt(fmtISO[5] || 0, 10),
      parseInt(fmtISO[6] || 0, 10)
    );
    return explicitTime && !fmtISO[4] ? applyTime(d, null) : d;
  }

  // B. Format with Month Names (apr/10/2026 14:20 or 10/apr/2026)
  const fmtMonth = cleanComment.match(/([a-z]{3,5})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (fmtMonth) {
    const month = MONTHS_MAP[fmtMonth[1].substring(0, 3)] ?? -1;
    if (month !== -1) {
      return applyTime(new Date(parseInt(fmtMonth[3], 10), month, parseInt(fmtMonth[2], 10)), comment);
    }
  }

  const fmtMonthInv = cleanComment.match(/(\d{1,2})[\/.-]([a-z]{3,5})[\/.-](\d{4})/);
  if (fmtMonthInv) {
    const month = MONTHS_MAP[fmtMonthInv[2].substring(0, 3)] ?? -1;
    if (month !== -1) {
      return applyTime(new Date(parseInt(fmtMonthInv[3], 10), month, parseInt(fmtMonthInv[1], 10)), comment);
    }
  }

  // C. Mikhmon activation date: up-xxx-MM.DD.YY (e.g. up-421-06.23.26-)
  const fmtMikhmonDate = lowerComment.match(/up-(?:[a-zA-Z0-9]+-)?(\d{2})[.\/-](\d{2})[.\/-](\d{2,4})/);
  if (fmtMikhmonDate) {
    const month = parseInt(fmtMikhmonDate[1], 10) - 1;
    const day = parseInt(fmtMikhmonDate[2], 10);
    let year = parseInt(fmtMikhmonDate[3], 10);
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return applyTime(new Date(year, month, day), comment);
    }
  }

  // D. Generalized numeric match: DD/MM/YYYY or MM/DD/YYYY
  const fmtGen = cleanComment.match(/(\d{1,4})[.\/-](\d{1,2})[.\/-](\d{1,4})/);
  if (fmtGen) {
    let p1 = parseInt(fmtGen[1], 10);
    let p2 = parseInt(fmtGen[2], 10);
    let p3 = parseInt(fmtGen[3], 10);
    let d;
    if (p1 > 1000) d = new Date(p1, p2 - 1, p3);
    else {
      let year = p3 < 100 ? 2000 + p3 : p3;
      if (p1 > 12) d = new Date(year, p2 - 1, p1);
      else if (p2 > 12) d = new Date(year, p1 - 1, p2);
      else d = new Date(year, p2 - 1, p1);
    }
    return applyTime(d, comment);
  }

  // E. Creator format ("App 10/04/2026")
  if (cleanComment.startsWith('app ')) {
    const fmtApp = cleanComment.match(/^app\s+(\d{2})\/(\d{2})\/(\d{4})/);
    if (fmtApp) {
      return applyTime(new Date(parseInt(fmtApp[3], 10), parseInt(fmtApp[2], 10) - 1, parseInt(fmtApp[1], 10)), comment);
    }
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

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function fromMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function dateToParts(iso: string) {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return { year, month, monthKey: monthKey(year, month) };
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Parse loose month strings like "Jan 2026", "January 2026", "2026-01", "01/2026", "Jan" */
export function parseLooseMonth(
  raw: string,
  fallbackYear?: number,
): { year: number; month: number } | { needsYear: true; month: number } | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // YYYY-MM
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return { year: +m[1], month: +m[2] };
  // MM/YYYY or MM-YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return { year: +m[2], month: +m[1] };

  // Month name [year]
  m = s.match(/^([A-Za-z]+)[\s,-]*([0-9]{2,4})?$/);
  if (m) {
    const name = m[1].toLowerCase();
    const idx = MONTH_NAMES.findIndex((n) => n.toLowerCase().startsWith(name.slice(0, 3)));
    if (idx >= 0) {
      const monthNum = idx + 1;
      if (m[2]) {
        let y = +m[2];
        if (y < 100) y += 2000;
        return { year: y, month: monthNum };
      }
      if (fallbackYear) return { year: fallbackYear, month: monthNum };
      return { needsYear: true, month: monthNum };
    }
  }

  // Try Date.parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return null;
}

export function labelForMonthKey(key: string) {
  const { year, month } = fromMonthKey(key);
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

export function listMonthsForYear(year: number) {
  return Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));
}

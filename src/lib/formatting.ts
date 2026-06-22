export function formatINR(n: number, opts: { compact?: boolean } = {}): string {
  if (!isFinite(n)) return "—";
  if (opts.compact && Math.abs(n) >= 100000) {
    if (Math.abs(n) >= 10000000) return "₹" + (n / 10000000).toFixed(2) + " Cr";
    return "₹" + (n / 100000).toFixed(2) + " L";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

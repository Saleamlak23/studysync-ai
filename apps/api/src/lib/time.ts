export function startOfUtcDay(date = new Date()): Date { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
export function nextUtcMidnight(date = new Date()): Date { return new Date(startOfUtcDay(date).getTime() + 86_400_000); }

const STORAGE_KEY = "zwillon_stats";

export function getStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== "object") {
      return { visits: 0, leads: 0 };
    }
    return {
      visits: Number(data.visits) || 0,
      leads: Number(data.leads) || 0,
    };
  } catch {
    return { visits: 0, leads: 0 };
  }
}

export function incrementVisit() {
  const stats = getStats();
  stats.visits += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function incrementLead() {
  const stats = getStats();
  stats.leads += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

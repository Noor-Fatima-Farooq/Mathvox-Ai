/** Group history rows by calendar day for display */

export function formatHistoryDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday - startThat) / 86400000);

  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === 1) return `Yesterday · ${time}`;
  if (diffDays < 7) {
    return `${d.toLocaleDateString(undefined, { weekday: "long" })} · ${time}`;
  }
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })} · ${time}`;
}

export function groupHistoryByDay(items) {
  const groups = [];
  let currentLabel = null;
  let bucket = [];

  for (const item of items) {
    const d = item.created_at ? new Date(item.created_at) : null;
    const label = d
      ? d.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : "Earlier";

    if (label !== currentLabel) {
      if (bucket.length) groups.push({ label: currentLabel, items: bucket });
      currentLabel = label;
      bucket = [item];
    } else {
      bucket.push(item);
    }
  }
  if (bucket.length) groups.push({ label: currentLabel, items: bucket });
  return groups;
}

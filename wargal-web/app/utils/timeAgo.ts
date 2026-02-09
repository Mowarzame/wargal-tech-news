export function timeAgo(dateIso: string) {
  const diff = Date.now() - new Date(dateIso).getTime();
  const sec = Math.floor(diff / 1000);

  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

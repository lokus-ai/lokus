export function formatDate(timestamp) {
  if (!timestamp || timestamp === 0) return '';

  // Handle both seconds (Unix timestamp) and milliseconds
  let date;
  if (typeof timestamp === 'number') {
    // If timestamp is less than year 2000 in milliseconds, it's probably in seconds
    date = timestamp < 946684800000 ? new Date(timestamp * 1000) : new Date(timestamp);
  } else {
    date = new Date(timestamp);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInMs = now - date;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  // Today
  if (diffInDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // Yesterday
  if (diffInDays === 1) {
    return 'Yesterday';
  }

  // This week
  if (diffInDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // This year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Older
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatNumber(num) {
  if (!num) return '0';
  return num.toLocaleString();
}

export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
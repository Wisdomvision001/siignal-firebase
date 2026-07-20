// utils.js
//
// Pure, dependency-free helper functions shared across pages. Kept separate
// from app-specific/Firebase logic specifically so they can be unit tested
// with plain Node (see test_utils.mjs) without needing a browser or a
// Firebase project.

export const DISPATCH_CENTER = { lat: 9.2035, lon: 12.4954 };

export const URGENCY_DISPATCH_MINUTES = { low: 12, moderate: 7, critical: 3 };

export const STATUS_COPY = {
  new: {
    label: "Report received",
    detail: "Dispatch has your report and is assigning a responder now."
  },
  dispatched: {
    label: "Responder assigned",
    detail: "Help is on the way. You can track their approach below."
  },
  enroute: {
    label: "Help is on the way",
    detail: "Your responder is en route. Track their position on the map below."
  },
  resolved: {
    label: "Marked resolved",
    detail: "Dispatch has marked this report as resolved. If you still need help, please submit a new report or contact dispatch directly."
  }
};

/**
 * Great-circle distance between two lat/lon points, in kilometers.
 * Standard haversine formula — used to pick the nearest available
 * responder to a new report instead of just grabbing the first one free.
 */
export function haversineDistanceKm(a, b) {
  if (!a || !b || typeof a.lat !== "number" || typeof b.lat !== "number") {
    return Infinity;
  }
  const R = 6371; // Earth radius, km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Given a report's coordinates and a list of candidate responders
 * (each { id, lat, lon, ...rest }), returns the closest one. Responders
 * with no known location fall back to the fixed dispatch center so they
 * can still be selected (just treated as "starting from base").
 */
export function findNearestResponder(reportCoords, responders) {
  if (!responders || responders.length === 0) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const responder of responders) {
    const point = (typeof responder.lat === "number" && typeof responder.lon === "number")
      ? { lat: responder.lat, lon: responder.lon }
      : DISPATCH_CENTER;
    const distance = haversineDistanceKm(reportCoords, point);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = responder;
    }
  }
  return best ? { responder: best, distanceKm: bestDistance } : null;
}

export function dispatchMinutesFor(urgency) {
  return URGENCY_DISPATCH_MINUTES[urgency] || 7;
}

export function getTimestampMillis(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (value.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatLocalDateTime(value) {
  const millis = getTimestampMillis(value);
  if (millis == null) return '';
  return new Date(millis).toLocaleString(undefined, { hour12: false });
}

export function formatLocalTime(value) {
  const millis = getTimestampMillis(value);
  if (millis == null) return '';
  return new Date(millis).toLocaleTimeString(undefined, { hour12: false });
}

export function formatRelativeTime(value) {
  const timestampMs = getTimestampMillis(value);
  if (timestampMs == null) return '';

  const now = Date.now();
  const diffSeconds = Math.floor((now - timestampMs) / 1000);
  if (diffSeconds < 0) return formatLocalDateTime(timestampMs);
  if (diffSeconds < 45) return 'Just now';
  if (diffSeconds < 90) return '1 min ago';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const date = new Date(timestampMs);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return formatLocalDateTime(timestampMs);
}

export function getRelativeTime(timestampMs) {
  return formatRelativeTime(timestampMs);
}

export function formatDispatchTime(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Very small allow-list validator for report payloads before we ever write
 * to Firestore. Security rules enforce this too (never trust the client
 * alone), but failing fast client-side gives better error messages.
 */
export function validateReportInput({ type, location, urgency }) {
  const errors = [];
  if (!type || typeof type !== "string") errors.push("Incident type is required.");
  if (!location || typeof location !== "string" || location.trim().length === 0) {
    errors.push("Location is required.");
  }
  if (!["low", "moderate", "critical"].includes(urgency)) {
    errors.push("Urgency must be low, moderate, or critical.");
  }
  return errors;
}

// test_utils.mjs
//
// Run with: node --test test_utils.mjs
// Uses Node's built-in test runner (no dependencies needed).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  haversineDistanceKm,
  findNearestResponder,
  dispatchMinutesFor,
  formatDispatchTime,
  escapeHtml,
  validateReportInput,
  DISPATCH_CENTER
} from "./utils.js";

test("haversineDistanceKm: distance to self is zero", () => {
  const p = { lat: 9.2035, lon: 12.4954 };
  assert.equal(haversineDistanceKm(p, p), 0);
});

test("haversineDistanceKm: known distance between two Jimeta-area points is small and positive", () => {
  const a = { lat: 9.2035, lon: 12.4954 };
  const b = { lat: 9.25, lon: 12.52 };
  const distance = haversineDistanceKm(a, b);
  assert.ok(distance > 0 && distance < 20, `expected a short local distance, got ${distance}`);
});

test("haversineDistanceKm: returns Infinity for missing coordinates", () => {
  assert.equal(haversineDistanceKm(null, { lat: 1, lon: 1 }), Infinity);
  assert.equal(haversineDistanceKm({ lat: 1, lon: 1 }, undefined), Infinity);
});

test("findNearestResponder: picks the closer of two responders", () => {
  const reportCoords = { lat: 9.20, lon: 12.50 };
  const near = { id: "r1", lat: 9.201, lon: 12.501 };
  const far = { id: "r2", lat: 9.9, lon: 13.9 };
  const result = findNearestResponder(reportCoords, [far, near]);
  assert.equal(result.responder.id, "r1");
});

test("findNearestResponder: falls back to dispatch center for responders with no location", () => {
  const reportCoords = DISPATCH_CENTER;
  const noLocation = { id: "r1" };
  const result = findNearestResponder(reportCoords, [noLocation]);
  assert.equal(result.responder.id, "r1");
  assert.ok(result.distanceKm < 0.001);
});

test("findNearestResponder: returns null for an empty list", () => {
  assert.equal(findNearestResponder(DISPATCH_CENTER, []), null);
  assert.equal(findNearestResponder(DISPATCH_CENTER, null), null);
});

test("dispatchMinutesFor: known urgencies map correctly", () => {
  assert.equal(dispatchMinutesFor("critical"), 3);
  assert.equal(dispatchMinutesFor("moderate"), 7);
  assert.equal(dispatchMinutesFor("low"), 12);
});

test("dispatchMinutesFor: unknown urgency defaults to 7", () => {
  assert.equal(dispatchMinutesFor("banana"), 7);
  assert.equal(dispatchMinutesFor(undefined), 7);
});

test("formatDispatchTime: formats minutes as mm:ss-style padded string", () => {
  assert.equal(formatDispatchTime(3), "00:03");
  assert.equal(formatDispatchTime(65), "01:05");
  assert.equal(formatDispatchTime(0), "00:00");
});

test("escapeHtml: escapes all dangerous characters", () => {
  assert.equal(
    escapeHtml(`<script>alert('x&y')</script>`),
    "&lt;script&gt;alert(&#39;x&amp;y&#39;)&lt;/script&gt;"
  );
});

test("validateReportInput: valid input has no errors", () => {
  const errors = validateReportInput({ type: "Fire", location: "Sabon Gari", urgency: "moderate" });
  assert.deepEqual(errors, []);
});

test("validateReportInput: flags missing type, location, and bad urgency", () => {
  const errors = validateReportInput({ type: "", location: "   ", urgency: "urgent-ish" });
  assert.equal(errors.length, 3);
});

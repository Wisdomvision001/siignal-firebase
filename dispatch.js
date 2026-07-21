// dispatch.js
//
// Firestore-dependent dispatch logic — kept separate from utils.js so the
// pure math (haversine, findNearestResponder) stays unit-testable without
// a live Firebase project, while this file handles the actual reads/writes.

import { db } from './firebase-init.js';
import {
  collection, query, where, getDocs, doc, runTransaction, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { findNearestResponder, dispatchMinutesFor } from './utils.js';

/**
 * Finds the nearest available responder to a report's coordinates and
 * atomically assigns them, using a Firestore transaction so two reports
 * created at nearly the same moment can't both grab the same responder.
 *
 * Falls back gracefully: if no responder is available, or the incident
 * has no coordinates, the report simply stays in "new" status for a
 * dispatcher to handle manually from the dashboard.
 *
 * Returns { responderId, responderName } on success, or null if no
 * responder could be assigned right now.
 */
export async function assignNearestResponder(reportId, reportCoords, dispatchMinutes) {
  const respondersRef = collection(db, 'responders');
  const availableQuery = query(respondersRef, where('status', '==', 'available'));
  const snapshot = await getDocs(availableQuery);

  if (snapshot.empty) {
    return null;
  }

  const candidates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Try nearest first, then next-nearest, etc., in case of a transaction
  // conflict with another report being assigned at the same instant.
  candidates.sort((a, b) => {
    const nearestA = findNearestResponder(reportCoords, [a]);
    const nearestB = findNearestResponder(reportCoords, [b]);
    return (nearestA ? nearestA.distanceKm : Infinity) - (nearestB ? nearestB.distanceKm : Infinity);
  });

  for (const candidate of candidates) {
    const responderRef = doc(db, 'responders', candidate.id);
    const reportRef = doc(db, 'reports', reportId);

    try {
      const result = await runTransaction(db, async (tx) => {
        const freshResponder = await tx.get(responderRef);
        if (!freshResponder.exists() || freshResponder.data().status !== 'available') {
          throw new Error('responder-no-longer-available');
        }

        tx.update(responderRef, {
          status: 'enroute',
          currentReportId: reportId
        });
        tx.update(reportRef, {
          status: 'enroute',
          responderId: candidate.id,
          responderName: freshResponder.data().name,
          responderAssignedAt: serverTimestamp(),
          dispatchTimeMinutes
        });

        return { responderId: candidate.id, responderName: freshResponder.data().name };
      });

      await addDoc(collection(db, 'audit_log'), {
        reportId,
        action: 'responder_assigned',
        actor: 'system:auto-dispatch',
        details: `Assigned ${result.responderName}`,
        timestamp: serverTimestamp()
      });

      return result;
    } catch (error) {
      // This candidate got taken by a concurrent assignment — try the next.
      continue;
    }
  }

  return null; // every candidate was taken between the query and the transaction
}

export async function logAuditEvent(reportId, action, actor, details, extra = {}) {
  await addDoc(collection(db, 'audit_log'), {
    reportId,
    action,
    actor,
    details: details || '',
    timestamp: serverTimestamp(),
    ...extra
  });
}

export { dispatchMinutesFor };

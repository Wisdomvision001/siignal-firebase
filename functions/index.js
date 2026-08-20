const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

initializeApp();

const auth = getAuth();
const db = getFirestore();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpsError('invalid-argument', `${fieldName} is required.`);
  }
  return value.trim();
}

function validateRequestData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'Responder account data is required.');
  }

  const name = requireString(data.name, 'Name');
  const callsign = requireString(data.callsign, 'Callsign');
  const unitType = requireString(data.unitType, 'Unit type');
  const responseCategory = requireString(data.responseCategory, 'Response category');
  const branchId = requireString(data.branchId, 'Branch');
  const email = requireString(data.email, 'Email').toLowerCase();
  const password = requireString(data.password, 'Password');

  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }

  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
  }

  return { name, callsign, unitType, responseCategory, branchId, email, password };
}

async function requireDispatcher(uid) {
  let staffSnapshot;
  try {
    staffSnapshot = await db.doc(`staff/${uid}`).get();
  } catch (error) {
    throw new HttpsError('internal', 'Unable to verify dispatcher authorization.');
  }

  if (!staffSnapshot.exists || staffSnapshot.data().role !== 'dispatcher') {
    throw new HttpsError('permission-denied', 'Only dispatchers can create responder accounts.');
  }
}

exports.createResponderAccount = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  await requireDispatcher(request.auth.uid);
  const responderData = validateRequestData(request.data);

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: responderData.email,
      password: responderData.password,
      displayName: responderData.name
    });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists.');
    }
    if (error.code === 'auth/invalid-password' || error.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'The responder email or password is invalid.');
    }
    throw new HttpsError('internal', 'Unable to create the responder account.');
  }

  const responderRef = db.collection('responders').doc();
  const staffRef = db.doc(`staff/${userRecord.uid}`);

  try {
    await db.runTransaction(async (transaction) => {
      transaction.set(responderRef, {
        name: responderData.name,
        callsign: responderData.callsign,
        unitType: responderData.unitType,
        responseCategory: responderData.responseCategory,
        branchId: responderData.branchId,
        email: responderData.email,
        status: 'available',
        currentReportId: null,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(staffRef, {
        role: 'responder',
        name: responderData.name,
        responderId: responderRef.id
      });
    });
  } catch (error) {
    try {
      await auth.deleteUser(userRecord.uid);
    } catch (cleanupError) {
      console.error('Failed to clean up responder Auth user after Firestore failure:', cleanupError.code || 'unknown-error');
    }
    throw new HttpsError('internal', 'Unable to finish creating the responder account.');
  }

  return {
    success: true,
    responderId: responderRef.id,
    uid: userRecord.uid
  };
});

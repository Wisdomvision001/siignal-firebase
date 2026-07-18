import { db } from '../firebase-init.js';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const stats = {
  totalReports: document.getElementById('total-reports'),
  newReports: document.getElementById('new-reports'),
  enrouteReports: document.getElementById('enroute-reports'),
  resolvedReports: document.getElementById('resolved-reports')
};
const reportBody = document.getElementById('report-table-body');
const responderList = document.getElementById('responder-list');
const activityList = document.getElementById('activity-list');

let reports = [];
let responders = [];
let activity = [];

const views = document.querySelectorAll('.nav-item');
views.forEach((button) => {
  button.addEventListener('click', () => {
    views.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  });
});

function formatStatus(status) {
  const map = {
    new: 'New',
    enroute: 'En Route',
    resolved: 'Resolved'
  };
  return map[status] || 'Unknown';
}

function renderStats() {
  stats.totalReports.textContent = reports.length;
  stats.newReports.textContent = reports.filter((r) => r.status === 'new').length;
  stats.enrouteReports.textContent = reports.filter((r) => r.status === 'enroute').length;
  stats.resolvedReports.textContent = reports.filter((r) => r.status === 'resolved').length;
}

function renderReports() {
  if (!reports.length) {
    reportBody.innerHTML = '<tr><td colspan="6" class="table-empty">No reports found.</td></tr>';
    return;
  }

  reportBody.innerHTML = reports.map((report) => `
    <tr>
      <td>${report.id.slice(-6).toUpperCase()}</td>
      <td>${report.type || 'Unknown'}</td>
      <td>${report.location || 'Unknown'}</td>
      <td>${report.urgency || 'Low'}</td>
      <td>${formatStatus(report.status)}</td>
      <td>
        <button class="secondary-button" data-action="view" data-id="${report.id}">View</button>
        <button class="secondary-button" data-action="dispatch" data-id="${report.id}">Dispatch</button>
        <button class="secondary-button" data-action="resolve" data-id="${report.id}">Resolve</button>
      </td>
    </tr>
  `).join('');
}

function renderResponders() {
  if (!responders.length) {
    responderList.innerHTML = '<div class="panel-empty">No responders available.</div>';
    return;
  }

  responderList.innerHTML = responders.map((responder) => `
    <div class="panel-row">
      <strong>${responder.name || 'Responder'}</strong>
      <span>${responder.status || 'unknown'}</span>
    </div>
  `).join('');
}

function renderActivity() {
  if (!activity.length) {
    activityList.innerHTML = '<div class="panel-empty">No recent activity.</div>';
    return;
  }

  activityList.innerHTML = activity.map((event) => `
    <div class="panel-row">
      <span>${new Date(event.timestamp?.toMillis ? event.timestamp.toMillis() : event.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
      <span>${event.action}</span>
    </div>
  `).join('');
}

function subscribeReports() {
  onSnapshot(collection(db, 'reports'), (snapshot) => {
    reports = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderStats();
    renderReports();
  });
}

function subscribeResponders() {
  onSnapshot(collection(db, 'responders'), (snapshot) => {
    responders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    renderResponders();
  });
}

function subscribeActivity() {
  onSnapshot(query(collection(db, 'audit_log'), orderBy('timestamp', 'desc'), limit(10)), (snapshot) => {
    activity = snapshot.docs.map((doc) => ({ ...doc.data() }));
    renderActivity();
  });
}

function init() {
  renderStats();
  renderReports();
  renderResponders();
  renderActivity();
  subscribeReports();
  subscribeResponders();
  subscribeActivity();
}

init();

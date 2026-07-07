import { FLHA_CATEGORIES, CRANE_SETUP_CHANGES } from './flhaItems.js';
import { generateFlhaPdf } from './pdfGenerator.js';
import { supabase } from './supabaseClient.js';
import { getQueue, addToQueue, removeFromQueue } from './offlineQueue.js';

const state = { items: {} };

// ---------- Render observation categories ----------
const sectionsEl = document.getElementById('observation-sections');
FLHA_CATEGORIES.forEach(cat => {
  const block = document.createElement('div');
  block.className = 'category-block card';
  const title = document.createElement('div');
  title.className = 'category-title';
  title.textContent = cat.name;
  block.appendChild(title);

  cat.items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'item-row';

    if (item.freeTextOnly) {
      row.innerHTML = `
        <span class="item-num">${item.id}</span>
        <span class="item-text">${item.text}${item.unit ? ' (' + item.unit + ')' : ''}</span>
        <input type="number" step="any" style="width:5rem" data-item="${item.id}" data-role="value" />
      `;
      block.appendChild(row);
      return;
    }

    row.innerHTML = `
      <span class="item-num">${item.id}</span>
      <span class="item-text">${item.text}</span>
      <div class="item-toggle">
        <button type="button" class="toggle-btn safe" data-item="${item.id}" data-status="safe">SAFE</button>
        <button type="button" class="toggle-btn risk" data-item="${item.id}" data-status="risk">RISK</button>
        <input type="text" class="risk-rating-input" placeholder="#" data-item="${item.id}" data-role="rating" />
      </div>
    `;
    block.appendChild(row);

    if (item.hasName) {
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Signalman name';
      nameInput.className = 'name-inline-input';
      nameInput.dataset.item = item.id;
      nameInput.dataset.role = 'signalmanName';
      block.appendChild(nameInput);
    }
  });

  sectionsEl.appendChild(block);
});

sectionsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  const itemId = btn.dataset.item;
  const status = btn.dataset.status;
  state.items[itemId] = state.items[itemId] || {};
  state.items[itemId].status = state.items[itemId].status === status ? null : status;

  const row = btn.closest('.item-row');
  row.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  if (state.items[itemId].status) {
    row.querySelector(`[data-status="${state.items[itemId].status}"]`).classList.add('active');
  }
  const ratingInput = row.querySelector('.risk-rating-input');
  if (ratingInput) ratingInput.classList.toggle('show', state.items[itemId].status === 'risk');
});

sectionsEl.addEventListener('input', (e) => {
  const el = e.target;
  const itemId = el.dataset.item;
  const role = el.dataset.role;
  if (!itemId || !role) return;
  state.items[itemId] = state.items[itemId] || {};
  if (role === 'rating') state.items[itemId].riskRating = el.value;
  if (role === 'signalmanName') state.items[itemId].signalmanName = el.value;
  if (role === 'value') state.items[itemId].value = el.value;
});

// ---------- Crane set-up changes ----------
const setupEl = document.getElementById('setup-changes');
CRANE_SETUP_CHANGES.forEach((label, i) => {
  const row = document.createElement('div');
  row.className = 'grid-2';
  row.style.marginBottom = '0.75rem';
  row.innerHTML = `
    <label>${label} - Changes
      <select data-setup="${i}" data-role="changes">
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
    </label>
    <label>Operator Initials
      <input type="text" data-setup="${i}" data-role="initials" maxlength="6" />
    </label>
  `;
  setupEl.appendChild(row);
});

// ---------- Hazard control measures ----------
const hazardEl = document.getElementById('hazard-controls');
function addHazardRow() {
  const row = document.createElement('div');
  row.className = 'hazard-row';
  row.innerHTML = `
    <input type="text" placeholder="#" style="text-align:center" data-role="itemNum" />
    <input type="text" placeholder="Hazard control measure" data-role="measure" />
    <button type="button" class="remove-row-btn">&times;</button>
  `;
  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  hazardEl.appendChild(row);
}
document.getElementById('add-hazard-row').addEventListener('click', addHazardRow);
addHazardRow();

// ---------- Attendees ----------
const attendeesEl = document.getElementById('attendees');
function addAttendeeRow() {
  const row = document.createElement('div');
  row.className = 'attendee-row';
  row.innerHTML = `
    <input type="text" placeholder="Print name" data-role="printName" />
    <label style="flex-direction:row;align-items:center;gap:0.4rem;font-size:0.8rem">
      <input type="checkbox" data-role="signature" style="width:auto" /> Signed in person
    </label>
    <button type="button" class="remove-row-btn">&times;</button>
  `;
  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  attendeesEl.appendChild(row);
}
document.getElementById('add-attendee-row').addEventListener('click', addAttendeeRow);
addAttendeeRow();
addAttendeeRow();

// ---------- Banner helper ----------
function showBanner(msg, type = 'info') {
  const b = document.getElementById('banner');
  b.textContent = msg;
  b.className = `banner ${type}`;
  b.classList.remove('hidden');
  setTimeout(() => b.classList.add('hidden'), 6000);
}

// ---------- Connection badge ----------
function updateConnectionBadge() {
  const badge = document.getElementById('connection-badge');
  const online = navigator.onLine;
  badge.textContent = online ? 'Online' : 'Offline';
  badge.className = `badge ${online ? 'badge-online' : 'badge-offline'}`;
}
window.addEventListener('online', () => { updateConnectionBadge(); syncQueue(); });
window.addEventListener('offline', updateConnectionBadge);
updateConnectionBadge();

// ---------- Gather form data ----------
function gatherData() {
  const setupChanges = CRANE_SETUP_CHANGES.map((label, i) => ({
    label,
    changes: document.querySelector(`[data-setup="${i}"][data-role="changes"]`)?.value === 'yes',
    initials: document.querySelector(`[data-setup="${i}"][data-role="initials"]`)?.value || ''
  }));

  const hazardControls = Array.from(hazardEl.querySelectorAll('.hazard-row')).map(row => ({
    itemNum: row.querySelector('[data-role="itemNum"]').value,
    measure: row.querySelector('[data-role="measure"]').value
  })).filter(h => h.measure);

  const attendees = Array.from(attendeesEl.querySelectorAll('.attendee-row')).map(row => ({
    printName: row.querySelector('[data-role="printName"]').value,
    signature: row.querySelector('[data-role="signature"]').checked
  })).filter(a => a.printName);

  return {
    date: document.getElementById('f-date').value,
    time: document.getElementById('f-time').value,
    customer: document.getElementById('f-customer').value,
    site: document.getElementById('f-site').value,
    operator: document.getElementById('f-operator').value,
    operatorInitials: document.getElementById('f-operator-initials').value,
    signal: document.getElementById('f-signal').value,
    order: document.getElementById('f-order').value,
    unit1: document.getElementById('f-unit1').value,
    unit2: document.getElementById('f-unit2').value,
    loadWeight: document.getElementById('f-load-weight').value,
    loadUnit: document.getElementById('f-load-unit').value,
    jobDesc: document.getElementById('f-job-desc').value,
    supervisorEmail: document.getElementById('f-supervisor-email').value,
    taskNotes: document.getElementById('f-task-notes').value,
    setupChanges,
    hazardControls,
    attendees,
    items: state.items
  };
}

function validate(data) {
  const required = { date: 'Date', operator: 'Operator name', site: 'Site Location', supervisorEmail: 'Supervisor Email' };
  for (const [key, label] of Object.entries(required)) {
    if (!data[key]) return `${label} is required.`;
  }
  return null;
}

// ---------- Submit ----------
async function submitAssessment(data) {
  const { pdfBase64, pdfBlob } = generateFlhaPdf(data);
  const filename = `FLHA_${data.site.replace(/\s+/g, '_')}_${data.date}_${Date.now()}.pdf`;

  // Upload PDF + row to Supabase
  const { error: uploadErr } = await supabase.storage.from('flha-reports').upload(filename, pdfBlob, {
    contentType: 'application/pdf'
  });
  if (uploadErr) throw uploadErr;

  const { data: row, error: insertErr } = await supabase.from('flha_submissions').insert({
    site_location: data.site,
    customer: data.customer,
    operator: data.operator,
    submission_date: data.date,
    supervisor_email: data.supervisorEmail,
    pdf_path: filename,
    form_data: data
  }).select().single();
  if (insertErr) throw insertErr;

  // Trigger email via Edge Function
  const { error: fnErr } = await supabase.functions.invoke('send-flha', {
    body: { submissionId: row.id, pdfBase64, filename, supervisorEmail: data.supervisorEmail, site: data.site, date: data.date }
  });
  if (fnErr) throw fnErr;

  return row;
}

document.getElementById('submit-btn').addEventListener('click', async () => {
  const data = gatherData();
  const err = validate(data);
  if (err) { showBanner(err, 'error'); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    if (!navigator.onLine) throw new Error('offline');
    await submitAssessment(data);
    showBanner('Assessment submitted and sent to office + supervisor.', 'success');
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.type === 'checkbox') el.checked = false; else el.value = '';
    });
    state.items = {};
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    loadHistory();
  } catch (e) {
    if (e.message === 'offline' || !navigator.onLine) {
      addToQueue(data);
      showBanner('No signal — saved on this device. Will send automatically once you\'re back online.', 'info');
    } else {
      console.error(e);
      showBanner('Something went wrong submitting. Saved locally to retry.', 'error');
      addToQueue(data);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Assessment';
  }
});

async function syncQueue() {
  const queue = getQueue();
  for (const item of queue) {
    try {
      await submitAssessment(item);
      removeFromQueue(item.localId);
      showBanner(`Synced a pending report for ${item.site}.`, 'success');
    } catch (e) {
      console.error('Sync failed, will retry later', e);
    }
  }
  loadHistory();
}
if (navigator.onLine) syncQueue();

// ---------- History ----------
async function loadHistory() {
  const historyEl = document.getElementById('history-list');
  const pending = getQueue();
  let html = '';
  pending.forEach(p => {
    html += `<div class="history-item"><span>${p.site || 'Untitled'} — ${p.date || ''}</span><span class="sync-pending">Pending sync</span></div>`;
  });

  try {
    const { data, error } = await supabase
      .from('flha_submissions')
      .select('id, site_location, submission_date, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    data.forEach(row => {
      html += `<div class="history-item"><span>${row.site_location} — ${row.submission_date}</span><span class="muted">Sent</span></div>`;
    });
  } catch (e) {
    console.warn('Could not load history', e);
  }

  historyEl.innerHTML = html || '<p class="muted">No submissions yet.</p>';
}
loadHistory();

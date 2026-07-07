import { FLHA_CATEGORIES, CRANE_SETUP_CHANGES } from './flhaItems.js';
import { generateFlhaPdf } from './pdfGenerator.js';
import { supabase } from './supabaseClient.js';
import { getQueue, addToQueue, removeFromQueue } from './offlineQueue.js';
import SignaturePad from 'signature_pad';

const state = { items: {} };

// A random ID stuck in localStorage the first time this device opens the app —
// used only to scope "My Past Submissions" to what was filed from this device.
// This is a convenience filter, not a security boundary — the app has no login,
// so there's no real per-user identity for Supabase to enforce.
const DEVICE_ID_KEY = 'hcr_flha_device_id';
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

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

function setItemStatus(itemId, status) {
  state.items[itemId] = state.items[itemId] || {};
  state.items[itemId].status = status;

  const row = sectionsEl.querySelector(`[data-item="${itemId}"][data-status]`)?.closest('.item-row');
  if (!row) return;
  row.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  if (status) row.querySelector(`[data-status="${status}"]`).classList.add('active');
  const ratingInput = row.querySelector('.risk-rating-input');
  if (ratingInput) ratingInput.classList.toggle('show', status === 'risk');

  if (status === 'risk') ensureHazardRowForItem(itemId); else removeHazardRowForItem(itemId);
}

sectionsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  const itemId = btn.dataset.item;
  const status = btn.dataset.status;
  const current = state.items[itemId]?.status;
  setItemStatus(itemId, current === status ? null : status);
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

// Flat lookup of item text by id, used to label auto-added hazard rows
const ITEM_TEXT_BY_ID = {};
FLHA_CATEGORIES.forEach(cat => cat.items.forEach(item => { ITEM_TEXT_BY_ID[item.id] = item.text; }));

function addHazardRow(prefill) {
  const row = document.createElement('div');
  row.className = 'hazard-row';
  row.innerHTML = `
    <input type="text" placeholder="#" style="text-align:center" data-role="itemNum" value="${prefill?.itemNum || ''}" />
    <input type="text" placeholder="Hazard control measure" data-role="measure" value="${prefill?.measure ? prefill.measure.replace(/"/g, '&quot;') : ''}" />
    <button type="button" class="remove-row-btn">&times;</button>
  `;
  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  hazardEl.appendChild(row);
}
document.getElementById('add-hazard-row').addEventListener('click', addHazardRow);
addHazardRow();

// Auto-added rows (one per item marked RISK) live here so we can find/remove them
// again without disturbing rows you added manually.
function hazardRowSelector(itemId) {
  return `.hazard-row[data-auto-item="${itemId}"]`;
}

function ensureHazardRowForItem(itemId) {
  if (hazardEl.querySelector(hazardRowSelector(itemId))) return; // already there

  const row = document.createElement('div');
  row.className = 'hazard-row';
  row.dataset.autoItem = itemId;
  row.innerHTML = `
    <input type="text" value="${itemId}" style="text-align:center;font-weight:700" data-role="itemNum" readonly />
    <input type="text" placeholder="Control measure for: ${ITEM_TEXT_BY_ID[itemId] || ''}" data-role="measure" />
    <button type="button" class="remove-row-btn" title="Remove (will re-appear if item is still marked RISK)">&times;</button>
  `;
  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());

  // Keep auto rows sorted in numeric order, above any manually-added rows.
  const autoRows = Array.from(hazardEl.querySelectorAll('[data-auto-item]'));
  const nextAutoRow = autoRows.find(r => Number(r.dataset.autoItem) > Number(itemId));
  if (nextAutoRow) {
    hazardEl.insertBefore(row, nextAutoRow);
  } else {
    // No later auto row — insert before the first manual row, or at the end if there isn't one.
    const firstManualRow = Array.from(hazardEl.children).find(r => !r.dataset.autoItem);
    hazardEl.insertBefore(row, firstManualRow || null);
  }
}

function removeHazardRowForItem(itemId) {
  const row = hazardEl.querySelector(hazardRowSelector(itemId));
  if (row) row.remove();
}

// ---------- Attendees ----------
const attendeesEl = document.getElementById('attendees');

function resizeCanvasForDpr(canvas) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.getContext('2d').scale(ratio, ratio);
}

function addAttendeeRow(prefill) {
  const card = document.createElement('div');
  card.className = 'attendee-card';
  card.innerHTML = `
    <input type="text" placeholder="Print name" data-role="printName" value="${prefill?.printName ? prefill.printName.replace(/"/g, '&quot;') : ''}" />
    <div class="sig-label">Signature</div>
    <canvas class="sig-pad-canvas"></canvas>
    <div class="attendee-actions">
      <button type="button" class="btn-secondary sig-clear-btn">Clear Signature</button>
      <button type="button" class="remove-row-btn">&times; Remove Attendee</button>
    </div>
  `;
  const canvas = card.querySelector('.sig-pad-canvas');
  card.querySelector('.remove-row-btn').addEventListener('click', () => card.remove());
  attendeesEl.appendChild(card);

  // Canvas has to be sized after it's in the DOM (so getBoundingClientRect works),
  // and again on window resize so signatures stay crisp.
  requestAnimationFrame(() => {
    resizeCanvasForDpr(canvas);
    const pad = new SignaturePad(canvas);
    canvas._signaturePad = pad;
    if (prefill?.signatureDataUrl) {
      pad.fromDataURL(prefill.signatureDataUrl);
    }
  });

  card.querySelector('.sig-clear-btn').addEventListener('click', () => {
    canvas._signaturePad?.clear();
  });
}
document.getElementById('add-attendee-row').addEventListener('click', () => addAttendeeRow());
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

  const attendees = Array.from(attendeesEl.querySelectorAll('.attendee-card')).map(card => {
    const canvas = card.querySelector('.sig-pad-canvas');
    const pad = canvas._signaturePad;
    return {
      printName: card.querySelector('[data-role="printName"]').value,
      signatureDataUrl: pad && !pad.isEmpty() ? pad.toDataURL('image/png') : null
    };
  }).filter(a => a.printName);

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
  const required = { date: 'Date', operator: 'Operator name', site: 'Site Location' };
  for (const [key, label] of Object.entries(required)) {
    if (!data[key]) return `${label} is required.`;
  }
  return null;
}

// ---------- Load Previous Day / Clear All ----------
const LAST_DATA_KEY = 'hcr_flha_last_data';

function saveLastEnteredData(data) {
  try { localStorage.setItem(LAST_DATA_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadLastEnteredData() {
  try { return JSON.parse(localStorage.getItem(LAST_DATA_KEY) || 'null'); } catch { return null; }
}

const TEXT_FIELD_IDS = {
  customer: 'f-customer', site: 'f-site', operator: 'f-operator', operatorInitials: 'f-operator-initials',
  signal: 'f-signal', order: 'f-order', unit1: 'f-unit1', unit2: 'f-unit2', loadWeight: 'f-load-weight',
  loadUnit: 'f-load-unit', jobDesc: 'f-job-desc', supervisorEmail: 'f-supervisor-email', taskNotes: 'f-task-notes'
};

function resetItemsHazardsAttendees() {
  state.items = {};
  sectionsEl.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  sectionsEl.querySelectorAll('.risk-rating-input').forEach(i => { i.value = ''; i.classList.remove('show'); });
  sectionsEl.querySelectorAll('[data-role="signalmanName"]').forEach(i => { i.value = ''; });
  sectionsEl.querySelectorAll('[data-role="value"]').forEach(i => { i.value = ''; });
  hazardEl.innerHTML = '';
  addHazardRow();
  attendeesEl.innerHTML = '';
  addAttendeeRow();
  addAttendeeRow();
}

function resetSetupChanges() {
  CRANE_SETUP_CHANGES.forEach((_, i) => {
    const sel = document.querySelector(`[data-setup="${i}"][data-role="changes"]`);
    const init = document.querySelector(`[data-setup="${i}"][data-role="initials"]`);
    if (sel) sel.value = 'no';
    if (init) init.value = '';
  });
}

function clearAllFields() {
  Object.values(TEXT_FIELD_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'f-load-unit' ? 'lb' : '';
  });
  document.getElementById('f-date').value = '';
  document.getElementById('f-time').value = '';
  resetSetupChanges();
  resetItemsHazardsAttendees();
  showBanner('Form cleared.', 'info');
}

function loadPreviousDay() {
  const last = loadLastEnteredData();
  if (!last) { showBanner('No previous submission found on this device yet.', 'error'); return; }

  // Everything except date/time carries over — those always start blank for the new day.
  Object.entries(TEXT_FIELD_IDS).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el && last[key] !== undefined) el.value = last[key];
  });

  resetItemsHazardsAttendees();

  // Re-apply each observation item's saved status, rating, and signalman name.
  Object.entries(last.items || {}).forEach(([itemId, itemState]) => {
    if (itemState.status) setItemStatus(itemId, itemState.status);
    if (itemState.riskRating) {
      const ratingInput = sectionsEl.querySelector(`.risk-rating-input[data-item="${itemId}"]`);
      if (ratingInput) { ratingInput.value = itemState.riskRating; state.items[itemId].riskRating = itemState.riskRating; }
    }
    if (itemState.signalmanName) {
      const nameInput = sectionsEl.querySelector(`[data-role="signalmanName"][data-item="${itemId}"]`);
      if (nameInput) { nameInput.value = itemState.signalmanName; state.items[itemId].signalmanName = itemState.signalmanName; }
    }
    if (itemState.value) {
      const valInput = sectionsEl.querySelector(`[data-role="value"][data-item="${itemId}"]`);
      if (valInput) { valInput.value = itemState.value; state.items[itemId].value = itemState.value; }
    }
  });

  // Fill in the measure text for auto-created hazard rows, and re-add any manual
  // (non-numbered) hazard rows exactly as they were.
  hazardEl.innerHTML = '';
  (last.hazardControls || []).forEach(h => {
    if (h.itemNum && last.items?.[h.itemNum]?.status === 'risk') {
      ensureHazardRowForItem(h.itemNum);
      const row = hazardEl.querySelector(`[data-auto-item="${h.itemNum}"] [data-role="measure"]`);
      if (row) row.value = h.measure;
    } else {
      addHazardRow(h);
    }
  });
  if (!hazardEl.children.length) addHazardRow();

  attendeesEl.innerHTML = '';
  (last.attendees || []).forEach(a => addAttendeeRow({ printName: a.printName })); // signatures are re-signed fresh each day
  if (!attendeesEl.children.length) { addAttendeeRow(); addAttendeeRow(); }

  showBanner('Loaded previous day\'s data — update the date/time and anything that\'s changed.', 'success');
}

document.getElementById('load-previous-btn').addEventListener('click', loadPreviousDay);
document.getElementById('clear-all-btn').addEventListener('click', clearAllFields);
async function submitAssessment(data) {
  const { pdfBase64, pdfBlob } = await generateFlhaPdf(data);
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
    form_data: data,
    device_id: DEVICE_ID
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

  saveLastEnteredData(data);

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    if (!navigator.onLine) throw new Error('offline');
    await submitAssessment(data);
    showBanner('Assessment submitted and sent to office' + (data.supervisorEmail ? ' + consultant.' : '.'), 'success');
    document.querySelectorAll('#observation-sections input, .card input, .card textarea, .card select').forEach(el => {
      if (el.dataset.role || el.dataset.item || el.dataset.setup) return; // handled by resetItemsHazardsAttendees
      if (el.id === 'f-load-unit') { el.value = 'lb'; return; }
      el.value = '';
    });
    resetItemsHazardsAttendees();
    resetSetupChanges();
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
      .eq('device_id', DEVICE_ID)
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

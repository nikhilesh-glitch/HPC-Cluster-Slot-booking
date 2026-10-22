/**
 * HPC Slot Booking System - Main Application Controller
 */

import { AuthManager } from './auth.js';
import { GitHubApi } from './github-api.js';
import { CalendarService } from './calendar.js';
import { TelemetryService } from './telemetry.js';

// Application State
const state = {
  currentNode: 'node-10',
  currentDate: CalendarService.formatDate(new Date()),
  bookingsData: null,
  activeSlotModal: null
};

// DOM Elements
const elements = {
  // Sync & Status
  syncStatusBtn: document.getElementById('sync-status-btn'),
  syncIndicator: document.getElementById('sync-indicator'),
  syncLabel: document.getElementById('sync-label'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnAuthText: document.getElementById('btn-auth-text'),

  // Telemetry
  telemetryNodeTitle: document.getElementById('telemetry-node-title'),
  telemetryNodeSpecs: document.getElementById('telemetry-node-specs'),
  telemetryTime: document.getElementById('telemetry-time'),
  telemetryCpuVal: document.getElementById('telemetry-cpu-val'),
  telemetryCpuBar: document.getElementById('telemetry-cpu-bar'),
  telemetryRamVal: document.getElementById('telemetry-ram-val'),
  telemetryRamBar: document.getElementById('telemetry-ram-bar'),
  telemetryTempVal: document.getElementById('telemetry-temp-val'),
  telemetryTempBar: document.getElementById('telemetry-temp-bar'),
  telemetryJobInfo: document.getElementById('telemetry-job-info'),
  telemetryJobUser: document.getElementById('telemetry-job-user'),
  telemetryGpuContainer: document.getElementById('telemetry-gpu-container'),
  telemetryGpuGrid: document.getElementById('telemetry-gpu-grid'),

  // Node Selector
  nodeButtons: document.querySelectorAll('.node-btn'),
  currentNodeTitle: document.getElementById('current-node-title'),
  currentDateReadable: document.getElementById('current-date-readable'),

  // Date Navigation
  btnPrevDay: document.getElementById('btn-prev-day'),
  btnNextDay: document.getElementById('btn-next-day'),
  btnToday: document.getElementById('btn-today'),
  btnTomorrow: document.getElementById('btn-tomorrow'),
  datePickerInput: document.getElementById('date-picker-input'),

  // Slots Grid
  slotsGrid: document.getElementById('slots-grid'),

  // Booking Modal
  bookingModal: document.getElementById('booking-modal'),
  modalSlotDesc: document.getElementById('modal-slot-desc'),
  bookingForm: document.getElementById('booking-form'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalCancelBtn: document.getElementById('modal-cancel-btn'),
  modalSubmitBtn: document.getElementById('modal-submit-btn'),
  submitBtnSpinner: document.getElementById('submit-btn-spinner'),
  submitBtnLabel: document.getElementById('submit-btn-label'),
  inputFacultyName: document.getElementById('input-faculty-name'),
  inputFacultyEmail: document.getElementById('input-faculty-email'),
  inputFacultyDept: document.getElementById('input-faculty-dept'),
  inputJobName: document.getElementById('input-job-name'),
  inputResources: document.getElementById('input-resources'),

  // Details Modal
  detailsModal: document.getElementById('details-modal'),
  detailsModalBody: document.getElementById('details-modal-body'),
  detailsSlurmCmd: document.getElementById('details-slurm-cmd'),
  detailsCloseBtn: document.getElementById('details-close-btn'),
  btnCloseDetails: document.getElementById('btn-close-details'),
  btnReleaseSlot: document.getElementById('btn-release-slot'),

  // Settings Modal
  settingsModal: document.getElementById('settings-modal'),
  settingsForm: document.getElementById('settings-form'),
  settingsCloseBtn: document.getElementById('settings-close-btn'),
  inputSettingsToken: document.getElementById('input-settings-token'),
  inputSettingsOwner: document.getElementById('input-settings-owner'),
  inputSettingsRepo: document.getElementById('input-settings-repo'),
  inputSettingsBranch: document.getElementById('input-settings-branch'),
  inputSettingsPath: document.getElementById('input-settings-path'),
  inputProfileName: document.getElementById('input-profile-name'),
  inputProfileEmail: document.getElementById('input-profile-email'),
  btnTestConnection: document.getElementById('btn-test-connection'),
  btnClearSettings: document.getElementById('btn-clear-settings'),
  settingsStatusBox: document.getElementById('settings-status-box'),

  // Toast
  toastContainer: document.getElementById('toast-container')
};

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200' :
             type === 'error' ? 'bg-red-900/90 border-red-700 text-red-200' :
             'bg-slate-800/90 border-slate-700 text-slate-200';

  toast.className = `px-4 py-3 rounded-xl border shadow-xl text-xs flex items-center space-x-2 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto backdrop-blur-md ${bg}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}</span>
    <span class="font-medium">${message}</span>
  `;

  elements.toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Updates Top Sync Pill UI based on connection state
 */
function updateSyncPill() {
  const config = AuthManager.getConfig();
  if (config.isConfigured) {
    elements.syncIndicator.className = 'h-2 w-2 rounded-full bg-emerald-400';
    elements.syncLabel.textContent = `GitHub: ${config.owner}/${config.repo}`;
    elements.btnAuthText.textContent = `${config.owner}`;
  } else {
    elements.syncIndicator.className = 'h-2 w-2 rounded-full bg-amber-400 animate-pulse';
    elements.syncLabel.textContent = 'Local / Demo Mode';
    elements.btnAuthText.textContent = 'Settings & PAT';
  }
}

/**
 * Updates Telemetry Dashboard for active node
 */
function renderTelemetry() {
  const telemetry = TelemetryService.getTelemetry(state.currentNode);
  
  elements.telemetryNodeTitle.textContent = `${telemetry.meta.name} Live Telemetry`;
  elements.telemetryNodeSpecs.textContent = `${telemetry.meta.cores} Cores • ${telemetry.meta.totalRamGb}GB RAM • ${telemetry.meta.interconnect}`;
  elements.telemetryTime.textContent = telemetry.timestamp;

  // CPU
  elements.telemetryCpuVal.textContent = `${telemetry.cpuLoadPercent}%`;
  elements.telemetryCpuBar.style.width = `${Math.min(telemetry.cpuLoadPercent, 100)}%`;

  // RAM
  elements.telemetryRamVal.textContent = `${telemetry.ramUsedGb} / ${telemetry.meta.totalRamGb} GB`;
  elements.telemetryRamBar.style.width = `${telemetry.ramPercent}%`;

  // Thermal
  elements.telemetryTempVal.textContent = `${telemetry.tempCelsius}°C • ${telemetry.powerWatts}W`;
  elements.telemetryTempBar.style.width = `${(telemetry.tempCelsius / 90) * 100}%`;

  // Active Job
  if (telemetry.activeJobs.length > 0) {
    const job = telemetry.activeJobs[0];
    elements.telemetryJobInfo.textContent = job.job;
    elements.telemetryJobUser.textContent = `${job.user} • ${job.cores} Cores (${job.elapsed})`;
  } else {
    elements.telemetryJobInfo.textContent = 'No Active Workloads';
    elements.telemetryJobUser.textContent = 'Node compute queue is idle';
  }

  // GPU Section
  if (telemetry.gpuMetrics && telemetry.gpuMetrics.length > 0) {
    elements.telemetryGpuContainer.classList.remove('hidden');
    elements.telemetryGpuGrid.innerHTML = telemetry.gpuMetrics.map(gpu => `
      <div class="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
        <div class="flex justify-between items-center mb-1">
          <span class="font-bold text-purple-400">${gpu.name}</span>
          <span class="text-[10px] text-slate-400">${gpu.tempC}°C</span>
        </div>
        <div class="flex justify-between text-[11px] text-slate-300 mb-1">
          <span>Util: ${gpu.util}%</span>
          <span>${gpu.memUsedGb}GB / ${gpu.memTotalGb}GB</span>
        </div>
        <div class="w-full bg-slate-800 rounded-full h-1.5">
          <div class="bg-purple-500 h-1.5 rounded-full" style="width: ${gpu.util}%"></div>
        </div>
      </div>
    `).join('');
  } else {
    elements.telemetryGpuContainer.classList.add('hidden');
  }
}

/**
 * Renders Slot Availability Cards
 */
function renderSlots() {
  if (!state.bookingsData) return;

  const slots = CalendarService.getSlotsForDate(state.bookingsData, state.currentNode, state.currentDate);
  elements.currentDateReadable.textContent = CalendarService.getReadableDate(state.currentDate);
  elements.datePickerInput.value = state.currentDate;

  // Header title update
  const nodeMeta = TelemetryService.nodesMetadata[state.currentNode];
  elements.currentNodeTitle.textContent = `Slot Availability: ${nodeMeta ? nodeMeta.name : state.currentNode}`;

  elements.slotsGrid.innerHTML = slots.map(slot => {
    const isBooked = slot.status === 'Booked';

    if (isBooked) {
      const details = slot.details || {};
      return `
        <div class="bg-slate-950/90 border border-blue-900/60 rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none"></div>
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800/80 flex items-center space-x-1">
                <span>${slot.icon}</span>
                <span>${slot.label}</span>
              </span>
              <span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700">
                BOOKED
              </span>
            </div>
            <div class="text-sm font-mono text-slate-300 mb-3">${slot.time}</div>

            <div class="space-y-1.5 mb-4 text-xs">
              <div class="font-bold text-slate-100 flex items-center space-x-1.5">
                <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>${details.bookedBy || 'Faculty Member'}</span>
              </div>
              <div class="text-[11px] text-slate-400 pl-5 truncate">${details.department || 'Academic Department'}</div>
              <div class="text-[11px] text-blue-400 pl-5 font-mono truncate">Job: ${details.jobName || 'Compute Job'}</div>
            </div>
          </div>

          <button class="btn-slot-details w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition" data-slot="${slot.key}">
            View Details & Cancel
          </button>
        </div>
      `;
    }

    // Available Slot
    return `
      <div class="bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-5 flex flex-col justify-between shadow-lg transition-all group">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800 flex items-center space-x-1">
              <span>${slot.icon}</span>
              <span>${slot.label}</span>
            </span>
            <span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              AVAILABLE
            </span>
          </div>
          <div class="text-sm font-mono text-slate-300 mb-3">${slot.time}</div>
          <p class="text-xs text-slate-400 mb-4">Slot is open for immediate reservation by department faculty.</p>
        </div>

        <button class="btn-book-slot w-full py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-1" data-slot="${slot.key}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Book This Slot</span>
        </button>
      </div>
    `;
  }).join('');

  // Attach event handlers to slot buttons
  document.querySelectorAll('.btn-book-slot').forEach(btn => {
    btn.addEventListener('click', () => openBookingModal(btn.dataset.slot));
  });

  document.querySelectorAll('.btn-slot-details').forEach(btn => {
    btn.addEventListener('click', () => openDetailsModal(btn.dataset.slot));
  });
}

/**
 * Opens Booking Modal
 */
function openBookingModal(slotKey) {
  state.activeSlotModal = { nodeId: state.currentNode, dateStr: state.currentDate, slotKey };

  const nodeMeta = TelemetryService.nodesMetadata[state.currentNode];
  elements.modalSlotDesc.textContent = `${nodeMeta ? nodeMeta.name : state.currentNode} • ${state.currentDate} • Slot: ${slotKey}`;

  // Pre-fill profile
  const profile = AuthManager.getProfile();
  elements.inputFacultyName.value = profile.name || '';
  elements.inputFacultyEmail.value = profile.email || '';
  if (profile.department) elements.inputFacultyDept.value = profile.department;
  elements.inputJobName.value = '';
  elements.inputResources.value = `Full Node (${nodeMeta?.cores || 32} cores)`;

  elements.bookingModal.classList.remove('hidden');
}

/**
 * Closes Booking Modal
 */
function closeBookingModal() {
  elements.bookingModal.classList.add('hidden');
  state.activeSlotModal = null;
}

/**
 * Handles Booking Form Submission
 */
async function handleBookingSubmit(e) {
  e.preventDefault();
  if (!state.activeSlotModal) return;

  const { nodeId, dateStr, slotKey } = state.activeSlotModal;
  const facultyInfo = {
    name: elements.inputFacultyName.value.trim(),
    email: elements.inputFacultyEmail.value.trim(),
    department: elements.inputFacultyDept.value,
    jobName: elements.inputJobName.value.trim(),
    coresRequested: elements.inputResources.value.trim()
  };

  // Remember profile for convenience
  AuthManager.saveProfile({
    name: facultyInfo.name,
    email: facultyInfo.email,
    department: facultyInfo.department
  });

  // UI loading state
  elements.submitBtnSpinner.classList.remove('hidden');
  elements.submitBtnLabel.textContent = 'Committing Booking...';
  elements.modalSubmitBtn.disabled = true;

  try {
    const updated = CalendarService.applyBooking(state.bookingsData, nodeId, dateStr, slotKey, facultyInfo);
    const commitMsg = `Book slot: ${nodeId} (${dateStr} ${slotKey}) for ${facultyInfo.name}`;
    const result = await GitHubApi.updateBookings(updated, commitMsg);

    state.bookingsData = updated;
    renderSlots();
    closeBookingModal();

    if (result.source === 'github') {
      showToast(`Slot reserved & committed to GitHub (Commit: ${result.commit.slice(0, 7)})`, 'success');
    } else {
      showToast('Slot reserved locally! Set up your GitHub PAT in Settings to sync across faculty.', 'success');
    }
  } catch (err) {
    console.error('Booking failed:', err);
    showToast(`Booking error: ${err.message}`, 'error');
  } finally {
    elements.submitBtnSpinner.classList.add('hidden');
    elements.submitBtnLabel.textContent = 'Confirm Reservation';
    elements.modalSubmitBtn.disabled = false;
  }
}

/**
 * Opens Details & Cancellation Modal
 */
function openDetailsModal(slotKey) {
  state.activeSlotModal = { nodeId: state.currentNode, dateStr: state.currentDate, slotKey };
  const slots = CalendarService.getSlotsForDate(state.bookingsData, state.currentNode, state.currentDate);
  const slot = slots.find(s => s.key === slotKey);
  const details = slot?.details || {};

  elements.detailsModalBody.innerHTML = `
    <div class="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
      <div class="flex justify-between text-xs"><span class="text-slate-400">Node:</span> <span class="font-bold text-white">${state.currentNode}</span></div>
      <div class="flex justify-between text-xs"><span class="text-slate-400">Date:</span> <span class="font-bold text-white">${state.currentDate}</span></div>
      <div class="flex justify-between text-xs"><span class="text-slate-400">Time Block:</span> <span class="font-bold text-blue-400">${slotKey}</span></div>
    </div>
    <div class="space-y-1">
      <div class="text-xs text-slate-400">Reserved by:</div>
      <div class="font-semibold text-slate-100">${details.bookedBy || 'N/A'}</div>
      <div class="text-xs text-slate-400">${details.email || ''} • ${details.department || ''}</div>
    </div>
    <div class="space-y-1">
      <div class="text-xs text-slate-400">Workload / Job:</div>
      <div class="text-xs font-mono text-blue-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">${details.jobName || 'Compute Job'}</div>
    </div>
    <div class="text-[11px] text-slate-500">Booked at: ${details.bookedAt ? new Date(details.bookedAt).toLocaleString() : 'N/A'}</div>
  `;

  elements.detailsSlurmCmd.textContent = `sbatch -w ${state.currentNode} --time=04:00:00 --job-name="${details.jobName || 'hpc_job'}" job.sh`;
  elements.detailsModal.classList.remove('hidden');
}

/**
 * Handles Cancellation / Slot Release
 */
async function handleReleaseSlot() {
  if (!state.activeSlotModal) return;

  const { nodeId, dateStr, slotKey } = state.activeSlotModal;
  const confirmed = window.confirm(`Are you sure you want to release the ${slotKey} slot on ${nodeId}?`);
  if (!confirmed) return;

  try {
    const updated = CalendarService.applyCancellation(state.bookingsData, nodeId, dateStr, slotKey);
    const commitMsg = `Release slot: ${nodeId} (${dateStr} ${slotKey})`;
    const result = await GitHubApi.updateBookings(updated, commitMsg);

    state.bookingsData = updated;
    renderSlots();
    elements.detailsModal.classList.add('hidden');
    state.activeSlotModal = null;

    if (result.source === 'github') {
      showToast(`Slot released and committed to GitHub!`, 'success');
    } else {
      showToast(`Slot released (updated local state)`, 'success');
    }
  } catch (err) {
    showToast(`Cancellation error: ${err.message}`, 'error');
  }
}

/**
 * Opens GitHub Settings Modal
 */
function openSettingsModal() {
  const config = AuthManager.getConfig();
  const profile = AuthManager.getProfile();

  elements.inputSettingsToken.value = config.token;
  elements.inputSettingsOwner.value = config.owner;
  elements.inputSettingsRepo.value = config.repo;
  elements.inputSettingsBranch.value = config.branch;
  elements.inputSettingsPath.value = config.filePath;
  elements.inputProfileName.value = profile.name || '';
  elements.inputProfileEmail.value = profile.email || '';

  elements.settingsStatusBox.classList.add('hidden');
  elements.settingsModal.classList.remove('hidden');
}

/**
 * Tests GitHub connection
 */
async function handleTestConnection() {
  const token = elements.inputSettingsToken.value.trim();
  const owner = elements.inputSettingsOwner.value.trim();
  const repo = elements.inputSettingsRepo.value.trim();

  if (!token || !owner || !repo) {
    elements.settingsStatusBox.className = 'p-3 rounded-lg text-xs bg-amber-950/70 border border-amber-800 text-amber-200 block';
    elements.settingsStatusBox.textContent = 'Please provide Token, Owner, and Repo before testing.';
    return;
  }

  elements.settingsStatusBox.className = 'p-3 rounded-lg text-xs bg-blue-950/70 border border-blue-800 text-blue-200 block';
  elements.settingsStatusBox.textContent = 'Testing connection with GitHub REST API...';

  const res = await AuthManager.testConnection(token, owner, repo);
  if (res.success) {
    elements.settingsStatusBox.className = 'p-3 rounded-lg text-xs bg-emerald-950/70 border border-emerald-800 text-emerald-200 block';
    elements.settingsStatusBox.innerHTML = `✓ Authenticated as <strong>@${res.user}</strong>. Push access to <strong>${res.repoFullName}</strong> verified!`;
  } else {
    elements.settingsStatusBox.className = 'p-3 rounded-lg text-xs bg-red-950/70 border border-red-800 text-red-200 block';
    elements.settingsStatusBox.textContent = `⚠ Connection Failed: ${res.error}`;
  }
}

/**
 * Saves Settings Form
 */
async function handleSettingsSubmit(e) {
  e.preventDefault();

  AuthManager.saveConfig({
    token: elements.inputSettingsToken.value,
    owner: elements.inputSettingsOwner.value,
    repo: elements.inputSettingsRepo.value,
    branch: elements.inputSettingsBranch.value,
    filePath: elements.inputSettingsPath.value
  });

  AuthManager.saveProfile({
    name: elements.inputProfileName.value.trim(),
    email: elements.inputProfileEmail.value.trim()
  });

  updateSyncPill();
  elements.settingsModal.classList.add('hidden');
  showToast('Settings saved! Refreshing bookings...', 'info');

  await loadBookings();
}

/**
 * Clears Authentication Settings
 */
function handleClearSettings() {
  if (window.confirm('Clear stored GitHub PAT and repository settings? The app will revert to local demo mode.')) {
    AuthManager.clearConfig();
    updateSyncPill();
    elements.settingsModal.classList.add('hidden');
    showToast('GitHub credentials cleared. App is in Local Mode.', 'info');
  }
}

/**
 * Loads bookings from GitHub or cache
 */
async function loadBookings() {
  try {
    const res = await GitHubApi.getBookings();
    state.bookingsData = res.data;
    renderSlots();
    renderTelemetry();

    if (res.source === 'github') {
      showToast('Loaded latest bookings from GitHub repository', 'success');
    }
  } catch (err) {
    console.error('Failed to load bookings:', err);
    showToast('Failed to load bookings data', 'error');
  }
}

/**
 * Setup Event Listeners
 */
function setupEvents() {
  // Node buttons
  elements.nodeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.nodeButtons.forEach(b => {
        b.className = 'node-btn group p-4 rounded-xl border text-left transition relative bg-slate-900/60 border-slate-800 hover:border-slate-700';
      });
      btn.className = 'node-btn group p-4 rounded-xl border text-left transition relative bg-slate-900 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500';
      state.currentNode = btn.dataset.node;
      renderTelemetry();
      renderSlots();
    });
  });

  // Date Navigation
  elements.btnToday.addEventListener('click', () => {
    state.currentDate = CalendarService.formatDate(new Date());
    renderSlots();
  });

  elements.btnTomorrow.addEventListener('click', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    state.currentDate = CalendarService.formatDate(tomorrow);
    renderSlots();
  });

  elements.btnPrevDay.addEventListener('click', () => {
    const [y, m, d] = state.currentDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    state.currentDate = CalendarService.formatDate(date);
    renderSlots();
  });

  elements.btnNextDay.addEventListener('click', () => {
    const [y, m, d] = state.currentDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    state.currentDate = CalendarService.formatDate(date);
    renderSlots();
  });

  elements.datePickerInput.addEventListener('change', (e) => {
    if (e.target.value) {
      state.currentDate = e.target.value;
      renderSlots();
    }
  });

  // Refresh
  elements.btnRefresh.addEventListener('click', async () => {
    showToast('Refreshing schedule from GitHub...', 'info');
    await loadBookings();
  });

  // Settings & Auth
  elements.btnOpenSettings.addEventListener('click', openSettingsModal);
  elements.syncStatusBtn.addEventListener('click', openSettingsModal);
  elements.settingsCloseBtn.addEventListener('click', () => elements.settingsModal.classList.add('hidden'));
  elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
  elements.btnTestConnection.addEventListener('click', handleTestConnection);
  elements.btnClearSettings.addEventListener('click', handleClearSettings);

  // Booking Modal
  elements.modalCloseBtn.addEventListener('click', closeBookingModal);
  elements.modalCancelBtn.addEventListener('click', closeBookingModal);
  elements.bookingForm.addEventListener('submit', handleBookingSubmit);

  // Details Modal
  elements.detailsCloseBtn.addEventListener('click', () => elements.detailsModal.classList.add('hidden'));
  elements.btnCloseDetails.addEventListener('click', () => elements.detailsModal.classList.add('hidden'));
  elements.btnReleaseSlot.addEventListener('click', handleReleaseSlot);

  // Periodic telemetry refresh (every 8s)
  setInterval(() => {
    renderTelemetry();
  }, 8000);
}

/**
 * Initialize Application
 */
async function init() {
  updateSyncPill();
  setupEvents();
  renderTelemetry();
  await loadBookings();
}

// Start
init();

/**
 * HPC Slot Booking System - Main Application Controller
 * Provides full monthly calendar display, slot reservation, modification, deletion, and telemetry.
 */

import { AuthManager } from './auth.js';
import { GitHubApi } from './github-api.js';
import { CalendarService, STANDARD_SLOTS } from './calendar.js';
import { TelemetryService } from './telemetry.js';

// Application State
const now = new Date();
const state = {
  currentNode: 'node-1',
  currentYear: now.getFullYear(),
  currentMonth: now.getMonth(), // 0-11
  currentDayDate: CalendarService.formatDate(now), // For Day Detail view
  currentView: 'month', // 'month' or 'day'
  bookingsData: null,
  activeSlot: null // { nodeId, dateStr, slotKey, details }
};

// DOM Elements
const elements = {
  // Sync & Top Status
  syncStatusBtn: document.getElementById('sync-status-btn'),
  syncIndicator: document.getElementById('sync-indicator'),
  syncLabel: document.getElementById('sync-label'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnAuthText: document.getElementById('btn-auth-text'),

  // Telemetry Section
  telemetryNodeTitle: document.getElementById('telemetry-node-title'),
  telemetryNodeSpecs: document.getElementById('telemetry-node-specs'),
  telemetryTime: document.getElementById('telemetry-time'),
  telemetryCpuVal: document.getElementById('telemetry-cpu-val'),
  telemetryCpuBar: document.getElementById('telemetry-cpu-bar'),
  telemetryCoresInfo: document.getElementById('telemetry-cores-info'),
  telemetryRamVal: document.getElementById('telemetry-ram-val'),
  telemetryRamBar: document.getElementById('telemetry-ram-bar'),
  telemetryRamPct: document.getElementById('telemetry-ram-pct'),
  telemetryTempVal: document.getElementById('telemetry-temp-val'),
  telemetryTempBar: document.getElementById('telemetry-temp-bar'),
  telemetryJobStatus: document.getElementById('telemetry-job-status'),
  telemetryJobInfo: document.getElementById('telemetry-job-info'),
  telemetryJobUser: document.getElementById('telemetry-job-user'),
  telemetryGpuContainer: document.getElementById('telemetry-gpu-container'),
  telemetryGpuGrid: document.getElementById('telemetry-gpu-grid'),

  // Node Selector
  nodeButtons: document.querySelectorAll('.node-btn'),

  // Month Navigation & Header
  calendarHeaderTitle: document.getElementById('calendar-header-title'),
  currentMonthDisplay: document.getElementById('current-month-display'),
  btnPrevMonth: document.getElementById('btn-prev-month'),
  btnNextMonth: document.getElementById('btn-next-month'),
  btnMonthToday: document.getElementById('btn-month-today'),
  monthPickerInput: document.getElementById('month-picker-input'),
  btnViewMonth: document.getElementById('btn-view-month'),
  btnViewDay: document.getElementById('btn-view-day'),

  // Monthly Stats
  statMonthTotal: document.getElementById('stat-month-total'),
  statMonthAvail: document.getElementById('stat-month-avail'),
  statMonthBooked: document.getElementById('stat-month-booked'),
  statMonthUtil: document.getElementById('stat-month-util'),
  statMonthBar: document.getElementById('stat-month-bar'),

  // Containers
  monthViewContainer: document.getElementById('month-view-container'),
  monthlyCalendarGrid: document.getElementById('monthly-calendar-grid'),
  dayViewContainer: document.getElementById('day-view-container'),
  dayViewDateTitle: document.getElementById('day-view-date-title'),
  dayViewDatePicker: document.getElementById('day-view-date-picker'),
  btnDayPrev: document.getElementById('btn-day-prev'),
  btnDayNext: document.getElementById('btn-day-next'),
  btnBackToMonth: document.getElementById('btn-back-to-month'),
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

  // Manage / Modify / Delete Modal
  manageModal: document.getElementById('manage-modal'),
  manageSlotDesc: document.getElementById('manage-slot-desc'),
  manageBookedAt: document.getElementById('manage-booked-at'),
  manageModifiedAt: document.getElementById('manage-modified-at'),
  modifyForm: document.getElementById('modify-form'),
  modifyFacultyName: document.getElementById('modify-faculty-name'),
  modifyFacultyEmail: document.getElementById('modify-faculty-email'),
  modifyFacultyDept: document.getElementById('modify-faculty-dept'),
  modifyJobName: document.getElementById('modify-job-name'),
  modifyResources: document.getElementById('modify-resources'),
  manageSlurmCmd: document.getElementById('manage-slurm-cmd'),
  btnCopySlurm: document.getElementById('btn-copy-slurm'),
  btnDeleteSlot: document.getElementById('btn-delete-slot'),
  btnCancelModify: document.getElementById('btn-cancel-modify'),
  manageCloseBtn: document.getElementById('manage-close-btn'),
  btnSaveModify: document.getElementById('btn-save-modify'),
  modifySpinner: document.getElementById('modify-spinner'),
  modifyLabel: document.getElementById('modify-label'),

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

  // Toast Container
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
  const telemetry = TelemetryService.getTelemetry(state.currentNode, state.bookingsData);
  
  elements.telemetryNodeTitle.textContent = `${telemetry.meta.name} Live Telemetry`;
  elements.telemetryNodeSpecs.textContent = `${telemetry.meta.cores} Cores • ${telemetry.meta.totalRamGb}GB RAM • ${telemetry.meta.interconnect}`;
  elements.telemetryTime.textContent = telemetry.timestamp;

  // CPU
  elements.telemetryCpuVal.textContent = `${telemetry.cpuLoadPercent.toFixed(1)}%`;
  elements.telemetryCpuBar.style.width = `${Math.min(telemetry.cpuLoadPercent, 100)}%`;
  if (elements.telemetryCoresInfo) {
    elements.telemetryCoresInfo.textContent = `${telemetry.meta.cores} Cores Active`;
  }

  // RAM
  elements.telemetryRamVal.textContent = `${telemetry.ramUsedGb} / ${telemetry.meta.totalRamGb} GB`;
  elements.telemetryRamBar.style.width = `${telemetry.ramPercent}%`;
  if (elements.telemetryRamPct) {
    elements.telemetryRamPct.textContent = `${telemetry.ramPercent}% Allocated`;
  }

  // Thermal
  elements.telemetryTempVal.textContent = `${telemetry.tempCelsius}°C • ${telemetry.powerWatts}W`;
  elements.telemetryTempBar.style.width = `${(telemetry.tempCelsius / 90) * 100}%`;

  // Active Job & Slurm status
  if (telemetry.activeJobs.length > 0) {
    const job = telemetry.activeJobs[0];
    if (elements.telemetryJobStatus) {
      elements.telemetryJobStatus.className = 'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800';
      elements.telemetryJobStatus.textContent = 'RUNNING';
    }
    elements.telemetryJobInfo.textContent = job.job;
    elements.telemetryJobUser.textContent = `${job.user} • ${job.cores} Cores`;
  } else {
    if (elements.telemetryJobStatus) {
      elements.telemetryJobStatus.className = 'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700';
      elements.telemetryJobStatus.textContent = 'IDLE';
    }
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
 * Switches between 'month' and 'day' views
 */
function switchView(viewName) {
  state.currentView = viewName;
  if (viewName === 'month') {
    elements.monthViewContainer.classList.remove('hidden');
    elements.dayViewContainer.classList.add('hidden');
    elements.btnViewMonth.className = 'px-3 py-1 rounded-md text-xs font-semibold bg-blue-600 text-white transition';
    elements.btnViewDay.className = 'px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition';
    renderMonthCalendar();
  } else {
    elements.monthViewContainer.classList.add('hidden');
    elements.dayViewContainer.classList.remove('hidden');
    elements.btnViewDay.className = 'px-3 py-1 rounded-md text-xs font-semibold bg-blue-600 text-white transition';
    elements.btnViewMonth.className = 'px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition';
    renderDaySlots();
  }
}

/**
 * Renders the Full Monthly Calendar Grid (All days & slots)
 */
function renderMonthCalendar() {
  if (!state.bookingsData) return;

  const nodeMeta = TelemetryService.nodesMetadata[state.currentNode];
  const monthName = CalendarService.getMonthYearLabel(state.currentYear, state.currentMonth);

  elements.calendarHeaderTitle.textContent = `${nodeMeta?.name || state.currentNode}`;
  elements.currentMonthDisplay.textContent = monthName;

  // Sync native month picker
  const pickerVal = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}`;
  elements.monthPickerInput.value = pickerVal;

  // Monthly Statistics
  const stats = CalendarService.getMonthStats(state.bookingsData, state.currentNode, state.currentYear, state.currentMonth);
  elements.statMonthTotal.textContent = `${stats.totalSlots} slots`;
  elements.statMonthAvail.textContent = `${stats.availableCount} available`;
  elements.statMonthBooked.textContent = `${stats.bookedCount} booked`;
  elements.statMonthUtil.textContent = `${stats.utilizationPct}%`;
  elements.statMonthBar.style.width = `${Math.min(stats.utilizationPct, 100)}%`;

  // Generate 7-column month grid days
  const days = CalendarService.getMonthGridDays(state.currentYear, state.currentMonth);

  elements.monthlyCalendarGrid.innerHTML = days.map(day => {
    const slots = CalendarService.getSlotsForDate(state.bookingsData, state.currentNode, day.dateStr);
    const bookedSlots = slots.filter(s => s.status === 'Booked');
    const isToday = day.isToday;
    const isCurrent = day.isCurrentMonth;

    const cellBg = !isCurrent ? 'bg-slate-950/40 opacity-45 border-slate-900' :
                   isToday ? 'bg-slate-900 border-blue-500/80 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50' :
                   'bg-slate-950/80 border-slate-800 hover:border-slate-700';

    return `
      <div class="rounded-xl border p-2.5 flex flex-col justify-between min-h-[160px] transition-all group ${cellBg}">
        <!-- Day Cell Header -->
        <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80">
          <button class="btn-inspect-day flex items-center space-x-1.5 hover:text-blue-400 transition" data-date="${day.dateStr}" title="Click to inspect this day in detail">
            <span class="text-xs font-bold ${isToday ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center' : isCurrent ? 'text-slate-200' : 'text-slate-500'}">
              ${day.dayNum}
            </span>
            ${isToday ? '<span class="text-[9px] px-1 py-0.2 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800">TODAY</span>' : ''}
          </button>
          
          <span class="text-[10px] ${bookedSlots.length > 0 ? 'text-blue-400 font-medium' : 'text-slate-500'}">
            ${bookedSlots.length > 0 ? `${bookedSlots.length} Booked` : 'All Open'}
          </span>
        </div>

        <!-- 4 Slots List -->
        <div class="space-y-1 flex-1 flex flex-col justify-center">
          ${slots.map(slot => {
            const isBooked = slot.status === 'Booked';
            if (isBooked) {
              const details = slot.details || {};
              const facultyShort = details.bookedBy ? details.bookedBy.split(' ')[0] + ' ' + (details.bookedBy.split(' ')[1] || '') : 'Reserved';
              return `
                <button class="btn-manage-slot w-full text-left p-1 px-1.5 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-800/80 text-blue-200 hover:border-blue-600 transition flex items-center justify-between text-[10px] group/slot"
                        data-node="${state.currentNode}" data-date="${day.dateStr}" data-slot="${slot.key}"
                        title="Booked: ${details.bookedBy || 'Faculty'} (${slot.time}) - Click to Modify/Delete">
                  <span class="truncate font-medium flex items-center space-x-1">
                    <span>${slot.icon}</span>
                    <strong class="text-blue-300">${slot.shortTime}</strong>
                    <span class="truncate ml-1 text-slate-300">${facultyShort}</span>
                  </span>
                  <span class="text-[9px] text-blue-400 group-hover/slot:text-white font-bold ml-1">EDIT</span>
                </button>
              `;
            }

            // Available Slot Button
            return `
              <button class="btn-book-slot w-full text-left p-1 px-1.5 rounded bg-slate-900/60 hover:bg-emerald-950/40 border border-slate-800/80 hover:border-emerald-600/70 text-slate-400 hover:text-emerald-300 transition flex items-center justify-between text-[10px] group/slot"
                      data-node="${state.currentNode}" data-date="${day.dateStr}" data-slot="${slot.key}"
                      title="Available: ${slot.time} - Click to Reserve">
                <span class="flex items-center space-x-1 font-mono">
                  <span>${slot.icon}</span>
                  <span>${slot.shortTime}</span>
                </span>
                <span class="text-[9px] text-emerald-400 group-hover/slot:text-emerald-300 font-semibold">+ Book</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Wire Day Inspect Buttons
  document.querySelectorAll('.btn-inspect-day').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentDayDate = btn.dataset.date;
      switchView('day');
    });
  });

  // Wire Slot Action Buttons in Month View
  attachSlotEventListeners();
}

/**
 * Renders Single-Day Detail View (4 large interactive slot cards)
 */
function renderDaySlots() {
  if (!state.bookingsData) return;

  const nodeMeta = TelemetryService.nodesMetadata[state.currentNode];
  elements.dayViewDateTitle.textContent = `${CalendarService.getReadableDate(state.currentDayDate)} (${nodeMeta?.name || state.currentNode})`;
  elements.dayViewDatePicker.value = state.currentDayDate;

  const slots = CalendarService.getSlotsForDate(state.bookingsData, state.currentNode, state.currentDayDate);

  elements.slotsGrid.innerHTML = slots.map(slot => {
    const isBooked = slot.status === 'Booked';

    if (isBooked) {
      const details = slot.details || {};
      return `
        <div class="bg-slate-950/90 border border-blue-900/80 rounded-xl p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
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

          <button class="btn-manage-slot w-full py-2 px-3 rounded-lg text-xs font-semibold bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-800 transition flex items-center justify-center space-x-1"
                  data-node="${state.currentNode}" data-date="${state.currentDayDate}" data-slot="${slot.key}">
            <span>Modify / Delete Booking</span>
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

        <button class="btn-book-slot w-full py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-1"
                data-node="${state.currentNode}" data-date="${state.currentDayDate}" data-slot="${slot.key}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Book This Slot</span>
        </button>
      </div>
    `;
  }).join('');

  attachSlotEventListeners();
}

/**
 * Attaches click handlers to both Book and Manage buttons
 */
function attachSlotEventListeners() {
  document.querySelectorAll('.btn-book-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openBookingModal(btn.dataset.node, btn.dataset.date, btn.dataset.slot);
    });
  });

  document.querySelectorAll('.btn-manage-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openManageModal(btn.dataset.node, btn.dataset.date, btn.dataset.slot);
    });
  });
}

/**
 * Opens Booking Modal
 */
function openBookingModal(nodeId, dateStr, slotKey) {
  state.activeSlot = { nodeId, dateStr, slotKey };

  const nodeMeta = TelemetryService.nodesMetadata[nodeId];
  elements.modalSlotDesc.textContent = `${nodeMeta ? nodeMeta.name : nodeId} • ${dateStr} • Shift: ${slotKey}`;

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
  state.activeSlot = null;
}

/**
 * Handles Booking Form Submission
 */
async function handleBookingSubmit(e) {
  e.preventDefault();
  if (!state.activeSlot) return;

  const { nodeId, dateStr, slotKey } = state.activeSlot;
  const facultyInfo = {
    name: elements.inputFacultyName.value.trim(),
    email: elements.inputFacultyEmail.value.trim(),
    department: elements.inputFacultyDept.value,
    jobName: elements.inputJobName.value.trim(),
    coresRequested: elements.inputResources.value.trim()
  };

  AuthManager.saveProfile({
    name: facultyInfo.name,
    email: facultyInfo.email,
    department: facultyInfo.department
  });

  elements.submitBtnSpinner.classList.remove('hidden');
  elements.submitBtnLabel.textContent = 'Committing Booking...';
  elements.modalSubmitBtn.disabled = true;

  try {
    const updated = CalendarService.applyBooking(state.bookingsData, nodeId, dateStr, slotKey, facultyInfo);
    const commitMsg = `Book slot: ${nodeId} (${dateStr} ${slotKey}) for ${facultyInfo.name}`;
    const result = await GitHubApi.updateBookings(updated, commitMsg);

    state.bookingsData = updated;
    closeBookingModal();
    renderMonthCalendar();
    renderDaySlots();
    renderTelemetry();

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
 * Opens Manage / Modify / Delete Modal
 */
function openManageModal(nodeId, dateStr, slotKey) {
  const slots = CalendarService.getSlotsForDate(state.bookingsData, nodeId, dateStr);
  const slot = slots.find(s => s.key === slotKey);
  const details = slot?.details || {};

  state.activeSlot = { nodeId, dateStr, slotKey, details };

  const nodeMeta = TelemetryService.nodesMetadata[nodeId];
  elements.manageSlotDesc.textContent = `${nodeMeta ? nodeMeta.name : nodeId} • ${dateStr} • Shift: ${slotKey}`;
  elements.manageBookedAt.textContent = details.bookedAt ? new Date(details.bookedAt).toLocaleString() : 'N/A';
  elements.manageModifiedAt.textContent = details.modifiedAt ? new Date(details.modifiedAt).toLocaleString() : 'Original Booking';

  // Fill modify form
  elements.modifyFacultyName.value = details.bookedBy || '';
  elements.modifyFacultyEmail.value = details.email || '';
  if (details.department) elements.modifyFacultyDept.value = details.department;
  elements.modifyJobName.value = details.jobName || '';
  elements.modifyResources.value = details.coresRequested || 'All available';

  // Slurm command
  elements.manageSlurmCmd.textContent = `sbatch -w ${nodeId} --job-name="${details.jobName || 'hpc_job'}" job.sh`;

  elements.manageModal.classList.remove('hidden');
}

/**
 * Closes Manage Modal
 */
function closeManageModal() {
  elements.manageModal.classList.add('hidden');
  state.activeSlot = null;
}

/**
 * Handles Modification Submission
 */
async function handleModifySubmit(e) {
  e.preventDefault();
  if (!state.activeSlot) return;

  const { nodeId, dateStr, slotKey } = state.activeSlot;
  const updatedInfo = {
    name: elements.modifyFacultyName.value.trim(),
    email: elements.modifyFacultyEmail.value.trim(),
    department: elements.modifyFacultyDept.value,
    jobName: elements.modifyJobName.value.trim(),
    coresRequested: elements.modifyResources.value.trim()
  };

  elements.modifySpinner.classList.remove('hidden');
  elements.modifyLabel.textContent = 'Saving Changes...';
  elements.btnSaveModify.disabled = true;

  try {
    const updated = CalendarService.modifyBooking(state.bookingsData, nodeId, dateStr, slotKey, updatedInfo);
    const commitMsg = `Modify booking: ${nodeId} (${dateStr} ${slotKey}) for ${updatedInfo.name}`;
    const result = await GitHubApi.updateBookings(updated, commitMsg);

    state.bookingsData = updated;
    closeManageModal();
    renderMonthCalendar();
    renderDaySlots();
    renderTelemetry();

    if (result.source === 'github') {
      showToast(`Reservation modified & committed to GitHub!`, 'success');
    } else {
      showToast(`Reservation modified (saved locally)`, 'success');
    }
  } catch (err) {
    console.error('Modify failed:', err);
    showToast(`Modification error: ${err.message}`, 'error');
  } finally {
    elements.modifySpinner.classList.add('hidden');
    elements.modifyLabel.textContent = 'Save Modifications';
    elements.btnSaveModify.disabled = false;
  }
}

/**
 * Handles Deleting / Releasing a Booking
 */
async function handleDeleteSlot() {
  if (!state.activeSlot) return;

  const { nodeId, dateStr, slotKey } = state.activeSlot;
  const confirmed = window.confirm(`Are you sure you want to release the ${slotKey} reservation on ${dateStr}?\nThis will make the slot available for other faculty.`);
  if (!confirmed) return;

  try {
    const updated = CalendarService.applyCancellation(state.bookingsData, nodeId, dateStr, slotKey);
    const commitMsg = `Release/Delete booking: ${nodeId} (${dateStr} ${slotKey})`;
    const result = await GitHubApi.updateBookings(updated, commitMsg);

    state.bookingsData = updated;
    closeManageModal();
    renderMonthCalendar();
    renderDaySlots();
    renderTelemetry();

    if (result.source === 'github') {
      showToast(`Reservation deleted & slot released on GitHub!`, 'success');
    } else {
      showToast(`Reservation deleted & slot released!`, 'success');
    }
  } catch (err) {
    showToast(`Deletion error: ${err.message}`, 'error');
  }
}

/**
 * Copies Slurm quick command to clipboard
 */
function handleCopySlurm() {
  const cmd = elements.manageSlurmCmd.textContent;
  navigator.clipboard.writeText(cmd).then(() => {
    showToast('Copied Slurm launch command to clipboard!', 'info');
  }).catch(() => {
    showToast('Failed to copy. Please manually select the command text.', 'error');
  });
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
    renderMonthCalendar();
    renderDaySlots();
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
 * Setup All Event Listeners
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
      renderMonthCalendar();
      renderDaySlots();
    });
  });

  // Month Navigation
  elements.btnPrevMonth.addEventListener('click', () => {
    if (state.currentMonth === 0) {
      state.currentMonth = 11;
      state.currentYear--;
    } else {
      state.currentMonth--;
    }
    renderMonthCalendar();
  });

  elements.btnNextMonth.addEventListener('click', () => {
    if (state.currentMonth === 11) {
      state.currentMonth = 0;
      state.currentYear++;
    } else {
      state.currentMonth++;
    }
    renderMonthCalendar();
  });

  elements.btnMonthToday.addEventListener('click', () => {
    const today = new Date();
    state.currentYear = today.getFullYear();
    state.currentMonth = today.getMonth();
    state.currentDayDate = CalendarService.formatDate(today);
    renderMonthCalendar();
  });

  elements.monthPickerInput.addEventListener('change', (e) => {
    if (e.target.value) {
      const [y, m] = e.target.value.split('-').map(Number);
      state.currentYear = y;
      state.currentMonth = m - 1;
      renderMonthCalendar();
    }
  });

  // View Switcher
  elements.btnViewMonth.addEventListener('click', () => switchView('month'));
  elements.btnViewDay.addEventListener('click', () => switchView('day'));
  elements.btnBackToMonth.addEventListener('click', () => switchView('month'));

  // Day View Navigation
  elements.btnDayPrev.addEventListener('click', () => {
    const [y, m, d] = state.currentDayDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    state.currentDayDate = CalendarService.formatDate(date);
    renderDaySlots();
  });

  elements.btnDayNext.addEventListener('click', () => {
    const [y, m, d] = state.currentDayDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    state.currentDayDate = CalendarService.formatDate(date);
    renderDaySlots();
  });

  elements.dayViewDatePicker.addEventListener('change', (e) => {
    if (e.target.value) {
      state.currentDayDate = e.target.value;
      renderDaySlots();
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

  // Manage / Modify / Delete Modal
  elements.manageCloseBtn.addEventListener('click', closeManageModal);
  elements.btnCancelModify.addEventListener('click', closeManageModal);
  elements.modifyForm.addEventListener('submit', handleModifySubmit);
  elements.btnDeleteSlot.addEventListener('click', handleDeleteSlot);
  elements.btnCopySlurm.addEventListener('click', handleCopySlurm);

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

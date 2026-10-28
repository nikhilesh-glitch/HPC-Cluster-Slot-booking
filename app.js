/**
 * HPC Slot Booking System - Unified Application Core
 * Supports 8 Compute Nodes (Nodes 1-6, 9, 11) + 1 GPU Node (Node 7).
 * All nodes feature 64 cores each. Nodes 9 & 11 are shared across faculty, students & staff.
 * Works seamlessly across file://, localhost, and GitHub Pages (HTTPS).
 */

// Default clean initial cluster database
const DEFAULT_BOOKINGS = {
  version: "1.0",
  lastUpdated: new Date().toISOString(),
  nodes: {
    "node-1": { name: "Node 1 (Shared Compute)", specs: "64 Cores CPU, 256GB RAM (Faculty, Students, Staff)", category: "shared", slots: {} },
    "node-2": { name: "Node 2 (Shared Compute)", specs: "64 Cores CPU, 256GB RAM (Faculty, Students, Staff)", category: "shared", slots: {} },
    "node-3": { name: "Node 3 (Shared Compute)", specs: "64 Cores CPU, 256GB RAM (Faculty, Students, Staff)", category: "shared", slots: {} },
    "node-4": { name: "Node 4 (Shared Compute)", specs: "64 Cores CPU, 256GB RAM (Faculty, Students, Staff)", category: "shared", slots: {} },
    "node-5": { name: "Node 5 (Shared Compute)", specs: "64 Cores CPU, 256GB RAM (Faculty, Students, Staff)", category: "shared", slots: {} },
    "node-6": { name: "Node 6 (Shared Compute)", specs: "64 Cores CPU, 256GB RAM (Faculty, Students, Staff)", category: "shared", slots: {} },
    "node-7": { name: "Node 7 (GPU Acceleration)", specs: "64 Cores CPU, 512GB RAM, 4x NVIDIA A100 80GB", category: "gpu", slots: {} },
    "node-9": { name: "Node 9 (Shared Compute)", specs: "64 Cores CPU, 256GB RAM (Faculty, Students, Staff)", category: "shared", slots: {} },
    "node-11": { name: "Node 11 (Shared Compute)", specs: "64 Cores CPU, 256GB RAM (Faculty, Students, Staff)", category: "shared", slots: {} }
  }
};

const STORAGE_KEY_AUTH = 'hpc_cluster_auth';
const STORAGE_KEY_PROFILE = 'hpc_faculty_profile';
const STORAGE_KEY_BOOKINGS = 'hpc_cluster_bookings_v4';

// 4 Standard HPC shifts per day
const STANDARD_SLOTS = [
  { key: '09:00-13:00', label: 'Morning Block', shortTime: '09:00-13:00', time: '09:00 - 13:00 (4 hrs)', icon: '🌅' },
  { key: '13:00-17:00', label: 'Afternoon Block', shortTime: '13:00-17:00', time: '13:00 - 17:00 (4 hrs)', icon: '☀️' },
  { key: '17:00-21:00', label: 'Evening Block', shortTime: '17:00-21:00', time: '17:00 - 21:00 (4 hrs)', icon: '🌆' },
  { key: '21:00-09:00', label: 'Overnight Batch', shortTime: '21:00-09:00', time: '21:00 - 09:00 (12 hrs)', icon: '🌙' }
];

// UTF-8 base64 helpers
function utf8ToBase64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}
function base64ToUtf8(str) {
  return decodeURIComponent(escape(window.atob(str.replace(/\s/g, ''))));
}

// Security: HTML escape helper to prevent XSS from user-supplied booking fields
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Security: Sanitize job names for safe use in shell commands (sbatch)
function sanitizeJobName(name) {
  return (name || 'hpc_job').trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 32);
}

// -------------------------------------------------------------
// Authentication & Settings Manager
// -------------------------------------------------------------
const AuthManager = {
  getDefaultOwner() {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
      return window.location.hostname.split('.')[0];
    }
    return 'nikhilesh-glitch';
  },

  getDefaultRepo() {
    if (typeof window !== 'undefined' && window.location.pathname) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts.length > 0 && !parts[0].includes('.')) {
        return parts[0];
      }
    }
    return 'HPC-Cluster-Slot-booking';
  },

  sanitizeOwner(val) {
    let o = (val || '').trim().replace(/\s+/g, '-');
    if (!o || o.toLowerCase() === 'nikhilesh' || o.toLowerCase() === 'your-github-username') {
      return this.getDefaultOwner();
    }
    return o;
  },

  sanitizeRepo(val) {
    let r = (val || '').trim();
    if (!r || (r.toLowerCase().includes('hpc') && (r.includes(' ') || r.toLowerCase() === 'hpc-slot-booking' || r.toLowerCase() === 'hpc-booking-system'))) {
      return 'HPC-Cluster-Slot-booking';
    }
    return r.replace(/\s+/g, '-');
  },

  getConfig() {
    const defaultOwner = this.getDefaultOwner();
    const defaultRepo = this.getDefaultRepo();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUTH);
      if (!raw) {
        return {
          token: '',
          owner: defaultOwner,
          repo: defaultRepo,
          branch: 'main',
          filePath: 'bookings.json',
          isConfigured: false
        };
      }
      const parsed = JSON.parse(raw);
      const token = (parsed.token || '').trim();
      let owner = this.sanitizeOwner(parsed.owner);
      let repo = this.sanitizeRepo(parsed.repo);

      // Auto-heal corrupted/typo owner and repo in localStorage immediately
      if (parsed.owner !== owner || parsed.repo !== repo) {
        try {
          parsed.owner = owner;
          parsed.repo = repo;
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(parsed));
        } catch {}
      }

      return {
        token,
        owner,
        repo,
        branch: (parsed.branch || 'main').trim(),
        filePath: (parsed.filePath || 'bookings.json').trim(),
        isConfigured: Boolean(token && owner && repo)
      };
    } catch {
      return {
        token: '',
        owner: defaultOwner,
        repo: defaultRepo,
        branch: 'main',
        filePath: 'bookings.json',
        isConfigured: false
      };
    }
  },

  saveConfig(config) {
    const defaultOwner = this.getDefaultOwner();
    const defaultRepo = this.getDefaultRepo();
    let owner = (config.owner || defaultOwner).trim().replace(/\s+/g, '-');
    let repo = (config.repo || defaultRepo).trim().replace(/\s+/g, '-');

    if (owner.toLowerCase() === 'nikhilesh') owner = 'nikhilesh-glitch';
    if (repo.toLowerCase() === 'hpc-slot-booking' || repo.toLowerCase() === 'hpc slot booking') {
      repo = 'HPC-Cluster-Slot-booking';
    }

    const cleaned = {
      token: (config.token || '').trim(),
      owner: owner || defaultOwner,
      repo: repo || defaultRepo,
      branch: (config.branch || 'main').trim(),
      filePath: (config.filePath || 'bookings.json').trim()
    };
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(cleaned));
    } catch (e) {
      console.warn('localStorage access failed:', e);
    }
    return this.getConfig();
  },

  checkUrlHashConfig() {
    try {
      if (typeof window === 'undefined' || !window.location.hash) return false;
      const hashStr = window.location.hash.substring(1);
      if (!hashStr) return false;

      const params = new URLSearchParams(hashStr);
      const token = params.get('token') || params.get('syncKey') || params.get('pat');
      if (token) {
        const current = this.getConfig();
        current.token = token.trim();
        if (params.get('owner')) current.owner = params.get('owner').trim();
        if (params.get('repo')) current.repo = params.get('repo').trim();
        if (params.get('branch')) current.branch = params.get('branch').trim();
        this.saveConfig(current);

        // Cleanly strip hash from address bar and history to keep token safe
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        return true;
      }
    } catch (e) {
      console.warn('URL hash config error:', e);
    }
    return false;
  },

  clearConfig() {
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch (e) {
      console.warn('localStorage clear failed:', e);
    }
  },

  getProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        name: parsed.name || '',
        email: parsed.email || '',
        department: 'Chemical Engineering',
        role: parsed.role || 'Faculty Member'
      };
    } catch {
      return { name: '', email: '', department: 'Chemical Engineering', role: 'Faculty Member' };
    }
  },

  saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('localStorage profile save failed:', e);
    }
  },

  async testConnection(token, owner, repo) {
    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!userRes.ok) throw new Error(`Invalid GitHub Token (Status ${userRes.status}). Check that the token was pasted correctly.`);
      const userData = await userRes.json();
      const login = userData.login;

      // Candidate owners and repos to test
      const ownerCandidates = Array.from(new Set([
        owner,
        login,
        'nikhilesh-glitch',
        (owner || '').toLowerCase(),
        (owner || '').replace(/\s+/g, '-')
      ])).filter(Boolean);

      const repoCandidates = Array.from(new Set([
        repo,
        (repo || '').replace(/\s+/g, '-'),
        'HPC-Cluster-Slot-booking',
        'hpc-cluster-slot-booking',
        (repo || '').toLowerCase().replace(/\s+/g, '-')
      ])).filter(Boolean);

      let workingRepoData = null;
      let matchedOwner = owner;
      let matchedRepo = repo;

      for (const o of ownerCandidates) {
        for (const r of repoCandidates) {
          try {
            const repoRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            });
            if (repoRes.ok) {
              workingRepoData = await repoRes.json();
              matchedOwner = o;
              matchedRepo = r;
              break;
            }
          } catch {}
        }
        if (workingRepoData) break;
      }

      if (!workingRepoData) {
        throw new Error(
          `Cannot access repository "${owner}/${repo}".<br><br>` +
          `<strong>How to fix:</strong><br>` +
          `• <strong>Repo Owner (User/Org)</strong>: Change <code>${owner}</code> to <strong><code>${login}</code></strong> (or <strong><code>nikhilesh-glitch</code></strong>).<br>` +
          `• <strong>Repository Name</strong>: Change <code>${repo}</code> to <strong><code>HPC-Cluster-Slot-booking</code></strong> (no spaces!).<br>` +
          `• Ensure your Personal Access Token has <strong>Contents: Read and write</strong> permissions on this repository.`
        );
      }

      return {
        success: true,
        user: login,
        repoFullName: workingRepoData.full_name,
        correctedOwner: matchedOwner,
        correctedRepo: matchedRepo
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// -------------------------------------------------------------
// GitHub API & Persistence Layer
// -------------------------------------------------------------
let cachedSha = null;

const GitHubApi = {
  mergeBookings(remoteData, localData) {
    if (!remoteData || !remoteData.nodes) return localData || DEFAULT_BOOKINGS;
    if (!localData || !localData.nodes) return remoteData;

    const merged = JSON.parse(JSON.stringify(remoteData));
    for (const [nodeId, nodeObj] of Object.entries(localData.nodes)) {
      if (!merged.nodes[nodeId]) {
        merged.nodes[nodeId] = nodeObj;
        continue;
      }
      if (!merged.nodes[nodeId].slots) {
        merged.nodes[nodeId].slots = {};
      }
      if (nodeObj.slots) {
        for (const [dateStr, daySlots] of Object.entries(nodeObj.slots)) {
          merged.nodes[nodeId].slots[dateStr] = {
            ...(merged.nodes[nodeId].slots[dateStr] || {}),
            ...daySlots
          };
        }
      }
    }
    return merged;
  },

  async getBookings() {
    const config = AuthManager.getConfig();
    const owner = AuthManager.sanitizeOwner(config.owner);
    const repo = AuthManager.sanitizeRepo(config.repo);
    const branch = config.branch || 'main';
    const filePath = config.filePath || 'bookings.json';

    // 1. Primary: Try GitHub Contents REST API
    try {
      const headers = { 'Accept': 'application/vnd.github.v3+json' };
      if (config.token) {
        headers['Authorization'] = `Bearer ${config.token}`;
      }
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}&t=${Date.now()}`;
      const res = await fetch(url, { headers });

      if (res.ok) {
        const data = await res.json();
        cachedSha = data.sha;
        const parsed = JSON.parse(base64ToUtf8(data.content));
        try { localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(parsed)); } catch {}
        return { source: 'github_api', data: parsed, sha: cachedSha };
      }
    } catch (err) {
      console.warn('GitHub API fetch failed, trying raw / static:', err);
    }

    // 2. High-speed raw GitHub fallback (no token required, no GitHub API rate limits)
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}?t=${Date.now()}`;
      const rawRes = await fetch(rawUrl);
      if (rawRes.ok) {
        const rawData = await rawRes.json();
        try { localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(rawData)); } catch {}
        return { source: 'github_raw', data: rawData, sha: cachedSha };
      }
    } catch (err) {
      console.warn('Raw GitHub fetch failed, trying local static file:', err);
    }

    // 3. Local relative static file
    try {
      const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : '';
      const pathname = (typeof window !== 'undefined' && window.location.pathname) ? window.location.pathname : '';
      const basePath = pathname.endsWith('/') ? pathname : pathname.substring(0, pathname.lastIndexOf('/') + 1) || '/';
      const staticUrl = origin + (basePath.endsWith('/') ? basePath : basePath + '/') + filePath + '?t=' + Date.now();
      const staticRes = await fetch(staticUrl);
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        try { localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(staticData)); } catch {}
        return { source: 'static_file', data: staticData, sha: cachedSha };
      }
    } catch {}

    // 4. LocalStorage cache (offline fallback only)
    try {
      const local = localStorage.getItem(STORAGE_KEY_BOOKINGS);
      if (local) {
        const parsed = JSON.parse(local);
        return { source: 'local_storage', data: parsed, sha: cachedSha };
      }
    } catch {}

    // 5. Default fallback
    try { localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(DEFAULT_BOOKINGS)); } catch {}
    return { source: 'default', data: DEFAULT_BOOKINGS, sha: null };
  },

  async updateBookings(updatedData, commitMessage) {
    const config = AuthManager.getConfig();
    const owner = AuthManager.sanitizeOwner(config.owner);
    const repo = AuthManager.sanitizeRepo(config.repo);
    const branch = config.branch || 'main';
    const filePath = config.filePath || 'bookings.json';

    updatedData.lastUpdated = new Date().toISOString();

    // Cache to localStorage immediately for snappy local response
    try {
      localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(updatedData));
    } catch (e) {
      console.warn('localStorage update failed:', e);
    }

    if (config.token && owner && repo) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

      // Always re-fetch latest remote sha and content first to prevent HTTP 409 conflict
      // and prevent overwriting concurrent bookings made by other faculty
      let currentSha = cachedSha;
      let mergedData = updatedData;

      try {
        const check = await fetch(`${url}?ref=${branch}&t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (check.ok) {
          const checkData = await check.json();
          currentSha = checkData.sha;
          cachedSha = currentSha;
          const remoteJson = JSON.parse(base64ToUtf8(checkData.content));

          // Security: Detect double-booking conflicts before merge
          for (const [nodeId, nodeObj] of Object.entries(updatedData.nodes || {})) {
            for (const [dateStr, daySlots] of Object.entries(nodeObj.slots || {})) {
              for (const [slotKey, slotData] of Object.entries(daySlots || {})) {
                const remoteSlot = remoteJson?.nodes?.[nodeId]?.slots?.[dateStr]?.[slotKey];
                if (slotData.status === 'Booked' && remoteSlot && remoteSlot.status === 'Booked') {
                  if (remoteSlot.bookedBy && slotData.bookedBy && remoteSlot.bookedBy !== slotData.bookedBy) {
                    throw new Error(`Conflict: ${slotKey} on ${dateStr} was just reserved by ${remoteSlot.bookedBy}. Please refresh and pick another slot.`);
                  }
                }
              }
            }
          }

          mergedData = this.mergeBookings(remoteJson, updatedData);
        }
      } catch (e) {
        console.warn('Pre-commit fetch error, proceeding with cached SHA:', e);
      }

      mergedData.lastUpdated = new Date().toISOString();

      const payload = {
        message: commitMessage || `HPC Slot Update: ${new Date().toISOString()}`,
        content: utf8ToBase64(JSON.stringify(mergedData, null, 2)),
        branch: branch
      };
      if (currentSha) payload.sha = currentSha;

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!putRes.ok) {
        const errJson = await putRes.json().catch(() => ({}));
        throw new Error(errJson.message || `GitHub commit failed (${putRes.status})`);
      }

      const resData = await putRes.json();
      cachedSha = resData.content ? resData.content.sha : null;
      try {
        localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(mergedData));
      } catch {}

      return { success: true, source: 'github', commit: resData.commit?.sha, data: mergedData };
    }

    return { success: true, source: 'local_storage', data: updatedData };
  }
};

// -------------------------------------------------------------
// Calendar & Slot Service
// -------------------------------------------------------------
const CalendarService = {
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  getReadableDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  getMonthYearLabel(year, month) {
    const date = new Date(year, month, 1);
    return date.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    });
  },

  getMonthGridDays(year, month) {
    const todayStr = this.formatDate(new Date());
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // 1. Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, prevDayNum);
      const dateStr = this.formatDate(prevDate);
      days.push({
        dateStr,
        dayNum: prevDayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
    }

    // 2. Current month
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const currDate = new Date(year, month, dayNum);
      const dateStr = this.formatDate(currDate);
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr
      });
    }

    // 3. Next month padding to complete 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(year, month + 1, dayNum);
      const dateStr = this.formatDate(nextDate);
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr
      });
    }

    return days;
  },

  getSlotsForDate(bookingsData, nodeId, dateStr) {
    const nodeObj = bookingsData?.nodes?.[nodeId] || { slots: {} };
    const dateSlots = nodeObj.slots?.[dateStr] || {};

    return STANDARD_SLOTS.map(def => {
      const existing = dateSlots[def.key];
      if (!existing) {
        return {
          key: def.key,
          label: def.label,
          shortTime: def.shortTime,
          time: def.time,
          icon: def.icon,
          status: 'Available',
          details: null
        };
      }

      if (typeof existing === 'string') {
        return {
          key: def.key,
          label: def.label,
          shortTime: def.shortTime,
          time: def.time,
          icon: def.icon,
          status: existing,
          details: null
        };
      }

      return {
        key: def.key,
        label: def.label,
        shortTime: def.shortTime,
        time: def.time,
        icon: def.icon,
        status: existing.status || 'Booked',
        details: existing
      };
    });
  },

  getMonthStats(bookingsData, nodeId, year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalSlots = daysInMonth * STANDARD_SLOTS.length;
    let bookedCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(new Date(year, month, day));
      const slots = this.getSlotsForDate(bookingsData, nodeId, dateStr);
      bookedCount += slots.filter(s => s.status === 'Booked').length;
    }

    const availableCount = totalSlots - bookedCount;
    const utilizationPct = totalSlots > 0 ? ((bookedCount / totalSlots) * 100).toFixed(1) : '0.0';

    return { totalSlots, bookedCount, availableCount, utilizationPct };
  },

  applyBooking(bookingsData, nodeId, dateStr, slotKey, facultyInfo) {
    const clone = JSON.parse(JSON.stringify(bookingsData || { nodes: {} }));
    if (!clone.nodes) clone.nodes = {};
    if (!clone.nodes[nodeId]) clone.nodes[nodeId] = { name: nodeId, slots: {} };
    if (!clone.nodes[nodeId].slots) clone.nodes[nodeId].slots = {};
    if (!clone.nodes[nodeId].slots[dateStr]) clone.nodes[nodeId].slots[dateStr] = {};

    clone.nodes[nodeId].slots[dateStr][slotKey] = {
      status: 'Booked',
      bookedBy: facultyInfo.name,
      role: facultyInfo.role || 'Faculty Member',
      email: facultyInfo.email,
      department: facultyInfo.department,
      jobName: facultyInfo.jobName || 'Compute Workload',
      coresRequested: facultyInfo.coresRequested || '64 Cores',
      bookedAt: new Date().toISOString()
    };
    return clone;
  },

  modifyBooking(bookingsData, nodeId, dateStr, slotKey, updatedInfo) {
    const clone = JSON.parse(JSON.stringify(bookingsData || { nodes: {} }));
    if (!clone.nodes?.[nodeId]?.slots?.[dateStr]?.[slotKey]) {
      return this.applyBooking(bookingsData, nodeId, dateStr, slotKey, updatedInfo);
    }
    const existing = clone.nodes[nodeId].slots[dateStr][slotKey];
    clone.nodes[nodeId].slots[dateStr][slotKey] = {
      ...existing,
      status: 'Booked',
      bookedBy: updatedInfo.name || existing.bookedBy,
      role: updatedInfo.role || existing.role || 'Faculty Member',
      email: updatedInfo.email || existing.email,
      department: updatedInfo.department || existing.department,
      jobName: updatedInfo.jobName || existing.jobName,
      coresRequested: updatedInfo.coresRequested || existing.coresRequested || '64 Cores',
      modifiedAt: new Date().toISOString()
    };
    return clone;
  },

  applyCancellation(bookingsData, nodeId, dateStr, slotKey) {
    const clone = JSON.parse(JSON.stringify(bookingsData || { nodes: {} }));
    if (clone.nodes?.[nodeId]?.slots?.[dateStr]?.[slotKey]) {
      clone.nodes[nodeId].slots[dateStr][slotKey] = {
        status: 'Available'
      };
    }
    return clone;
  }
};

// -------------------------------------------------------------
// Cluster Hardware Telemetry Service (All nodes 64 cores)
// -------------------------------------------------------------
const TelemetryService = {
  nodesMetadata: {
    'node-1': { name: 'Node 1 (Shared Compute)', type: 'Shared Compute Node (Faculty, Students & Staff)', cores: 64, totalRamGb: 256, gpus: 0, interconnect: 'Dual 100GbE', category: 'shared' },
    'node-2': { name: 'Node 2 (Shared Compute)', type: 'Shared Compute Node (Faculty, Students & Staff)', cores: 64, totalRamGb: 256, gpus: 0, interconnect: 'Dual 100GbE', category: 'shared' },
    'node-3': { name: 'Node 3 (Shared Compute)', type: 'Shared Compute Node (Faculty, Students & Staff)', cores: 64, totalRamGb: 256, gpus: 0, interconnect: 'Dual 100GbE', category: 'shared' },
    'node-4': { name: 'Node 4 (Shared Compute)', type: 'Shared Compute Node (Faculty, Students & Staff)', cores: 64, totalRamGb: 256, gpus: 0, interconnect: 'Dual 100GbE', category: 'shared' },
    'node-5': { name: 'Node 5 (Shared Compute)', type: 'Shared Compute Node (Faculty, Students & Staff)', cores: 64, totalRamGb: 256, gpus: 0, interconnect: 'Dual 100GbE', category: 'shared' },
    'node-6': { name: 'Node 6 (Shared Compute)', type: 'Shared Compute Node (Faculty, Students & Staff)', cores: 64, totalRamGb: 256, gpus: 0, interconnect: 'Dual 100GbE', category: 'shared' },
    'node-7': { name: 'Node 7 (GPU Acceleration)', type: 'GPU Compute Node (64 Cores + 4x A100)', cores: 64, totalRamGb: 512, gpus: 4, gpuModel: '4x NVIDIA A100-80GB', interconnect: 'NVLink + 100GbE', category: 'gpu' },
    'node-9': { name: 'Node 9 (Shared Compute)', type: 'Shared Compute Node (Faculty, Students & Staff)', cores: 64, totalRamGb: 256, gpus: 0, interconnect: 'Dual 100GbE', category: 'shared' },
    'node-11': { name: 'Node 11 (Shared Compute)', type: 'Shared Compute Node (Faculty, Students & Staff)', cores: 64, totalRamGb: 256, gpus: 0, interconnect: 'Dual 100GbE', category: 'shared' }
  },

  getCurrentSlotKey() {
    const hour = new Date().getHours();
    if (hour >= 9 && hour < 13) return '09:00-13:00';
    if (hour >= 13 && hour < 17) return '13:00-17:00';
    if (hour >= 17 && hour < 21) return '17:00-21:00';
    return '21:00-09:00';
  },

  getTelemetry(nodeId, bookingsData = null) {
    const meta = this.nodesMetadata[nodeId] || { name: nodeId, cores: 64, totalRamGb: 256, gpus: 0 };
    const todayStr = CalendarService.formatDate(new Date());
    const currentSlot = this.getCurrentSlotKey();

    const slotData = bookingsData?.nodes?.[nodeId]?.slots?.[todayStr]?.[currentSlot];
    const isSlotBooked = slotData && slotData.status === 'Booked';

    let cpuLoadPercent = 0.5;
    let ramUsedGb = Math.round(meta.totalRamGb * 0.03);
    let powerWatts = 85;
    let tempCelsius = 28;
    let activeJobs = [];
    let gpuMetrics = [];

    if (isSlotBooked) {
      cpuLoadPercent = meta.gpus > 0 ? 45.2 : 88.4;
      ramUsedGb = Math.round(meta.totalRamGb * 0.74);
      powerWatts = meta.gpus > 0 ? 1280 : 395;
      tempCelsius = meta.gpus > 0 ? 65 : 48;
      activeJobs = [{
        id: 'slurm-89412',
        user: slotData.bookedBy || 'Authorized Researcher',
        role: slotData.role || 'User',
        job: slotData.jobName || 'Compute Workload',
        cores: meta.cores,
        state: 'RUNNING'
      }];

      if (meta.gpus > 0) {
        gpuMetrics = [
          { id: 0, name: 'A100 #0', util: 92, memUsedGb: 74.2, memTotalGb: 80, tempC: 66 },
          { id: 1, name: 'A100 #1', util: 94, memUsedGb: 75.0, memTotalGb: 80, tempC: 68 },
          { id: 2, name: 'A100 #2', util: 89, memUsedGb: 72.8, memTotalGb: 80, tempC: 64 },
          { id: 3, name: 'A100 #3', util: 88, memUsedGb: 71.5, memTotalGb: 80, tempC: 63 }
        ];
      }
    } else {
      if (meta.gpus > 0) {
        gpuMetrics = [
          { id: 0, name: 'A100 #0', util: 0, memUsedGb: 0.4, memTotalGb: 80, tempC: 29 },
          { id: 1, name: 'A100 #1', util: 0, memUsedGb: 0.4, memTotalGb: 80, tempC: 29 },
          { id: 2, name: 'A100 #2', util: 0, memUsedGb: 0.4, memTotalGb: 80, tempC: 28 },
          { id: 3, name: 'A100 #3', util: 0, memUsedGb: 0.4, memTotalGb: 80, tempC: 28 }
        ];
      }
    }

    return {
      nodeId,
      meta,
      cpuLoadPercent,
      ramUsedGb,
      ramPercent: Math.round((ramUsedGb / meta.totalRamGb) * 100),
      powerWatts,
      tempCelsius,
      gpuMetrics,
      activeJobs,
      timestamp: new Date().toLocaleTimeString()
    };
  },

  getDefaultSinfo(bookingsData = null) {
    const todayStr = CalendarService.formatDate(new Date());
    const currentSlot = this.getCurrentSlotKey();

    let countComp16Booked = 0;
    ['node-1', 'node-2', 'node-3', 'node-4', 'node-5', 'node-6'].forEach(id => {
      if (bookingsData?.nodes?.[id]?.slots?.[todayStr]?.[currentSlot]?.status === 'Booked') {
        countComp16Booked++;
      }
    });

    let countComp911Booked = 0;
    ['node-9', 'node-11'].forEach(id => {
      if (bookingsData?.nodes?.[id]?.slots?.[todayStr]?.[currentSlot]?.status === 'Booked') {
        countComp911Booked++;
      }
    });

    const isGpuBooked = bookingsData?.nodes?.['node-7']?.slots?.[todayStr]?.[currentSlot]?.status === 'Booked';

    const stateComp16 = countComp16Booked === 6 ? 'alloc' : countComp16Booked > 0 ? 'mix' : 'idle';
    const stateGpu = isGpuBooked ? 'alloc' : 'idle';
    const stateComp911 = countComp911Booked === 2 ? 'alloc' : countComp911Booked > 0 ? 'mix' : 'idle';

    return [
      { partition: 'compute*', avail: 'up', timelimit: 'infinite', nodes: '6', state: stateComp16, nodelist: 'node[1-6]', cpus: '64', memory: '256G' },
      { partition: 'gpu', avail: 'up', timelimit: 'infinite', nodes: '1', state: stateGpu, nodelist: 'node7', cpus: '64', memory: '512G' },
      { partition: 'compute*', avail: 'up', timelimit: 'infinite', nodes: '2', state: stateComp911, nodelist: 'node[9,11]', cpus: '64', memory: '256G' }
    ];
  },

  getDefaultSqueue(bookingsData = null) {
    const todayStr = CalendarService.formatDate(new Date());
    const currentSlot = this.getCurrentSlotKey();
    const jobs = [];
    let jobCounter = 40912;

    if (bookingsData?.nodes) {
      Object.entries(bookingsData.nodes).forEach(([nodeId, nodeObj]) => {
        const slot = nodeObj?.slots?.[todayStr]?.[currentSlot];
        if (slot && slot.status === 'Booked') {
          const isGpu = nodeId === 'node-7';
          jobs.push({
            id: String(jobCounter++),
            partition: isGpu ? 'gpu' : 'compute',
            job: slot.jobName || 'slurm_task',
            user: slot.bookedBy ? slot.bookedBy.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : 'faculty',
            state: 'R',
            elapsed: '01:28:44',
            nodes: '1',
            nodeList: nodeId,
            cores: 64
          });
        }
      });
    }
    return jobs;
  }
};

// -------------------------------------------------------------
// Application State & Controller
// -------------------------------------------------------------
const initDate = new Date();
const state = {
  currentNode: 'node-1',
  currentYear: initDate.getFullYear(),
  currentMonth: initDate.getMonth(), // 0-11
  currentDayDate: CalendarService.formatDate(initDate),
  currentView: 'month',
  bookingsData: DEFAULT_BOOKINGS,
  activeSlot: null
};

// DOM References
const el = {
  syncStatusBtn: document.getElementById('sync-status-btn'),
  syncIndicator: document.getElementById('sync-indicator'),
  syncLabel: document.getElementById('sync-label'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnAuthText: document.getElementById('btn-auth-text'),

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

  // Realtime Node Core Allocation Panel Elements
  corePanelNodeTitle: document.getElementById('core-panel-node-title'),
  corePanelStatusBadge: document.getElementById('core-panel-status-badge'),
  corePanelNodeSpecs: document.getElementById('core-panel-node-specs'),
  corePanelTime: document.getElementById('core-panel-time'),
  metricTotalCores: document.getElementById('metric-total-cores'),
  metricConsumedCores: document.getElementById('metric-consumed-cores'),
  metricConsumedPct: document.getElementById('metric-consumed-pct'),
  barConsumedCores: document.getElementById('bar-consumed-cores'),
  metricFreeCores: document.getElementById('metric-free-cores'),
  metricFreePct: document.getElementById('metric-free-pct'),
  barFreeCores: document.getElementById('bar-free-cores'),
  metricLoadAvg: document.getElementById('metric-load-avg'),
  metricRamUsage: document.getElementById('metric-ram-usage'),
  barRamUsage: document.getElementById('bar-ram-usage'),
  metricRamPct: document.getElementById('metric-ram-pct'),
  legendFreeCount: document.getElementById('legend-free-count'),
  legendConsumedCount: document.getElementById('legend-consumed-count'),
  coresGridContainer: document.getElementById('cores-grid-container'),
  coreHoverText: document.getElementById('core-hover-text'),
  nodeWorkloadTitle: document.getElementById('node-workload-title'),
  nodeWorkloadBadge: document.getElementById('node-workload-badge'),
  nodeWorkloadDesc: document.getElementById('node-workload-desc'),
  coreNodeGpuStrip: document.getElementById('core-node-gpu-strip'),

  nodeButtons: document.querySelectorAll('.node-btn'),

  calendarHeaderTitle: document.getElementById('calendar-header-title'),
  currentMonthDisplay: document.getElementById('current-month-display'),
  btnPrevMonth: document.getElementById('btn-prev-month'),
  btnNextMonth: document.getElementById('btn-next-month'),
  btnMonthToday: document.getElementById('btn-month-today'),
  monthPickerInput: document.getElementById('month-picker-input'),
  btnViewMonth: document.getElementById('btn-view-month'),
  btnViewDay: document.getElementById('btn-view-day'),

  statMonthTotal: document.getElementById('stat-month-total'),
  statMonthAvail: document.getElementById('stat-month-avail'),
  statMonthBooked: document.getElementById('stat-month-booked'),
  statMonthUtil: document.getElementById('stat-month-util'),
  statMonthBar: document.getElementById('stat-month-bar'),

  monthViewContainer: document.getElementById('month-view-container'),
  monthlyCalendarGrid: document.getElementById('monthly-calendar-grid'),
  dayViewContainer: document.getElementById('day-view-container'),
  dayViewDateTitle: document.getElementById('day-view-date-title'),
  dayViewDatePicker: document.getElementById('day-view-date-picker'),
  btnDayPrev: document.getElementById('btn-day-prev'),
  btnDayNext: document.getElementById('btn-day-next'),
  btnBackToMonth: document.getElementById('btn-back-to-month'),
  slotsGrid: document.getElementById('slots-grid'),

  bookingModal: document.getElementById('booking-modal'),
  modalSlotDesc: document.getElementById('modal-slot-desc'),
  bookingNodePolicy: document.getElementById('booking-node-policy'),
  bookingForm: document.getElementById('booking-form'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalCancelBtn: document.getElementById('modal-cancel-btn'),
  modalSubmitBtn: document.getElementById('modal-submit-btn'),
  submitBtnSpinner: document.getElementById('submit-btn-spinner'),
  submitBtnLabel: document.getElementById('submit-btn-label'),
  inputFacultyName: document.getElementById('input-faculty-name'),
  inputFacultyRole: document.getElementById('input-faculty-role'),
  inputFacultyEmail: document.getElementById('input-faculty-email'),
  inputFacultyDept: document.getElementById('input-faculty-dept'),
  inputJobName: document.getElementById('input-job-name'),
  inputResources: document.getElementById('input-resources'),

  manageModal: document.getElementById('manage-modal'),
  manageSlotDesc: document.getElementById('manage-slot-desc'),
  manageBookedAt: document.getElementById('manage-booked-at'),
  manageModifiedAt: document.getElementById('manage-modified-at'),
  modifyForm: document.getElementById('modify-form'),
  modifyFacultyName: document.getElementById('modify-faculty-name'),
  modifyFacultyRole: document.getElementById('modify-faculty-role'),
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
  btnCopyShareLink: document.getElementById('btn-copy-share-link'),

  // Real-Time Sync Token Prompt Modal
  syncPromptModal: document.getElementById('sync-prompt-modal'),
  promptSyncToken: document.getElementById('prompt-sync-token'),
  btnPromptSaveSync: document.getElementById('btn-prompt-save-sync'),
  btnPromptLocalOnly: document.getElementById('btn-prompt-local-only'),
  btnPromptCancel: document.getElementById('btn-prompt-cancel'),

  // Cluster SSH Live Feed Elements (10.206.4.128 - 7s Refresh)
  btnClusterSsh: document.getElementById('btn-cluster-ssh'),
  sshFeedIndicator: document.getElementById('ssh-feed-indicator'),
  sshFeedLabel: document.getElementById('ssh-feed-label'),
  sshModal: document.getElementById('ssh-modal'),
  sshCloseBtn: document.getElementById('ssh-close-btn'),
  btnCloseSsh: document.getElementById('btn-close-ssh'),
  sshLoginForm: document.getElementById('ssh-login-form'),
  inputSshHost: document.getElementById('input-ssh-host'),
  inputSshPort: document.getElementById('input-ssh-port'),
  inputSshUser: document.getElementById('input-ssh-user'),
  inputSshPassword: document.getElementById('input-ssh-password'),
  inputSshBridgeUrl: document.getElementById('input-ssh-bridge-url'),
  sshStatusBox: document.getElementById('ssh-status-box'),
  btnSubmitSsh: document.getElementById('btn-submit-ssh'),
  sshSpinner: document.getElementById('ssh-spinner'),
  sshBtnLabel: document.getElementById('ssh-btn-label'),
  btnDisconnectSsh: document.getElementById('btn-disconnect-ssh'),

  // Dual Slurm Panel Elements (sinfo & squeue)
  sinfoTbody: document.getElementById('sinfo-tbody'),
  sinfoTableContainer: document.getElementById('sinfo-table-container'),
  sinfoRawContainer: document.getElementById('sinfo-raw-container'),
  btnToggleSinfoView: document.getElementById('btn-toggle-sinfo-view'),
  btnFetchSinfo: document.getElementById('btn-fetch-sinfo'),
  sinfoFetchIcon: document.getElementById('sinfo-fetch-icon'),
  sinfoFetchLabel: document.getElementById('sinfo-fetch-label'),
  sinfoStatusBadge: document.getElementById('sinfo-status-badge'),
  sinfoSubtitle: document.getElementById('sinfo-subtitle'),
  sinfoIdleDot: document.getElementById('sinfo-idle-dot'),
  sinfoIdleCount: document.getElementById('sinfo-idle-count'),
  sinfoAllocDot: document.getElementById('sinfo-alloc-dot'),
  sinfoAllocCount: document.getElementById('sinfo-alloc-count'),
  sinfoFooterCluster: document.getElementById('sinfo-footer-cluster'),

  squeueTbody: document.getElementById('squeue-tbody'),
  squeueTableContainer: document.getElementById('squeue-table-container'),
  squeueRawContainer: document.getElementById('squeue-raw-container'),
  btnToggleSqueueView: document.getElementById('btn-toggle-squeue-view'),
  btnFetchSqueue: document.getElementById('btn-fetch-squeue'),
  squeueFetchIcon: document.getElementById('squeue-fetch-icon'),
  squeueFetchLabel: document.getElementById('squeue-fetch-label'),
  squeueCountBadge: document.getElementById('squeue-count-badge'),
  squeueSubtitle: document.getElementById('squeue-subtitle'),
  squeueFooterStatus: document.getElementById('squeue-footer-status'),

  // Calendar Node Selector Dropdown
  calendarNodeSelector: document.getElementById('calendar-node-selector'),

  toastContainer: document.getElementById('toast-container')
};

// SSH Live Feed Client State
const sshState = {
  host: '10.206.4.128',
  port: 22,
  bridgeUrl: 'http://localhost:8080',
  connected: false,
  username: '',
  liveTelemetry: null
};

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

  if (el.toastContainer) {
    el.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

function updateSyncPill() {
  const config = AuthManager.getConfig();
  if (config.isConfigured) {
    el.syncIndicator.className = 'h-2 w-2 rounded-full bg-emerald-400';
    el.syncLabel.textContent = `GitHub: ${config.owner}/${config.repo}`;
    el.btnAuthText.textContent = `${config.owner}`;
    if (el.syncStatusBtn) el.syncStatusBtn.title = `Connected & Synced with GitHub (${config.owner}/${config.repo})`;
  } else {
    el.syncIndicator.className = 'h-2 w-2 rounded-full bg-amber-400 animate-pulse';
    el.syncLabel.textContent = 'Sync Inactive (Local)';
    el.btnAuthText.textContent = 'Connect Sync';
    if (el.syncStatusBtn) el.syncStatusBtn.title = 'Click to connect Department GitHub Token for real-time cross-faculty synchronization';
  }
}

function renderTelemetry() {
  const telemetry = TelemetryService.getTelemetry(state.currentNode, state.bookingsData);
  const isLiveSsh = sshState.connected && sshState.liveTelemetry;
  const live = isLiveSsh ? sshState.liveTelemetry : null;

  const nodeMeta = telemetry.meta;
  const titleText = isLiveSsh 
    ? `${nodeMeta.name} (Live SSH: ${sshState.host})`
    : `${nodeMeta.name} Live Telemetry`;

  if (el.telemetryNodeTitle) el.telemetryNodeTitle.textContent = titleText;
  if (el.telemetryNodeSpecs) el.telemetryNodeSpecs.textContent = `${nodeMeta.cores} Cores • ${nodeMeta.totalRamGb}GB RAM • ${nodeMeta.interconnect}`;
  
  const timeStr = isLiveSsh ? `${live.timestamp} (SSH Live 7s)` : telemetry.timestamp;
  if (el.telemetryTime) el.telemetryTime.textContent = timeStr;

  const cpuVal = isLiveSsh ? live.cpuLoadPercent : telemetry.cpuLoadPercent;
  if (el.telemetryCpuVal) el.telemetryCpuVal.textContent = `${cpuVal.toFixed(1)}%`;
  if (el.telemetryCpuBar) el.telemetryCpuBar.style.width = `${Math.min(cpuVal, 100)}%`;
  if (el.telemetryCoresInfo) el.telemetryCoresInfo.textContent = `${nodeMeta.cores} Cores Active`;

  const ramUsed = isLiveSsh ? live.ramUsedGb : telemetry.ramUsedGb;
  const ramTotal = isLiveSsh ? live.ramTotalGb : nodeMeta.totalRamGb;
  const ramPct = isLiveSsh ? live.ramPercent : telemetry.ramPercent;
  if (el.telemetryRamVal) el.telemetryRamVal.textContent = `${ramUsed} / ${ramTotal} GB`;
  if (el.telemetryRamBar) el.telemetryRamBar.style.width = `${ramPct}%`;
  if (el.telemetryRamPct) el.telemetryRamPct.textContent = `${ramPct}% Allocated`;

  const tempVal = isLiveSsh ? live.tempCelsius : telemetry.tempCelsius;
  const powerVal = isLiveSsh ? live.powerWatts : telemetry.powerWatts;
  if (el.telemetryTempVal) el.telemetryTempVal.textContent = `${tempVal}°C • ${powerVal}W`;
  if (el.telemetryTempBar) el.telemetryTempBar.style.width = `${(tempVal / 90) * 100}%`;

  const activeJobs = isLiveSsh && live.activeJobs ? live.activeJobs : telemetry.activeJobs;
  if (activeJobs.length > 0) {
    const job = activeJobs[0];
    if (el.telemetryJobStatus) {
      el.telemetryJobStatus.className = 'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800';
      el.telemetryJobStatus.textContent = job.state || 'RUNNING';
    }
    if (el.telemetryJobInfo) el.telemetryJobInfo.textContent = job.job || job.id;
    if (el.telemetryJobUser) el.telemetryJobUser.textContent = `${job.user || 'User'} (${job.role || 'Slurm Job'}) • ${job.cores || 64} Cores${job.elapsed ? ' • ' + job.elapsed : ''}`;
  } else {
    if (el.telemetryJobStatus) {
      el.telemetryJobStatus.className = 'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700';
      el.telemetryJobStatus.textContent = 'IDLE';
    }
    if (el.telemetryJobInfo) el.telemetryJobInfo.textContent = 'No Active Workloads';
    if (el.telemetryJobUser) el.telemetryJobUser.textContent = 'Node compute queue is idle (64 cores ready)';
  }

  const gpus = (isLiveSsh && live.gpuMetrics && live.gpuMetrics.length > 0) 
    ? live.gpuMetrics 
    : (telemetry.gpuMetrics || []);

  if (gpus && gpus.length > 0) {
    if (el.telemetryGpuContainer) el.telemetryGpuContainer.classList.remove('hidden');
    if (el.telemetryGpuGrid) {
      el.telemetryGpuGrid.innerHTML = gpus.map(gpu => `
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
    }
  } else {
    if (el.telemetryGpuContainer) el.telemetryGpuContainer.classList.add('hidden');
  }

  // Update dual Slurm panels (sinfo on left, squeue on right)
  renderSinfoAndSqueue();

  // Update Realtime 64-Core Allocation & Availability Monitor Panel
  renderCoreTelemetryPanel();
}

function renderCoreTelemetryPanel() {
  const nodeId = state.currentNode || 'node-1';
  const meta = TelemetryService.nodesMetadata[nodeId] || { 
    name: nodeId, 
    type: 'Shared Compute', 
    cores: 64, 
    totalRamGb: 256, 
    gpus: 0, 
    interconnect: 'Dual 100GbE', 
    category: 'shared' 
  };
  const totalCores = meta.cores || 64;

  const isLiveSsh = sshState.connected && Boolean(sshState.liveTelemetry);
  const live = isLiveSsh ? sshState.liveTelemetry : null;

  // 1. Update Title & Hardware Specs
  if (el.corePanelNodeTitle) {
    el.corePanelNodeTitle.textContent = meta.name;
  }
  if (el.corePanelNodeSpecs) {
    el.corePanelNodeSpecs.textContent = `${totalCores} Cores CPU • ${meta.totalRamGb}GB RAM • ${meta.interconnect}${meta.gpus > 0 ? ' • ' + (meta.gpuModel || '4x NVIDIA A100') : ''}`;
  }

  // 2. Sync Quick Node Switcher Pills
  document.querySelectorAll('.core-node-pill').forEach(pill => {
    const pNode = pill.getAttribute('data-node');
    if (pNode === nodeId) {
      pill.className = 'core-node-pill px-2.5 py-1 rounded-lg font-bold transition bg-blue-600 text-white shadow-md shadow-blue-600/30 cursor-pointer';
    } else if (pNode === 'node-7') {
      pill.className = 'core-node-pill px-2.5 py-1 rounded-lg font-medium transition text-purple-400 hover:text-purple-300 font-semibold cursor-pointer';
    } else {
      pill.className = 'core-node-pill px-2.5 py-1 rounded-lg font-medium transition text-slate-400 hover:text-white cursor-pointer';
    }
  });

  // 3. Compute Realtime Consumed vs Free Cores
  let consumedCores = 0;
  let activeJob = null;
  let ramUsedGb = Math.round(meta.totalRamGb * 0.04);
  let loadAvgStr = '0.08';
  let timestampStr = isLiveSsh ? `${live.timestamp} (SSH Live 7s)` : `${new Date().toLocaleTimeString()} (Scheduled Mode)`;

  if (isLiveSsh && live) {
    // Check if live probe extracted exact nodeCores dictionary
    const nodeKey = nodeId.replace('-', '');
    const directCoreInfo = live.nodeCores && (live.nodeCores[nodeId] || live.nodeCores[nodeKey]);

    if (directCoreInfo && typeof directCoreInfo.allocated === 'number') {
      consumedCores = directCoreInfo.allocated;
    } else {
      // Find jobs running on this node in Slurm
      const jobs = (live.activeJobs || live.squeue || []).filter(j => {
        const nList = (j.nodeList || j.nodelist || '').toLowerCase();
        return nList.includes(nodeId.toLowerCase()) || nList.includes(nodeKey.toLowerCase()) || (nodeId === 'node-1' && nList.includes('10.206.4.128'));
      });

      if (jobs.length > 0) {
        jobs.forEach(j => {
          const c = parseInt(j.cores, 10) || 64;
          consumedCores += c;
        });
        activeJob = jobs[0];
      } else if (nodeId === 'node-1' || nodeId === state.currentNode) {
        // Fallback to instantaneous load from node
        const loadPct = live.cpuLoadPercent || 0;
        if (loadPct > 10) {
          consumedCores = Math.round((loadPct / 100) * totalCores);
        }
      }
    }

    ramUsedGb = live.ramUsedGb || Math.round(meta.totalRamGb * 0.08);
    const cpuPct = live.cpuLoadPercent || 5.0;
    loadAvgStr = `Load: ${(cpuPct / 100 * totalCores).toFixed(2)}`;

  } else {
    // Scheduled Slot Booking Mode
    const todayStr = CalendarService.formatDate(new Date());
    const currentSlotKey = TelemetryService.getCurrentSlotKey();
    const slotData = state.bookingsData?.nodes?.[nodeId]?.slots?.[todayStr]?.[currentSlotKey];

    if (slotData && slotData.status === 'Booked') {
      const match = (slotData.coresRequested || '').match(/\d+/);
      const req = match ? parseInt(match[0], 10) : totalCores;
      consumedCores = Math.min(req, totalCores);
      activeJob = {
        id: `SLOT-${currentSlotKey.replace(':', '')}`,
        user: slotData.bookedBy,
        dept: slotData.department,
        role: slotData.role,
        job: slotData.jobName || 'Reserved Research Workload',
        cores: consumedCores
      };
      ramUsedGb = Math.round(meta.totalRamGb * (consumedCores / totalCores) * 0.75);
      loadAvgStr = `Load: ${(consumedCores * 0.82).toFixed(1)}`;
    } else {
      consumedCores = 0;
      ramUsedGb = Math.round(meta.totalRamGb * 0.04);
      loadAvgStr = 'Load: 0.12';
    }
  }

  // Constrain bounds
  consumedCores = Math.max(0, Math.min(consumedCores, totalCores));
  const freeCores = Math.max(0, totalCores - consumedCores);
  const consumedPct = ((consumedCores / totalCores) * 100);
  const freePct = ((freeCores / totalCores) * 100);

  // 4. Update Header Badges & Timestamp
  if (el.corePanelTime) {
    el.corePanelTime.textContent = timestampStr;
  }
  if (el.corePanelStatusBadge) {
    if (consumedCores === 0) {
      el.corePanelStatusBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800';
      el.corePanelStatusBadge.textContent = `● 64 / 64 Cores Available (100% Free)`;
    } else if (freeCores === 0) {
      el.corePanelStatusBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800';
      el.corePanelStatusBadge.textContent = `● 0 / 64 Cores Free (Fully Allocated)`;
    } else {
      el.corePanelStatusBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800';
      el.corePanelStatusBadge.textContent = `● ${freeCores} Cores Free (${consumedCores} Consumed)`;
    }
  }

  // 5. Update Stat Metrics Cards
  if (el.metricTotalCores) el.metricTotalCores.textContent = totalCores;
  if (el.metricConsumedCores) el.metricConsumedCores.textContent = consumedCores;
  if (el.metricConsumedPct) el.metricConsumedPct.textContent = `${consumedPct.toFixed(1)}%`;
  if (el.barConsumedCores) el.barConsumedCores.style.width = `${consumedPct}%`;

  if (el.metricFreeCores) el.metricFreeCores.textContent = freeCores;
  if (el.metricFreePct) el.metricFreePct.textContent = `${freePct.toFixed(1)}%`;
  if (el.barFreeCores) el.barFreeCores.style.width = `${freePct}%`;

  if (el.legendFreeCount) el.legendFreeCount.textContent = freeCores;
  if (el.legendConsumedCount) el.legendConsumedCount.textContent = consumedCores;

  if (el.metricLoadAvg) el.metricLoadAvg.textContent = loadAvgStr;
  if (el.metricRamUsage) el.metricRamUsage.textContent = `${ramUsedGb} / ${meta.totalRamGb} GB`;
  const ramPct = Math.round((ramUsedGb / meta.totalRamGb) * 100);
  if (el.barRamUsage) el.barRamUsage.style.width = `${ramPct}%`;
  if (el.metricRamPct) el.metricRamPct.textContent = `${ramPct}% Allocated`;

  // 6. Build the Visual 64-Core Hardware Matrix
  if (el.coresGridContainer) {
    let gridHtml = '';
    for (let i = 0; i < totalCores; i++) {
      const isBusy = i < consumedCores;
      const corePad = String(i).padStart(2, '0');
      if (isBusy) {
        gridHtml += `
          <div class="core-tile bg-blue-600/90 border border-blue-400 text-white font-mono text-[9px] font-bold py-1.5 px-0.5 rounded flex flex-col items-center justify-center shadow-sm shadow-blue-500/20 cursor-pointer transition transform hover:scale-110 select-none" data-core="${i}" data-status="busy">
            <span class="leading-none text-[8.5px]">c${corePad}</span>
            <span class="w-1.5 h-1.5 rounded-full bg-blue-200 mt-0.5 animate-pulse"></span>
          </div>
        `;
      } else {
        gridHtml += `
          <div class="core-tile bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 hover:border-emerald-500 text-emerald-400 font-mono text-[9px] font-medium py-1.5 px-0.5 rounded flex flex-col items-center justify-center cursor-pointer transition transform hover:scale-110 select-none" data-core="${i}" data-status="free">
            <span class="leading-none text-[8.5px]">c${corePad}</span>
            <span class="w-1 h-1 rounded-full bg-emerald-500/70 mt-0.5"></span>
          </div>
        `;
      }
    }
    el.coresGridContainer.innerHTML = gridHtml;

    // Attach interactive hover tooltips to each core
    el.coresGridContainer.querySelectorAll('.core-tile').forEach(tile => {
      tile.addEventListener('mouseenter', () => {
        const cNum = tile.getAttribute('data-core');
        const cStatus = tile.getAttribute('data-status');
        const cPad = String(cNum).padStart(2, '0');
        if (cStatus === 'busy') {
          const userStr = activeJob ? `${escapeHtml(activeJob.user || 'User')} (${escapeHtml(activeJob.job || 'Active Job')})` : 'Cluster Batch Job';
          if (el.coreHoverText) {
            el.coreHoverText.innerHTML = `<span class="text-blue-400 font-bold">● Core #${cPad} [CONSUMED]</span> — Running execution thread assigned to: <strong>${userStr}</strong> (${consumedCores} cores allocated on ${meta.name})`;
          }
        } else {
          if (el.coreHoverText) {
            el.coreHoverText.innerHTML = `<span class="text-emerald-400 font-bold">● Core #${cPad} [AVAILABLE]</span> — Hardware thread is IDLE and available for immediate workload assignment.`;
          }
        }
      });
      tile.addEventListener('mouseleave', () => {
        if (el.coreHoverText) {
          el.coreHoverText.textContent = `Hover over any core tile above to inspect its execution thread (${freeCores} free, ${consumedCores} busy).`;
        }
      });
    });
  }

  // 7. Active Workload Banner
  if (activeJob) {
    if (el.nodeWorkloadTitle) el.nodeWorkloadTitle.textContent = activeJob.job || 'Reserved HPC Compute Workload';
    if (el.nodeWorkloadBadge) {
      el.nodeWorkloadBadge.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800';
      el.nodeWorkloadBadge.textContent = 'RUNNING';
    }
    if (el.nodeWorkloadDesc) {
      el.nodeWorkloadDesc.textContent = `Assigned to ${activeJob.user || 'Authorized Researcher'} (${activeJob.dept || activeJob.role || 'Department Faculty/Staff'}) • Consuming ${consumedCores} of 64 physical cores.`;
    }
  } else {
    if (el.nodeWorkloadTitle) el.nodeWorkloadTitle.textContent = 'Node compute queue is idle';
    if (el.nodeWorkloadBadge) {
      el.nodeWorkloadBadge.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700';
      el.nodeWorkloadBadge.textContent = 'IDLE';
    }
    if (el.nodeWorkloadDesc) {
      el.nodeWorkloadDesc.textContent = `No active jobs currently running on ${meta.name}. All 64 cores are ready to accept batch jobs or reservations.`;
    }
  }

  // 8. GPU Strip for Node 7
  if (el.coreNodeGpuStrip) {
    if (meta.gpus > 0) {
      el.coreNodeGpuStrip.classList.remove('hidden');
      const gpus = (live && live.gpuMetrics && live.gpuMetrics.length > 0) 
        ? live.gpuMetrics 
        : [
            { id: 0, name: 'A100 #0', util: consumedCores > 0 ? 88 : 0, memUsedGb: consumedCores > 0 ? 72.4 : 0.4, memTotalGb: 80, tempC: consumedCores > 0 ? 64 : 29 },
            { id: 1, name: 'A100 #1', util: consumedCores > 0 ? 91 : 0, memUsedGb: consumedCores > 0 ? 74.1 : 0.4, memTotalGb: 80, tempC: consumedCores > 0 ? 66 : 29 },
            { id: 2, name: 'A100 #2', util: consumedCores > 0 ? 85 : 0, memUsedGb: consumedCores > 0 ? 70.0 : 0.4, memTotalGb: 80, tempC: consumedCores > 0 ? 62 : 28 },
            { id: 3, name: 'A100 #3', util: consumedCores > 0 ? 87 : 0, memUsedGb: consumedCores > 0 ? 71.2 : 0.4, memTotalGb: 80, tempC: consumedCores > 0 ? 63 : 28 }
          ];

      el.coreNodeGpuStrip.innerHTML = gpus.map(g => `
        <div class="px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-800/60 text-[10.5px] font-mono text-purple-200 flex items-center space-x-2">
          <span class="font-bold text-purple-400">${g.name}</span>
          <span class="text-slate-400">${g.memUsedGb}/${g.memTotalGb}GB</span>
          <span class="px-1 rounded bg-purple-900/60 text-purple-300 font-semibold">${g.util}%</span>
          <span class="text-slate-500">${g.tempC}°C</span>
        </div>
      `).join('');
    } else {
      el.coreNodeGpuStrip.classList.add('hidden');
      el.coreNodeGpuStrip.innerHTML = '';
    }
  }
}

function renderSinfoAndSqueue() {
  const isLive = Boolean(sshState.connected && sshState.liveTelemetry);
  const live = isLive ? sshState.liveTelemetry : null;

  // -----------------------------------------------------------
  // 1. LEFT PANEL: sinfo (Cluster Partitions & Node States)
  // -----------------------------------------------------------
  if (!isLive) {
    if (el.sinfoStatusBadge) {
      el.sinfoStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800';
      el.sinfoStatusBadge.textContent = 'Not Connected';
    }
    if (el.sinfoSubtitle) {
      el.sinfoSubtitle.textContent = 'Cluster offline • Connect to 10.206.4.128';
    }
    if (el.sinfoIdleDot) el.sinfoIdleDot.className = 'w-2 h-2 rounded-full bg-slate-600';
    if (el.sinfoIdleCount) {
      el.sinfoIdleCount.textContent = '-- Idle';
      el.sinfoIdleCount.className = 'font-medium text-slate-400';
    }
    if (el.sinfoAllocDot) el.sinfoAllocDot.className = 'w-2 h-2 rounded-full bg-slate-600';
    if (el.sinfoAllocCount) {
      el.sinfoAllocCount.textContent = '-- Allocated';
      el.sinfoAllocCount.className = 'font-medium text-slate-400';
    }
    if (el.sinfoFooterCluster) {
      el.sinfoFooterCluster.textContent = 'Slurm Cluster • Not Connected';
    }
    if (el.sinfoTbody) {
      el.sinfoTbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-10 text-slate-500">
            <div class="flex flex-col items-center justify-center space-y-2">
              <div class="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center mb-1 border border-slate-700">
                <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span class="text-xs font-semibold text-slate-300">Not Connected to Cluster</span>
              <span class="text-[11px] text-slate-500 max-w-xs">Partition status and node states will activate once connected via SSH to 10.206.4.128.</span>
            </div>
          </td>
        </tr>
      `;
    }
    if (el.sinfoRawContainer) {
      el.sinfoRawContainer.textContent = '[Cluster Not Connected]\nPlease authenticate via the Live Feed button in the header or click "Fetch Live" to connect to 10.206.4.128.';
    }
  } else {
    if (el.sinfoStatusBadge) {
      el.sinfoStatusBadge.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800';
      el.sinfoStatusBadge.textContent = 'Connected (Live)';
    }
    if (el.sinfoSubtitle) {
      el.sinfoSubtitle.textContent = '8 Compute Nodes (64c) + 1 GPU Node (64c + 4x A100)';
    }
    if (el.sinfoIdleDot) el.sinfoIdleDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    if (el.sinfoIdleCount) el.sinfoIdleCount.className = 'font-medium text-slate-300';
    if (el.sinfoAllocDot) el.sinfoAllocDot.className = 'w-2 h-2 rounded-full bg-blue-400';
    if (el.sinfoAllocCount) el.sinfoAllocCount.className = 'font-medium text-slate-300';
    if (el.sinfoFooterCluster) {
      el.sinfoFooterCluster.textContent = `Slurm Cluster • ${sshState.host || '10.206.4.128'}`;
    }

    let sinfoRows = (live && Array.isArray(live.sinfo)) ? live.sinfo : [];

    // Auto-heal shifted columns from Slurm custom/bare sinfo formats
    const stateKeywords = ['idle', 'mixed', 'mix', 'alloc', 'allocated', 'down', 'drain', 'drained', 'draining', 'fail', 'maint', 'resv', 'comp', 'completing'];
    sinfoRows = sinfoRows.map(row => {
      let p = String(row.partition || '').trim();
      let a = String(row.avail || '').trim();
      let t = String(row.timelimit || '').trim();
      let n = String(row.nodes || '').trim();
      let s = String(row.state || '').trim();
      let nl = String(row.nodelist || '').trim();

      if (p.toLowerCase().startsWith('node') || p.includes('[') || p.includes(',')) {
        nl = p;
        n = a || '1';
        p = t || 'compute';
        if (stateKeywords.some(k => String(row.nodes || '').toLowerCase().includes(k))) {
          s = String(row.nodes);
        } else if (stateKeywords.some(k => String(row.state || '').toLowerCase().includes(k))) {
          s = String(row.state);
        } else {
          s = 'idle';
        }
        a = 'up';
        t = 'infinite';
      }

      if (stateKeywords.some(k => n.toLowerCase().includes(k))) {
        const realState = n;
        n = (!isNaN(parseInt(a, 10))) ? a : '1';
        s = realState;
      }

      if (!stateKeywords.some(k => s.toLowerCase().includes(k))) {
        const candidates = [s, n, a, t, nl];
        for (const cand of candidates) {
          if (stateKeywords.some(k => cand.toLowerCase().includes(k))) {
            s = cand;
            break;
          }
        }
      }

      return {
        partition: p || 'compute',
        avail: a || 'up',
        timelimit: t || 'infinite',
        nodes: (!isNaN(parseInt(n, 10))) ? n : '1',
        state: s || 'idle',
        nodelist: nl
      };
    });

    if (el.sinfoTbody) {
      if (sinfoRows.length === 0) {
        el.sinfoTbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-7 text-slate-500">
              <div class="flex flex-col items-center justify-center space-y-1">
                <svg class="w-6 h-6 text-slate-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span class="text-xs font-medium text-slate-400">No partitions parsed from sinfo output.</span>
                <span class="text-[11px] text-slate-500">Toggle "Raw CLI" above to view raw server output.</span>
              </div>
            </td>
          </tr>
        `;
      } else {
        el.sinfoTbody.innerHTML = sinfoRows.map(row => {
          const stateLower = (row.state || 'idle').toLowerCase();
          let stateBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">idle</span>`;
          if (stateLower.includes('mix')) {
            stateBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">mix</span>`;
          } else if (stateLower.includes('alloc')) {
            stateBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">alloc</span>`;
          } else if (stateLower.includes('down') || stateLower.includes('drain')) {
            stateBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950 text-red-300 border border-red-800">${row.state}</span>`;
          }

          return `
            <tr class="hover:bg-slate-800/40 transition">
              <td class="p-2.5 font-semibold text-slate-200">${row.partition}</td>
              <td class="p-2.5 text-emerald-400 font-medium">${row.avail}</td>
              <td class="p-2.5 text-slate-400">${row.timelimit}</td>
              <td class="p-2.5 text-center text-slate-300 font-bold">${row.nodes}</td>
              <td class="p-2.5">${stateBadge}</td>
              <td class="p-2.5 font-bold text-slate-100">${row.nodelist}</td>
            </tr>
          `;
        }).join('');
      }
    }

    let idleCount = 0;
    let allocCount = 0;
    sinfoRows.forEach(r => {
      const num = parseInt(r.nodes, 10) || 1;
      const st = (r.state || '').toLowerCase();
      if (st.includes('idle')) idleCount += num;
      else if (st.includes('alloc') || st.includes('mix')) allocCount += num;
    });
    if (el.sinfoIdleCount) el.sinfoIdleCount.textContent = `${idleCount} Idle`;
    if (el.sinfoAllocCount) el.sinfoAllocCount.textContent = `${allocCount} Allocated`;

    if (el.sinfoRawContainer) {
      let rawText = (live && live.sinfoRaw) ? live.sinfoRaw : '';
      if (!rawText) {
        rawText = 'PARTITION  AVAIL  TIMELIMIT  NODES  STATE NODELIST\n';
        sinfoRows.forEach(r => {
          rawText += `${r.partition.padEnd(11)}${r.avail.padEnd(7)}${r.timelimit.padEnd(11)}${String(r.nodes).padEnd(7)}${r.state.padEnd(6)}${r.nodelist}\n`;
        });
      }
      el.sinfoRawContainer.textContent = rawText.trim();
    }
  }

  // -----------------------------------------------------------
  // 2. RIGHT PANEL: squeue (Active & Queued Batch Jobs)
  // -----------------------------------------------------------
  if (!isLive) {
    if (el.squeueCountBadge) {
      el.squeueCountBadge.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800';
      el.squeueCountBadge.textContent = 'Not Connected';
    }
    if (el.squeueSubtitle) {
      el.squeueSubtitle.textContent = 'Cluster offline • Connect to 10.206.4.128';
    }
    if (el.squeueFooterStatus) {
      el.squeueFooterStatus.textContent = 'Cluster Inactive';
    }
    if (el.squeueTbody) {
      el.squeueTbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-10 text-slate-500">
            <div class="flex flex-col items-center justify-center space-y-2">
              <div class="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center mb-1 border border-slate-700">
                <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.828-15.536a9 9 0 0112.728 0M8.464 15.536a5 5 0 010-7.072m0 0l2.829 2.829" />
                </svg>
              </div>
              <span class="text-xs font-semibold text-slate-300">Not Connected to Cluster</span>
              <span class="text-[11px] text-slate-500 max-w-xs">Slurm queue is inactive. Connect via SSH to stream active batch jobs in real time.</span>
            </div>
          </td>
        </tr>
      `;
    }
    if (el.squeueRawContainer) {
      el.squeueRawContainer.textContent = '[Cluster Not Connected]\nPlease authenticate via the Live Feed button in the header or click "Fetch Live" to connect to 10.206.4.128.';
    }
  } else {
    if (el.squeueSubtitle) {
      el.squeueSubtitle.textContent = 'Active running & queued batch jobs';
    }
    if (el.squeueFooterStatus) {
      el.squeueFooterStatus.textContent = 'Streaming 7s via SSH';
    }

    let squeueRows = (live && Array.isArray(live.squeue))
      ? live.squeue
      : (live && Array.isArray(live.activeJobs))
      ? live.activeJobs
      : [];

    const validStates = ['R', 'PD', 'CG', 'CD', 'CF', 'F', 'TO', 'RUNNING', 'PENDING', 'COMPLETED'];
    squeueRows = squeueRows.map(job => {
      let id = String(job.id || '').trim();
      let part = String(job.partition || '').trim();
      let jName = String(job.job || '').trim();
      let uName = String(job.user || '').trim();
      let st = String(job.state || '').trim().toUpperCase();
      let elap = String(job.elapsed || '').trim();
      let nCnt = String(job.nodes || '').trim();
      let nLst = String(job.nodeList || job.nodelist || '').trim();

      if ((uName.includes('.sh') || uName.includes('.py')) && !validStates.includes(st)) {
        const realUser = st.toLowerCase();
        const realJob = uName;
        uName = realUser;
        jName = realJob;
        st = 'R';
      } else if (!validStates.includes(st) && (st.startsWith('DR_') || st.startsWith('USER') || st.includes('_'))) {
        uName = st.toLowerCase();
        st = 'R';
      }

      return {
        id,
        partition: part || 'compute',
        job: jName || 'batch_job',
        user: uName || 'user',
        state: st || 'R',
        elapsed: elap || '00:00',
        nodes: nCnt || '1',
        nodeList: nLst || '-'
      };
    });

    if (el.squeueTbody) {
      if (!squeueRows || squeueRows.length === 0) {
        el.squeueTbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-7 text-slate-500">
              <div class="flex flex-col items-center justify-center space-y-1">
                <svg class="w-6 h-6 text-slate-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                <span class="text-xs font-medium text-slate-400">Queue is idle. No jobs currently running on cluster.</span>
                <span class="text-[11px] text-slate-500">All 64 cores per node are free for job submissions.</span>
              </div>
            </td>
          </tr>
        `;
      } else {
        el.squeueTbody.innerHTML = squeueRows.map(job => {
          const isRun = (job.state === 'R' || job.state === 'RUNNING');
          const stBadge = isRun
            ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">R</span>`
            : `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">${job.state || 'PD'}</span>`;

          return `
            <tr class="hover:bg-slate-800/40 transition">
              <td class="p-2.5 font-mono text-blue-400 font-semibold">${job.id}</td>
              <td class="p-2.5 text-slate-300">${job.partition || 'compute'}</td>
              <td class="p-2.5 font-medium text-slate-100 max-w-[120px] truncate" title="${job.job || ''}">${job.job || 'batch_job'}</td>
              <td class="p-2.5 text-slate-300 font-mono">${job.user || 'user'}</td>
              <td class="p-2.5 text-center">${stBadge}</td>
              <td class="p-2.5 text-slate-400 font-mono">${job.elapsed || '00:00'}</td>
              <td class="p-2.5 text-center text-slate-300">${job.nodes || '1'}</td>
              <td class="p-2.5 font-bold text-slate-200 font-mono">${job.nodeList || job.nodes || '-'}</td>
            </tr>
          `;
        }).join('');
      }
    }

    if (el.squeueCountBadge) {
      const runCount = squeueRows ? squeueRows.filter(j => j.state === 'R' || j.state === 'RUNNING').length : 0;
      el.squeueCountBadge.textContent = `${runCount} Running`;
      if (runCount > 0) {
        el.squeueCountBadge.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800';
      } else {
        el.squeueCountBadge.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700';
      }
    }

    if (el.squeueRawContainer) {
      let rawText = (live && live.squeueRaw) ? live.squeueRaw : '';
      if (!rawText) {
        if (!squeueRows || squeueRows.length === 0) {
          rawText = 'JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)\n(queue empty - no active jobs)';
        } else {
          rawText = 'JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)\n';
          squeueRows.forEach(j => {
            rawText += `${String(j.id).padEnd(6)}${(j.partition || 'compute').padEnd(14)}${(j.job || 'job').slice(0, 8).padEnd(9)}${(j.user || 'user').slice(0, 8).padEnd(9)}${(j.state || 'R').padEnd(3)}${(j.elapsed || '00:00:00').padEnd(11)}${String(j.nodes || 1).padEnd(6)}${j.nodeList || 'node1'}\n`;
          });
        }
      }
      el.squeueRawContainer.textContent = rawText.trim();
    }
  }
}

function switchView(viewName) {
  state.currentView = viewName;
  if (viewName === 'month') {
    el.monthViewContainer.classList.remove('hidden');
    el.dayViewContainer.classList.add('hidden');
    el.btnViewMonth.className = 'px-3 py-1 rounded-md text-xs font-semibold bg-blue-600 text-white transition';
    el.btnViewDay.className = 'px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition';
    renderMonthCalendar();
  } else {
    el.monthViewContainer.classList.add('hidden');
    el.dayViewContainer.classList.remove('hidden');
    el.btnViewDay.className = 'px-3 py-1 rounded-md text-xs font-semibold bg-blue-600 text-white transition';
    el.btnViewMonth.className = 'px-3 py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition';
    renderDaySlots();
  }
}

function renderMonthCalendar() {
  if (!state.bookingsData) return;

  const nodeMeta = TelemetryService.nodesMetadata[state.currentNode];
  const monthName = CalendarService.getMonthYearLabel(state.currentYear, state.currentMonth);

  if (el.calendarHeaderTitle) el.calendarHeaderTitle.textContent = `Monthly Schedule: ${nodeMeta?.name || state.currentNode}`;
  if (el.calendarNodeSelector) el.calendarNodeSelector.value = state.currentNode;
  if (el.currentMonthDisplay) el.currentMonthDisplay.textContent = monthName;

  const pickerVal = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}`;
  if (el.monthPickerInput) el.monthPickerInput.value = pickerVal;

  const stats = CalendarService.getMonthStats(state.bookingsData, state.currentNode, state.currentYear, state.currentMonth);
  if (el.statMonthTotal) el.statMonthTotal.textContent = `${stats.totalSlots} slots`;
  if (el.statMonthAvail) el.statMonthAvail.textContent = `${stats.availableCount} available`;
  if (el.statMonthBooked) el.statMonthBooked.textContent = `${stats.bookedCount} booked`;
  if (el.statMonthUtil) el.statMonthUtil.textContent = `${stats.utilizationPct}%`;
  if (el.statMonthBar) el.statMonthBar.style.width = `${Math.min(parseFloat(stats.utilizationPct), 100)}%`;

  const days = CalendarService.getMonthGridDays(state.currentYear, state.currentMonth);

  if (el.monthlyCalendarGrid) {
    el.monthlyCalendarGrid.innerHTML = days.map(day => {
      const slots = CalendarService.getSlotsForDate(state.bookingsData, state.currentNode, day.dateStr);
      const bookedSlots = slots.filter(s => s.status === 'Booked');
      const isToday = day.isToday;
      const isCurrent = day.isCurrentMonth;

      const cellBg = !isCurrent ? 'bg-slate-950/40 opacity-40 border-slate-900' :
                     isToday ? 'bg-slate-900 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/60' :
                     'bg-slate-950/80 border-slate-800 hover:border-slate-700';

      return `
        <div class="rounded-xl border p-2 flex flex-col justify-between min-h-[175px] transition-all group ${cellBg}">
          <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80">
            <button class="btn-inspect-day flex items-center space-x-1.5 hover:text-blue-400 transition" data-date="${day.dateStr}" title="Inspect full day slots">
              <span class="text-xs font-bold ${isToday ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center' : isCurrent ? 'text-slate-200' : 'text-slate-500'}">
                ${day.dayNum}
              </span>
              ${isToday ? '<span class="text-[9px] px-1 py-0.2 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800">TODAY</span>' : ''}
            </button>
            <span class="text-[10px] ${bookedSlots.length > 0 ? 'text-blue-400 font-semibold' : 'text-slate-500'}">
              ${bookedSlots.length > 0 ? `${bookedSlots.length} Booked` : 'All Open'}
            </span>
          </div>

          <div class="space-y-1 flex-1 flex flex-col justify-center">
            ${slots.map(slot => {
              const isBooked = slot.status === 'Booked';
              if (isBooked) {
                const details = slot.details || {};
                const nameParts = (escapeHtml(details.bookedBy) || 'Reserved').split(' ');
                const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1]}` : nameParts[0];
                const roleBadge = details.role === 'Student' || details.role === 'Research Scholar / Student' ? '🎓' : details.role === 'Technical / Dept Staff' ? '🛠️' : '👨‍🏫';
                return `
                  <button class="btn-manage-slot w-full text-left p-1 px-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-800/80 hover:border-blue-500 text-blue-200 transition flex items-center justify-between text-[11px] group/slot"
                          data-node="${state.currentNode}" data-date="${day.dateStr}" data-slot="${slot.key}"
                          title="Booked: ${escapeHtml(details.bookedBy)} (${escapeHtml(details.role) || 'User'}) - Click to Modify / Delete">
                    <span class="truncate font-medium flex items-center space-x-1">
                      <span>${roleBadge}</span>
                      <strong class="text-blue-300 font-mono text-[10px]">${slot.shortTime.split('-')[0]}</strong>
                      <span class="truncate ml-1 text-slate-200">${shortName}</span>
                    </span>
                    <span class="text-[9px] text-blue-400 group-hover/slot:text-white font-bold ml-1">EDIT</span>
                  </button>
                `;
              }

              return `
                <button class="btn-book-slot w-full text-left p-1 px-1.5 rounded-lg bg-slate-900/70 hover:bg-emerald-950/40 border border-slate-800/80 hover:border-emerald-500/70 text-slate-400 hover:text-emerald-300 transition flex items-center justify-between text-[11px] group/slot"
                        data-node="${state.currentNode}" data-date="${day.dateStr}" data-slot="${slot.key}"
                        title="Available: ${slot.time} - Click to Book">
                  <span class="flex items-center space-x-1 font-mono text-[10px]">
                    <span>${slot.icon}</span>
                    <span>${slot.shortTime.split('-')[0]}</span>
                  </span>
                  <span class="text-[10px] text-emerald-400 group-hover/slot:text-emerald-300 font-semibold">+ Book</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-inspect-day').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentDayDate = btn.dataset.date;
        switchView('day');
      });
    });

    attachSlotListeners();
  }
}

function renderDaySlots() {
  if (!state.bookingsData) return;

  const nodeMeta = TelemetryService.nodesMetadata[state.currentNode];
  if (el.dayViewDateTitle) el.dayViewDateTitle.textContent = `${CalendarService.getReadableDate(state.currentDayDate)} (${nodeMeta?.name || state.currentNode})`;
  if (el.dayViewDatePicker) el.dayViewDatePicker.value = state.currentDayDate;

  const slots = CalendarService.getSlotsForDate(state.bookingsData, state.currentNode, state.currentDayDate);

  if (el.slotsGrid) {
    el.slotsGrid.innerHTML = slots.map(slot => {
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
                  <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span>${escapeHtml(details.bookedBy) || 'Reserved'}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">${escapeHtml(details.role) || 'Faculty'}</span>
                </div>
                <div class="text-[11px] text-slate-400 pl-5 truncate">${escapeHtml(details.department) || 'Department'} • ${escapeHtml(details.email)}</div>
                <div class="text-[11px] text-blue-400 pl-5 font-mono truncate">Job: ${escapeHtml(details.jobName) || 'Compute Job'}</div>
                <div class="text-[11px] text-slate-500 pl-5 font-mono">Allocation: ${escapeHtml(details.coresRequested) || '64 Cores'}</div>
              </div>
            </div>

            <button class="btn-manage-slot w-full py-2 px-3 rounded-lg text-xs font-semibold bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-800 transition flex items-center justify-center space-x-1"
                    data-node="${state.currentNode}" data-date="${state.currentDayDate}" data-slot="${slot.key}">
              <span>Modify / Delete Booking</span>
            </button>
          </div>
        `;
      }

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
            <p class="text-xs text-slate-400 mb-4">64 Cores available for immediate reservation.</p>
          </div>

          <button class="btn-book-slot w-full py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-1"
                  data-node="${state.currentNode}" data-date="${state.currentDayDate}" data-slot="${slot.key}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            <span>Book This Slot</span>
          </button>
        </div>
      `;
    }).join('');

    attachSlotListeners();
  }
}

function attachSlotListeners() {
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

function openBookingModal(nodeId, dateStr, slotKey) {
  state.activeSlot = { nodeId, dateStr, slotKey };
  const nodeMeta = TelemetryService.nodesMetadata[nodeId];
  if (el.modalSlotDesc) el.modalSlotDesc.textContent = `${nodeMeta ? nodeMeta.name : nodeId} • ${dateStr} • Shift: ${slotKey}`;

  // Update policy notice for shared vs GPU
  const isGpu = nodeId === 'node-7';
  if (el.bookingNodePolicy) {
    if (isGpu) {
      el.bookingNodePolicy.textContent = 'Node 7 is a GPU Compute Node (64 cores + 4x NVIDIA A100 GPUs) for deep learning & CUDA workloads.';
    } else {
      el.bookingNodePolicy.textContent = `${nodeMeta?.name || nodeId} is a Shared Compute Node (64 cores) open to all Faculty Members, Students, and Staff.`;
    }
  }

  const profile = AuthManager.getProfile();
  if (el.inputFacultyName) el.inputFacultyName.value = profile.name || '';
  if (el.inputFacultyRole && profile.role) el.inputFacultyRole.value = profile.role;
  if (el.inputFacultyEmail) el.inputFacultyEmail.value = profile.email || '';
  if (el.inputFacultyDept) el.inputFacultyDept.value = 'Chemical Engineering';
  if (el.inputJobName) el.inputJobName.value = '';
  if (el.inputResources) el.inputResources.value = `Full 64 Cores`;

  if (el.bookingModal) el.bookingModal.classList.remove('hidden');
}

function closeBookingModal() {
  if (el.bookingModal) el.bookingModal.classList.add('hidden');
  state.activeSlot = null;
}

// -------------------------------------------------------------
// Real-Time Cross-Faculty Sync Prompt & Handlers
// -------------------------------------------------------------
let pendingSyncAction = null;

function openSyncPromptModal(action) {
  pendingSyncAction = action;
  if (el.promptSyncToken) el.promptSyncToken.value = '';
  if (el.syncPromptModal) el.syncPromptModal.classList.remove('hidden');
}

function closeSyncPromptModal() {
  if (el.syncPromptModal) el.syncPromptModal.classList.add('hidden');
  pendingSyncAction = null;
}

async function handlePromptSaveSync() {
  const token = el.promptSyncToken ? el.promptSyncToken.value.trim() : '';
  if (!token) {
    showToast('Please enter a GitHub PAT token to enable sync.', 'error');
    return;
  }

  const current = AuthManager.getConfig();
  current.token = token;
  AuthManager.saveConfig(current);
  updateSyncPill();
  showToast('Department Sync Token saved & connected!', 'success');

  const action = pendingSyncAction;
  closeSyncPromptModal();

  if (action && typeof action.execute === 'function') {
    await action.execute();
  }
}

function handlePromptLocalOnly() {
  const action = pendingSyncAction;
  closeSyncPromptModal();
  if (action && typeof action.fallbackLocal === 'function') {
    action.fallbackLocal();
  }
}

function handleCopyShareLink() {
  const config = AuthManager.getConfig();
  const tokenToUse = (el.inputSettingsToken && el.inputSettingsToken.value.trim()) || config.token;
  if (!tokenToUse) {
    showToast('Please enter and save a GitHub PAT token first before copying the invite link.', 'warning');
    if (el.inputSettingsToken) el.inputSettingsToken.focus();
    return;
  }

  const owner = (el.inputSettingsOwner && el.inputSettingsOwner.value.trim()) || config.owner || AuthManager.getDefaultOwner();
  const repo = (el.inputSettingsRepo && el.inputSettingsRepo.value.trim()) || config.repo || AuthManager.getDefaultRepo();
  const branch = (el.inputSettingsBranch && el.inputSettingsBranch.value.trim()) || config.branch || 'main';

  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = `${baseUrl}#token=${encodeURIComponent(tokenToUse)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`;

  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast('✓ One-Click Faculty Invite Link copied! Share this link with faculty.', 'success');
  }).catch(() => {
    window.prompt('Copy this One-Click Faculty Invite Link:', shareUrl);
  });
}

async function executeBooking(nodeId, dateStr, slotKey, facultyInfo) {
  if (el.submitBtnSpinner) el.submitBtnSpinner.classList.remove('hidden');
  if (el.submitBtnLabel) el.submitBtnLabel.textContent = 'Syncing to GitHub...';
  if (el.modalSubmitBtn) el.modalSubmitBtn.disabled = true;

  try {
    const updated = CalendarService.applyBooking(state.bookingsData, nodeId, dateStr, slotKey, facultyInfo);
    const commitMsg = `Book slot: ${nodeId} (${dateStr} ${slotKey}) for ${facultyInfo.name} (${facultyInfo.role})`;
    const result = await GitHubApi.updateBookings(updated, commitMsg);

    state.bookingsData = result.data || updated;
    closeBookingModal();
    renderMonthCalendar();
    renderDaySlots();
    renderTelemetry();

    if (result.source === 'github') {
      showToast(`Slot reserved on ${nodeId} & synced to GitHub!`, 'success');
    } else {
      showToast(`Slot reserved on ${nodeId} (Local mode)!`, 'info');
    }
  } catch (err) {
    showToast(`Booking error: ${err.message}`, 'error');
  } finally {
    if (el.submitBtnSpinner) el.submitBtnSpinner.classList.add('hidden');
    if (el.submitBtnLabel) el.submitBtnLabel.textContent = 'Confirm Reservation';
    if (el.modalSubmitBtn) el.modalSubmitBtn.disabled = false;
  }
}

function executeBookingLocalOnly(nodeId, dateStr, slotKey, facultyInfo) {
  const updated = CalendarService.applyBooking(state.bookingsData, nodeId, dateStr, slotKey, facultyInfo);
  try {
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(updated));
  } catch {}
  state.bookingsData = updated;
  closeBookingModal();
  renderMonthCalendar();
  renderDaySlots();
  renderTelemetry();
  renderCoreTelemetryPanel();
  showToast(`⚠️ Reserved locally only. Other faculty will not see this booking!`, 'warning');
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  if (!state.activeSlot) return;

  const { nodeId, dateStr, slotKey } = state.activeSlot;
  const facultyInfo = {
    name: el.inputFacultyName.value.trim(),
    role: el.inputFacultyRole ? el.inputFacultyRole.value : 'Faculty Member',
    email: el.inputFacultyEmail.value.trim(),
    department: el.inputFacultyDept.value,
    jobName: el.inputJobName.value.trim(),
    coresRequested: el.inputResources.value.trim() || '64 Cores'
  };

  AuthManager.saveProfile({
    name: facultyInfo.name,
    role: facultyInfo.role,
    email: facultyInfo.email,
    department: facultyInfo.department
  });

  const config = AuthManager.getConfig();
  if (!config.token) {
    openSyncPromptModal({
      execute: async () => {
        await executeBooking(nodeId, dateStr, slotKey, facultyInfo);
      },
      fallbackLocal: () => {
        executeBookingLocalOnly(nodeId, dateStr, slotKey, facultyInfo);
      }
    });
    return;
  }

  await executeBooking(nodeId, dateStr, slotKey, facultyInfo);
}

function openManageModal(nodeId, dateStr, slotKey) {
  const slots = CalendarService.getSlotsForDate(state.bookingsData, nodeId, dateStr);
  const slot = slots.find(s => s.key === slotKey);
  const details = slot?.details || {};

  state.activeSlot = { nodeId, dateStr, slotKey, details };
  const nodeMeta = TelemetryService.nodesMetadata[nodeId];

  if (el.manageSlotDesc) el.manageSlotDesc.textContent = `${nodeMeta ? nodeMeta.name : nodeId} • ${dateStr} • Shift: ${slotKey}`;
  if (el.manageBookedAt) el.manageBookedAt.textContent = details.bookedAt ? new Date(details.bookedAt).toLocaleString() : 'N/A';
  if (el.manageModifiedAt) el.manageModifiedAt.textContent = details.modifiedAt ? new Date(details.modifiedAt).toLocaleString() : 'Original Booking';

  if (el.modifyFacultyName) el.modifyFacultyName.value = details.bookedBy || '';
  if (el.modifyFacultyRole && details.role) el.modifyFacultyRole.value = details.role;
  if (el.modifyFacultyEmail) el.modifyFacultyEmail.value = details.email || '';
  if (el.modifyFacultyDept) el.modifyFacultyDept.value = 'Chemical Engineering';
  if (el.modifyJobName) el.modifyJobName.value = details.jobName || '';
  if (el.modifyResources) el.modifyResources.value = details.coresRequested || '64 Cores';

  if (el.manageSlurmCmd) el.manageSlurmCmd.textContent = `sbatch -w ${nodeId} -c 64 --job-name="${sanitizeJobName(details.jobName)}" job.sh`;
  if (el.manageModal) el.manageModal.classList.remove('hidden');
}

function closeManageModal() {
  if (el.manageModal) el.manageModal.classList.add('hidden');
  state.activeSlot = null;
}

async function executeModify(nodeId, dateStr, slotKey, updatedInfo) {
  if (el.modifySpinner) el.modifySpinner.classList.remove('hidden');
  if (el.modifyLabel) el.modifyLabel.textContent = 'Syncing Changes...';
  if (el.btnSaveModify) el.btnSaveModify.disabled = true;

  try {
    const updated = CalendarService.modifyBooking(state.bookingsData, nodeId, dateStr, slotKey, updatedInfo);
    const commitMsg = `Modify booking: ${nodeId} (${dateStr} ${slotKey}) for ${updatedInfo.name}`;
    const result = await GitHubApi.updateBookings(updated, commitMsg);

    state.bookingsData = result.data || updated;
    closeManageModal();
    renderMonthCalendar();
    renderDaySlots();
    renderTelemetry();

    if (result.source === 'github') {
      showToast(`Reservation modified & synced to GitHub!`, 'success');
    } else {
      showToast(`Reservation updated locally!`, 'info');
    }
  } catch (err) {
    showToast(`Modification error: ${err.message}`, 'error');
  } finally {
    if (el.modifySpinner) el.modifySpinner.classList.add('hidden');
    if (el.modifyLabel) el.modifyLabel.textContent = 'Save Modifications';
    if (el.btnSaveModify) el.btnSaveModify.disabled = false;
  }
}

function executeModifyLocalOnly(nodeId, dateStr, slotKey, updatedInfo) {
  const updated = CalendarService.modifyBooking(state.bookingsData, nodeId, dateStr, slotKey, updatedInfo);
  try {
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(updated));
  } catch {}
  state.bookingsData = updated;
  closeManageModal();
  renderMonthCalendar();
  renderDaySlots();
  renderTelemetry();
  renderCoreTelemetryPanel();
  showToast(`⚠️ Modified locally only. Not synced with other faculty!`, 'warning');
}

async function handleModifySubmit(e) {
  e.preventDefault();
  if (!state.activeSlot) return;

  const { nodeId, dateStr, slotKey } = state.activeSlot;
  const updatedInfo = {
    name: el.modifyFacultyName.value.trim(),
    role: el.modifyFacultyRole ? el.modifyFacultyRole.value : 'Faculty Member',
    email: el.modifyFacultyEmail.value.trim(),
    department: el.modifyFacultyDept.value,
    jobName: el.modifyJobName.value.trim(),
    coresRequested: el.modifyResources.value.trim() || '64 Cores'
  };

  const config = AuthManager.getConfig();
  if (!config.token) {
    openSyncPromptModal({
      execute: async () => {
        await executeModify(nodeId, dateStr, slotKey, updatedInfo);
      },
      fallbackLocal: () => {
        executeModifyLocalOnly(nodeId, dateStr, slotKey, updatedInfo);
      }
    });
    return;
  }

  await executeModify(nodeId, dateStr, slotKey, updatedInfo);
}

async function executeDelete(nodeId, dateStr, slotKey) {
  try {
    const updated = CalendarService.applyCancellation(state.bookingsData, nodeId, dateStr, slotKey);
    const commitMsg = `Release/Delete booking: ${nodeId} (${dateStr} ${slotKey})`;
    const result = await GitHubApi.updateBookings(updated, commitMsg);

    state.bookingsData = result.data || updated;
    closeManageModal();
    renderMonthCalendar();
    renderDaySlots();
    renderTelemetry();

    if (result.source === 'github') {
      showToast(`Reservation deleted & slot released on GitHub!`, 'success');
    } else {
      showToast(`Reservation deleted locally!`, 'info');
    }
  } catch (err) {
    showToast(`Deletion error: ${err.message}`, 'error');
  }
}

function executeDeleteLocalOnly(nodeId, dateStr, slotKey) {
  const updated = CalendarService.applyCancellation(state.bookingsData, nodeId, dateStr, slotKey);
  try {
    localStorage.setItem(STORAGE_KEY_BOOKINGS, JSON.stringify(updated));
  } catch {}
  state.bookingsData = updated;
  closeManageModal();
  renderMonthCalendar();
  renderDaySlots();
  renderTelemetry();
  renderCoreTelemetryPanel();
  showToast(`⚠️ Slot released locally only. Not synced with other faculty!`, 'warning');
}

async function handleDeleteSlot() {
  if (!state.activeSlot) return;

  const { nodeId, dateStr, slotKey } = state.activeSlot;
  const confirmed = window.confirm(`Release the ${slotKey} reservation on ${dateStr} for ${nodeId}?\nThis will make the slot available for others.`);
  if (!confirmed) return;

  const config = AuthManager.getConfig();
  if (!config.token) {
    openSyncPromptModal({
      execute: async () => {
        await executeDelete(nodeId, dateStr, slotKey);
      },
      fallbackLocal: () => {
        executeDeleteLocalOnly(nodeId, dateStr, slotKey);
      }
    });
    return;
  }

  await executeDelete(nodeId, dateStr, slotKey);
}

function handleCopySlurm() {
  const cmd = el.manageSlurmCmd.textContent;
  navigator.clipboard.writeText(cmd).then(() => {
    showToast('Copied Slurm launch command!', 'info');
  }).catch(() => {
    showToast('Select and copy command manually.', 'error');
  });
}

function openSettingsModal() {
  const config = AuthManager.getConfig();
  const profile = AuthManager.getProfile();

  let owner = config.owner || AuthManager.getDefaultOwner();
  let repo = config.repo || AuthManager.getDefaultRepo();

  if (owner.toLowerCase() === 'nikhilesh') owner = 'nikhilesh-glitch';
  if (repo.toLowerCase().includes('hpc') && (repo.includes(' ') || repo.toLowerCase() === 'hpc-slot-booking')) {
    repo = 'HPC-Cluster-Slot-booking';
  }

  if (el.inputSettingsToken) el.inputSettingsToken.value = config.token;
  if (el.inputSettingsOwner) el.inputSettingsOwner.value = owner;
  if (el.inputSettingsRepo) el.inputSettingsRepo.value = repo;
  if (el.inputSettingsBranch) el.inputSettingsBranch.value = config.branch || 'main';
  if (el.inputSettingsPath) el.inputSettingsPath.value = config.filePath || 'bookings.json';
  if (el.inputProfileName) el.inputProfileName.value = profile.name || '';
  if (el.inputProfileEmail) el.inputProfileEmail.value = profile.email || '';

  if (el.settingsStatusBox) el.settingsStatusBox.classList.add('hidden');
  if (el.settingsModal) el.settingsModal.classList.remove('hidden');
}

async function handleTestConnection() {
  const token = el.inputSettingsToken.value.trim();
  let owner = el.inputSettingsOwner.value.trim() || AuthManager.getDefaultOwner();
  let repo = el.inputSettingsRepo.value.trim() || AuthManager.getDefaultRepo();

  if (!token) {
    el.settingsStatusBox.className = 'p-3 rounded-lg text-xs bg-amber-950/70 border border-amber-800 text-amber-200 block';
    el.settingsStatusBox.textContent = 'Please paste your GitHub Personal Access Token (PAT) before testing.';
    return;
  }

  el.settingsStatusBox.className = 'p-3 rounded-lg text-xs bg-blue-950/70 border border-blue-800 text-blue-200 block';
  el.settingsStatusBox.textContent = 'Testing connection with GitHub REST API...';

  const res = await AuthManager.testConnection(token, owner, repo);
  if (res.success) {
    if (res.correctedOwner) el.inputSettingsOwner.value = res.correctedOwner;
    if (res.correctedRepo) el.inputSettingsRepo.value = res.correctedRepo;

    AuthManager.saveConfig({
      token,
      owner: res.correctedOwner || owner,
      repo: res.correctedRepo || repo,
      branch: el.inputSettingsBranch.value || 'main',
      filePath: el.inputSettingsPath.value || 'bookings.json'
    });
    updateSyncPill();

    el.settingsStatusBox.className = 'p-3 rounded-lg text-xs bg-emerald-950/70 border border-emerald-800 text-emerald-200 block';
    el.settingsStatusBox.innerHTML = `✓ Authenticated as <strong>@${res.user}</strong>. Access to <strong>${res.repoFullName}</strong> verified! Real-time sync ready.`;
  } else {
    el.settingsStatusBox.className = 'p-3 rounded-lg text-xs bg-red-950/70 border border-red-800 text-red-200 block';
    el.settingsStatusBox.innerHTML = `⚠ Connection Failed: ${res.error}`;
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault();

  let owner = (el.inputSettingsOwner.value || '').trim();
  let repo = (el.inputSettingsRepo.value || '').trim();

  // Clean common typos
  owner = owner.replace(/\s+/g, '-');
  repo = repo.replace(/\s+/g, '-');
  if (owner.toLowerCase() === 'nikhilesh') owner = 'nikhilesh-glitch';
  if (repo.toLowerCase() === 'hpc-slot-booking' || repo.toLowerCase() === 'hpc slot booking' || !repo) {
    repo = 'HPC-Cluster-Slot-booking';
  }

  AuthManager.saveConfig({
    token: el.inputSettingsToken.value,
    owner: owner || AuthManager.getDefaultOwner(),
    repo: repo || AuthManager.getDefaultRepo(),
    branch: el.inputSettingsBranch.value || 'main',
    filePath: el.inputSettingsPath.value || 'bookings.json'
  });

  AuthManager.saveProfile({
    name: el.inputProfileName.value.trim(),
    email: el.inputProfileEmail.value.trim()
  });

  updateSyncPill();
  if (el.settingsModal) el.settingsModal.classList.add('hidden');
  showToast('Settings saved successfully!', 'info');

  await loadBookings(true);
}

function handleClearSettings() {
  if (window.confirm('Clear stored GitHub PAT and repository settings?')) {
    AuthManager.clearConfig();
    updateSyncPill();
    if (el.settingsModal) el.settingsModal.classList.add('hidden');
    showToast('GitHub credentials cleared. App is in Local Mode.', 'info');
  }
}

async function loadBookings(showToastNotification = false) {
  try {
    const res = await GitHubApi.getBookings();
    state.bookingsData = res.data;
    if (showToastNotification) {
      showToast(`Refreshed bookings via ${res.source.replace('_', ' ')}!`, 'info');
    }
  } catch (err) {
    console.warn('Load bookings warning:', err);
    if (!state.bookingsData) {
      state.bookingsData = DEFAULT_BOOKINGS;
    }
  }
  renderMonthCalendar();
  renderDaySlots();
  renderTelemetry();
  renderCoreTelemetryPanel();
}

// -------------------------------------------------------------
// Cluster SSH Live Feed Controller (10.206.4.128 - 7s Refresh)
// -------------------------------------------------------------
function openSshModal() {
  if (!el.sshModal) return;
  if (el.inputSshHost) el.inputSshHost.value = sshState.host || '10.206.4.128';
  if (el.inputSshPort) el.inputSshPort.value = sshState.port || 22;
  if (el.inputSshBridgeUrl) el.inputSshBridgeUrl.value = sshState.bridgeUrl || 'http://localhost:8080';
  if (el.inputSshUser) el.inputSshUser.value = sshState.username || '';
  
  if (sshState.connected) {
    if (el.sshStatusBox) {
      el.sshStatusBox.className = 'p-3 rounded-lg text-xs bg-emerald-950/70 border border-emerald-800 text-emerald-200 block';
      el.sshStatusBox.innerHTML = `✓ Active SSH session to <strong>${sshState.username}@${sshState.host}</strong>. Telemetry streaming every 7 seconds.`;
    }
    if (el.btnDisconnectSsh) el.btnDisconnectSsh.classList.remove('hidden');
    if (el.sshBtnLabel) el.sshBtnLabel.textContent = 'Reconnect / Update';
  } else {
    if (el.sshStatusBox) {
      el.sshStatusBox.className = 'p-3 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-300 block';
      el.sshStatusBox.innerHTML = `Connect to cluster at <strong>10.206.4.128:22</strong> via local telemetry bridge (<code class="text-blue-400">telemetry-bridge.py</code>). Streams every 7 seconds.`;
    }
    if (el.btnDisconnectSsh) el.btnDisconnectSsh.classList.add('hidden');
    if (el.sshBtnLabel) el.sshBtnLabel.textContent = 'Connect & Stream (7s)';
  }
  el.sshModal.classList.remove('hidden');
}

function closeSshModal() {
  if (el.sshModal) el.sshModal.classList.add('hidden');
}

async function fetchLiveClusterTelemetry() {
  if (!sshState.connected) return;
  try {
    const res = await fetch(`${sshState.bridgeUrl}/api/telemetry`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.connected) {
      sshState.liveTelemetry = data;
      renderTelemetry();
      if (el.sshFeedIndicator) {
        el.sshFeedIndicator.className = 'h-2 w-2 rounded-full bg-emerald-400 animate-pulse';
      }
      if (el.sshFeedLabel) {
        el.sshFeedLabel.textContent = `SSH: ${sshState.username}@${sshState.host} (7s)`;
      }
    } else {
      console.warn('Telemetry bridge reports disconnected:', data.error);
      sshState.connected = false;
      sshState.liveTelemetry = null;
      if (el.sshFeedIndicator) {
        el.sshFeedIndicator.className = 'h-2 w-2 rounded-full bg-amber-500';
      }
      if (el.sshFeedLabel) {
        el.sshFeedLabel.textContent = 'SSH Disconnected';
      }
      renderTelemetry();
    }
  } catch (err) {
    console.warn('Fetch live cluster telemetry error:', err.message);
    if (el.sshFeedIndicator) {
      el.sshFeedIndicator.className = 'h-2 w-2 rounded-full bg-red-500';
    }
    if (el.sshFeedLabel) {
      el.sshFeedLabel.textContent = 'SSH Bridge Offline';
    }
  }
}

async function handleSshSubmit(e) {
  e.preventDefault();
  const host = el.inputSshHost.value.trim() || '10.206.4.128';
  const port = parseInt(el.inputSshPort.value, 10) || 22;
  const username = el.inputSshUser.value.trim();
  const password = el.inputSshPassword.value;
  const bridgeUrl = (el.inputSshBridgeUrl.value.trim() || 'http://localhost:8080').replace(/\/$/, '');

  if (!username || !password) {
    if (el.sshStatusBox) {
      el.sshStatusBox.className = 'p-3 rounded-lg text-xs bg-amber-950/70 border border-amber-800 text-amber-200 block';
      el.sshStatusBox.textContent = 'Please enter both cluster SSH username and password.';
    }
    return;
  }

  // Show loading
  if (el.sshSpinner) el.sshSpinner.classList.remove('hidden');
  if (el.sshBtnLabel) el.sshBtnLabel.textContent = 'Connecting...';
  if (el.btnSubmitSsh) el.btnSubmitSsh.disabled = true;

  if (el.sshStatusBox) {
    el.sshStatusBox.className = 'p-3 rounded-lg text-xs bg-blue-950/70 border border-blue-800 text-blue-200 block';
    el.sshStatusBox.textContent = `Connecting to ${username}@${host}:${port} via bridge at ${bridgeUrl}...`;
  }

  try {
    const res = await fetch(`${bridgeUrl}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, port, username, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to establish SSH connection.');
    }

    sshState.host = host;
    sshState.port = port;
    sshState.username = username;
    sshState.bridgeUrl = bridgeUrl;
    sshState.connected = true;

    if (el.sshStatusBox) {
      el.sshStatusBox.className = 'p-3 rounded-lg text-xs bg-emerald-950/70 border border-emerald-800 text-emerald-200 block';
      el.sshStatusBox.innerHTML = `✓ Connected to <strong>${username}@${host}</strong>! Streaming live metrics every 7 seconds.`;
    }

    if (el.sshFeedIndicator) {
      el.sshFeedIndicator.className = 'h-2 w-2 rounded-full bg-emerald-400 animate-pulse';
    }
    if (el.sshFeedLabel) {
      el.sshFeedLabel.textContent = `SSH: ${username}@${host} (7s)`;
    }

    showToast(`Connected to cluster ${host} (7s refresh)`, 'success');

    // Trigger immediate telemetry fetch
    await fetchLiveClusterTelemetry();

    setTimeout(() => {
      closeSshModal();
    }, 1200);

  } catch (err) {
    sshState.connected = false;
    sshState.liveTelemetry = null;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:' && bridgeUrl.startsWith('http://');
    let helpHtml = `<span class="text-[11px] text-slate-400">1. Ensure you ran <code>python telemetry-bridge.py</code> locally on your machine.<br>2. Ensure you are connected to Campus Wi-Fi / VPN to reach ${host}.</span>`;
    if (isHttps) {
      helpHtml += `
      <div class="mt-2 p-2 rounded bg-amber-950/70 border border-amber-800 text-[11px] text-amber-200 text-left">
        <strong>⚠️ Browser Mixed-Content Restriction:</strong><br>
        Because this portal runs on HTTPS, browsers block background calls to local <code>http://localhost</code> by default.<br>
        <div class="mt-1 font-mono text-[10.5px] text-amber-100">
          Fix: Click the site settings/lock icon in your browser URL bar &rarr; <em>Site settings</em> &rarr; set <strong>Insecure content</strong> to <strong>Allow</strong> &rarr; Refresh page.
        </div>
      </div>`;
    }
    if (el.sshStatusBox) {
      el.sshStatusBox.className = 'p-3 rounded-lg text-xs bg-red-950/70 border border-red-800 text-red-200 block';
      el.sshStatusBox.innerHTML = `⚠ Connection Failed: <strong>${err.message}</strong><br>${helpHtml}`;
    }
    if (el.sshFeedIndicator) {
      el.sshFeedIndicator.className = 'h-2 w-2 rounded-full bg-red-500';
    }
    if (el.sshFeedLabel) {
      el.sshFeedLabel.textContent = 'SSH Disconnected';
    }
    showToast(`SSH Error: ${err.message}`, 'error');
  } finally {
    if (el.sshSpinner) el.sshSpinner.classList.add('hidden');
    if (el.sshBtnLabel) el.sshBtnLabel.textContent = sshState.connected ? 'Reconnect / Update' : 'Connect & Stream (7s)';
    if (el.btnSubmitSsh) el.btnSubmitSsh.disabled = false;
  }
}

async function handleSshDisconnect() {
  try {
    await fetch(`${sshState.bridgeUrl}/api/disconnect`, { method: 'POST' });
  } catch (e) {
    // Ignore network errors on disconnect
  }
  sshState.connected = false;
  sshState.liveTelemetry = null;
  if (el.sshFeedIndicator) {
    el.sshFeedIndicator.className = 'h-2 w-2 rounded-full bg-slate-500';
  }
  if (el.sshFeedLabel) {
    el.sshFeedLabel.textContent = 'Live Feed: 10.206.4.128';
  }
  if (el.sshStatusBox) {
    el.sshStatusBox.className = 'p-3 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-300 block';
    el.sshStatusBox.textContent = 'Disconnected from cluster SSH.';
  }
  if (el.btnDisconnectSsh) el.btnDisconnectSsh.classList.add('hidden');
  showToast('Disconnected from cluster SSH.', 'info');
  renderTelemetry();
}

async function handleFetchSinfo() {
  if (!sshState.connected) {
    showToast('Please connect to Cluster SSH first.', 'error');
    openSshModal();
    return;
  }

  if (el.sinfoFetchLabel) el.sinfoFetchLabel.textContent = 'Fetching...';
  if (el.sinfoFetchIcon) el.sinfoFetchIcon.classList.add('animate-spin');

  try {
    let sinfoData = null;
    let sinfoRaw = '';

    // 1. Try dedicated endpoint /api/sinfo
    try {
      const res = await fetch(`${sshState.bridgeUrl}/api/sinfo`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          sinfoData = json.data;
          sinfoRaw = json.raw || '';
        }
      }
    } catch (e) {
      // Fall through to /api/telemetry
    }

    // 2. Fallback to /api/telemetry if /api/sinfo was not available on running bridge
    if (!sinfoData) {
      const res = await fetch(`${sshState.bridgeUrl}/api/telemetry`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.connected) throw new Error(json.error || 'SSH not connected');
      sshState.liveTelemetry = json;
      sinfoData = json.sinfo || [];
      sinfoRaw = json.sinfoRaw || '';
    }

    if (!sshState.liveTelemetry) sshState.liveTelemetry = {};
    sshState.liveTelemetry.sinfo = sinfoData;
    sshState.liveTelemetry.sinfoRaw = sinfoRaw;
    renderSinfoAndSqueue();
    showToast(`Live sinfo retrieved: ${sinfoData.length} partition entries from 10.206.4.128`, 'success');
  } catch (err) {
    console.error('Fetch sinfo error:', err);
    showToast(`Fetch sinfo failed: ${err.message}`, 'error');
    if (el.sinfoRawContainer) {
      el.sinfoRawContainer.textContent = `[Error executing sinfo on ${sshState.host}]: ${err.message}\nMake sure to restart telemetry-bridge.py: python telemetry-bridge.py`;
    }
  } finally {
    if (el.sinfoFetchLabel) el.sinfoFetchLabel.textContent = 'Fetch Live';
    if (el.sinfoFetchIcon) el.sinfoFetchIcon.classList.remove('animate-spin');
  }
}

async function handleFetchSqueue() {
  if (!sshState.connected) {
    showToast('Please connect to Cluster SSH first.', 'error');
    openSshModal();
    return;
  }

  if (el.squeueFetchLabel) el.squeueFetchLabel.textContent = 'Fetching...';
  if (el.squeueFetchIcon) el.squeueFetchIcon.classList.add('animate-spin');

  try {
    let squeueData = null;
    let squeueRaw = '';

    // 1. Try dedicated endpoint /api/squeue
    try {
      const res = await fetch(`${sshState.bridgeUrl}/api/squeue`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          squeueData = json.data;
          squeueRaw = json.raw || '';
        }
      }
    } catch (e) {
      // Fall through to /api/telemetry
    }

    // 2. Fallback to /api/telemetry if /api/squeue was not available on running bridge
    if (!squeueData) {
      const res = await fetch(`${sshState.bridgeUrl}/api/telemetry`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.connected) throw new Error(json.error || 'SSH not connected');
      sshState.liveTelemetry = json;
      squeueData = json.squeue || json.activeJobs || [];
      squeueRaw = json.squeueRaw || '';
    }

    if (!sshState.liveTelemetry) sshState.liveTelemetry = {};
    sshState.liveTelemetry.squeue = squeueData;
    sshState.liveTelemetry.squeueRaw = squeueRaw;
    renderSinfoAndSqueue();
    showToast(`Live squeue retrieved: ${squeueData.length} active jobs from 10.206.4.128`, 'success');
  } catch (err) {
    console.error('Fetch squeue error:', err);
    showToast(`Fetch squeue failed: ${err.message}`, 'error');
    if (el.squeueRawContainer) {
      el.squeueRawContainer.textContent = `[Error executing squeue on ${sshState.host}]: ${err.message}\nMake sure to restart telemetry-bridge.py: python telemetry-bridge.py`;
    }
  } finally {
    if (el.squeueFetchLabel) el.squeueFetchLabel.textContent = 'Fetch Live';
    if (el.squeueFetchIcon) el.squeueFetchIcon.classList.remove('animate-spin');
  }
}

function setupEvents() {
  // Calendar Node Selector Dropdown
  if (el.calendarNodeSelector) {
    el.calendarNodeSelector.value = state.currentNode;
    el.calendarNodeSelector.addEventListener('change', (e) => {
      state.currentNode = e.target.value;
      renderMonthCalendar();
      renderDaySlots();
      renderSinfoAndSqueue();
      renderCoreTelemetryPanel();
    });
  }

  // Quick Node Switcher Pills in Core Monitor Panel
  document.querySelectorAll('.core-node-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const selected = e.currentTarget.getAttribute('data-node');
      if (selected && selected !== state.currentNode) {
        state.currentNode = selected;
        if (el.calendarNodeSelector) el.calendarNodeSelector.value = selected;
        renderMonthCalendar();
        renderDaySlots();
        renderSinfoAndSqueue();
        renderCoreTelemetryPanel();
      }
    });
  });

  // SINFO & SQUEUE Fetch Live Buttons
  if (el.btnFetchSinfo) el.btnFetchSinfo.addEventListener('click', handleFetchSinfo);
  if (el.btnFetchSqueue) el.btnFetchSqueue.addEventListener('click', handleFetchSqueue);

  // Month navigation
  if (el.btnPrevMonth) {
    el.btnPrevMonth.addEventListener('click', () => {
      if (state.currentMonth === 0) {
        state.currentMonth = 11;
        state.currentYear--;
      } else {
        state.currentMonth--;
      }
      renderMonthCalendar();
    });
  }

  if (el.btnNextMonth) {
    el.btnNextMonth.addEventListener('click', () => {
      if (state.currentMonth === 11) {
        state.currentMonth = 0;
        state.currentYear++;
      } else {
        state.currentMonth++;
      }
      renderMonthCalendar();
    });
  }

  if (el.btnMonthToday) {
    el.btnMonthToday.addEventListener('click', () => {
      const today = new Date();
      state.currentYear = today.getFullYear();
      state.currentMonth = today.getMonth();
      state.currentDayDate = CalendarService.formatDate(today);
      renderMonthCalendar();
    });
  }

  if (el.monthPickerInput) {
    el.monthPickerInput.addEventListener('change', (e) => {
      if (e.target.value) {
        const [y, m] = e.target.value.split('-').map(Number);
        state.currentYear = y;
        state.currentMonth = m - 1;
        renderMonthCalendar();
      }
    });
  }

  // View Toggle
  if (el.btnViewMonth) el.btnViewMonth.addEventListener('click', () => switchView('month'));
  if (el.btnViewDay) el.btnViewDay.addEventListener('click', () => switchView('day'));
  if (el.btnBackToMonth) el.btnBackToMonth.addEventListener('click', () => switchView('month'));

  // Day View nav
  if (el.btnDayPrev) {
    el.btnDayPrev.addEventListener('click', () => {
      const [y, m, d] = state.currentDayDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() - 1);
      state.currentDayDate = CalendarService.formatDate(date);
      renderDaySlots();
    });
  }

  if (el.btnDayNext) {
    el.btnDayNext.addEventListener('click', () => {
      const [y, m, d] = state.currentDayDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + 1);
      state.currentDayDate = CalendarService.formatDate(date);
      renderDaySlots();
    });
  }

  if (el.dayViewDatePicker) {
    el.dayViewDatePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        state.currentDayDate = e.target.value;
        renderDaySlots();
      }
    });
  }

  // Refresh
  if (el.btnRefresh) {
    el.btnRefresh.addEventListener('click', async () => {
      showToast('Refreshing bookings from GitHub...', 'info');
      await loadBookings(true);
    });
  }

  // Settings
  if (el.btnOpenSettings) el.btnOpenSettings.addEventListener('click', openSettingsModal);
  if (el.syncStatusBtn) el.syncStatusBtn.addEventListener('click', openSettingsModal);
  if (el.settingsCloseBtn) el.settingsCloseBtn.addEventListener('click', () => el.settingsModal.classList.add('hidden'));
  if (el.settingsForm) el.settingsForm.addEventListener('submit', handleSettingsSubmit);
  if (el.btnTestConnection) el.btnTestConnection.addEventListener('click', handleTestConnection);
  if (el.btnClearSettings) el.btnClearSettings.addEventListener('click', handleClearSettings);
  if (el.btnCopyShareLink) el.btnCopyShareLink.addEventListener('click', handleCopyShareLink);

  // Sync Prompt Modal Events
  if (el.btnPromptSaveSync) el.btnPromptSaveSync.addEventListener('click', handlePromptSaveSync);
  if (el.btnPromptLocalOnly) el.btnPromptLocalOnly.addEventListener('click', handlePromptLocalOnly);
  if (el.btnPromptCancel) el.btnPromptCancel.addEventListener('click', closeSyncPromptModal);

  // Cluster SSH Modal Events (10.206.4.128)
  if (el.btnClusterSsh) el.btnClusterSsh.addEventListener('click', openSshModal);
  if (el.sshCloseBtn) el.sshCloseBtn.addEventListener('click', closeSshModal);
  if (el.btnCloseSsh) el.btnCloseSsh.addEventListener('click', closeSshModal);
  if (el.sshLoginForm) el.sshLoginForm.addEventListener('submit', handleSshSubmit);
  if (el.btnDisconnectSsh) el.btnDisconnectSsh.addEventListener('click', handleSshDisconnect);

  // SINFO & SQUEUE Panel View Toggles
  if (el.btnToggleSinfoView) {
    let sinfoRawMode = false;
    el.btnToggleSinfoView.addEventListener('click', () => {
      sinfoRawMode = !sinfoRawMode;
      if (sinfoRawMode) {
        el.sinfoTableContainer.classList.add('hidden');
        el.sinfoRawContainer.classList.remove('hidden');
        el.btnToggleSinfoView.textContent = 'Table View';
        el.btnToggleSinfoView.className = 'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-emerald-600 text-white transition';
      } else {
        el.sinfoTableContainer.classList.remove('hidden');
        el.sinfoRawContainer.classList.add('hidden');
        el.btnToggleSinfoView.textContent = 'Raw CLI';
        el.btnToggleSinfoView.className = 'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition';
      }
    });
  }

  if (el.btnToggleSqueueView) {
    let squeueRawMode = false;
    el.btnToggleSqueueView.addEventListener('click', () => {
      squeueRawMode = !squeueRawMode;
      if (squeueRawMode) {
        el.squeueTableContainer.classList.add('hidden');
        el.squeueRawContainer.classList.remove('hidden');
        el.btnToggleSqueueView.textContent = 'Table View';
        el.btnToggleSqueueView.className = 'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-blue-600 text-white transition';
      } else {
        el.squeueTableContainer.classList.remove('hidden');
        el.squeueRawContainer.classList.add('hidden');
        el.btnToggleSqueueView.textContent = 'Raw CLI';
        el.btnToggleSqueueView.className = 'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition';
      }
    });
  }

  // Booking Modal
  if (el.modalCloseBtn) el.modalCloseBtn.addEventListener('click', closeBookingModal);
  if (el.modalCancelBtn) el.modalCancelBtn.addEventListener('click', closeBookingModal);
  if (el.bookingForm) el.bookingForm.addEventListener('submit', handleBookingSubmit);

  // Manage Modal
  if (el.manageCloseBtn) el.manageCloseBtn.addEventListener('click', closeManageModal);
  if (el.btnCancelModify) el.btnCancelModify.addEventListener('click', closeManageModal);
  if (el.modifyForm) el.modifyForm.addEventListener('submit', handleModifySubmit);
  if (el.btnDeleteSlot) el.btnDeleteSlot.addEventListener('click', handleDeleteSlot);
  if (el.btnCopySlurm) el.btnCopySlurm.addEventListener('click', handleCopySlurm);

  // Strict 7-second recurring live telemetry refresh loop
  setInterval(() => {
    if (sshState.connected) {
      fetchLiveClusterTelemetry();
    } else {
      renderTelemetry();
    }
  }, 7000);
}

function isAnyModalOpen() {
  const modals = [
    el.bookingModal,
    el.manageModal,
    el.settingsModal,
    el.sshModal,
    el.syncPromptModal
  ];
  return modals.some(m => m && !m.classList.contains('hidden'));
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
async function startApp() {
  // Check if URL has #token=... for 1-click faculty invite setup
  const hadHashToken = AuthManager.checkUrlHashConfig();

  updateSyncPill();
  setupEvents();
  renderMonthCalendar();
  renderDaySlots();
  renderTelemetry();
  renderCoreTelemetryPanel();
  renderCoreTelemetryPanel();
  await loadBookings();

  if (hadHashToken) {
    showToast('✓ Connected to Department HPC GitHub Sync! Bookings will now sync in real time.', 'success');
  }

  // Recurring 20s background sync for calendar bookings from GitHub
  setInterval(async () => {
    if (!isAnyModalOpen()) {
      await loadBookings(false);
    }
  }, 20000);

  // Auto-sync when user switches back to browser tab
  window.addEventListener('focus', () => {
    if (!isAnyModalOpen()) {
      loadBookings(false);
    }
  });

  // Auto-probe if bridge is already running in background
  try {
    const res = await fetch(`${sshState.bridgeUrl}/api/status`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (data.connected) {
        sshState.connected = true;
        sshState.host = data.host || '10.206.4.128';
        sshState.username = data.username || '';
        if (el.sshFeedIndicator) el.sshFeedIndicator.className = 'h-2 w-2 rounded-full bg-emerald-400 animate-pulse';
        if (el.sshFeedLabel) el.sshFeedLabel.textContent = `SSH: ${sshState.username}@${sshState.host} (7s)`;
        fetchLiveClusterTelemetry();
      }
    }
  } catch (e) {
    // Bridge not running; user will start it when ready
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

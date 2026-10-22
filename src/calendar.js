/**
 * HPC Slot Booking System - Calendar & Slot Management Module
 */

export const STANDARD_SLOTS = [
  { key: '09:00-13:00', label: 'Morning Block', time: '09:00 - 13:00 (4 hrs)', icon: '🌅' },
  { key: '13:00-17:00', label: 'Afternoon Block', time: '13:00 - 17:00 (4 hrs)', icon: '☀️' },
  { key: '17:00-21:00', label: 'Evening Block', time: '17:00 - 21:00 (4 hrs)', icon: '🌆' },
  { key: '21:00-09:00', label: 'Overnight Batch', time: '21:00 - 09:00 (12 hrs)', icon: '🌙' }
];

export const CalendarService = {
  /**
   * Formats a Date object to YYYY-MM-DD
   */
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /**
   * Returns human readable date label (e.g. "Thursday, Oct 22, 2026")
   */
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

  /**
   * Retrieves slots for a node on a specific date, creating default available slots if missing.
   */
  getSlotsForDate(bookingsData, nodeId, dateStr) {
    const nodeObj = bookingsData?.nodes?.[nodeId] || { slots: {} };
    const dateSlots = nodeObj.slots?.[dateStr] || {};

    return STANDARD_SLOTS.map(def => {
      const existing = dateSlots[def.key];
      if (!existing) {
        return {
          key: def.key,
          label: def.label,
          time: def.time,
          icon: def.icon,
          status: 'Available',
          details: null
        };
      }

      // Check if it's simple string or detailed object
      if (typeof existing === 'string') {
        return {
          key: def.key,
          label: def.label,
          time: def.time,
          icon: def.icon,
          status: existing,
          details: null
        };
      }

      return {
        key: def.key,
        label: def.label,
        time: def.time,
        icon: def.icon,
        status: existing.status || 'Booked',
        details: existing
      };
    });
  },

  /**
   * Immutably updates the bookings data with a new reservation.
   */
  applyBooking(bookingsData, nodeId, dateStr, slotKey, facultyInfo) {
    const clone = JSON.parse(JSON.stringify(bookingsData));

    if (!clone.nodes) clone.nodes = {};
    if (!clone.nodes[nodeId]) {
      clone.nodes[nodeId] = {
        name: nodeId,
        slots: {}
      };
    }
    if (!clone.nodes[nodeId].slots) {
      clone.nodes[nodeId].slots = {};
    }
    if (!clone.nodes[nodeId].slots[dateStr]) {
      clone.nodes[nodeId].slots[dateStr] = {};
    }

    clone.nodes[nodeId].slots[dateStr][slotKey] = {
      status: 'Booked',
      bookedBy: facultyInfo.name,
      email: facultyInfo.email,
      department: facultyInfo.department,
      jobName: facultyInfo.jobName || 'Compute Workload',
      coresRequested: facultyInfo.coresRequested || 'All available',
      estimatedRuntime: facultyInfo.estimatedRuntime || 'Full slot',
      bookedAt: new Date().toISOString()
    };

    return clone;
  },

  /**
   * Immutably cancels/releases a slot reservation.
   */
  applyCancellation(bookingsData, nodeId, dateStr, slotKey) {
    const clone = JSON.parse(JSON.stringify(bookingsData));
    if (clone.nodes?.[nodeId]?.slots?.[dateStr]?.[slotKey]) {
      clone.nodes[nodeId].slots[dateStr][slotKey] = {
        status: 'Available'
      };
    }
    return clone;
  }
};

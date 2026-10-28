/**
 * HPC Slot Booking System - Calendar & Slot Management Module
 * Supports full monthly calendar generation, slot status queries, booking, modification, and deletion.
 */

export const STANDARD_SLOTS = [
  { key: '09:00-13:00', label: 'Morning', shortTime: '09-13h', time: '09:00 - 13:00', icon: '🌅' },
  { key: '13:00-17:00', label: 'Afternoon', shortTime: '13-17h', time: '13:00 - 17:00', icon: '☀️' },
  { key: '17:00-21:00', label: 'Evening', shortTime: '17-21h', time: '17:00 - 21:00', icon: '🌆' },
  { key: '21:00-09:00', label: 'Overnight', shortTime: '21-09h', time: '21:00 - 09:00', icon: '🌙' }
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
   * Returns formatted Month & Year label (e.g. "October 2026")
   */
  getMonthYearLabel(year, month) {
    const date = new Date(year, month, 1);
    return date.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    });
  },

  /**
   * Generates the days array for a 7-column monthly calendar view.
   * Includes padding days from adjacent months so Sunday is first day.
   */
  getMonthGridDays(year, month) {
    const todayStr = this.formatDate(new Date());
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // 1. Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, prevDayNum);
      const dateStr = this.formatDate(prevDate);
      days.push({
        dateStr,
        dayNum: prevDayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dateObj: prevDate
      });
    }

    // 2. Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const currDate = new Date(year, month, dayNum);
      const dateStr = this.formatDate(currDate);
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dateObj: currDate
      });
    }

    // 3. Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(year, month + 1, dayNum);
      const dateStr = this.formatDate(nextDate);
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dateObj: nextDate
      });
    }

    return days;
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

  /**
   * Computes monthly statistics (total slots, booked count, available count, utilization rate).
   */
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
    const utilizationPct = totalSlots > 0 ? ((bookedCount / totalSlots) * 100).toFixed(1) : 0;

    return {
      totalSlots,
      bookedCount,
      availableCount,
      utilizationPct
    };
  },

  /**
   * Immutably updates bookings with a new reservation.
   */
  applyBooking(bookingsData, nodeId, dateStr, slotKey, facultyInfo) {
    const clone = JSON.parse(JSON.stringify(bookingsData || { nodes: {} }));

    if (!clone.nodes) clone.nodes = {};
    if (!clone.nodes[nodeId]) {
      clone.nodes[nodeId] = { name: nodeId, slots: {} };
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
      role: facultyInfo.role || 'Faculty Member',
      email: facultyInfo.email,
      department: facultyInfo.department,
      jobName: facultyInfo.jobName || 'Compute Workload',
      coresRequested: facultyInfo.coresRequested || '64 Cores',
      estimatedRuntime: facultyInfo.estimatedRuntime || 'Full slot',
      bookedAt: new Date().toISOString()
    };

    return clone;
  },

  /**
   * Immutably modifies an existing reservation.
   */
  modifyBooking(bookingsData, nodeId, dateStr, slotKey, updatedInfo) {
    const clone = JSON.parse(JSON.stringify(bookingsData || { nodes: {} }));

    if (!clone.nodes?.[nodeId]?.slots?.[dateStr]?.[slotKey]) {
      // If missing, apply as fresh booking
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

  /**
   * Immutably cancels/deletes a slot reservation (sets back to Available).
   */
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

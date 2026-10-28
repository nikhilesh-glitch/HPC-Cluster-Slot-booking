/**
 * HPC Slot Booking System - Cluster Telemetry Module
 * Configured for 8 Compute Nodes (Node 1 to Node 6, Node 9, Node 11) + 1 GPU Node (Node 7).
 * All nodes have 64 cores each.
 */

export const TelemetryService = {
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
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
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

      activeJobs = [
        {
          id: `slurm-${Math.floor(10000 + Math.random() * 89999)}`,
          user: slotData.bookedBy || 'Authorized Researcher',
          role: slotData.role || 'User',
          job: slotData.jobName || 'Compute Workload',
          cores: meta.cores,
          gpus: meta.gpus,
          elapsed: 'Active Slot',
          state: 'RUNNING'
        }
      ];

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
      status: 'ONLINE',
      isBooked: isSlotBooked,
      cpuLoadPercent,
      ramUsedGb,
      ramPercent: Math.round((ramUsedGb / meta.totalRamGb) * 100),
      powerWatts,
      tempCelsius,
      gpuMetrics,
      activeJobs,
      timestamp: now.toLocaleTimeString()
    };
  }
};

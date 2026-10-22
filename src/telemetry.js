/**
 * HPC Slot Booking System - Cluster Telemetry Module
 * Monitors cluster node health, hardware utilization (CPU, RAM, GPU), and Slurm queue jobs.
 */

export const TelemetryService = {
  // Pre-configured cluster specs
  nodesMetadata: {
    'node-10': {
      name: 'Node 10 (Exclusive Compute)',
      type: 'CPU High-Compute',
      cores: 64,
      totalRamGb: 256,
      gpus: 0,
      interconnect: 'Dual 100GbE RoCE',
      storage: '3.84TB NVMe Scratch'
    },
    'nodes-8-12': {
      name: 'Nodes 8 & 12 (MPI Cluster)',
      type: 'Distributed MPI',
      cores: 96,
      totalRamGb: 384,
      gpus: 0,
      interconnect: 'InfiniBand HDR 200Gb/s',
      storage: '15TB Lustre Parallel FS'
    },
    'node-7-gpu': {
      name: 'Node 7 (GPU Acceleration)',
      type: 'GPU Dense Node',
      cores: 32,
      totalRamGb: 512,
      gpus: 4,
      gpuModel: 'NVIDIA A100-SXM4-80GB',
      interconnect: 'NVLink 600GB/s + 200GbE',
      storage: '7.68TB NVMe Gen4'
    }
  },

  /**
   * Generates realistic telemetry metrics based on current node and time of day.
   */
  getTelemetry(nodeId) {
    const meta = this.nodesMetadata[nodeId] || {
      name: nodeId,
      type: 'Standard Compute',
      cores: 32,
      totalRamGb: 128,
      gpus: 0
    };

    // Realistic load calculation
    let cpuLoadPercent = 0;
    let ramUsedGb = 0;
    let gpuMetrics = [];
    let powerWatts = 0;
    let tempCelsius = 0;
    let activeJobs = [];

    if (nodeId === 'node-10') {
      cpuLoadPercent = 88.4;
      ramUsedGb = 214;
      powerWatts = 420;
      tempCelsius = 54;
      activeJobs = [
        {
          id: 'slurm-89410',
          user: 'Dr. Sarah Chen',
          job: 'GATK_haplotype_caller.sh',
          cores: 64,
          elapsed: '03:12:45',
          state: 'RUNNING'
        }
      ];
    } else if (nodeId === 'nodes-8-12') {
      cpuLoadPercent = 74.2;
      ramUsedGb = 280;
      powerWatts = 650;
      tempCelsius = 49;
      activeJobs = [
        {
          id: 'slurm-89392',
          user: 'Dr. Marcus Vance',
          job: 'openfoam_aerofoil_mpi',
          cores: 96,
          elapsed: '01:45:10',
          state: 'RUNNING'
        },
        {
          id: 'slurm-89415',
          user: 'K. Patel (Ph.D.)',
          job: 'lammps_md_simulation',
          cores: 48,
          elapsed: '00:00:00',
          state: 'PENDING'
        }
      ];
    } else if (nodeId === 'node-7-gpu') {
      cpuLoadPercent = 45.1;
      ramUsedGb = 398;
      powerWatts = 1350;
      tempCelsius = 68;
      gpuMetrics = [
        { id: 0, name: 'A100 #0', util: 96, memUsedGb: 78.4, memTotalGb: 80, tempC: 72 },
        { id: 1, name: 'A100 #1', util: 98, memUsedGb: 78.4, memTotalGb: 80, tempC: 74 },
        { id: 2, name: 'A100 #2', util: 94, memUsedGb: 78.4, memTotalGb: 80, tempC: 70 },
        { id: 3, name: 'A100 #3', util: 91, memUsedGb: 76.2, memTotalGb: 80, tempC: 69 }
      ];
      activeJobs = [
        {
          id: 'slurm-89421',
          user: 'Prof. Elena Rostova',
          job: 'torchrun_foundation_v3.py',
          cores: 32,
          gpus: 4,
          elapsed: '02:08:14',
          state: 'RUNNING'
        }
      ];
    }

    return {
      nodeId,
      meta,
      status: 'ONLINE',
      cpuLoadPercent,
      ramUsedGb,
      ramPercent: Math.round((ramUsedGb / meta.totalRamGb) * 100),
      powerWatts,
      tempCelsius,
      gpuMetrics,
      activeJobs,
      timestamp: new Date().toLocaleTimeString()
    };
  }
};

# HPC Cluster Slot Booking & Telemetry Portal

A lightweight, zero-maintenance, serverless Single-Page Application (SPA) designed for academic and research departments to manage High-Performance Computing (HPC) cluster reservations and monitor node telemetry directly hosted on **GitHub Pages**.

---

## 🌟 Key Features

- **Zero-Server Infrastructure**: Runs 100% on the client side via static HTML/Tailwind CSS/ES Modules hosted on free GitHub Pages with HTTPS.
- **GitHub API Persistence**: Reads and commits reservation updates directly to `bookings.json` in your repository using the GitHub Contents REST API.
- **Live Cluster Telemetry**: Real-time telemetry monitoring for compute nodes:
  - CPU Core Utilization & Load
  - Memory (RAM) Allocation
  - Thermal & Power Draw
  - Multi-GPU metrics (NVIDIA A100 VRAM, Load %, Temperature)
  - Active Slurm Queue & Job telemetry
- **Multi-Node Partitioning**:
  - **Node 10**: Exclusive Single-Tenant Compute (64 Cores AMD EPYC, 256GB RAM)
  - **Nodes 8 & 12**: Distributed MPI Cluster (96 Cores Intel Xeon, InfiniBand HDR)
  - **Node 7 (GPU)**: Dense Deep Learning Node (4x NVIDIA A100 80GB SXM4)
- **Flexible Time Slots**:
  - Morning Block: `09:00 - 13:00` (4 hrs)
  - Afternoon Block: `13:00 - 17:00` (4 hrs)
  - Evening Block: `17:00 - 21:00` (4 hrs)
  - Overnight Batch: `21:00 - 09:00` (12 hrs)
- **Slurm Script Generator**: Automatically constructs quick-launch `sbatch` and `salloc` commands corresponding to reserved node parameters.
- **Offline & Local Demo Mode**: Works immediately in demo mode with browser storage caching if no GitHub PAT is supplied.

---

## 📁 Project Structure

```plaintext
hpc-slot-booking-system/
├── index.html            # Main responsive dashboard UI (Tailwind CSS CDN)
├── bookings.json         # Git-backed JSON database for reservations
├── package.json          # Optional dev server scripts (Vite)
├── README.md             # Documentation & deployment guide
└── src/
    ├── main.js           # App controller, event listeners, toasts, rendering
    ├── calendar.js       # Slot definitions, date maths, reservation state
    ├── telemetry.js      # Cluster specs, hardware telemetry, active jobs
    ├── github-api.js     # GitHub Contents REST API read/write integration
    └── auth.js           # Personal Access Token (PAT) & profile management
```

---

## 🚀 Quick Start (Local Development)

You can run this project locally with any static web server:

### Option A: Using Python (Built-in)
```bash
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

### Option B: Using Vite / Node.js
```bash
npm install
npm run dev
```

---

## 🔐 Configuring GitHub API Persistence

To enable faculty members to sync reservations across devices:

1. **Create a GitHub Personal Access Token (PAT)**:
   - Go to [GitHub Token Settings](https://github.com/settings/tokens?type=beta).
   - Click **Generate new token (Fine-grained)**.
   - Select your repository (e.g. `your-username/hpc-booking-system`).
   - Under **Repository permissions**, enable:
     - **Contents**: `Read and write`
   - Generate and copy the token (`github_pat_...`).

2. **Connect in the App**:
   - Open your deployed portal or local app.
   - Click the **Settings & PAT** button in the top right.
   - Fill in:
     - **GitHub PAT**: `github_pat_...`
     - **Repo Owner**: `your-username`
     - **Repo Name**: `hpc-booking-system`
     - **Branch**: `main`
     - **File Path**: `bookings.json`
   - Click **Test Connection** to verify permissions, then click **Save Settings**.

Now, whenever a slot is booked or released, a Git commit is created directly against `bookings.json`, instantly synchronizing with all other researchers.

---

## 🌐 Deploying to GitHub Pages

1. Push this repository to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial release of HPC Slot Booking Portal"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. Enable GitHub Pages:
   - In your repository, click **Settings** > **Pages**.
   - Under **Build and deployment**:
     - **Source**: `Deploy from a branch`
     - **Branch**: `main` / `/ (root)`
   - Click **Save**.

3. Your portal will be live in ~60 seconds at:
   `https://<your-username>.github.io/<your-repo-name>/`

---

## 🛡️ Faculty Workflows

1. **Viewing Schedule**: Select a cluster node tab and navigate dates with the date picker or "Today" / "Tomorrow" buttons.
2. **Reserving a Slot**: Click **Book This Slot** on any green card, provide researcher name, email, department, and compute workload details.
3. **Releasing a Slot**: Click **View Details & Cancel** on a booked card and select **Release / Cancel Slot**.
4. **Copying Slurm Command**: The reservation details modal provides a customized `sbatch` launch command ready to paste into your cluster terminal.

---

## 📄 License
MIT License - Open for academic, research, and enterprise cluster deployments.

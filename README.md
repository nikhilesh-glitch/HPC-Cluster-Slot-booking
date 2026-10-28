# HPC Cluster Slot Booking & Telemetry Portal

A lightweight, zero-maintenance, serverless Single-Page Application (SPA) designed for academic and research departments to manage High-Performance Computing (HPC) cluster reservations and monitor node telemetry directly hosted on **GitHub Pages**.

---

## 🌟 Key Features

- **Full Monthly Calendar Display**: Visualizes all 30/31 days of the month at once in an interactive 7-column calendar grid showing all shift blocks and cluster occupancy.
- **Complete Booking Lifecycle**:
  - **Book Available Slots**: Reserve any open shift with one click.
  - **Modify Existing Bookings**: Edit researcher details, email, department, job description, and resource demands.
  - **Delete / Release Bookings**: Cancel reservations and immediately return slots to available status for other faculty.
- **Zero-Server Infrastructure**: Runs 100% on the client side via static HTML/Tailwind CSS/ES Modules hosted on free GitHub Pages with HTTPS.
- **GitHub API Persistence**: Reads and commits reservation updates directly to `bookings.json` in your repository using the GitHub Contents REST API.
- **Dual Slurm Operations Center (Left: `sinfo`, Right: `squeue`)**:
  - **Left Panel (`sinfo`)**: Real-time partition and node availability view (`compute*` & `gpu`), state badges (`idle`, `mix`, `alloc`, `down`), node counts, dedicated **"Fetch Live"** button, and raw CLI terminal output toggle.
  - **Right Panel (`squeue`)**: Live job queue monitor displaying active and pending jobs, JobID, partition, job name, user, state (`R` running, `PD` pending), elapsed time, node counts, nodelist assignments, dedicated **"Fetch Live"** button, and raw CLI toggle.
- **Live Cluster Telemetry & SSH Feed (10.206.4.128)**:
  - Real-time SSH streaming with a **7-second refresh interval**
  - Prompts for SSH username and password via a secure modal
  - Connects to cluster IP `10.206.4.128:22` via local CORS bridge (`telemetry-bridge.py`)
  - Live Slurm queue (`squeue`) and node states (`sinfo`), CPU load from `uptime`, RAM from `free -m`, and GPU telemetry from `nvidia-smi`
- **Multi-Node Partitioning (All 64 Cores Each)**:
  - **Nodes 1 to 6**: Shared Department Compute Nodes (64 Cores CPU each, shared across faculty, students, and staff)
  - **Node 7 (GPU)**: GPU Compute Node (64 Cores + 4x NVIDIA A100 80GB)
  - **Nodes 9 & 11**: Shared Department Compute Nodes (64 Cores CPU each, shared across faculty, students, and staff)
  - All jobs submitted on these nodes exclusively
- **Flexible Time Slots**:
  - Morning Block: `09:00 - 13:00` (4 hrs)
  - Afternoon Block: `13:00 - 17:00` (4 hrs)
  - Evening Block: `17:00 - 21:00` (4 hrs)
  - Overnight Batch: `21:00 - 09:00` (12 hrs)
- **Month Utilization Analytics**: Real-time stats showing total slots, available slots, booked slots, and node utilization percentage for the month.
- **Slurm Script Generator**: Automatically constructs quick-launch `sbatch` commands with a one-click clipboard copy.

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

## 📡 Live Cluster Feed (SSH to 10.206.4.128 - 7s Refresh)

To stream live hardware metrics and active Slurm jobs directly from cluster node `10.206.4.128`:

1. **Prerequisites for Users**:
   - Must be connected to the **Campus Wi-Fi or VPN** to reach the internal cluster IP `10.206.4.128`.
   - Install required Python package:
     ```bash
     pip install paramiko
     ```

2. **Launch the local SSH bridge**:
   ```bash
   python telemetry-bridge.py
   ```
   The bridge runs a lightweight CORS HTTP server on `http://localhost:8080`.

3. **Browser Permission for GitHub Pages (HTTPS)**:
   - When accessing the portal via GitHub Pages (`https://...`), web browsers block insecure background requests (`http://localhost:8080`) by default.
   - **Fix in Chrome / Edge**: Click the settings/lock icon next to the address bar &rarr; **Site settings** &rarr; change **Insecure content** to **Allow** &rarr; refresh the page.

4. **Connect in the Web Portal**:
   - Click the **Live Feed: 10.206.4.128** badge in the top navigation bar.
   - Enter your cluster **SSH Username** and **Password**.
   - Click **Connect & Stream (7s)**.

5. **Real-time 64-Core Hardware Monitoring**:
   - Displays real-time **Consumed Cores** vs **Available Free Cores** for each selected node.
   - Interactive 64-Core Hardware Matrix (`Core 00` to `Core 63`) with per-core thread hover inspection.
   - Fast 1-click node switcher pills (Node 1 through Node 11 + GPU Node 7).
   - Telemetry refreshes **every 7 seconds** with real CPU load from `uptime`, RAM usage from `free -m`, active jobs from `squeue`, core allocations from `sinfo -Node`, and GPU metrics from `nvidia-smi`.
   - Click the badge at any time to inspect connection health or disconnect.

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

1. **Viewing Monthly Schedule**: See all 30/31 days and their 4 shift slots at once on the interactive 7-column calendar grid. Switch months via `Prev Month`, `Next Month`, `Current Month`, or the month picker.
2. **Reserving a Slot**: Click `+ Book` on any open slot chip (Morning, Afternoon, Evening, Overnight) to open the reservation dialog and reserve instantly.
3. **Modifying a Booking**: Click on any booked slot chip (`EDIT`) to open the management modal, update researcher details, job purpose, or allocated resources, and save the changes.
4. **Deleting / Releasing a Slot**: In the management modal, click `Delete / Release Booking` to cancel the reservation and return the slot back to `Available`.
5. **Inspecting a Single Day**: Click any day number or toggle `Day Detail` mode to view high-resolution shift cards.
6. **Copying Slurm Command**: The reservation details modal provides a customized `sbatch` launch command ready to paste into your cluster terminal.

---

## 📄 License
MIT License - Open for academic, research, and enterprise cluster deployments.

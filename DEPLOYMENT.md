# Kogane Restaurant Deployment & Operations Playbook

This document is the turnkey installation and operational manual for deploying **Kogane** in restaurant and food service environments. It covers on-premise local area network (LAN) setup, hardware recommendations, first-time owner onboarding, workstation configuration, and day-to-day operations and maintenance.

---

## 1. System Architecture & Pitch for Restaurants

When presenting Kogane to a restaurant owner, the core value proposition is:

- **100% On-Premise Resilience (Zero Internet Dependency)**:
  All orders, product catalogs, and inventory reside in a high-performance local SQLite database on the counter PC. Even if the restaurant's internet drops, counter ringing and kitchen ticket displays never stop.
- **Instant Real-Time Kitchen Display Synchronization**:
  Using lightweight Server-Sent Events (SSE), orders rung up at the cashier instantly push to kitchen line tablets in milliseconds with zero polling overhead.
- **Dedicated Workstation Terminals**:
  Hardware-agnostic browser terminals for iPads, Android tablets, touch monitors, and phones:
  1. **Front Counter (Cashier Register)**: Fast cart, item modifiers, statutory discounts (PWD/Senior Citizen), split bills, card and cash payments.
  2. **Kitchen Queue (Kitchen Display System - KDS)**: Real-time ticket board with order aging, bump-to-cook, and bump-to-served buttons.
  3. **Stock Room (Inventory Manager)**: Inbound stock intake, reorder threshold alerts, and receiving logs.
  4. **Menu Catalog (Catalog Registrar)**: Real-time product creation, price updates, and category tagging.
  5. **Finance Console (Reports & Compliance)**: Daily gross/net revenue, tax collection schedules, average order value (AOV), and 1-click Excel/CSV export.
- **No Monthly Per-Device Cloud Subscription**:
  One local host PC serves unlimited tablets and phones across the dining room and kitchen over local Wi-Fi.

---

## 2. Hardware & Local Network (LAN) Setup

### Recommended Hardware
| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| **Host Counter PC** | Intel Celeron / 4GB RAM / 64GB SSD (Windows 10/11 or Ubuntu) | Intel NUC / Mini PC (Core i3/i5, 8GB RAM, 128GB SSD) |
| **Cashier Terminal** | 10" Tablet or Touchscreen Monitor on Host PC | 12" Touch POS Terminal or 10.2" iPad |
| **Kitchen Display (KDS)** | 10" Android Tablet with heavy-duty silicone case | 10.5" - 13" Android/iPad Tablet with wall/pole mount |
| **Wi-Fi Router** | Standard dual-band Wi-Fi 5 router | Dedicated Wi-Fi 6 Router (e.g., TP-Link Archer / Asus) |

### Local Network Setup (5 Minutes)
1. **Dedicated Restaurant Router**:
   Connect the Counter PC directly to the router via Ethernet cable (preferred) or strong Wi-Fi.
2. **Assign a Static IP to the Counter PC**:
   - In Windows: Settings -> Network & Internet -> Properties -> IP Assignment -> Set to **Static** (or configure a DHCP Reservation on your router).
   - Example static IP: `192.168.1.50`.
3. **Disable "AP Isolation" / "Client Isolation" on the Router**:
   - In your router admin page (`192.168.1.1`), ensure **AP Isolation** or **Guest Mode Isolation** is turned **OFF**.
   - This ensures kitchen tablets and cashier phones can communicate directly with the counter PC on port 3000.
4. **Open Windows Defender Firewall for Port 3000**:
   - Open PowerShell or Command Prompt as Administrator in the Kogane folder and run:
     ```cmd
     scripts\allow-lan-port-3000.bat
     ```
   - This opens inbound TCP port 3000 for LAN devices with a single click.

---

## 3. Installation & Startup (Zero to Running)

### Option A: Standard Production Runner (Recommended for Windows)

1. **Install Runtime**:
   Download and install [Bun](https://bun.sh) (or Node.js 18+). In Windows PowerShell:
   ```powershell
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```
2. **Clone or Copy Kogane**:
   Place the Kogane folder in `C:\Kogane` or `C:\Users\<User>\postfolio`.
3. **Reset to Clean Deployment State**:
   ```cmd
   bun run db:reset
   ```
   *This wipes any test orders/dummy artifacts, creates the clean schema, seeds the sample restaurant menu, and prints out the initial admin credentials.*
4. **Build the Production Bundle**:
   ```cmd
   bun run build
   ```
5. **Start the Production Server**:
   Double-click `scripts\start-server.bat` or run:
   ```cmd
   bun run preview:lan
   ```
   The console will display:
   ```text
   Counter / Admin PC:  http://localhost:3000
   Kitchen Tablets:     http://192.168.1.50:3000
   Cashier Phones:      http://192.168.1.50:3000
   ```

### Option B: Automatic Startup on Windows Reboot (Power Outage Recovery)
Restaurants frequently experience power cycles or PC reboots. To ensure Kogane starts automatically when the computer turns on:
1. Double-click `scripts\install-windows-autostart.bat`.
2. This creates a startup shortcut in Windows Startup (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`).
3. Whenever the computer reboots, Kogane will start immediately in the background without needing staff intervention.

### Option C: PM2 Background Service Runner (Cross-Platform Daemon)
For production environments running PM2 (e.g. Linux servers, Windows background daemons, or Mac mini counter hosts):
1. Install PM2:
   ```cmd
   npm install -g pm2
   ```
2. Build and launch Kogane using the provided ecosystem configuration:
   ```cmd
   bun run build
   pm2 start ecosystem.config.cjs
   ```
3. Save state and register startup service:
   ```cmd
   pm2 save
   pm2 startup
   ```
   *PM2 monitors the process, automatically restarts it if memory exceeds 500MB, and restores it on reboot.*

---

## 4. First-Time Owner Onboarding

When deploying Kogane for a new restaurant client:

### Step 1: Owner Account Setup & Password Management
1. Open Chrome/Edge on the counter PC and navigate to `http://localhost:3000/login`.
2. To create a brand new restaurant owner account:
   - Click **Create Account** (`/login?mode=signup`).
   - Enter Owner Full Name (e.g. `Marco Rossi`), Username, Email (e.g. `marco@trattoria.com`), Password, and Confirm Password (minimum 6 characters).
   - Enter Owner birthday and complete setup.
   - *Passwords are salted and cryptographically hashed with PBKDF2-SHA256 (100,000 iterations). Arbitrary email entry without valid credentials is strictly rejected.*
3. *Alternatively, use the default seeded admin account (`admin@kogane.dev` / `admin123`).*
4. **Changing Password in Dashboard**:
   - Once logged in, navigate to **Settings** (`/dashboard/settings`).
   - Scroll to **Account & Password**.
   - Enter your current password and your new secure password, then click **Update Password**. The password hash updates in the local database immediately.

### Step 2: First-Time Onboarding Modal
Upon registration or first login, the Onboarding Modal automatically appears:
1. **Business Details**:
   - Enter Restaurant Name (e.g., `Trattoria Bella Napoli`).
   - Select Country & Currency (e.g., `US` / `USD $`, `PH` / `PHP ₱`, `EU` / `EUR €`, `GB` / `GBP £`, `JP` / `JPY ¥`).
2. **Select Active Features**:
   - Check **Orders (POS & Kitchen)** and **Inventory (Stock Management)**.
3. **Select Workstations**:
   - Front Counter (Cashier Register)
   - Kitchen Queue (Kitchen Display)
   - Stock Room (Inventory Manager)
   - Menu Catalog (Catalog Registrar)
   - Finance Console (Reports Viewer)
4. Click **Complete Setup**. The system will provision custom restaurant tables (`biz_<id>_products`, `biz_<id>_orders`, `biz_<id>_inventory`) and terminal layouts.

---

## 5. Workstation Tablets Setup (KDS & Cashier)

### Connecting Tablets to Stations
1. Connect the kitchen tablet and cashier tablet to the restaurant's Wi-Fi network.
2. In the Admin Dashboard on the Counter PC, go to **Terminals** (`/dashboard/terminals`).
3. Locate the workstation and copy its direct URL:
   - Front Counter: `http://192.168.1.50:3000/terminal/cashier-register-001`
   - Kitchen Display: `http://192.168.1.50:3000/terminal/kitchen-display-001`
   - Stock Room: `http://192.168.1.50:3000/terminal/inventory-manager-001`
4. Open Safari (iOS) or Chrome (Android) on the tablet and visit the URL.
5. **Install as Full-Screen App**:
   - **iOS Safari**: Tap Share icon -> **Add to Home Screen**.
   - **Android Chrome**: Tap three dots -> **Install App** / **Add to Home screen**.
6. The workstation opens in full-screen kiosk mode without browser address bars.
7. Enter the station PIN (Default PIN: `1234`).
8. The station session is stored securely in client storage and auto-refreshes for 30 days.

### Station Roles & Permissions
| Station | Access Rights | Ideal Device |
|---|---|---|
| **Front Counter** | Create orders, charge cards/cash, view open queue, read products | Cashier iPad / Counter Touch PC |
| **Kitchen Queue** | View pending orders, bump to preparing/fulfilled, read-only menu | 10"+ Android / iPad mount in kitchen |
| **Stock Room** | Intake inventory, adjust quantities, view stock charts | Mobile phone or back-office tablet |
| **Menu Catalog** | Add/edit dishes, update pricing, toggle availability | Manager iPad or counter PC |
| **Finance Console** | Sales aggregation, tax audit schedules, export XLSX/CSV | Owner PC / Manager laptop |

---

## 6. Daily Operations & Real-Time Sync

### Order Lifecycle Flow
1. **Cashier registers an order**:
   - Cashier taps items on the Front Counter terminal.
   - Selects dining option (Table 1, Dine In, Takeout).
   - Applies discounts if applicable (e.g., 20% PWD or Senior Citizen discount on highest-value item).
   - Selects Payment Method: Cash or Integrated Card.
   - Taps **Charge & Dispatch**.
2. **Instant Kitchen Notification**:
   - The order immediately appears on the Kitchen Queue terminal via native Server-Sent Events (SSE). No browser refresh required!
   - Ticket displays order items, table number, special instructions, and elapsed timer.
3. **Kitchen Fulfillment**:
   - Kitchen staff taps the status badge: advances from `PENDING` -> `PREPARING` -> `FULFILLED / SERVED`.
   - The status change broadcasts in real time back to the cashier counter and the manager dashboard.

---

## 7. Maintenance, Backup & Recovery

### Daily Safe Backup (End-of-Day Routine)
Before closing each night, run a backup snapshot of the SQLite database:
- **Windows (1-Click)**: Double click `scripts\backup-db.bat`.
- **Command Line**:
  ```cmd
  bun run scripts/backup-db.ts
  ```
- Backups are stored in `./backups/kogane-backup-YYYY-MM-DD-HH-MM-SS.db`.
- The script automatically maintains the last 30 daily backups and prunes older snapshots to prevent disk exhaustion.
- *Tip: Instruct the restaurant manager to copy the `./backups` folder to a USB drive or cloud storage once a week.*

### Database Restore (Emergency Recovery)
If the host PC experiences hardware failure and you transfer files to a backup machine:
```cmd
bun run scripts/restore-db.ts
```
*Restores the latest backup snapshot from `./backups` and creates a pre-restore safety copy of the current file.*

### Clean Database Reset for a New Restaurant Sale
When taking this software to install at a new restaurant client:
```cmd
bun run db:reset
```
This resets all test orders to 0, purges old temporary test tables, seeds a fresh restaurant catalog, and resets the admin account.

---

## 8. Troubleshooting Guide for Restaurant Staff

### Problem 1: Kitchen tablet displays "Cannot connect to server"
- **Cause A**: Tablet is connected to guest Wi-Fi instead of the restaurant's private network.
  - *Fix*: Connect the tablet to the main restaurant Wi-Fi SSID.
- **Cause B**: Host Counter PC IP address changed after router reboot.
  - *Fix*: Run `ipconfig` on Counter PC. If the IP changed (e.g. from `.50` to `.52`), update the URL on the tablet or set a static DHCP reservation in the router.
- **Cause C**: Windows Defender Firewall blocked the port.
  - *Fix*: Run `scripts\allow-lan-port-3000.bat` as Administrator on Counter PC.

### Problem 2: Staff entered wrong PIN
- Each terminal has a 4-digit PIN (default: `1234`).
- To change or view PINs, log in as Manager on the counter PC -> **Terminals** -> Edit terminal PIN.

### Problem 3: Accidental tablet logout
- Staff can simply re-enter the 4-digit PIN on the screen. The session token will be reissued automatically.

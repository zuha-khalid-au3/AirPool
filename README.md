# AirPool 🛫🚗

AirPool is an open-source, production-grade, server-driven co-passenger matching application designed to solve the "last-mile" airport transit problem. When travelers land at airports, they often face high private cab fares or long waits for shared transit to fill up. AirPool enables travelers to connect pre-flight, in-flight, or post-landing to pool rides (cabs, auto-rickshaws, or SUVs) to nearby towns or destinations, saving up to 75% of transit costs.

This project is structured as a **Yarn Workspaces Monorepo** containing:
- **`packages/backend`**: Node.js/Express.js API server with Socket.io, Redis, RabbitMQ, and AdminJS.
- **`packages/mobile`**: Expo / React Native mobile app (pure JavaScript, zero TypeScript, styled with TailwindCSS via NativeWind).
- **`packages/admin`**: Vite / React admin dashboard for Server-Driven UI, user management, and fraud detection.

---

## 🛠️ Tech Stack & Open-Source Licenses

Every component of AirPool is built using permissive open-source licenses:

| Component | Technology | License | Purpose |
| :--- | :--- | :--- | :--- |
| **Mobile App** | React Native (Expo 51+) | MIT | Cross-platform mobile app (iOS/Android) |
| **Mobile Styling** | NativeWind (TailwindCSS v3) | MIT | Utility-first styling in React Native |
| **Mobile State** | Zustand | MIT | Lightweight state management |
| **Backend API** | Node.js + Express.js | MIT | RESTful and WebSocket API server |
| **Real-time Sync** | Socket.io | MIT | Live chat and location sharing |
| **Database** | MongoDB | SSPL | User, ride pool, and config storage |
| **Caching/Session** | Redis | BSD-3-Clause | Session store, rate limiting, and pub/sub |
| **Queue** | RabbitMQ | MPL 2.0 | Asynchronous tasks (OCR, notifications) |
| **Object Storage** | MinIO | AGPLv3 | S3-compatible file storage (ticket uploads) |
| **Admin Dashboard** | React + Vite | MIT | Frontend for configuration and management |
| **Admin CRUD** | AdminJS | MIT | Backend administrative interface |
| **OCR Engine** | Node-Tesseract (Tesseract) | Apache 2.0 | Automatic flight ticket detail extraction |
| **Reverse Proxy** | Nginx | BSD-2-Clause | Reverse proxy, SSL termination, rate limiting |

---

## 🚀 macOS Quick Start & Development Roadmap

As a macOS user, this roadmap will guide you through setting up and running the entire AirPool ecosystem locally.

### 📋 Prerequisites

Before starting, ensure you have the following installed on your Mac:
1. **Homebrew**: The macOS package manager. Run `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` if not installed.
2. **Node.js (v20+)**: Install via Homebrew: `brew install node`
3. **Yarn (v1.22+)**: Install globally: `npm install -g yarn`
4. **Docker Desktop for Mac**: [Download and install here](https://www.docker.com/products/docker-desktop/). This runs our databases and message queues.
5. **Expo Go App**: Install the "Expo Go" app on your physical iPhone or Android device from the App Store / Google Play Store.

---

### 🗺️ Step-by-Step Setup Guide

Follow these steps to get the application running on your Mac.

#### Step 1: Clone and Install Dependencies
Open your Terminal and run:
```bash
# Clone the repository
git clone https://github.com/zuha-khalid-au3/AirPool.git
cd AirPool

# Install all workspace dependencies
yarn install
```

#### Step 2: Set Up Environment Variables
Create the `.env` files for both the backend and mobile apps:
```bash
# Backend Env
cp packages/backend/.env.example packages/backend/.env

# Mobile Env
cp packages/mobile/.env.example packages/mobile/.env
```
*Note: For local development, the default values in `.env.example` will work out of the box.*

#### Step 3: Start Databases & Services via Docker
Make sure Docker Desktop is running on your Mac, then start the infrastructure services:
```bash
# Start MongoDB, Redis, RabbitMQ, and MinIO in the background
docker-compose up -d
```
Verify they are running by checking Docker Desktop or running `docker ps`.

#### Step 4: Seed the Database
Seed the MongoDB database with default airports, vehicle configurations, and the default admin user:
```bash
cd packages/backend
yarn seed
cd ../..
```

#### Step 5: Run the Development Servers
We have provided a `Makefile` to make starting the servers easy. From the root of the project, run:
```bash
# Start Backend, Mobile Expo, and Admin Panel simultaneously
make dev
```
Alternatively, you can run them in separate terminal windows:
* **Backend**: `cd packages/backend && yarn dev` (Runs on `http://localhost:5000`)
* **Admin Panel**: `cd packages/admin && yarn dev` (Runs on `http://localhost:3001`)
* **Mobile Expo**: `cd packages/mobile && yarn start` (Opens the Expo CLI)

---

### 📱 Running the Mobile App on Your Mac/Device

Once you run `yarn start` or `make dev` in the mobile directory, the Expo CLI will start and print a **QR Code** in your terminal.

#### Option A: On a Physical Device (Recommended for Bluetooth/GPS testing)
1. Open the **Camera App** on your iPhone or Android device.
2. Scan the QR Code displayed in your terminal.
3. Tap the link to open it in **Expo Go**.
4. Make sure your phone and Mac are connected to the **same Wi-Fi network**.

#### Option B: On the iOS Simulator (Mac Only)
1. Install Xcode from the Mac App Store.
2. Open Xcode, go to **Settings > Platforms**, and download an iOS Simulator.
3. In your Expo terminal, press `i` to automatically launch the iOS Simulator and open AirPool.

#### Option C: On the Android Emulator
1. Install Android Studio.
2. Set up a Virtual Device (AVD) via the Device Manager.
3. In your Expo terminal, press `a` to open AirPool in the emulator.

---

## 🎛️ Managing App UI via Admin Panel (Server-Driven UI)

AirPool uses **Server-Driven UI (SDUI)**. You can change the theme colors, active airports, vehicle passenger capacities, and announcements in real-time without redeploying the mobile app.

1. Open your browser and go to `http://localhost:3001`.
2. Sign in with the default admin credentials:
   * **Email**: `admin@airpool.app`
   * **Password**: `admin123`
3. Go to the **App Config** tab.
4. Modify the values (e.g., change the primary color hex code or add a new airport).
5. Click **Save**.
6. Open or refresh your mobile app — the changes will be applied instantly!

For advanced database CRUD operations, visit the AdminJS panel directly at `http://localhost:5000/admin`.

---

## 📅 Production Deployment Checklist

When you are ready to take AirPool to production, follow this checklist:

1. **Security**:
   * Change all secrets in `packages/backend/.env` (`JWT_SECRET`, `ENCRYPTION_KEY`, database passwords).
   * Generate SSL certificates using Let's Encrypt and configure them in `infrastructure/nginx/nginx.conf`.
2. **Infrastructure**:
   * Deploy the Docker Compose production stack (`docker-compose.prod.yml`) to an AWS EC2 instance or DigitalOcean Droplet.
   * Point your domain's DNS A records to your server IP.
3. **SMS OTP**:
   * In `packages/backend/.env`, change `OTP_SERVICE=console` to `twilio` or `msg91` and provide your API keys to enable real SMS verification.
4. **App Stores**:
   * Build the standalone mobile app using Expo Application Services (EAS): `eas build --platform all`.
   * Submit to Apple App Store and Google Play Store.

---

## 🤝 Contributing & Credits

* **Author**: Zuha Khalid
* **License**: MIT
* **App Name**: AirPool

---

*Safe travels and happy pooling! 🛫🚗*

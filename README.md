# Geeks Bank - Vulnerable Banking Application

Geeks Bank is a deliberately vulnerable web application designed for cybersecurity education, penetration testing practice, and Capture The Flag (CTF) simulations.

This application demonstrates various popular security flaws based on the **OWASP Top 10** in a real-world digital banking scenario.

---

## 🚀 Key Features
* **Authentication & Registration**: Customer login and registration system.
* **Fund Transfer**: Transfer funds between Geeks Bank customer accounts.
* **Top Up & Bill Payment**: Balance top-up and transaction bill payment features.
* **Admin Panel**: Administrative console to manage customers and view banking statistics.
* **Open API Documentation**: Public API documentation page (Swagger).

---

## 🛠️ Tech Stack
* **Backend**: Node.js & Express.js
* **Database**: SQLite (In-Memory Database for easy data reset)
* **Frontend**: Vanilla HTML, CSS, & JavaScript
* **Containerization**: Docker & Docker Compose

---

## 📥 Getting Started (Download & Install)

### Prerequisites
Install these first:
* **Git** — to download the lab: <https://git-scm.com/downloads>
* **Docker Desktop** (recommended) — runs the **full** lab, including the RCE/reverse shell:
  <https://www.docker.com/products/docker-desktop/> (make sure it is running before you start)
* *(Optional)* **Node.js 20+** — only if you prefer running without Docker: <https://nodejs.org/>
* *(Optional, for the attack labs)* **curl**, **jq**, **ExifTool**, and **Nmap/Ncat** on your host.

### 1. Download the lab
Clone the repository and enter the project folder:
```bash
git clone https://github.com/dodiventuraz/vuln_geeks_bank.git
cd vuln_geeks_bank
```
> Prefer not to use Git? On GitHub click **Code → Download ZIP**, extract it, then `cd` into the
> extracted folder.

### 2. Start the lab
Continue with **Method 1 (Docker)** below (recommended) or **Method 2 (Node.js)**.

---

## 🐳 Running the Application

The application is configured to run on port **`3000`** by default to prevent conflicts with proxy testing tools like **Burp Suite** (which typically use port `8080`).

### Method 1: Using Docker Compose (Highly Recommended)
This is the **recommended** way to run the lab: the container (Node.js 22 on Alpine Linux) ships
with **ImageMagick** and a shell, so **every** vulnerability works end-to-end — including the
avatar-upload **Remote Code Execution (RCE)** and reverse shell.

Ensure Docker Desktop is installed and running, then from the project root:

```bash
# Build the image and start the lab
docker compose up --build

# ...to stop it later:
docker compose down
```
Access the application via your browser at: **`http://localhost:3000`**

> The container is named `vuln-geeks-bank`. The source folder is bind-mounted, so after editing
> `server.js` (or other files) just restart the container to apply changes — no rebuild needed.

### Method 2: Running Locally (Node.js)
Ensure Node.js is installed (version 20+ recommended), then run:

```bash
# Install project dependencies
npm install

# Start the server
npm start
```
Access the application via your browser at: **`http://localhost:3000`**

> Note: on a bare Node.js host without **ImageMagick** installed, the avatar-upload RCE (#16)
> still executes injected commands, but the thumbnail step degrades gracefully. For the full lab
> experience (including the reverse shell walkthrough in **`vulnerability_list.md`**), use
> **Method 1 (Docker)**.

### Verifying the vulnerabilities
With the lab running, you can auto-check the deliberate flaws from the host:
```bash
node test_vulnerabilities.js
```

---

## ⚠️ List of Vulnerabilities
This application contains various security flaws that are documented in detail in the **`vulnerability_list.md`** file. Some of the vulnerabilities include:
* **SQL Injection (SQLi)** on the login page.
* **Broken Object Level Authorization (BOLA / IDOR)** on the change password feature.
* **Broken Function Level Authorization (BFLA)** on the admin panel.
* **Insecure File Upload** allowing web shell uploads.
* **Server-Side Request Forgery (SSRF) & Remote File Inclusion (RFI)** on the avatar URL import feature.
* Authentication bypass using the JWT `none` algorithm.
* **OS Command Injection → Remote Code Execution (RCE)** via the avatar upload (image comment metadata).

A full **RCE reverse-shell lab walkthrough** (including the local-Docker quick start) is provided in
**`vulnerability_list.md`** under *"Lab Exercise: Reverse Shell via Avatar Upload"*.

---

> [!WARNING]
> **DISCLAIMER**: This application contains severe security vulnerabilities, including **real Remote Code Execution**. **NEVER** deploy this application to a production server or expose it directly to the public internet — anyone who finds it could gain a shell on the host. Use it only in an isolated local environment for educational purposes.

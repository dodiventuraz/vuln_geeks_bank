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
Ensure Docker is installed on your system, then run:

```bash
# Build and run the container
docker-compose up --build
```
Access the application via your browser at: **`http://localhost:3000`**

### Method 2: Running Locally (Node.js)
Ensure Node.js is installed (version 20+ recommended), then run:

```bash
# Install project dependencies
npm install

# Start the server
npm start
```
Access the application via your browser at: **`http://localhost:3000`**

---

## ⚠️ List of Vulnerabilities
This application contains various security flaws that are documented in detail in the **`vulnerability_list.md`** file. Some of the vulnerabilities include:
* **SQL Injection (SQLi)** on the login page.
* **Broken Object Level Authorization (BOLA / IDOR)** on the change password feature.
* **Broken Function Level Authorization (BFLA)** on the admin panel.
* **Insecure File Upload** allowing web shell uploads.
* **Server-Side Request Forgery (SSRF) & Remote File Inclusion (RFI)** on the avatar URL import feature.
* Authentication bypass using the JWT `none` algorithm.

> [!WARNING]
> **DISCLAIMER**: This application contains severe security vulnerabilities. **NEVER** deploy this application to a production server or expose it directly to the public internet. Use it only in an isolated local environment for educational purposes.

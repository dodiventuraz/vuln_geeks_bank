# Geeks Bank - Vulnerable Banking Application

Geeks Bank adalah aplikasi perbankan digital sengaja dibuat rentan (*deliberately vulnerable web application*) yang dirancang khusus untuk pembelajaran keamanan informasi (cybersecurity), latihan *penetration testing*, dan simulasi CTF (Capture The Flag).

Aplikasi ini mendemonstrasikan berbagai celah keamanan populer berdasarkan **OWASP Top 10** dalam skenario aplikasi perbankan dunia nyata.

---

## 🚀 Fitur Utama
* **Autentikasi & Registrasi**: Sistem masuk dan daftar akun nasabah.
* **Transfer Dana**: Fitur kirim uang antar rekening nasabah Geeks Bank.
* **Top Up & Pembayaran Tagihan**: Fitur pengisian saldo dan transaksi pembayaran.
* **Panel Admin**: Konsol administrasi untuk mengelola nasabah dan melihat statistik perbankan.
* **Dokumentasi API Terbuka**: Halaman dokumentasi API (Swagger) publik.

---

## 🛠️ Tech Stack
* **Backend**: Node.js & Express.js
* **Database**: SQLite (In-Memory Database untuk mempermudah reset data)
* **Frontend**: Vanilla HTML, CSS, & JavaScript
* **Containerization**: Docker & Docker Compose

---

## 🐳 Cara Menjalankan Aplikasi

Aplikasi ini dikonfigurasi menggunakan port **`3000`** secara default agar tidak bentrok dengan alat proxy pengetesan seperti **Burp Suite** (yang biasanya memakai port `8080`).

### Metode 1: Menggunakan Docker Compose (Sangat Direkomendasikan)
Pastikan Anda sudah menginstal Docker di sistem Anda, lalu jalankan perintah berikut:

```bash
# Build dan jalankan container
docker-compose up --build
```
Akses aplikasi melalui peramban di: **`http://localhost:3000`**

### Metode 2: Menjalankan Secara Lokal (Node.js)
Pastikan Node.js sudah terinstal (disarankan versi 20+), lalu jalankan perintah berikut:

```bash
# Install dependensi proyek
npm install

# Jalankan server
npm start
```
Akses aplikasi melalui peramban di: **`http://localhost:3000`**

---

## ⚠️ Daftar Celah Keamanan (Vulnerabilities)
Aplikasi ini memiliki berbagai celah keamanan yang terdokumentasi secara lengkap pada berkas **`VULNERABILITY_LIST.md`**. Beberapa celah yang ada di antaranya:
* **SQL Injection (SQLi)** pada halaman login.
* **Broken Object Level Authorization (BOLA / IDOR)** pada fitur ganti kata sandi nasabah.
* **Broken Function Level Authorization (BFLA)** pada panel admin.
* **Insecure File Upload** yang memungkinkan pengunggahan shell web.
* **Server-Side Request Forgery (SSRF) & Remote File Inclusion (RFI)** pada fitur import avatar URL.
* Bypass autentikasi menggunakan algoritma JWT `none`.

> [!WARNING]
> **DISCLAIMER**: Aplikasi ini mengandung celah keamanan yang berbahaya. **JANGAN PERNAH** men-deploy aplikasi ini di server produksi atau mengeksposnya langsung ke internet publik. Gunakan hanya di lingkungan lokal yang terisolasi untuk tujuan edukasi.

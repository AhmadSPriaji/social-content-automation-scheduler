# Peta Jalan Integrasi Nyata (Real API Integration Roadmap)

Dokumen ini adalah cetak biru (*blueprint*) teknis untuk mengubah seluruh *endpoint* tiruan (*Mock APIs*) di dalam aplikasi **Social Content Automation Scheduler** menjadi integrasi platform sosial media sungguhan (Twitter/X, Facebook, LinkedIn, dll).

Gunakan dokumen ini sebagai panduan langkah demi langkah saat Anda siap mengeksekusi integrasi nyata.

---

## Prasyarat Utama (External Setups)

Sebelum menyentuh baris kode apa pun, Anda wajib melakukan hal berikut di luar aplikasi:
1. Buka **Developer Portal** dari setiap platform yang ingin diintegrasikan (misal: [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)).
2. Buat "App" baru untuk mendapatkan **Client ID** (API Key) dan **Client Secret**.
3. Daftarkan URL aplikasi kita sebagai **Callback URL** yang sah di portal tersebut (misal: `https://api.domainkita.com/auth/twitter/callback`).
4. Daftarkan URL aplikasi kita sebagai **Webhook URL** yang sah (misal: `https://api.domainkita.com/posts/webhook`).

---

## Fase 1: Integrasi Otentikasi Asli (Real OAuth2)

Saat ini `WorkspacesService.mockOauthConnect` hanya mengembalikan token acak.

**Langkah Eksekusi:**
1. **Instalasi Pustaka**: Pasang `@nestjs/passport`, `passport`, dan *strategy* spesifik (misal: `passport-twitter-oauth2`).
2. **Ubah Skema Workspace**: Tambahkan *field* baru di `WorkspaceSchema` untuk menyimpan token akses asli.
   ```typescript
   connectedAccounts: {
     provider: string; // 'twitter', 'facebook'
     accessToken: string;
     refreshToken: string;
   }[]
   ```
3. **Ubah Controller & Service**:
   - Buat *endpoint* yang akan mengarahkan (*redirect*) pengguna ke halaman login Twitter (menggunakan `@UseGuards(AuthGuard('twitter'))`).
   - Buat *endpoint callback* tempat Twitter melempar kembali pengguna ke backend kita beserta `accessToken`.
   - Enkripsi `accessToken` tersebut sebelum menyimpannya ke MongoDB untuk menjaga keamanan (*Security Best Practices*).

---

## Fase 2: Publikasi Asli lewat BullMQ (Real Publishing)

Saat ini `PostProcessor` menggunakan `setTimeout` untuk simulasi jeda dan `Math.random()` untuk simulasi *error*.

**Langkah Eksekusi:**
1. **Instal HTTP Client**: Pasang `@nestjs/axios` dan `axios` untuk melakukan *HTTP request*.
2. **Ambil Token**: Di dalam fungsi `process(job)` pada `PostProcessor`, baca `workspaceId` dari postingan, lalu cari `accessToken` yang tersimpan di database dari Fase 1.
3. **Panggil API Platform**: Ganti `setTimeout` dengan panggilan *request* ke API platform (contoh di bawah untuk Twitter v2 API):
   ```typescript
   const response = await this.httpService.axiosRef.post(
     'https://api.twitter.com/2/tweets',
     { text: post.content },
     { headers: { Authorization: `Bearer ${workspace.twitterAccessToken}` } }
   );
   ```
4. **Validasi Error Asli**: Hapus `Math.random()`. Biarkan BullMQ secara otomatis mendeteksi jika panggilan `axios` melempar *error* (misal kode 429 *Too Many Requests* atau 500 *Server Error*). Jika gagal, BullMQ akan memicu retri eksponensial yang sudah kita buat secara otomatis.

---

## Fase 3: Callback Webhook Asli (Real Webhooks)

Saat ini `PostsController.webhookCallback` menerima JSON apapun secara buta. Ini sangat berbahaya di dunia nyata.

**Langkah Eksekusi:**
1. **Ambil Kunci Rahasia**: Dapatkan *Webhook Secret Key* dari platform sosial media. Simpan di `.env` aplikasi kita.
2. **Validasi Tanda Tangan (Signature Verification)**:
   - Platform akan selalu mengirimkan kode tanda tangan kriptografi lewat *Headers* (misal: `X-Hub-Signature-256` dari Facebook).
   - Buat fungsi atau *NestJS Middleware* menggunakan `crypto.createHmac('sha256', secretKey)` untuk mencocokkan isi *body* dengan tanda tangan di *header*.
   - Tolak dengan status `401 Unauthorized` jika tanda tangan tidak cocok.
3. **Pemrosesan Asli**: Setelah diyakini valid, proses *payload* dari platform. Karena format JSON dari setiap platform berbeda-beda, buat *switch/case* untuk memetakan status spesifik platform ke dalam status standar aplikasi kita (`published` atau `failed`).

---

## Fase 4: Integrasi Analitik Asli (Real Analytics)

Saat ini `PostsService.getMockAnalytics` mereturn angka-angka dari `Math.random()`.

**Langkah Eksekusi:**
1. **Gunakan Cron Job (Penjadwalan)**: Pasang `@nestjs/schedule` untuk mengaktifkan *cron job* di NestJS.
2. **Tarik Data Secara Berkala**: Buat sebuah *service* yang berjalan setiap jam (misal: `@Cron(CronExpression.EVERY_HOUR)`).
   - Temukan seluruh postingan di *database* yang berstatus `published`.
   - Lakukan panggilan API `GET` ke platform terkait (misal Twitter Analytics API) untuk mengambil jumlah *likes*, *retweets*, *replies*.
   - Simpan data *real* ini kembali ke dokumen Post di *database*.
3. **Ubah Endpoint Controller**: Ubah `PostsController.getAnalytics` agar tidak menghasilkan *random string*, melainkan sekadar membacakan data *likes* & *shares* terakhir yang baru saja di-*update* oleh *Cron Job* dari database.

---
**Catatan Penting (Enterprise Grade):** Karena kita sudah memiliki pondasi Audit Logs dan RBAC, setiap kegagalan atau keberhasilan di eksekusi nyata ini akan tetap tercatat dengan sangat rapi dan otomatis, memudahkan pelacakan kerusakan (debugging).

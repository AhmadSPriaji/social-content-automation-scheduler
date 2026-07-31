# Frontend Development Roadmap

Dokumen ini merinci tahapan pengembangan untuk aplikasi frontend (Next.js) berdasarkan _Product Requirements Document_ (PRD) fase 5. Pendekatan ini memastikan alur pengembangan terstruktur mulai dari autentikasi hingga real-time updates.

---

## Tahap 1: Fondasi UI & Routing Dasar (Foundation & Shared UI)
**Fokus:** Membangun *layout* utama dan komponen dasar yang dapat digunakan ulang di seluruh aplikasi.

**Detail Pengerjaan:**
1. **Instalasi Komponen UI (shadcn/ui):**
   - Menambahkan komponen esensial: `Button`, `Input`, `Form`, `Card`, `Dialog`, `Toast` (Sonner), `Avatar`, `Badge`, `DropdownMenu`, `Tabs`, `Table`.
2. **Setup Global State (Zustand):**
   - Membuat `authStore`: Menyimpan data _current user_ dan status otentikasi.
   - Membuat `workspaceStore`: Menyimpan data _active workspace_ dan daftar anggota beserta _role_-nya.
3. **Layouting Dasar:**
   - Membuat `DashboardLayout`: Terdiri dari Sidebar (untuk navigasi menu) dan Topbar (untuk profil & memilih Workspace).
   - Menerapkan _Responsive Design_ menggunakan Tailwind CSS.

---

## Tahap 2: Autentikasi & Manajemen Sesi (Auth & Session)
**Fokus:** Mengamankan aplikasi dan menghubungkan ke backend otentikasi.

**Detail Pengerjaan:**
1. **Halaman Login & Register:**
   - Membuat form menggunakan `React Hook Form` dan divalidasi dengan `Zod`.
   - Menampilkan *loading state* dan pesan error (toast) saat kredensial salah.
2. **Integrasi API Client & Interceptor:**
   - Menyempurnakan `lib/api.ts` untuk menangkap error `401 Unauthorized`.
   - Mengimplementasikan alur _Silent Refresh_ ke `/auth/refresh` secara otomatis jika akses token *expired*.
3. **Route Protection (Middleware):**
   - Melindungi rute `/dashboard/*` agar hanya bisa diakses oleh pengguna yang sudah *login*. Melempar pengguna ke `/login` jika belum punya sesi.
4. **Alur Workspace (Onboarding):**
   - Jika pengguna baru login dan belum punya workspace, arahkan ke form "Create Workspace".

---

## Tahap 3: Pembuatan Post, Media Upload, & RBAC (Content & Authoring)
**Fokus:** Fitur utama membuat konten dan memastikan otorisasi level UI berjalan.

**Detail Pengerjaan:**
1. **Halaman Dashboard Utama (List View):**
   - Menampilkan tabel/list postingan milik Workspace yang aktif.
   - Menambahkan filter/tabs berdasarkan status: `All`, `Draft`, `Scheduled`, `Published`, `Failed`.
   - Styling _Status Badge_ dengan warna berbeda (Misal: Draft=Abu-abu, Scheduled=Biru, Published=Hijau, Failed=Merah).
2. **Modal / Halaman Create Post:**
   - Input teks untuk konten post (mendukung textarea).
   - Fitur upload gambar menggunakan input tipe file.
   - Mengimplementasikan visualisasi _Progress Bar_ saat mengunggah gambar ke `/posts/upload`.
3. **Penerapan RBAC & ABAC di UI:**
   - Mengecek *role* user aktif dari Zustand store (`owner`, `editor`, `viewer`).
   - Jika user adalah `viewer`, sembunyikan atau *disable* tombol `Create Post`, `Edit`, dan `Delete`.

---

## Tahap 4: Mesin Penjadwalan & Real-time State (Scheduling & Polling)
**Fokus:** Menghubungkan proses *background worker* di backend agar terlihat *real-time* di frontend.

**Detail Pengerjaan:**
1. **Integrasi Scheduling:**
   - Menambahkan Date/Time Picker di modal post.
   - Memanggil API `POST /posts/:id/schedule`.
2. **Optimistic UI (TanStack Query):**
   - Saat tombol "Schedule" ditekan, frontend langsung mengubah status lokal post menjadi `Scheduled` di _cache_ React Query sebelum respon backend selesai, agar UI terasa sangat cepat (_snappy_).
3. **Polling Data Otomatis:**
   - Mengatur parameter `refetchInterval: 3000` (3 detik) pada TanStack Query `useQuery` di halaman List View.
   - Ini memungkinkan UI untuk berganti otomatis (misalnya dari `Scheduled` ke `Published` atau `Failed`) seiring BullMQ Worker memproses *queue* di backend, tanpa perlu menekan tombol _Refresh_ halaman.

---

## Tahap 5: Fitur Tambahan & Penyempurnaan (Portfolio Plus)
**Fokus:** Fitur kompleks ekstra untuk menunjukkan penguasaan _fullstack_ yang dalam (Sesuai bagian *Portfolio Plus* di PRD).

**Detail Pengerjaan:**
1. **Calendar View (Drag-and-Drop):**
   - Mengintegrasikan library seperti `react-big-calendar` atau `@fullcalendar/react`.
   - Mengizinkan _drag-and-drop_ postingan antar tanggal kalender yang secara otomatis memanggil API _reschedule_.
2. **Tampilan Analitik (Mock Charts):**
   - Menambahkan library `Recharts` atau built-in _shadcn charts_.
   - Menampilkan visualisasi jumlah "Likes" dan "Views" palsu dari post yang sudah _Published_.
3. **Log Audit & Dead-letter Queue:**
   - Membuat halaman khusus untuk melihat histori *retry* dari sebuah post, membaca tabel log untuk melihat percobaan *publish* yang gagal.

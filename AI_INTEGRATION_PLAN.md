# Real AI Integration Plan (AI Caption Generator)

Dokumen ini berisi langkah-langkah terstruktur untuk mengganti *Mock AI Caption* dengan model AI sungguhan (seperti OpenAI atau Google Gemini) jika Anda memutuskan untuk mengimplementasikannya di masa depan.

## 1. Persiapan Environment Variables
Tambahkan *API Key* dari layanan AI pilihan Anda ke file `.env` di dalam direktori `backend/`.

```env
# backend/.env
OPENAI_API_KEY="sk-..."
# ATAU jika menggunakan Gemini
GEMINI_API_KEY="AIza..."
```

## 2. Instalasi Dependency (Backend)
Instal SDK resmi dari layanan AI tersebut di direktori backend.

```bash
cd backend
npm install @google/generative-ai  # Jika pakai Gemini
# ATAU
npm install openai                 # Jika pakai OpenAI
```

## 3. Modifikasi `PostsService`
Ubah implementasi `generateAiCaption` di dalam file `backend/src/posts/posts.service.ts`.

### Contoh Kode Integrasi (Google Gemini):
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

// ... (di dalam kelas PostsService)

async generateAiCaption(prompt: string): Promise<{ caption: string }> {
  try {
    // Inisialisasi SDK dengan API Key dari environment variable
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Instruksi sistem (System Prompt) agar hasil konsisten
    const systemInstruction = "Anda adalah asisten penulis konten sosial media yang kreatif. Buatlah caption yang menarik berdasarkan topik/judul yang diberikan. Sertakan emoji dan 2-3 hashtag. Jangan tuliskan teks pengantar, kembalikan hanya isi caption-nya saja.";
    const fullPrompt = `${systemInstruction}\n\nTopik Postingan: ${prompt}`;
    
    const result = await model.generateContent(fullPrompt);
    const caption = result.response.text();
    
    return { caption: caption.trim() };
  } catch (error) {
    console.error('Error generating AI caption:', error);
    // Kembalikan error agar frontend bisa menampilkannya ke user
    throw new Error('Gagal menghubungi layanan AI. Silakan coba lagi nanti.');
  }
}
```

## 4. Pertimbangan Produksi (Opsional)
- **Rate Limiting**: Gunakan modul seperti `@nestjs/throttler` pada endpoint `generate-caption` di `PostsController` untuk mencegah *spamming* atau kehabisan kuota API karena pengguna yang iseng.
- **Handling Timeout**: Layanan AI eksternal terkadang membutuhkan waktu beberapa detik. Pastikan frontend tidak mengalami *timeout error* jika proses sedikit lama.

## 5. Perubahan Frontend
**Tidak ada perubahan besar yang diperlukan di Frontend!**
Frontend saat ini sudah memanggil `/posts/generate-caption` dan mengharapkan respons `{ caption: "..." }`. Karena kontrak (*payload*) data tidak berubah, antarmuka pengguna akan langsung menampilkan teks AI sungguhan secara otomatis (plug-and-play) segera setelah backend diperbarui.

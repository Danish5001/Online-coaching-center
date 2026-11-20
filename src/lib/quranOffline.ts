export interface QuranAyah {
  number: number;
  numberInSurah: number;
  arabic: string;
  urdu: string;
  english: string;
  audioUrl: string;
}

export interface QuranSurahDetail {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: QuranAyah[];
}

export interface FullQuranArchive {
  downloadedAt: string;
  editionArabic: string;
  editionUrdu: string;
  totalSurahs: number;
  surahs: QuranSurahDetail[];
}

const DB_NAME = 'scholaraxis_quran_db';
const STORE_NAME = 'quran_store';
const FULL_KEY = 'full_quran_urdu_v1';

function openQuranDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFullQuranOffline(archive: FullQuranArchive): Promise<void> {
  const db = await openQuranDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(archive, FULL_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFullQuranOffline(): Promise<FullQuranArchive | null> {
  try {
    const db = await openQuranDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(FULL_KEY);
      req.onsuccess = () => resolve((req.result as FullQuranArchive) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportFullQuranAsHtml(archive: FullQuranArchive) {
  const surahsHtml = archive.surahs
    .map(
      (s) => `
      <section class="surah" id="surah-${s.number}">
        <div class="surah-head">
          <h2>${s.number}. ${escapeHtml(s.englishName)} — <span dir="rtl">${escapeHtml(s.name)}</span></h2>
          <div class="meta">${escapeHtml(s.englishNameTranslation)} · ${escapeHtml(s.revelationType)} · ${s.numberOfAyahs} Ayahs</div>
        </div>
        ${s.ayahs
          .map(
            (a) => `
          <div class="ayah">
            <div class="ar" dir="rtl">${escapeHtml(a.arabic)} <span class="num">﴿${a.numberInSurah}﴾</span></div>
            <div class="ur" dir="rtl">${escapeHtml(a.urdu)}</div>
          </div>`
          )
          .join('')}
      </section>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Holy Quran with Urdu Translation — ScholarAxis Academy</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 32px auto; padding: 0 20px; background: #F8FAFC; color: #0F172A; }
    header { border-bottom: 2px solid #047857; padding-bottom: 16px; margin-bottom: 28px; }
    .surah { background: #FFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .surah-head { border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 16px; }
    .surah-head h2 { margin: 0; font-size: 20px; }
    .meta { font-size: 12px; color: #64748B; margin-top: 4px; }
    .ayah { padding: 14px 0; border-bottom: 1px solid #F1F5F9; }
    .ayah:last-child { border-bottom: none; }
    .ar { font-size: 26px; line-height: 2.1; color: #0F172A; font-family: "Amiri", "Traditional Arabic", serif; }
    .num { font-size: 16px; color: #047857; }
    .ur { font-size: 18px; line-height: 2.0; color: #334155; margin-top: 8px; font-family: "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", serif; }
  </style>
</head>
<body>
  <header>
    <h1>Al-Quran Al-Kareem — Complete Arabic & Urdu Translation</h1>
    <p>114 Surahs · ${escapeHtml(archive.editionArabic)} & ${escapeHtml(archive.editionUrdu)} · ScholarAxis Academy</p>
  </header>
  ${surahsHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'holy-quran-complete-urdu-translation.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

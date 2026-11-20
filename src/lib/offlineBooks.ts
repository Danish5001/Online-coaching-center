import { SyllabusBook } from '../types';

const BOOKS_STORAGE_KEY = 'scholaraxis_offline_books_v1';
const LESSONS_STORAGE_KEY = 'scholaraxis_offline_lessons_v1';

export interface OfflineBookRecord {
  id: string;
  title: string;
  academicLevel: string;
  grade: string;
  subject: string;
  boardOrAuthor: string;
  description: string;
  resourceUrl: string;
  chapters: string[];
  downloadedAt: string;
}

export function getOfflineBooks(): Record<string, OfflineBookRecord> {
  try {
    const raw = localStorage.getItem(BOOKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBookOffline(book: SyllabusBook): Record<string, OfflineBookRecord> {
  const existing = getOfflineBooks();
  existing[book.id] = {
    id: book.id,
    title: book.title,
    academicLevel: book.academicLevel,
    grade: book.grade,
    subject: book.subject,
    boardOrAuthor: book.boardOrAuthor,
    description: book.description,
    resourceUrl: book.resourceUrl,
    chapters: book.chapters,
    downloadedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // storage full fallback
  }
  return existing;
}

export function saveAllBooksOffline(books: SyllabusBook[]): Record<string, OfflineBookRecord> {
  const existing = getOfflineBooks();
  const now = new Date().toISOString();
  for (const book of books) {
    existing[book.id] = {
      id: book.id,
      title: book.title,
      academicLevel: book.academicLevel,
      grade: book.grade,
      subject: book.subject,
      boardOrAuthor: book.boardOrAuthor,
      description: book.description,
      resourceUrl: book.resourceUrl,
      chapters: book.chapters,
      downloadedAt: now,
    };
  }
  try {
    localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // storage full fallback
  }
  return existing;
}

export function getCachedLesson(bookId: string, chapterIdx: number): string | null {
  try {
    const raw = localStorage.getItem(LESSONS_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[`${bookId}::${chapterIdx}`] || null;
  } catch {
    return null;
  }
}

export function saveCachedLesson(bookId: string, chapterIdx: number, content: string): void {
  try {
    const raw = localStorage.getItem(LESSONS_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[`${bookId}::${chapterIdx}`] = content;
    localStorage.setItem(LESSONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportBooksAsReadableHtml(books: SyllabusBook[], fileName: string) {
  let cachedLessons: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(LESSONS_STORAGE_KEY);
    if (raw) cachedLessons = JSON.parse(raw);
  } catch {
    cachedLessons = {};
  }

  const sectionsHtml = books
    .map((book) => {
      const chaptersHtml = book.chapters
        .map((ch, idx) => {
          const lesson = cachedLessons[`${book.id}::${idx}`];
          return `
            <div class="chapter">
              <h3>Chapter ${idx + 1}: ${escapeHtml(ch)}</h3>
              ${
                lesson
                  ? `<pre class="lesson">${escapeHtml(lesson)}</pre>`
                  : `<p class="note">Open this chapter inside ScholarAxis Academy to generate full interactive study notes and worked examples.</p>`
              }
            </div>
          `;
        })
        .join('');

      return `
        <article class="book">
          <div class="meta">${escapeHtml(book.academicLevel)} · ${escapeHtml(book.grade)} · ${escapeHtml(book.subject)}</div>
          <h2>${escapeHtml(book.title)}</h2>
          <p class="author">${escapeHtml(book.boardOrAuthor)}</p>
          <p class="desc">${escapeHtml(book.description || '')}</p>
          ${chaptersHtml}
        </article>
      `;
    })
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ScholarAxis Academy — Direct Reading Syllabus Pack</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 24px; color: #0F172A; background: #F8FAFC; line-height: 1.6; }
    header { border-bottom: 2px solid #047857; padding-bottom: 16px; margin-bottom: 32px; }
    h1 { margin: 0; font-size: 28px; }
    .sub { color: #475569; font-size: 14px; margin-top: 6px; }
    .book { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 28px; margin-bottom: 28px; }
    .meta { color: #047857; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
    .book h2 { margin: 0 0 6px; font-size: 22px; }
    .author { color: #64748B; font-size: 13px; margin: 0 0 12px; }
    .desc { color: #334155; font-size: 14px; margin: 0 0 20px; }
    .chapter { border-top: 1px solid #F1F5F9; padding-top: 14px; margin-top: 14px; }
    .chapter h3 { font-size: 16px; margin: 0 0 8px; }
    .lesson { white-space: pre-wrap; font-family: inherit; font-size: 14px; color: #1E293B; background: #F8FAFC; padding: 14px; border-radius: 8px; border: 1px solid #E2E8F0; }
    .note { font-size: 13px; color: #64748B; margin: 0; }
  </style>
</head>
<body>
  <header>
    <h1>ScholarAxis Academy — Syllabus Books Pack</h1>
    <div class="sub">Downloaded on ${new Date().toLocaleDateString()} · ${books.length} ${books.length === 1 ? 'Book' : 'Books'} included for direct offline reading</div>
  </header>
  ${sectionsHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_NAME = 'gemini-4-hydrogen';
const TRANSLATE_MODEL = 'gemini-3.1-flash-lite';

function getGeminiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please check Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // AI Study & App Assistance Chatbot Endpoint
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, context } = req.body as {
        messages?: { role: 'user' | 'model'; text: string }[];
        context?: {
          userName?: string;
          role?: string;
          academicLevel?: string;
          activeBookTitle?: string;
          activeChapter?: string;
        };
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required.' });
      }

      const ai = getGeminiClient();

      const systemInstruction = [
        'You are the official AI Academic Tutor and Help Assistant for ScholarAxis Academy, an online coaching center covering Nursery through Masters.',
        `User Profile: Name="${context?.userName || 'Member'}", Role="${context?.role || 'student'}", Academic Level="${context?.academicLevel || 'All Levels'}".`,
        context?.activeBookTitle
          ? `Currently reading book: "${context.activeBookTitle}"${context.activeChapter ? `, Chapter: "${context.activeChapter}"` : ''}.`
          : '',
        'Academy Facts for Help Queries:',
        '- Registration fee: $10 USD one-time lifetime fee (PKR 2,780) via EasyPaisa QR or mobile account 923132746091 (MUHAMMAD DANISH MEHMOOD).',
        '- Syllabus Books Library covers all 7 tiers from Early Years (Nursery–KG) through Masters, with chapter tracking, offline download, and direct in-app reading.',
        '- Live Coaching Sessions are scheduled by teachers and can be joined from the Live Sessions tab.',
        '- Email verification is required for all accounts.',
        'Instructions: Adapt your tone and depth to the student academic level (simple and encouraging for Nursery/Primary, rigorous and structured for Secondary/Bachelors/Masters). Be concise, clear, and well-formatted with headings or bullet points when helpful.',
      ]
        .filter(Boolean)
        .join('\n');

      const contents = messages.slice(-14).map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.text || '').slice(0, 3000) }],
      }));

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
        },
      });

      return res.json({ reply: response.text || 'I could not generate a response. Please try again.' });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'AI assistant request failed.';
      console.error('Gemini /api/ai/chat error:', errMsg);
      const status = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') ? 429 : 500;
      return res.status(status).json({ error: errMsg });
    }
  });

  // Direct Reading Chapter Lesson Generator Endpoint
  app.post('/api/ai/chapter-lesson', async (req, res) => {
    try {
      const { bookTitle, academicLevel, grade, subject, chapterTitle } = req.body as {
        bookTitle?: string;
        academicLevel?: string;
        grade?: string;
        subject?: string;
        chapterTitle?: string;
      };

      if (!bookTitle || !chapterTitle) {
        return res.status(400).json({ error: 'bookTitle and chapterTitle are required.' });
      }

      const ai = getGeminiClient();

      const prompt = [
        `Write a clear, complete textbook reading lesson for direct in-app study.`,
        `Book: ${bookTitle}`,
        `Academic Level: ${academicLevel || 'General'} (${grade || ''})`,
        `Subject: ${subject || 'General'}`,
        `Chapter: ${chapterTitle}`,
        '',
        'Structure the lesson cleanly with these exact sections:',
        '1. Chapter Overview (2-3 sentences)',
        '2. Core Concepts & Explanations (clear, level-appropriate teaching notes with key definitions)',
        '3. Worked Example or Real-World Application',
        '4. Key Takeaways (3-5 concise bullet points)',
        '5. Quick Self-Check Questions (3 practice questions with brief answers at the bottom)',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert curriculum textbook author for ScholarAxis Academy. Write clean, accurate, well-structured study material tailored precisely to the requested grade level from Nursery to Masters.',
        },
      });

      return res.json({
        content: response.text || 'Lesson content could not be generated.',
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to generate chapter lesson.';
      console.error('Gemini /api/ai/chapter-lesson error:', errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

  // In-memory translation cache for instant repeat lookups
  const translationCache = new Map<string, string>();

  // All-Language Fast Translator Endpoint (Gemini 3.1 Flash Lite + Minimal Thinking + Streaming)
  app.post('/api/ai/translate', async (req, res) => {
    try {
      const { text, sourceLanguage, targetLanguage, stream } = req.body as {
        text?: string;
        sourceLanguage?: string;
        targetLanguage?: string;
        stream?: boolean;
      };

      if (!text || !text.trim() || !targetLanguage || !targetLanguage.trim()) {
        return res.status(400).json({ error: 'Both text and targetLanguage are required.' });
      }

      const trimmedText = text.trim().slice(0, 4000);
      const target = targetLanguage.trim();
      const source = sourceLanguage || 'Auto-Detect';
      const cacheKey = `${source}|${target}|${trimmedText}`;

      const cached = translationCache.get(cacheKey);
      if (cached) {
        if (stream) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.end(cached);
        }
        return res.json({ translation: cached, cached: true });
      }

      const ai = getGeminiClient();
      const srcNote =
        source !== 'Auto-Detect' ? `from ${source}` : '(auto-detect source language)';

      const prompt = `Translate ${srcNote} into ${target}. Output ONLY the accurate, natural translation with no commentary or markdown.\n\n${trimmedText}`;
      const config = {
        systemInstruction:
          'You are a fast, accurate multilingual translator covering all world languages. Output only the translated text preserving exact meaning and script.',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      };

      if (stream) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        let fullOutput = '';
        const responseStream = await ai.models.generateContentStream({
          model: TRANSLATE_MODEL,
          contents: prompt,
          config,
        });

        for await (const chunk of responseStream) {
          const piece = chunk.text || '';
          if (piece) {
            fullOutput += piece;
            res.write(piece);
          }
        }

        const finalTrimmed = fullOutput.trim();
        if (finalTrimmed) {
          if (translationCache.size >= 250) {
            const oldestKey = translationCache.keys().next().value;
            if (oldestKey) translationCache.delete(oldestKey);
          }
          translationCache.set(cacheKey, finalTrimmed);
        }
        return res.end();
      }

      const response = await ai.models.generateContent({
        model: TRANSLATE_MODEL,
        contents: prompt,
        config,
      });

      const finalTranslation = (response.text || '').trim();
      if (finalTranslation) {
        if (translationCache.size >= 250) {
          const oldestKey = translationCache.keys().next().value;
          if (oldestKey) translationCache.delete(oldestKey);
        }
        translationCache.set(cacheKey, finalTranslation);
      }

      return res.json({
        translation: finalTranslation,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Translation failed.';
      console.error('Gemini /api/ai/translate error:', errMsg);
      const isQuota = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
      if (res.headersSent) {
        return res.end();
      }
      return res.status(isQuota ? 429 : 500).json({
        error: isQuota
          ? 'Daily free-tier AI translation quota reached. You can select a billing-enabled API key in Settings > Secrets for higher quota.'
          : errMsg,
        quotaExceeded: isQuota,
      });
    }
  });

  // In-memory TTS audio cache to preserve Gemini TTS quota on repeated reads
  const ttsAudioCache = new Map<string, string>();

  // AI Voice Bot Text-to-Speech Endpoint (Gemini 3.8 Flash Lite TTS)
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const { text, voiceName, style } = req.body as {
        text?: string;
        voiceName?: string;
        style?: string;
      };

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text is required for voice reading.' });
      }

      const allowedVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
      const chosenVoice = allowedVoices.includes(voiceName || '') ? voiceName! : 'Kore';
      const chosenStyle = (style || 'Clear, warm, well-paced educational narrator').slice(0, 140);
      const trimmedText = text.trim().slice(0, 2500);
      const cacheKey = `${chosenVoice}|${chosenStyle}|${trimmedText}`;

      const cachedAudio = ttsAudioCache.get(cacheKey);
      if (cachedAudio) {
        return res.json({
          audioBase64: cachedAudio,
          mimeType: 'audio/wav',
          cached: true,
        });
      }

      const ai = getGeminiClient('v1beta');
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: trimmedText,
                speechMetadata: {
                  style: chosenStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        return res.status(500).json({ error: 'Voice bot did not return audio data.' });
      }

      if (ttsAudioCache.size >= 120) {
        const oldestKey = ttsAudioCache.keys().next().value;
        if (oldestKey) ttsAudioCache.delete(oldestKey);
      }
      ttsAudioCache.set(cacheKey, base64Audio);

      // Unary Gemini 3.8 TTS returns a complete audio/wav file
      return res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Voice bot TTS failed.';
      const isQuota = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
      if (isQuota) {
        console.warn('Gemini /api/ai/tts free-tier daily quota reached (429).');
        return res.status(429).json({
          error:
            'Gemini AI Voice free-tier daily limit (10 requests/day) reached. To unlock higher AI voice quota, select a billing-enabled API key in Settings > Secrets.',
          quotaExceeded: true,
        });
      }
      console.error('Gemini /api/ai/tts error:', errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

  // --- Full Holy Quran + Urdu Translation Fast Preloaded Store (jsDelivr CDN + Fallback) ---
  interface QuranAyahRecord {
    number: number;
    numberInSurah: number;
    arabic: string;
    urdu: string;
    english: string;
    audioUrl: string;
  }

  interface QuranSurahRecord {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
    numberOfAyahs: number;
    ayahs: QuranAyahRecord[];
  }

  interface QuranStore {
    downloadedAt: string;
    editionArabic: string;
    editionUrdu: string;
    totalSurahs: number;
    surahList: Array<Omit<QuranSurahRecord, 'ayahs'>>;
    surahMap: Map<number, QuranSurahRecord>;
    fullPayload: {
      downloadedAt: string;
      editionArabic: string;
      editionUrdu: string;
      totalSurahs: number;
      surahs: QuranSurahRecord[];
    };
  }

  let quranStore: QuranStore | null = null;
  let quranLoadPromise: Promise<QuranStore> | null = null;

  async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 10000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async function buildQuranStoreFromJsDelivr(): Promise<QuranStore> {
    const base = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1';
    type InfoJson = {
      chapters: Array<{
        chapter: number;
        name: string;
        englishname: string;
        arabicname: string;
        revelation: string;
        verses: Array<{ verse: number }>;
      }>;
    };
    type EditionJson = {
      quran: Array<{ chapter: number; verse: number; text: string }>;
    };

    const [info, arEd, urEd, enEd] = await Promise.all([
      fetchJsonWithTimeout<InfoJson>(`${base}/info.min.json`, 10000),
      fetchJsonWithTimeout<EditionJson>(`${base}/editions/ara-quranuthmanihaf.min.json`, 12000),
      fetchJsonWithTimeout<EditionJson>(`${base}/editions/urd-fatehmuhammadja.min.json`, 12000),
      fetchJsonWithTimeout<EditionJson>(`${base}/editions/eng-muhammadasad.min.json`, 12000).catch(
        () => ({ quran: [] })
      ),
    ]);

    const arByChapter = new Map<number, Array<{ globalNum: number; verse: number; text: string }>>();
    const urByKey = new Map<string, string>();
    const enByKey = new Map<string, string>();

    for (const v of urEd.quran || []) {
      urByKey.set(`${v.chapter}:${v.verse}`, v.text);
    }
    for (const v of enEd.quran || []) {
      enByKey.set(`${v.chapter}:${v.verse}`, v.text);
    }

    (arEd.quran || []).forEach((v, idx) => {
      const list = arByChapter.get(v.chapter) || [];
      list.push({ globalNum: idx + 1, verse: v.verse, text: v.text });
      arByChapter.set(v.chapter, list);
    });

    const surahs: QuranSurahRecord[] = [];
    const surahMap = new Map<number, QuranSurahRecord>();
    const surahList: Array<Omit<QuranSurahRecord, 'ayahs'>> = [];

    for (const ch of info.chapters || []) {
      const arVerses = arByChapter.get(ch.chapter) || [];
      const ayahs: QuranAyahRecord[] = arVerses.map((v) => {
        const key = `${ch.chapter}:${v.verse}`;
        return {
          number: v.globalNum,
          numberInSurah: v.verse,
          arabic: v.text,
          urdu: urByKey.get(key) || '',
          english: enByKey.get(key) || '',
          audioUrl: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${v.globalNum}.mp3`,
        };
      });

      const revelationType =
        ch.revelation?.toLowerCase().includes('medin') ? 'Medinan' : 'Meccan';

      const surah: QuranSurahRecord = {
        number: ch.chapter,
        name: ch.arabicname,
        englishName: ch.name,
        englishNameTranslation: ch.englishname,
        revelationType,
        numberOfAyahs: ayahs.length || ch.verses?.length || 0,
        ayahs,
      };

      surahs.push(surah);
      surahMap.set(surah.number, surah);
      surahList.push({
        number: surah.number,
        name: surah.name,
        englishName: surah.englishName,
        englishNameTranslation: surah.englishNameTranslation,
        revelationType: surah.revelationType,
        numberOfAyahs: surah.numberOfAyahs,
      });
    }

    if (surahs.length < 114) {
      throw new Error('Incomplete Quran dataset received from CDN.');
    }

    const downloadedAt = new Date().toISOString();
    return {
      downloadedAt,
      editionArabic: 'Quran Uthmani',
      editionUrdu: 'Fateh Muhammad Jalandhry (Urdu)',
      totalSurahs: surahs.length,
      surahList,
      surahMap,
      fullPayload: {
        downloadedAt,
        editionArabic: 'Quran Uthmani',
        editionUrdu: 'Fateh Muhammad Jalandhry (Urdu)',
        totalSurahs: surahs.length,
        surahs,
      },
    };
  }

  async function buildQuranStoreFromAlQuranCloud(): Promise<QuranStore> {
    type FullEdition = {
      data?: {
        surahs?: Array<{
          number: number;
          name: string;
          englishName: string;
          englishNameTranslation: string;
          revelationType: string;
          ayahs: Array<{ number: number; numberInSurah: number; text: string }>;
        }>;
      };
    };

    const [arJson, urJson] = await Promise.all([
      fetchJsonWithTimeout<FullEdition>('https://api.alquran.cloud/v1/quran/quran-uthmani', 15000),
      fetchJsonWithTimeout<FullEdition>('https://api.alquran.cloud/v1/quran/ur.jalandhry', 15000),
    ]);

    const arSurahs = arJson.data?.surahs || [];
    const urSurahs = urJson.data?.surahs || [];
    const surahs: QuranSurahRecord[] = [];
    const surahMap = new Map<number, QuranSurahRecord>();
    const surahList: Array<Omit<QuranSurahRecord, 'ayahs'>> = [];

    arSurahs.forEach((s, sIdx) => {
      const uSurah = urSurahs[sIdx];
      const surah: QuranSurahRecord = {
        number: s.number,
        name: s.name,
        englishName: s.englishName,
        englishNameTranslation: s.englishNameTranslation,
        revelationType: s.revelationType,
        numberOfAyahs: s.ayahs.length,
        ayahs: s.ayahs.map((a, aIdx) => ({
          number: a.number,
          numberInSurah: a.numberInSurah,
          arabic: a.text,
          urdu: uSurah?.ayahs?.[aIdx]?.text || '',
          english: '',
          audioUrl: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${a.number}.mp3`,
        })),
      };
      surahs.push(surah);
      surahMap.set(surah.number, surah);
      surahList.push({
        number: surah.number,
        name: surah.name,
        englishName: surah.englishName,
        englishNameTranslation: surah.englishNameTranslation,
        revelationType: surah.revelationType,
        numberOfAyahs: surah.numberOfAyahs,
      });
    });

    const downloadedAt = new Date().toISOString();
    return {
      downloadedAt,
      editionArabic: 'Quran Uthmani',
      editionUrdu: 'Fateh Muhammad Jalandhry (Urdu)',
      totalSurahs: surahs.length,
      surahList,
      surahMap,
      fullPayload: {
        downloadedAt,
        editionArabic: 'Quran Uthmani',
        editionUrdu: 'Fateh Muhammad Jalandhry (Urdu)',
        totalSurahs: surahs.length,
        surahs,
      },
    };
  }

  function ensureQuranStore(): Promise<QuranStore> {
    if (quranStore) return Promise.resolve(quranStore);
    if (!quranLoadPromise) {
      quranLoadPromise = buildQuranStoreFromJsDelivr()
        .catch((cdnErr) => {
          console.warn('jsDelivr Quran CDN failed, falling back to alquran.cloud:', cdnErr);
          return buildQuranStoreFromAlQuranCloud();
        })
        .then((store) => {
          quranStore = store;
          return store;
        })
        .catch((err) => {
          quranLoadPromise = null;
          throw err;
        });
    }
    return quranLoadPromise;
  }

  // Warm up the entire 114-Surah Arabic + Urdu store immediately on server boot
  ensureQuranStore().catch((err) => {
    console.warn('Initial Quran warmup deferred:', err instanceof Error ? err.message : err);
  });

  app.get('/api/quran/surahs', async (_req, res) => {
    try {
      const store = await ensureQuranStore();
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.json({ surahs: store.surahList });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to fetch Surah list.';
      return res.status(502).json({ error: errMsg });
    }
  });

  app.get('/api/quran/surah/:number', async (req, res) => {
    try {
      const num = Number(req.params.number);
      if (!Number.isInteger(num) || num < 1 || num > 114) {
        return res.status(400).json({ error: 'Surah number must be between 1 and 114.' });
      }

      const store = await ensureQuranStore();
      const surah = store.surahMap.get(num);
      if (!surah) {
        return res.status(404).json({ error: 'Surah not found.' });
      }

      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.json(surah);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to fetch Surah.';
      return res.status(502).json({ error: errMsg });
    }
  });

  app.get('/api/quran/full-download', async (_req, res) => {
    try {
      const store = await ensureQuranStore();
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.json(store.fullPayload);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to download full Quran.';
      return res.status(502).json({ error: errMsg });
    }
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScholarAxis Academy server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

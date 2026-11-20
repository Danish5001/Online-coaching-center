import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please check Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
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

  // All-Language Translator Endpoint (Gemini 4 Hydrogen)
  app.post('/api/ai/translate', async (req, res) => {
    try {
      const { text, sourceLanguage, targetLanguage } = req.body as {
        text?: string;
        sourceLanguage?: string;
        targetLanguage?: string;
      };

      if (!text || !text.trim() || !targetLanguage || !targetLanguage.trim()) {
        return res.status(400).json({ error: 'Both text and targetLanguage are required.' });
      }

      const ai = getGeminiClient();
      const srcNote =
        sourceLanguage && sourceLanguage !== 'Auto-Detect'
          ? `from ${sourceLanguage}`
          : '(auto-detect the source language)';

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Translate the following text ${srcNote} into ${targetLanguage.trim()}.\nReturn ONLY the accurate, natural translation with no extra commentary or markdown wrappers.\n\nText:\n${text.trim().slice(0, 4000)}`,
        config: {
          systemInstruction:
            'You are a professional multilingual translator for ScholarAxis Academy covering all world languages including Urdu, Arabic, English, Hindi, Punjabi, Pashto, Persian, Turkish, French, Spanish, German, Chinese, Bengali, and more. Preserve exact meaning, script, and respectful tone.',
        },
      });

      return res.json({
        translation: (response.text || '').trim(),
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Translation failed.';
      console.error('Gemini /api/ai/translate error:', errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

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

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim().slice(0, 2500),
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

      // Unary Gemini 3.8 TTS returns a complete audio/wav file
      return res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Voice bot TTS failed.';
      console.error('Gemini /api/ai/tts error:', errMsg);
      return res.status(500).json({ error: errMsg });
    }
  });

  // --- Full Holy Quran + Urdu Translation API Proxy & In-Memory Cache ---
  let cachedSurahList: unknown = null;
  const cachedSurahs = new Map<number, unknown>();
  let cachedFullQuran: unknown = null;

  app.get('/api/quran/surahs', async (_req, res) => {
    try {
      if (cachedSurahList) {
        return res.json({ surahs: cachedSurahList });
      }
      const upstream = await fetch('https://api.alquran.cloud/v1/surah');
      if (!upstream.ok) {
        throw new Error(`Upstream Quran API error (${upstream.status})`);
      }
      const json = (await upstream.json()) as { data?: unknown };
      cachedSurahList = json.data || [];
      return res.json({ surahs: cachedSurahList });
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

      if (cachedSurahs.has(num)) {
        return res.json(cachedSurahs.get(num));
      }

      const upstream = await fetch(
        `https://api.alquran.cloud/v1/surah/${num}/editions/quran-uthmani,ur.jalandhry,en.asad,ar.alafasy`
      );
      if (!upstream.ok) {
        throw new Error(`Upstream Quran API error (${upstream.status})`);
      }
      const json = (await upstream.json()) as {
        data?: Array<{
          number: number;
          name: string;
          englishName: string;
          englishNameTranslation: string;
          revelationType: string;
          numberOfAyahs: number;
          ayahs: Array<{ number: number; numberInSurah: number; text: string; audio?: string }>;
        }>;
      };

      const editions = json.data || [];
      const arabic = editions[0];
      const urdu = editions[1];
      const english = editions[2];
      const audioEd = editions[3];

      if (!arabic) {
        throw new Error('Surah data unavailable.');
      }

      const payload = {
        number: arabic.number,
        name: arabic.name,
        englishName: arabic.englishName,
        englishNameTranslation: arabic.englishNameTranslation,
        revelationType: arabic.revelationType,
        numberOfAyahs: arabic.numberOfAyahs,
        ayahs: arabic.ayahs.map((a, i) => ({
          number: a.number,
          numberInSurah: a.numberInSurah,
          arabic: a.text,
          urdu: urdu?.ayahs?.[i]?.text || '',
          english: english?.ayahs?.[i]?.text || '',
          audioUrl: audioEd?.ayahs?.[i]?.audio || '',
        })),
      };

      cachedSurahs.set(num, payload);
      return res.json(payload);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to fetch Surah.';
      return res.status(502).json({ error: errMsg });
    }
  });

  app.get('/api/quran/full-download', async (_req, res) => {
    try {
      if (cachedFullQuran) {
        return res.json(cachedFullQuran);
      }

      const [arRes, urRes] = await Promise.all([
        fetch('https://api.alquran.cloud/v1/quran/quran-uthmani'),
        fetch('https://api.alquran.cloud/v1/quran/ur.jalandhry'),
      ]);

      if (!arRes.ok || !urRes.ok) {
        throw new Error('Could not download complete Quran editions from upstream API.');
      }

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

      const arJson = (await arRes.json()) as FullEdition;
      const urJson = (await urRes.json()) as FullEdition;

      const arSurahs = arJson.data?.surahs || [];
      const urSurahs = urJson.data?.surahs || [];

      const surahs = arSurahs.map((s, sIdx) => {
        const uSurah = urSurahs[sIdx];
        return {
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
      });

      cachedFullQuran = {
        downloadedAt: new Date().toISOString(),
        editionArabic: 'Quran Uthmani',
        editionUrdu: 'Fateh Muhammad Jalandhry (Urdu)',
        totalSurahs: surahs.length,
        surahs,
      };

      return res.json(cachedFullQuran);
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

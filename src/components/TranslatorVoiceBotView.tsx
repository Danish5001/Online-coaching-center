import { useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  Languages,
  Loader2,
  Pause,
  Play,
  Volume2,
} from 'lucide-react';

const WORLD_LANGUAGES = [
  'Urdu',
  'English',
  'Arabic',
  'Hindi',
  'Punjabi',
  'Pashto',
  'Sindhi',
  'Persian (Farsi)',
  'Turkish',
  'French',
  'Spanish',
  'German',
  'Chinese (Simplified)',
  'Bengali',
  'Indonesian',
  'Malay',
  'Russian',
  'Japanese',
  'Korean',
  'Italian',
  'Portuguese',
  'Swahili',
  'Other (Type Custom Language)',
];

const VOICE_OPTIONS = [
  { id: 'Kore', label: 'Kore — Clear Academic Voice' },
  { id: 'Puck', label: 'Puck — Warm Friendly Tutor' },
  { id: 'Charon', label: 'Charon — Deep Formal Narrator' },
  { id: 'Fenrir', label: 'Fenrir — Energetic Instructor' },
  { id: 'Zephyr', label: 'Zephyr — Calm Gentle Reader' },
];

export function TranslatorVoiceBotView() {
  const [sourceLang, setSourceLang] = useState('Auto-Detect');
  const [targetLang, setTargetLang] = useState('Urdu');
  const [customTargetLang, setCustomTargetLang] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Voice Bot state
  const [voiceName, setVoiceName] = useState('Kore');
  const [voiceStyle, setVoiceStyle] = useState('Clear, calm, well-paced educational reader');
  const [generatingAudio, setGeneratingAudio] = useState<'source' | 'translated' | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveTargetLang =
    targetLang === 'Other (Type Custom Language)'
      ? customTargetLang.trim() || 'English'
      : targetLang;

  const handleTranslate = async () => {
    if (!sourceText.trim() || translating) return;
    setError('');
    setTranslating(true);
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText.trim(),
          sourceLanguage: sourceLang,
          targetLanguage: effectiveTargetLang,
        }),
      });
      const data = (await res.json()) as { translation?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Translation failed.');
      setTranslatedText(data.translation || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to translate text.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSwap = () => {
    if (!translatedText.trim()) return;
    const prevSource = sourceText;
    setSourceText(translatedText);
    setTranslatedText(prevSource);
    if (sourceLang !== 'Auto-Detect' && targetLang !== 'Other (Type Custom Language)') {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
    }
  };

  const handleVoiceRead = async (which: 'source' | 'translated') => {
    const textToRead = which === 'translated' ? translatedText.trim() : sourceText.trim();
    if (!textToRead || generatingAudio) return;

    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    setError('');
    setGeneratingAudio(which);
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToRead,
          voiceName,
          style: voiceStyle,
        }),
      });
      const data = (await res.json()) as { audioBase64?: string; mimeType?: string; error?: string };
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Voice bot could not generate speech.');
      }

      const dataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      setAudioDataUrl(dataUrl);

      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice bot playback failed.');
    } finally {
      setGeneratingAudio(null);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownloadWav = () => {
    if (!audioDataUrl) return;
    const a = document.createElement('a');
    a.href = audioDataUrl;
    a.download = `scholaraxis-voice-bot-${voiceName.toLowerCase()}.wav`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          All-Language Translator & Voice Bot
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Translate study notes, syllabus chapters, or Quranic passages into any language and
          listen with our AI Voice Bot.
        </p>
      </div>

      {error && (
        <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Language Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Source Language
            </label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="Auto-Detect">Auto-Detect Language</option>
              {WORLD_LANGUAGES.filter((l) => !l.startsWith('Other')).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              title="Swap source and target text"
              className="p-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Target Language (All Languages Supported)
            </label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {WORLD_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {targetLang === 'Other (Type Custom Language)' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Enter Any Language Name
            </label>
            <input
              type="text"
              value={customTargetLang}
              onChange={(e) => setCustomTargetLang(e.target.value)}
              placeholder="e.g. Balochi, Kashmiri, Swahili, Dutch, Thai, Korean..."
              maxLength={60}
              className="w-full max-w-md px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        )}

        {/* Dual Text Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Original Text</span>
              <button
                type="button"
                disabled={!sourceText.trim() || generatingAudio !== null}
                onClick={() => handleVoiceRead('source')}
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 cursor-pointer"
              >
                {generatingAudio === 'source' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
                Read Original Aloud
              </button>
            </div>
            <textarea
              rows={7}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste or type text in any language (Arabic, Urdu, English, etc.)..."
              maxLength={4000}
              className="w-full p-3.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700 leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                Translation ({effectiveTargetLang})
              </span>
              <div className="flex items-center gap-3">
                {translatedText && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(translatedText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={!translatedText.trim() || generatingAudio !== null}
                  onClick={() => handleVoiceRead('translated')}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {generatingAudio === 'translated' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  Read Translation Aloud
                </button>
              </div>
            </div>
            <div
              dir={
                ['Urdu', 'Arabic', 'Pashto', 'Sindhi', 'Persian (Farsi)'].includes(
                  effectiveTargetLang
                )
                  ? 'rtl'
                  : 'ltr'
              }
              className="w-full min-h-[186px] p-3.5 text-sm bg-[#F8FAFC] border border-slate-200 rounded-lg text-slate-900 whitespace-pre-wrap leading-relaxed"
            >
              {translating
                ? `Translating into ${effectiveTargetLang}...`
                : translatedText || 'Your translation will appear here.'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Quick sample:</span>
            <button
              type="button"
              onClick={() =>
                setSourceText(
                  'Seeking knowledge is an obligation upon every student. Stay consistent and track every chapter.'
                )
              }
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
            >
              English Study Quote
            </button>
            <button
              type="button"
              onClick={() =>
                setSourceText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')
              }
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
            >
              Arabic Ayah
            </button>
          </div>

          <button
            type="button"
            disabled={!sourceText.trim() || translating}
            onClick={handleTranslate}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {translating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Languages className="w-4 h-4" />
            )}
            {translating ? 'Translating...' : `Translate to ${effectiveTargetLang}`}
          </button>
        </div>
      </div>

      {/* Voice Bot Controls & Audio Player */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium">
          <Volume2 className="w-4 h-4" />
          <span>AI Voice Bot Reader</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Voice Bot Persona
            </label>
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Reading Tone & Pace
            </label>
            <select
              value={voiceStyle}
              onChange={(e) => setVoiceStyle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="Clear, calm, well-paced educational reader">
                Clear & Calm Teacher
              </option>
              <option value="Slow, deliberate pronunciation for language learners">
                Slow Study Pace (Language Learners)
              </option>
              <option value="Warm, expressive storytelling narrator">
                Warm Expressive Narrator
              </option>
            </select>
          </div>
        </div>

        {audioDataUrl && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={togglePlayback}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Pause Voice Bot' : 'Replay Audio'}
              </button>
              <span className="text-xs text-slate-500">
                Voice: <strong className="text-slate-800">{voiceName}</strong> · WAV 24kHz
              </span>
            </div>

            <button
              type="button"
              onClick={handleDownloadWav}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Audio (.wav)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

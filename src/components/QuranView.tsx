import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  Check,
  Download,
  FileDown,
  Languages,
  Loader2,
  Pause,
  Play,
  Search,
  Square,
  Volume2,
} from 'lucide-react';
import {
  exportFullQuranAsHtml,
  FullQuranArchive,
  getFullQuranOffline,
  QuranAyah,
  QuranSurahDetail,
  saveFullQuranOffline,
} from '../lib/quranOffline';

interface SurahSummary {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

const QUICK_LANGUAGES = [
  'English',
  'Urdu',
  'Hindi',
  'Punjabi',
  'Pashto',
  'Persian',
  'Turkish',
  'French',
  'Spanish',
  'German',
  'Bengali',
  'Indonesian',
  'Chinese',
];

export function QuranView() {
  const [surahs, setSurahs] = useState<SurahSummary[]>([]);
  const [surahSearch, setSurahSearch] = useState('');
  const [selectedSurahNum, setSelectedSurahNum] = useState<number>(1);
  const [surahDetail, setSurahDetail] = useState<QuranSurahDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSurah, setLoadingSurah] = useState(false);
  const [error, setError] = useState('');
  const [showEnglish, setShowEnglish] = useState(false);

  // Offline Full Quran state
  const [offlineArchive, setOfflineArchive] = useState<FullQuranArchive | null>(null);
  const [downloadingFull, setDownloadingFull] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');

  // Audio playback (Arabic Qari & Voice Bot Urdu/Translation)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAyahNum, setPlayingAyahNum] = useState<number | null>(null);
  const [playingMode, setPlayingMode] = useState<'arabic' | 'voicebot' | null>(null);
  const [continuousPlay, setContinuousPlay] = useState(false);
  const [loadingVoiceAyah, setLoadingVoiceAyah] = useState<number | null>(null);

  // Per-ayah custom language translation
  const [targetLang, setTargetLang] = useState('English');
  const [translatedAyahs, setTranslatedAyahs] = useState<Record<number, string>>({});
  const [translatingAyah, setTranslatingAyah] = useState<number | null>(null);

  // Load offline archive if previously downloaded + fetch Surah list
  useEffect(() => {
    let mounted = true;

    async function init() {
      const saved = await getFullQuranOffline();
      if (mounted && saved) {
        setOfflineArchive(saved);
        setSurahs(
          saved.surahs.map((s) => ({
            number: s.number,
            name: s.name,
            englishName: s.englishName,
            englishNameTranslation: s.englishNameTranslation,
            numberOfAyahs: s.numberOfAyahs,
            revelationType: s.revelationType,
          }))
        );
        setLoadingList(false);
        return;
      }

      try {
        const res = await fetch('/api/quran/surahs');
        const data = (await res.json()) as { surahs?: SurahSummary[]; error?: string };
        if (!res.ok) throw new Error(data.error || 'Could not load Surah list.');
        if (mounted) {
          setSurahs(data.surahs || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load Holy Quran directory.');
        }
      } finally {
        if (mounted) setLoadingList(false);
      }
    }

    init();
    return () => {
      mounted = false;
      audioRef.current?.pause();
    };
  }, []);

  // Load selected Surah (from offline archive if present, otherwise from server API)
  useEffect(() => {
    let mounted = true;
    stopAudio();
    setTranslatedAyahs({});

    async function loadSurah() {
      if (offlineArchive) {
        const found = offlineArchive.surahs.find((s) => s.number === selectedSurahNum);
        if (found) {
          setSurahDetail(found);
          setError('');
          return;
        }
      }

      setLoadingSurah(true);
      setError('');
      try {
        const res = await fetch(`/api/quran/surah/${selectedSurahNum}`);
        const data = (await res.json()) as QuranSurahDetail & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to load Surah.');
        if (mounted) {
          setSurahDetail(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Could not fetch Surah.');
        }
      } finally {
        if (mounted) setLoadingSurah(false);
      }
    }

    loadSurah();
    return () => {
      mounted = false;
    };
  }, [selectedSurahNum, offlineArchive]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    setPlayingAyahNum(null);
    setPlayingMode(null);
    setContinuousPlay(false);
  };

  const playArabicAyah = (ayah: QuranAyah, autoAdvance = false) => {
    if (playingAyahNum === ayah.number && playingMode === 'arabic') {
      stopAudio();
      return;
    }

    stopAudio();
    const url =
      ayah.audioUrl || `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.number}.mp3`;
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingAyahNum(ayah.number);
    setPlayingMode('arabic');
    setContinuousPlay(autoAdvance);

    audio.onended = () => {
      if (autoAdvance && surahDetail) {
        const idx = surahDetail.ayahs.findIndex((a) => a.number === ayah.number);
        const next = surahDetail.ayahs[idx + 1];
        if (next) {
          playArabicAyah(next, true);
          return;
        }
      }
      setPlayingAyahNum(null);
      setPlayingMode(null);
      setContinuousPlay(false);
    };

    audio.play().catch(() => {
      setError('Audio playback was blocked or unavailable for this verse.');
      stopAudio();
    });
  };

  const handleVoiceBotRead = async (ayah: QuranAyah, textToRead: string) => {
    if (playingAyahNum === ayah.number && playingMode === 'voicebot') {
      stopAudio();
      return;
    }

    stopAudio();
    setLoadingVoiceAyah(ayah.number);
    setError('');
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToRead,
          voiceName: 'Kore',
          style: 'Calm, respectful, clear voice reading Quranic translation',
        }),
      });
      const data = (await res.json()) as { audioBase64?: string; mimeType?: string; error?: string };
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Voice bot could not read this verse.');
      }

      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audioRef.current = audio;
      setPlayingAyahNum(ayah.number);
      setPlayingMode('voicebot');
      audio.onended = () => {
        setPlayingAyahNum(null);
        setPlayingMode(null);
      };
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice bot audio failed.');
    } finally {
      setLoadingVoiceAyah(null);
    }
  };

  const handleTranslateAyah = async (ayah: QuranAyah) => {
    setTranslatingAyah(ayah.number);
    setError('');
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ayah.urdu || ayah.arabic,
          sourceLanguage: ayah.urdu ? 'Urdu' : 'Arabic',
          targetLanguage: targetLang,
        }),
      });
      const data = (await res.json()) as { translation?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Translation failed.');
      setTranslatedAyahs((prev) => ({
        ...prev,
        [ayah.number]: data.translation || '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not translate verse.');
    } finally {
      setTranslatingAyah(null);
    }
  };

  const handleDownloadFullQuran = async () => {
    if (downloadingFull) return;
    setDownloadingFull(true);
    setError('');
    setDownloadStatus('Downloading all 114 Surahs (Arabic + Urdu translation)...');
    try {
      const res = await fetch('/api/quran/full-download');
      const data = (await res.json()) as FullQuranArchive & { error?: string };
      if (!res.ok || !data.surahs) {
        throw new Error(data.error || 'Could not download full Quran.');
      }
      await saveFullQuranOffline(data);
      setOfflineArchive(data);
      setDownloadStatus(
        `Full Holy Quran (${data.totalSurahs} Surahs, Arabic + Urdu Translation) saved on app for direct offline reading.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Full Quran download failed.');
      setDownloadStatus('');
    } finally {
      setDownloadingFull(false);
    }
  };

  const filteredSurahs = useMemo(() => {
    const q = surahSearch.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        String(s.number) === q ||
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        s.name.includes(q)
    );
  }, [surahs, surahSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Al-Quran Al-Kareem & Urdu Translation
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            All 114 Surahs with Uthmani Arabic script, Fateh Muhammad Jalandhry Urdu translation,
            Qari recitation, and AI Voice Bot reading.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={downloadingFull}
            onClick={handleDownloadFullQuran}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {downloadingFull ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : offlineArchive ? (
              <Check className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloadingFull
              ? 'Downloading 114 Surahs...'
              : offlineArchive
              ? 'Full Quran Saved Offline (114 Surahs)'
              : 'Download Full Quran + Urdu on App'}
          </button>

          {offlineArchive && (
            <button
              type="button"
              onClick={() => exportFullQuranAsHtml(offlineArchive)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-slate-600" />
              Export Full Quran (.html)
            </button>
          )}
        </div>
      </div>

      {downloadStatus && (
        <div className="p-3 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg">
          {downloadStatus}
        </div>
      )}

      {error && (
        <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Main Split Reader Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 114 Surahs Directory */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[760px]">
          <div className="p-3.5 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={surahSearch}
                onChange={(e) => setSurahSearch(e.target.value)}
                placeholder="Search Surah (1–114, Yaseen, Rahman)..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingList ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading 114 Surahs...
              </div>
            ) : (
              filteredSurahs.map((s) => {
                const active = s.number === selectedSurahNum;
                return (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => setSelectedSurahNum(s.number)}
                    className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      active ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`font-mono-tabular text-xs font-semibold w-7 shrink-0 ${
                          active ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {String(s.number).padStart(3, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {s.englishName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {s.englishNameTranslation} · {s.numberOfAyahs} Ayahs
                        </div>
                      </div>
                    </div>
                    <span
                      dir="rtl"
                      className="text-base text-slate-800 shrink-0"
                      style={{ fontFamily: '"Amiri", serif' }}
                    >
                      {s.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right: Active Surah Verse-by-Verse Direct Reader */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loadingSurah || !surahDetail ? (
            <div className="p-16 text-center space-y-2">
              <Loader2 className="w-6 h-6 text-emerald-700 animate-spin mx-auto" />
              <p className="text-sm text-slate-600">Loading Surah & Urdu translation...</p>
            </div>
          ) : (
            <>
              {/* Surah Header & Controls */}
              <div className="px-6 py-5 border-b border-slate-200 bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>
                      Surah {surahDetail.number} · {surahDetail.revelationType} ·{' '}
                      {surahDetail.numberOfAyahs} Ayahs
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <h2 className="text-xl font-bold text-slate-900">{surahDetail.englishName}</h2>
                    <span
                      dir="rtl"
                      className="text-2xl text-emerald-800"
                      style={{ fontFamily: '"Amiri", serif' }}
                    >
                      {surahDetail.name}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (continuousPlay) {
                        stopAudio();
                      } else if (surahDetail.ayahs[0]) {
                        playArabicAyah(surahDetail.ayahs[0], true);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      continuousPlay
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {continuousPlay ? (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        Stop Surah Recitation
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Play Full Surah Audio
                      </>
                    )}
                  </button>

                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    aria-label="Select translation language for ayahs"
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
                  >
                    {QUICK_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        Translate to: {lang}
                      </option>
                    ))}
                  </select>

                  {surahDetail.ayahs[0]?.english && (
                    <button
                      type="button"
                      onClick={() => setShowEnglish((v) => !v)}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      {showEnglish ? 'Hide English' : 'Show English'}
                    </button>
                  )}
                </div>
              </div>

              {/* Ayahs List */}
              <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
                {surahDetail.ayahs.map((ayah) => {
                  const isPlayingArabic =
                    playingAyahNum === ayah.number && playingMode === 'arabic';
                  const isPlayingVoice =
                    playingAyahNum === ayah.number && playingMode === 'voicebot';
                  const customTrans = translatedAyahs[ayah.number];

                  return (
                    <div
                      key={ayah.number}
                      className={`p-6 space-y-4 transition-colors ${
                        playingAyahNum === ayah.number ? 'bg-emerald-50/40' : 'bg-white'
                      }`}
                    >
                      {/* Arabic Verse */}
                      <div
                        dir="rtl"
                        className="text-right text-2xl sm:text-3xl leading-[2.2] text-slate-900"
                        style={{ fontFamily: '"Amiri", serif' }}
                      >
                        {ayah.arabic}{' '}
                        <span className="text-lg text-emerald-700 font-sans">
                          ﴿{ayah.numberInSurah}﴾
                        </span>
                      </div>

                      {/* Urdu Translation */}
                      <div
                        dir="rtl"
                        className="text-right text-base sm:text-lg leading-[2.2] text-slate-700"
                        style={{ fontFamily: '"Noto Nastaliq Urdu", serif' }}
                      >
                        {ayah.urdu}
                      </div>

                      {/* Optional English Translation */}
                      {showEnglish && ayah.english && (
                        <p className="text-sm text-slate-600 leading-relaxed">{ayah.english}</p>
                      )}

                      {/* Custom AI Translated Language Output */}
                      {customTrans && (
                        <div className="p-3.5 bg-[#F8FAFC] border border-slate-200 rounded-lg space-y-1">
                          <div className="text-[11px] font-semibold text-emerald-700">
                            {targetLang} Translation
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed">{customTrans}</p>
                        </div>
                      )}

                      {/* Ayah Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                        <span className="font-mono-tabular text-slate-400">
                          {surahDetail.number}:{ayah.numberInSurah}
                        </span>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => playArabicAyah(ayah, false)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                          >
                            {isPlayingArabic ? (
                              <Pause className="w-3.5 h-3.5 text-emerald-700" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            {isPlayingArabic ? 'Pause Qari' : 'Arabic Audio'}
                          </button>

                          <button
                            type="button"
                            disabled={loadingVoiceAyah === ayah.number}
                            onClick={() =>
                              handleVoiceBotRead(ayah, customTrans || ayah.urdu || ayah.arabic)
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md cursor-pointer disabled:opacity-60"
                          >
                            {loadingVoiceAyah === ayah.number ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isPlayingVoice ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                            {loadingVoiceAyah === ayah.number
                              ? 'Reading...'
                              : isPlayingVoice
                              ? 'Stop Voice Bot'
                              : customTrans
                              ? `Voice Bot (${targetLang})`
                              : 'Voice Bot (Urdu)'}
                          </button>

                          <button
                            type="button"
                            disabled={translatingAyah === ayah.number}
                            onClick={() => handleTranslateAyah(ayah)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer disabled:opacity-60"
                          >
                            {translatingAyah === ayah.number ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Languages className="w-3.5 h-3.5" />
                            )}
                            Translate ({targetLang})
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

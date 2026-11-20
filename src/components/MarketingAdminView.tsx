import React, { useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  Megaphone,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  MarketingCampaign,
  MarketingChannel,
  PaymentSettings,
  STARTER_MARKETING_CAMPAIGNS,
  UserProfile,
} from '../types';

interface MarketingAdminViewProps {
  profile: UserProfile;
  paymentSettings: PaymentSettings;
  campaigns: MarketingCampaign[];
}

type BannerTheme = 'emerald' | 'slate' | 'indigo';

const BANNER_PALETTES: Record<
  BannerTheme,
  { bg1: string; bg2: string; accent: string; badgeBg: string; label: string }
> = {
  emerald: {
    bg1: '#064E3B',
    bg2: '#0F172A',
    accent: '#10B981',
    badgeBg: '#047857',
    label: 'Academy Emerald',
  },
  slate: {
    bg1: '#0F172A',
    bg2: '#1E293B',
    accent: '#34D399',
    badgeBg: '#334155',
    label: 'Executive Slate',
  },
  indigo: {
    bg1: '#1E1B4B',
    bg2: '#0F172A',
    accent: '#818CF8',
    badgeBg: '#3730A3',
    label: 'Scholarly Indigo',
  },
};

export function MarketingAdminView({
  profile,
  paymentSettings,
  campaigns,
}: MarketingAdminViewProps) {
  const baseAppUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://scholaraxis.academy';

  // Share & Link state
  const [utmSource, setUtmSource] = useState('whatsapp');
  const [utmCampaign, setUtmCampaign] = useState('admissions2026');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const shareUrl = `${baseAppUrl}/?utm_source=${encodeURIComponent(
    utmSource.trim() || 'direct'
  )}&utm_campaign=${encodeURIComponent(utmCampaign.trim() || 'academy')}`;

  const defaultShareMessage = `Join ScholarAxis Academy — Online Coaching Center (Nursery to Masters).\nComplete syllabus books, chapter progress tracking, and live classes for just $${paymentSettings.feeUsd} one-time via EasyPaisa (${paymentSettings.easypaisaNumber}).\nSign in here: ${shareUrl}`;

  // Banner Studio state
  const [bannerHeadline, setBannerHeadline] = useState(
    'Online Coaching Center: Nursery to Masters'
  );
  const [bannerSubline, setBannerSubline] = useState(
    `All Syllabus Books · Live Classes · $${paymentSettings.feeUsd} One-Time via EasyPaisa (${paymentSettings.easypaisaNumber})`
  );
  const [bannerCta, setBannerCta] = useState('Enroll Today');
  const [bannerTheme, setBannerTheme] = useState<BannerTheme>('emerald');

  // Video Ad Studio state
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0); // 0..12 seconds
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [videoStatusMsg, setVideoStatusMsg] = useState('');
  const [videoOfferLine, setVideoOfferLine] = useState(
    `$${paymentSettings.feeUsd} One-Time Fee · EasyPaisa ${paymentSettings.easypaisaNumber}`
  );
  const videoTimeRef = useRef(0);

  // New Ad Campaign Modal state
  const [showAdModal, setShowAdModal] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [adChannel, setAdChannel] = useState<MarketingChannel>('whatsapp');
  const [adHeadline, setAdHeadline] = useState('');
  const [adBody, setAdBody] = useState('');
  const [adCta, setAdCta] = useState('Enroll Now');
  const [savingAd, setSavingAd] = useState(false);
  const [seedingAds, setSeedingAds] = useState(false);
  const [adError, setAdError] = useState('');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ScholarAxis Academy — Online Coaching Center',
          text: defaultShareMessage,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share unavailable
      }
    }
    handleCopy(defaultShareMessage, 'native-share');
  };

  // --- Downloadable PNG Banner Renderer ---
  const downloadBannerPng = (format: 'wide' | 'square' | 'strip') => {
    const dims =
      format === 'wide'
        ? { w: 1200, h: 630, name: 'scholaraxis-facebook-banner-1200x630.png' }
        : format === 'square'
        ? { w: 1080, h: 1080, name: 'scholaraxis-instagram-banner-1080x1080.png' }
        : { w: 1200, h: 320, name: 'scholaraxis-header-banner-1200x320.png' };

    const canvas = document.createElement('canvas');
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = BANNER_PALETTES[bannerTheme];
    const grad = ctx.createLinearGradient(0, 0, dims.w, dims.h);
    grad.addColorStop(0, palette.bg1);
    grad.addColorStop(1, palette.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dims.w, dims.h);

    // Subtle geometric accent lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dims.w * 0.88, dims.h * 0.2, dims.h * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    const padX = format === 'square' ? 84 : 76;
    const padY = format === 'strip' ? 62 : format === 'square' ? 120 : 88;

    // Brand kicker
    ctx.fillStyle = palette.accent;
    ctx.font = `600 ${format === 'strip' ? 20 : 24}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('SCHOLARAXIS ACADEMY · ONLINE COACHING CENTER', padX, padY);

    // Main Headline with word wrap
    ctx.fillStyle = '#FFFFFF';
    const headlineSize = format === 'strip' ? 42 : format === 'square' ? 64 : 56;
    ctx.font = `700 ${headlineSize}px "Plus Jakarta Sans", sans-serif`;
    const maxTextWidth = dims.w - padX * 2;
    const words = bannerHeadline.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(test).width > maxTextWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);

    let yCursor = padY + (format === 'strip' ? 58 : 78);
    for (const line of lines.slice(0, 3)) {
      ctx.fillText(line, padX, yCursor);
      yCursor += headlineSize * 1.18;
    }

    // Subheadline
    ctx.fillStyle = '#CBD5E1';
    ctx.font = `400 ${format === 'strip' ? 22 : 26}px "DM Sans", sans-serif`;
    ctx.fillText(bannerSubline, padX, yCursor + 14, maxTextWidth);

    // CTA Button Box
    const btnY = dims.h - (format === 'strip' ? 88 : 130);
    const btnText = `${bannerCta}  →`;
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    const btnW = Math.max(240, ctx.measureText(btnText).width + 64);
    const btnH = 58;
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.roundRect(padX, btnY, btnW, btnH, 10);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.fillText(btnText, padX + 32, btnY + 37);

    // Footer URL on right
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 20px "IBM Plex Mono", monospace';
    const footerLabel = `EasyPaisa: ${paymentSettings.easypaisaNumber} · $${paymentSettings.feeUsd} Once`;
    const footerW = ctx.measureText(footerLabel).width;
    ctx.fillText(footerLabel, dims.w - padX - footerW, dims.h - 46);

    const link = document.createElement('a');
    link.download = dims.name;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // --- 12-Second Animated Small Video Ad Renderer ---
  const drawVideoFrame = (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    const palette = BANNER_PALETTES[bannerTheme];
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, palette.bg1);
    grad.addColorStop(1, palette.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Animated ambient rings
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 2;
    const pulse = Math.sin(t * 1.4) * 14;
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.22, 130 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.14, h * 0.85, 100 - pulse * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // Top bar brand & timer
    ctx.fillStyle = palette.accent;
    ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('SCHOLARAXIS ACADEMY', 40, 44);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '500 13px "IBM Plex Mono", monospace';
    const timeText = `${String(Math.floor(t)).padStart(2, '0')}s / 12s`;
    ctx.fillText(timeText, w - 110, 44);

    // 4 Scenes of 3 seconds each
    const safeT = Number.isFinite(t) ? ((t % 12) + 12) % 12 : 0;
    const sceneIdx = Math.max(0, Math.min(3, Math.floor(safeT / 3)));
    const localT = (safeT % 3) / 3; // 0..1
    const fadeIn = Math.min(1, localT * 4);
    const slideY = (1 - fadeIn) * 18;

    const scenes = [
      {
        kicker: 'ONLINE COACHING CENTER',
        title: bannerHeadline,
        sub: 'Verified Student & Teacher Portal · Study Anywhere',
      },
      {
        kicker: 'COMPLETE SYLLABUS LIBRARY',
        title: 'Nursery to Masters Books',
        sub: 'Early Years · Primary · Middle · Matric · FSc · Bachelors · Masters',
      },
      {
        kicker: 'LIVE CLASSES & PROGRESS TRACKING',
        title: 'Scheduled Live Sessions',
        sub: 'Interactive Chapter Checklists & Real-Time Automated Alerts',
      },
      {
        kicker: 'LIFETIME ENROLLMENT',
        title: videoOfferLine,
        sub: `${paymentSettings.easypaisaAccountTitle} · Scan EasyPaisa QR & Join Today`,
      },
    ];

    const scene = scenes[sceneIdx] || scenes[0];
    ctx.save();
    ctx.globalAlpha = fadeIn;

    ctx.fillStyle = palette.accent;
    ctx.font = '600 14px "IBM Plex Mono", monospace';
    ctx.fillText(scene.kicker, 40, 132 + slideY);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(scene.title, 40, 180 + slideY, w - 80);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '400 18px "DM Sans", sans-serif';
    ctx.fillText(scene.sub, 40, 224 + slideY, w - 80);

    // CTA Pill in Scene 4
    if (sceneIdx === 3) {
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.roundRect(40, 260 + slideY, 210, 44, 8);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${bannerCta} →`, 64, 288 + slideY);
    }

    ctx.restore();

    // Bottom Progress Bar
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(40, h - 26, w - 80, 5);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(40, h - 26, ((w - 80) * safeT) / 12, 5);
  };

  useEffect(() => {
    const canvas = videoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTs: number | null = null;

    const loop = (now: number) => {
      const dt = lastTs === null ? 0 : Math.max(0, Math.min(0.1, (now - lastTs) / 1000));
      lastTs = now;

      if (videoPlaying) {
        videoTimeRef.current = (videoTimeRef.current + dt) % 12;
        setVideoProgress(videoTimeRef.current);
      }

      drawVideoFrame(ctx, videoTimeRef.current, canvas.width, canvas.height);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [videoPlaying, bannerHeadline, bannerTheme, bannerCta, videoOfferLine, paymentSettings]);

  const handleRecordAndDownloadVideo = () => {
    const canvas = videoCanvasRef.current;
    if (!canvas || recordingVideo) return;
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      setVideoStatusMsg('Your browser does not support video recording export.');
      return;
    }

    setRecordingVideo(true);
    setVideoStatusMsg('Recording 12-second promo video ad...');
    videoTimeRef.current = 0;
    setVideoPlaying(true);

    try {
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scholaraxis-promo-video-ad.webm';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setRecordingVideo(false);
        setVideoStatusMsg('12-second video ad downloaded (scholaraxis-promo-video-ad.webm).');
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 12000);
    } catch {
      setRecordingVideo(false);
      setVideoStatusMsg('Could not record video in this browser.');
    }
  };

  // --- Firestore Ad Campaigns CRUD ---
  const handleSeedCampaigns = async () => {
    if (seedingAds) return;
    setSeedingAds(true);
    try {
      for (const tpl of STARTER_MARKETING_CAMPAIGNS) {
        await addDoc(collection(db, 'marketingCampaigns'), {
          ...tpl,
          targetUrl: `${baseAppUrl}/?utm_source=${tpl.channel}&utm_campaign=admissions`,
          createdByUid: profile.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'marketingCampaigns');
    } finally {
      setSeedingAds(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdError('');
    if (adTitle.trim().length < 2 || adHeadline.trim().length < 2 || adBody.trim().length < 2) {
      setAdError('Please complete Title, Headline, and Ad Copy.');
      return;
    }

    setSavingAd(true);
    try {
      await addDoc(collection(db, 'marketingCampaigns'), {
        title: adTitle.trim().slice(0, 140),
        channel: adChannel,
        headline: adHeadline.trim().slice(0, 160),
        bodyText: adBody.trim().slice(0, 1000),
        ctaText: (adCta.trim() || 'Enroll Now').slice(0, 80),
        targetUrl: `${baseAppUrl}/?utm_source=${adChannel}&utm_campaign=${encodeURIComponent(
          adTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'promo'
        )}`.slice(0, 500),
        status: 'active',
        createdByUid: profile.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAdTitle('');
      setAdHeadline('');
      setAdBody('');
      setAdCta('Enroll Now');
      setShowAdModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'marketingCampaigns');
    } finally {
      setSavingAd(false);
    }
  };

  const handleToggleCampaignStatus = async (c: MarketingCampaign) => {
    try {
      await updateDoc(doc(db, 'marketingCampaigns', c.id), {
        status: c.status === 'active' ? 'paused' : 'active',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `marketingCampaigns/${c.id}`);
    }
  };

  const handleDeleteCampaign = async (c: MarketingCampaign) => {
    try {
      await deleteDoc(doc(db, 'marketingCampaigns', c.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `marketingCampaigns/${c.id}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Admin Marketing & Ads Hub
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Share tracked enrollment links, manage ad campaigns, export promotional banners, and
            download a 12-second promo video ad.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Ad
        </button>
      </div>

      {/* 1. Share & Copy Tracked Link Kit */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Share Academy Link & Referral Builder
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize your campaign tag, copy the direct link, or share straight to WhatsApp,
                Facebook, X, or LinkedIn.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Traffic Channel (utm_source)
                </label>
                <select
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="flyer">Print Flyer / QR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Campaign Name (utm_campaign)
                </label>
                <input
                  type="text"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  placeholder="admissions2026"
                  maxLength={40}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>
            </div>

            {/* Copyable Link Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3.5 py-2.5 text-xs font-mono-tabular bg-[#F8FAFC] border border-slate-200 rounded-lg text-slate-800 select-all"
              />
              <button
                type="button"
                onClick={() => handleCopy(shareUrl, 'main-link')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'main-link' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Link Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </>
                )}
              </button>
            </div>

            {/* Direct Social Share Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(defaultShareMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share on WhatsApp
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Share on Facebook
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `Join ScholarAxis Academy — Nursery to Masters Online Coaching ($10 One-Time via EasyPaisa)`
                )}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Share on X
              </a>
              <button
                type="button"
                onClick={handleNativeShare}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {copiedKey === 'native-share' ? 'Invite Message Copied' : 'Share / Copy Invite Text'}
              </button>
            </div>
          </div>

          {/* Shareable App Invite QR */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
            <QRCodeSVG value={shareUrl} size={136} bgColor="#FFFFFF" fgColor="#0F172A" level="M" />
            <div className="mt-3 text-center">
              <div className="text-xs font-semibold text-slate-900">Academy Invite QR</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Scan to open tracked enrollment link
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Small Video Ad Studio (12-Second Animated Promo Video) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 mb-1">
              <Film className="w-4 h-4" />
              <span>Small Video Ad Studio · 12s Animated Promo</span>
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Preview & Download Promo Video Ad
            </h2>
          </div>

          <button
            type="button"
            disabled={recordingVideo}
            onClick={handleRecordAndDownloadVideo}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {recordingVideo ? 'Recording 12s Video...' : 'Download Video Ad (.webm)'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3">
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
              <canvas
                ref={videoCanvasRef}
                width={640}
                height={360}
                className="w-full h-auto block"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVideoPlaying((p) => !p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  {videoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {videoPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    videoTimeRef.current = 0;
                    setVideoProgress(0);
                    setVideoPlaying(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Replay
                </button>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {videoProgress.toFixed(1)}s / 12.0s · 4 Animated Scenes
              </span>
            </div>

            {videoStatusMsg && (
              <div className="p-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                {videoStatusMsg}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Scene 1 & Banner Headline
              </label>
              <input
                type="text"
                value={bannerHeadline}
                onChange={(e) => setBannerHeadline(e.target.value)}
                maxLength={80}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Scene 4 Offer & EasyPaisa Line
              </label>
              <input
                type="text"
                value={videoOfferLine}
                onChange={(e) => setVideoOfferLine(e.target.value)}
                maxLength={80}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Visual Theme (Applies to Video Ad & Banners)
              </label>
              <div className="flex items-center gap-2">
                {(['emerald', 'slate', 'indigo'] as BannerTheme[]).map((themeKey) => (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() => setBannerTheme(themeKey)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                      bannerTheme === themeKey
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {BANNER_PALETTES[themeKey].label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Click <strong>Download Video Ad (.webm)</strong> to export a ready-to-post 12-second
              video ad for WhatsApp Status, Facebook Feed, or Instagram Reels.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Promotional Banners Studio */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 mb-1">
              <ImageIcon className="w-4 h-4" />
              <span>Promotional Banners Studio</span>
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Customizable Downloadable PNG Banners
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Banner Subheadline
            </label>
            <input
              type="text"
              value={bannerSubline}
              onChange={(e) => setBannerSubline(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Call-to-Action Button Label
            </label>
            <input
              type="text"
              value={bannerCta}
              onChange={(e) => setBannerCta(e.target.value)}
              maxLength={40}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
            />
          </div>
        </div>

        {/* 3 Live Banner Previews with PNG Export */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {(
            [
              {
                id: 'wide',
                label: 'Facebook & Web Ad Banner',
                dims: '1200 × 630 px',
              },
              {
                id: 'square',
                label: 'Instagram & WhatsApp Status',
                dims: '1080 × 1080 px',
              },
              {
                id: 'strip',
                label: 'Wide Admissions Header Strip',
                dims: '1200 × 320 px',
              },
            ] as const
          ).map((b) => {
            const palette = BANNER_PALETTES[bannerTheme];
            return (
              <div
                key={b.id}
                className="border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between bg-[#F8FAFC]"
              >
                <div
                  className="p-5 text-white flex flex-col justify-between min-h-[180px]"
                  style={{
                    background: `linear-gradient(135deg, ${palette.bg1}, ${palette.bg2})`,
                  }}
                >
                  <div>
                    <div
                      className="text-[10px] font-semibold tracking-wider uppercase"
                      style={{ color: palette.accent }}
                    >
                      ScholarAxis Academy
                    </div>
                    <div className="text-base font-bold leading-snug mt-1.5">{bannerHeadline}</div>
                    <div className="text-xs text-slate-300 mt-1.5 line-clamp-2">
                      {bannerSubline}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span
                      className="px-3 py-1 rounded text-[11px] font-bold text-slate-900"
                      style={{ backgroundColor: palette.accent }}
                    >
                      {bannerCta} →
                    </span>
                    <span className="text-[10px] font-mono-tabular text-slate-300">
                      ${paymentSettings.feeUsd} Once
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{b.label}</div>
                    <div className="text-[11px] font-mono-tabular text-slate-500">{b.dims}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadBannerPng(b.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PNG
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Saved Ad Campaigns & Copy Manager */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Ad Campaigns & Copy Library ({campaigns.length})
            </h2>
            <p className="text-xs text-slate-500">
              Store ready-to-post ads for WhatsApp, Facebook, Instagram, and YouTube with tracked
              links.
            </p>
          </div>
          {campaigns.length === 0 && (
            <button
              type="button"
              disabled={seedingAds}
              onClick={handleSeedCampaigns}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {seedingAds ? 'Loading Templates...' : 'Load Ready-to-Use Ad Templates'}
            </button>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div className="p-10 text-center">
            <Megaphone className="w-7 h-7 text-slate-300 mx-auto mb-2.5" />
            <p className="text-sm font-medium text-slate-700">No ad campaigns created yet</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Load our 4 ready-to-use admissions ad templates or create your own custom campaign.
            </p>
            <button
              type="button"
              disabled={seedingAds}
              onClick={handleSeedCampaigns}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Load Ready-to-Use Ad Templates
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {campaigns.map((c) => {
              const fullAdText = `${c.headline}\n\n${c.bodyText}\n\n${c.ctaText}: ${c.targetUrl}`;
              return (
                <div
                  key={c.id}
                  className="p-6 flex flex-col lg:flex-row lg:items-start justify-between gap-5"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span
                        className={`font-semibold capitalize ${
                          c.status === 'active' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {c.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{c.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{c.title}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{c.headline}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{c.bodyText}</p>
                    <div className="text-xs font-mono-tabular text-slate-400 truncate pt-1">
                      {c.targetUrl}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(fullAdText, `ad-${c.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                    >
                      {copiedKey === `ad-${c.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          Copied Ad
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Ad Copy
                        </>
                      )}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(fullAdText)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => handleToggleCampaignStatus(c)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                    >
                      {c.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCampaign(c)}
                      aria-label={`Delete campaign ${c.title}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create New Ad Modal */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setShowAdModal(false)}
              aria-label="Close ad modal"
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Create Ad Campaign</h2>
            <p className="text-sm text-slate-500 mb-5">
              Save promotional copy with an automatic UTM-tracked enrollment link.
            </p>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    required
                    value={adTitle}
                    onChange={(e) => setAdTitle(e.target.value)}
                    placeholder="e.g. Summer Crash Course"
                    maxLength={140}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Channel</label>
                  <select
                    value={adChannel}
                    onChange={(e) => setAdChannel(e.target.value as MarketingChannel)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="general">General / Flyer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ad Headline</label>
                <input
                  type="text"
                  required
                  value={adHeadline}
                  onChange={(e) => setAdHeadline(e.target.value)}
                  placeholder="e.g. Admissions Open — Nursery to Masters Online Coaching"
                  maxLength={160}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ad Copy</label>
                <textarea
                  rows={4}
                  required
                  value={adBody}
                  onChange={(e) => setAdBody(e.target.value)}
                  placeholder="Write your promotional pitch, $10 EasyPaisa fee details, and benefits..."
                  maxLength={1000}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Call-to-Action Text
                </label>
                <input
                  type="text"
                  value={adCta}
                  onChange={(e) => setAdCta(e.target.value)}
                  placeholder="Enroll Now"
                  maxLength={80}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              {adError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {adError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAd}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingAd ? 'Saving...' : 'Save Ad Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

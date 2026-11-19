import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, QrCode } from 'lucide-react';
import { DEFAULT_PAYMENT_SETTINGS, PaymentSettings } from '../types';

interface EasyPaisaQRCardProps {
  settings: PaymentSettings;
  compact?: boolean;
}

export function EasyPaisaQRCard({ settings, compact = false }: EasyPaisaQRCardProps) {
  const [copied, setCopied] = useState(false);

  const qrImageSrc = settings.qrImageData || DEFAULT_PAYMENT_SETTINGS.qrImageData;
  const qrPayload = `easypaisa://pay?account=${encodeURIComponent(
    settings.easypaisaNumber
  )}&title=${encodeURIComponent(settings.easypaisaAccountTitle)}&amount=${settings.feePkr}&currency=PKR&note=ScholarAxis-Registration-10USD`;

  const handleCopy = () => {
    navigator.clipboard.writeText(settings.easypaisaNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <p className="text-xs font-medium text-emerald-700 mb-1">EasyPaisa Official Payment</p>
          <h3 className="text-lg font-bold text-slate-900">One-Time Enrollment Fee</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900 font-mono-tabular">
            ${settings.feeUsd} USD
          </div>
          <div className="text-xs text-slate-500 font-mono-tabular">
            PKR {settings.feePkr.toLocaleString()} · Lifetime
          </div>
        </div>
      </div>

      <div className={`flex flex-col ${compact ? 'items-center' : 'sm:flex-row items-center'} gap-6 pt-5`}>
        <div className="shrink-0 bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center">
          {qrImageSrc ? (
            <img
              src={qrImageSrc}
              alt="EasyPaisa Payment QR Code for MUHAMMAD DANISH MEHMOOD"
              referrerPolicy="no-referrer"
              className="w-48 sm:w-52 h-auto object-contain rounded"
            />
          ) : (
            <QRCodeSVG
              value={qrPayload}
              size={180}
              bgColor="#FFFFFF"
              fgColor="#0F172A"
              level="M"
            />
          )}
          <span className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-emerald-700" />
            Scan with EasyPaisa App
          </span>
        </div>

        <div className="flex-1 w-full space-y-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Account Title</div>
            <div className="font-semibold text-slate-900 mt-0.5">
              {settings.easypaisaAccountTitle}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">EasyPaisa Mobile Account</div>
            <div className="mt-1 flex items-center justify-between gap-2 bg-[#F8FAFC] border border-slate-200 rounded-lg px-3 py-2">
              <span className="font-mono-tabular font-semibold text-slate-900">
                {settings.easypaisaNumber}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Scan the QR code in your EasyPaisa app or send PKR {settings.feePkr.toLocaleString()}{' '}
            ($10 one-time) to the number above, then enter your Transaction ID (TID) to activate full
            account access.
          </p>
        </div>
      </div>
    </div>
  );
}

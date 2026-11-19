import { useState } from 'react';
import { reload, sendEmailVerification, signOut, User } from 'firebase/auth';
import { CheckCircle2, LogOut, MailCheck, RefreshCw } from 'lucide-react';
import { auth } from '../lib/firebase';

interface EmailVerificationGateProps {
  user: User;
  onVerified: () => void;
}

export function EmailVerificationGate({ user, onVerified }: EmailVerificationGateProps) {
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  const handleCheckStatus = async () => {
    setChecking(true);
    setMessage('');
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        onVerified();
      } else {
        setMessage('Email is not verified yet. Please click the verification link in your inbox.');
      }
    } catch {
      setMessage('Could not refresh verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setMessage('');
    try {
      await sendEmailVerification(user);
      setMessage(`Verification email resent to ${user.email}.`);
    } catch {
      setMessage('Please wait a moment before requesting another verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8">
        <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-5">
          <MailCheck className="w-5 h-5" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
          Verify your email address
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          To protect student and faculty accounts, ScholarAxis Academy requires email verification
          before accessing syllabus books or live sessions. We sent a verification link to{' '}
          <span className="font-semibold text-slate-900">{user.email}</span>.
        </p>

        {message && (
          <div className="mb-5 p-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
            {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckStatus}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {checking ? 'Checking Status...' : "I've Verified — Continue"}
          </button>

          <button
            type="button"
            disabled={resending}
            onClick={handleResend}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {resending ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out and use another account
          </button>
        </div>
      </div>
    </div>
  );
}

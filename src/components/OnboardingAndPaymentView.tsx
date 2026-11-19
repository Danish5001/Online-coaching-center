import React, { useState } from 'react';
import { User, signOut } from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ArrowRight, CheckCircle2, GraduationCap, LogOut, ShieldCheck, Users } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dispatchNotification } from '../lib/notifications';
import { ACADEMIC_LEVELS, ADMIN_EMAIL, PaymentSettings, UserRole } from '../types';
import { EasyPaisaQRCard } from './EasyPaisaQRCard';

interface OnboardingAndPaymentViewProps {
  user: User;
  preferredRole: 'student' | 'teacher';
  paymentSettings: PaymentSettings;
  onComplete: () => void;
}

export function OnboardingAndPaymentView({
  user,
  preferredRole,
  paymentSettings,
  onComplete,
}: OnboardingAndPaymentViewProps) {
  const isBootstrappedAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [step, setStep] = useState<'profile' | 'payment'>('profile');
  const [role, setRole] = useState<'student' | 'teacher'>(preferredRole);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [academicLevel, setAcademicLevel] = useState<string>(ACADEMIC_LEVELS[3]);
  const [gradeOrSpecialty, setGradeOrSpecialty] = useState('');
  const [tid, setTid] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = displayName.trim();
    if (cleanName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    const assignedRole: UserRole = isBootstrappedAdmin ? 'admin' : role;
    const initialPaymentStatus = isBootstrappedAdmin ? 'verified' : 'unpaid';

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: cleanName.slice(0, 100),
        email: (user.email || '').slice(0, 150),
        role: assignedRole,
        academicLevel: isBootstrappedAdmin ? 'All Levels' : academicLevel,
        gradeOrSpecialty:
          gradeOrSpecialty.trim().slice(0, 100) ||
          (isBootstrappedAdmin ? 'Academy Administrator' : role === 'teacher' ? 'General Faculty' : 'Enrolled Student'),
        paymentStatus: initialPaymentStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await dispatchNotification({
        recipientUid: user.uid,
        type: 'system',
        title: 'Welcome to ScholarAxis Academy',
        message: isBootstrappedAdmin
          ? 'Administrator account verified. You can upload syllabus books, manage EasyPaisa QR settings, and approve student payments.'
          : `Your verified ${assignedRole} account is ready. Complete your one-time $10 EasyPaisa fee to activate full enrollment.`,
      });

      if (isBootstrappedAdmin) {
        onComplete();
      } else {
        setStep('payment');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanTid = tid.trim().replace(/\s+/g, '');
    const cleanPhone = senderPhone.trim();

    if (!/^[a-zA-Z0-9-]{6,40}$/.test(cleanTid)) {
      setError('Enter a valid EasyPaisa Transaction ID (6–40 letters/digits, no spaces).');
      return;
    }
    if (cleanPhone.length < 7 || cleanPhone.length > 20) {
      setError('Enter the sender phone number used for EasyPaisa (e.g. 0345-1234567).');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'payments'), {
        userId: user.uid,
        userName: displayName.trim().slice(0, 100) || user.displayName || 'Member',
        userEmail: (user.email || '').slice(0, 150),
        userRole: role,
        amountUsd: 10,
        amountPkr: paymentSettings.feePkr,
        method: 'easypaisa',
        transactionId: cleanTid,
        senderPhone: cleanPhone,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', user.uid), {
        paymentStatus: 'pending',
        easypaisaTid: cleanTid,
        updatedAt: serverTimestamp(),
      });

      await dispatchNotification({
        recipientUid: user.uid,
        type: 'payment',
        title: 'EasyPaisa Payment Submitted',
        message: `Transaction ID ${cleanTid} ($10 one-time fee) has been submitted for verification. You will be notified automatically once approved.`,
      });

      onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'payments');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900">
          ScholarAxis Academy
        </span>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        {step === 'profile' ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Email Verified · {user.email}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">
              Complete your academy profile
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              {isBootstrappedAdmin
                ? 'Your email matches the Academy Administrator account. Confirm your display name to enter the dashboard.'
                : 'Choose whether you are joining as a Student or Teacher and select your academic level.'}
            </p>

            <form onSubmit={handleCreateProfile} className="space-y-5">
              {!isBootstrappedAdmin && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Account Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`flex items-center gap-3 p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                        role === 'student'
                          ? 'border-emerald-700 bg-emerald-50/50 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <GraduationCap className="w-5 h-5 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Student</div>
                        <div className="text-xs text-slate-500">
                          Study books, track progress & join classes
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('teacher')}
                      className={`flex items-center gap-3 p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                        role === 'teacher'
                          ? 'border-emerald-700 bg-emerald-50/50 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Users className="w-5 h-5 text-emerald-700 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Teacher</div>
                        <div className="text-xs text-slate-500">
                          Upload syllabus books & host live sessions
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your full name"
                  maxLength={100}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              {!isBootstrappedAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {role === 'student' ? 'Academic Level (Nursery to Masters)' : 'Primary Teaching Level'}
                    </label>
                    <select
                      value={academicLevel}
                      onChange={(e) => setAcademicLevel(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                    >
                      {ACADEMIC_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {role === 'student' ? 'Class / Semester' : 'Subject Specialty'}
                    </label>
                    <input
                      type="text"
                      value={gradeOrSpecialty}
                      onChange={(e) => setGradeOrSpecialty(e.target.value)}
                      placeholder={
                        role === 'student' ? 'e.g. Grade 10 or BS Semester 3' : 'e.g. Physics & Mathematics'
                      }
                      maxLength={100}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Saving Profile...'
                  : isBootstrappedAdmin
                  ? 'Enter Admin Dashboard'
                  : 'Continue to $10 One-Time Fee'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium text-emerald-700 mb-1">
                Step 2 of 2 · Lifetime Enrollment
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Complete $10 One-Time Registration via EasyPaisa
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Scan the EasyPaisa QR code below and submit your Transaction ID (TID) for
                verification.
              </p>
            </div>

            <EasyPaisaQRCard settings={paymentSettings} />

            <form
              onSubmit={handleSubmitPayment}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-slate-900">Submit EasyPaisa Receipt</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    EasyPaisa Transaction ID (TID)
                  </label>
                  <input
                    type="text"
                    required
                    value={tid}
                    onChange={(e) => setTid(e.target.value)}
                    placeholder="e.g. EP8923410922"
                    maxLength={40}
                    className="w-full px-3.5 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Sender EasyPaisa Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="e.g. 0345-1234567"
                    maxLength={20}
                    className="w-full px-3.5 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? 'Submitting Receipt...' : 'Submit EasyPaisa Payment'}
                </button>
                <button
                  type="button"
                  onClick={onComplete}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Skip for now & explore dashboard
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

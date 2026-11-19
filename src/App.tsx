import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { AuthModal } from './components/AuthModal';
import { DashboardWorkspace } from './components/DashboardWorkspace';
import { EmailVerificationGate } from './components/EmailVerificationGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingView } from './components/LandingView';
import { OnboardingAndPaymentView } from './components/OnboardingAndPaymentView';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { DEFAULT_PAYMENT_SETTINGS, PaymentSettings, UserProfile } from './types';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [verifiedTick, setVerifiedTick] = useState(0);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [inOnboarding, setInOnboarding] = useState(false);

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(
    DEFAULT_PAYMENT_SETTINGS
  );

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [preferredRole, setPreferredRole] = useState<'student' | 'teacher'>('student');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfile(null);
        setProfileLoaded(false);
        setInOnboarding(false);
      }
    });
    return () => unsub();
  }, []);

  // Load user profile & payment settings once authenticated and email-verified
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setProfile(null);
      setProfileLoaded(false);
      setInOnboarding(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
          setInOnboarding(true);
        }
        setProfileLoaded(true);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
    );

    const settingsRef = doc(db, 'settings', 'payment');
    const unsubSettings = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          setPaymentSettings(snap.data() as PaymentSettings);
        } else {
          setPaymentSettings(DEFAULT_PAYMENT_SETTINGS);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'settings/payment')
    );

    return () => {
      unsubProfile();
      unsubSettings();
    };
  }, [user, verifiedTick]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Loading ScholarAxis Academy...</div>
      </div>
    );
  }

  // Unauthenticated Landing Page
  if (!user) {
    return (
      <>
        <LandingView
          onOpenAuth={(role) => {
            if (role) setPreferredRole(role);
            setAuthModalOpen(true);
          }}
        />
        {authModalOpen && (
          <AuthModal
            initialRole={preferredRole}
            onClose={() => setAuthModalOpen(false)}
            onRoleSelected={setPreferredRole}
          />
        )}
      </>
    );
  }

  // Email Verification Gate
  if (!user.emailVerified) {
    return (
      <EmailVerificationGate
        user={user}
        onVerified={() => setVerifiedTick((t) => t + 1)}
      />
    );
  }

  // Waiting for Firestore profile load
  if (!profileLoaded) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Loading your academy workspace...</div>
      </div>
    );
  }

  // First-time onboarding (Profile + $10 EasyPaisa QR)
  if (!profile || inOnboarding) {
    return (
      <OnboardingAndPaymentView
        user={user}
        preferredRole={preferredRole}
        paymentSettings={paymentSettings}
        onComplete={() => setInOnboarding(false)}
      />
    );
  }

  return <DashboardWorkspace profile={profile} paymentSettings={paymentSettings} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

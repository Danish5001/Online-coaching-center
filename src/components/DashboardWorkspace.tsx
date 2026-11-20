import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  CreditCard,
  Languages,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ACADEMIC_LEVELS,
  LiveSession,
  MarketingCampaign,
  NotificationItem,
  PaymentRecord,
  PaymentSettings,
  StudentProgress,
  SyllabusBook,
  UserProfile,
} from '../types';
import { AiStudyChatbot, ChatContextHint } from './AiStudyChatbot';
import { LiveSessionsView } from './LiveSessionsView';
import { MarketingAdminView } from './MarketingAdminView';
import { NotificationsDrawer } from './NotificationsDrawer';
import { PaymentsAdminView } from './PaymentsAdminView';
import { QuranView } from './QuranView';
import { SyllabusLibrary } from './SyllabusLibrary';
import { TranslatorVoiceBotView } from './TranslatorVoiceBotView';

type NavTab =
  | 'overview'
  | 'syllabus'
  | 'quran'
  | 'translator'
  | 'sessions'
  | 'progress'
  | 'assistant'
  | 'payments'
  | 'marketing';

interface DashboardWorkspaceProps {
  profile: UserProfile;
  paymentSettings: PaymentSettings;
}

export function DashboardWorkspace({ profile, paymentSettings }: DashboardWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiContextHint, setAiContextHint] = useState<ChatContextHint | null>(null);

  const [books, setBooks] = useState<SyllabusBook[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [progressList, setProgressList] = useState<StudentProgress[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [seenBroadcastIds, setSeenBroadcastIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`scholaraxis_seen_${profile.uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleMarkBroadcastSeen = (ids: string[]) => {
    setSeenBroadcastIds(ids);
    try {
      localStorage.setItem(`scholaraxis_seen_${profile.uid}`, JSON.stringify(ids));
    } catch {
      // ignore storage errors
    }
  };

  // Real-time Firestore subscriptions (all aligned with hardened firestore.rules)
  useEffect(() => {
    const booksQ = query(collection(db, 'syllabusBooks'), where('visibility', '==', 'public'));
    const unsubBooks = onSnapshot(
      booksQ,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SyllabusBook));
        items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setBooks(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'syllabusBooks')
    );

    const sessionsQ = query(collection(db, 'liveSessions'), where('visibility', '==', 'public'));
    const unsubSessions = onSnapshot(
      sessionsQ,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveSession));
        setSessions(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'liveSessions')
    );

    const progressQ = query(collection(db, 'progress'), where('userId', '==', profile.uid));
    const unsubProgress = onSnapshot(
      progressQ,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentProgress));
        setProgressList(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'progress')
    );

    const paymentsQ =
      profile.role === 'admin'
        ? collection(db, 'payments')
        : query(collection(db, 'payments'), where('userId', '==', profile.uid));
    const unsubPayments = onSnapshot(
      paymentsQ,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
        items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setPayments(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    );

    const notifQ = query(
      collection(db, 'notifications'),
      where('recipientUid', 'in', [profile.uid, 'all'])
    );
    const unsubNotifs = onSnapshot(
      notifQ,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationItem));
        items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setNotifications(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    let unsubCampaigns = () => {};
    if (profile.role === 'admin') {
      unsubCampaigns = onSnapshot(
        collection(db, 'marketingCampaigns'),
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MarketingCampaign));
          items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          setCampaigns(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'marketingCampaigns')
      );
    }

    return () => {
      unsubBooks();
      unsubSessions();
      unsubProgress();
      unsubPayments();
      unsubNotifs();
      unsubCampaigns();
    };
  }, [profile.uid, profile.role]);

  const progressMap = useMemo(() => {
    const map: Record<string, StudentProgress> = {};
    for (const p of progressList) {
      map[p.bookId] = p;
    }
    return map;
  }, [progressList]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) =>
      n.recipientUid === 'all' ? !seenBroadcastIds.includes(n.id) : !n.isRead
    ).length;
  }, [notifications, seenBroadcastIds]);

  const overallCompletion = useMemo(() => {
    if (progressList.length === 0) return 0;
    const total = progressList.reduce((sum, p) => sum + p.percentComplete, 0);
    return Math.round(total / progressList.length);
  }, [progressList]);

  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'scheduled' || s.status === 'live')
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [sessions]
  );

  const pendingPaymentsCount = useMemo(
    () => payments.filter((p) => p.status === 'pending').length,
    [payments]
  );

  const navItems: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'syllabus', label: 'Syllabus Books', icon: BookOpen },
    { id: 'quran', label: 'Holy Quran & Urdu', icon: BookMarked },
    { id: 'translator', label: 'Translator & Voice Bot', icon: Languages },
    { id: 'sessions', label: 'Live Sessions', icon: Calendar },
    { id: 'progress', label: 'Progress Tracker', icon: BarChart3 },
    { id: 'assistant', label: 'AI Study Assistant', icon: Bot },
    {
      id: 'payments',
      label: profile.role === 'admin' ? 'EasyPaisa & Approvals' : 'EasyPaisa Fee ($10)',
      icon: CreditCard,
    },
    ...(profile.role === 'admin'
      ? [{ id: 'marketing' as NavTab, label: 'Marketing & Ads', icon: Megaphone }]
      : []),
  ];

  const tabTitles: Record<NavTab, string> = {
    overview: 'Overview',
    syllabus: 'Syllabus Books',
    quran: 'Holy Quran & Urdu',
    translator: 'Translator & Voice Bot',
    sessions: 'Live Sessions',
    progress: 'Progress Tracker',
    assistant: 'AI Study Assistant',
    payments: profile.role === 'admin' ? 'EasyPaisa & Approvals' : 'EasyPaisa Fee ($10)',
    marketing: 'Marketing & Ads',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar (260px) */}
      <aside className="hidden lg:flex lg:flex-col w-[260px] shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="font-display text-base font-bold tracking-tight text-slate-900">
            ScholarAxis Academy
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'payments' && profile.role === 'admin' && pendingPaymentsCount > 0 && (
                  <span className="font-mono-tabular text-xs font-semibold text-amber-700">
                    {pendingPaymentsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="px-2">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {profile.displayName}
            </div>
            <div className="text-xs text-slate-500 capitalize flex items-center gap-1.5 mt-0.5">
              <span>{profile.role}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  profile.paymentStatus === 'verified'
                    ? 'text-emerald-700 font-medium'
                    : 'text-amber-700 font-medium'
                }
              >
                {profile.paymentStatus === 'verified'
                  ? 'Fee Verified'
                  : profile.paymentStatus === 'pending'
                  ? 'Fee Pending'
                  : 'Fee Unpaid'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/40 backdrop-blur-xs flex">
          <div className="w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="font-display text-base font-bold text-slate-900">
                ScholarAxis
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg ${
                      active ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 truncate">
              <span className="hidden sm:inline">Academy</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">{tabTitles[activeTab]}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Verified Email</span>
            </div>

            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className="relative inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Bell className="w-4 h-4 text-slate-700" />
              <span className="hidden sm:inline">Notifications</span>
              {unreadCount > 0 && (
                <span className="font-mono-tabular text-xs font-bold text-emerald-700">
                  ({unreadCount})
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Fee Reminder Strip if Unpaid */}
        {profile.paymentStatus !== 'verified' && activeTab !== 'payments' && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-amber-900">
              {profile.paymentStatus === 'pending'
                ? `Your $10 EasyPaisa registration fee (TID: ${profile.easypaisaTid || 'submitted'}) is awaiting admin verification.`
                : 'Complete your one-time $10 EasyPaisa registration fee to verify your lifetime academy membership.'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className="font-semibold text-amber-900 underline hover:text-amber-950 whitespace-nowrap self-start sm:self-auto cursor-pointer"
            >
              {profile.paymentStatus === 'pending' ? 'View Payment Status' : 'Pay via EasyPaisa QR'}
            </button>
          </div>
        )}

        {/* Viewport Container */}
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Welcome back, {profile.displayName}
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  {profile.academicLevel} · {profile.gradeOrSpecialty}
                </p>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-white p-5">
                  <div className="text-xs text-slate-500">Syllabus Books Available</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1">
                    {books.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Nursery through Masters</div>
                </div>
                <div className="bg-white p-5">
                  <div className="text-xs text-slate-500">Average Syllabus Mastery</div>
                  <div className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
                    {overallCompletion}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {progressList.length} books tracked
                  </div>
                </div>
                <div className="bg-white p-5">
                  <div className="text-xs text-slate-500">Upcoming Live Sessions</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1">
                    {upcomingSessions.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Scheduled & live now</div>
                </div>
                <div className="bg-white p-5">
                  <div className="text-xs text-slate-500">Enrollment Status ($10)</div>
                  <div className="text-2xl font-bold text-slate-900 capitalize mt-1">
                    {profile.paymentStatus}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">One-time EasyPaisa fee</div>
                </div>
              </div>

              {/* 2-Column Activity Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Recent Syllabus Progress */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-slate-900">Your Syllabus Progress</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('syllabus')}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Browse All Books
                    </button>
                  </div>

                  {progressList.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500 mb-3">
                        You have not started tracking any syllabus books yet.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('syllabus')}
                        className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                      >
                        Open Syllabus Library
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {progressList.slice(0, 5).map((item) => (
                        <div key={item.id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-900 truncate pr-4">
                              {item.bookTitle}
                            </span>
                            <span className="font-mono-tabular text-xs font-semibold text-slate-700 shrink-0">
                              {item.completedChapters.length}/{item.totalChapters} ({item.percentComplete}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600"
                              style={{ width: `${item.percentComplete}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Next Live Sessions */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-slate-900">Upcoming Live Sessions</h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('sessions')}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      View Schedule
                    </button>
                  </div>

                  {upcomingSessions.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      No upcoming live sessions scheduled yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {upcomingSessions.slice(0, 4).map((s) => (
                        <div key={s.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="text-xs text-emerald-700 font-medium">
                            {s.status === 'live' ? 'LIVE NOW' : s.academicLevel} · {s.subject}
                          </div>
                          <div className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                            {s.title}
                          </div>
                          <div className="text-xs text-slate-500 font-mono-tabular mt-1">
                            {new Date(s.scheduledAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {s.durationMinutes} min
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'syllabus' && (
            <SyllabusLibrary
              profile={profile}
              books={books}
              progressMap={progressMap}
              onAskAi={(ctx) => {
                setAiContextHint(ctx);
                setAiDrawerOpen(true);
              }}
            />
          )}

          {activeTab === 'quran' && <QuranView />}

          {activeTab === 'translator' && <TranslatorVoiceBotView />}

          {activeTab === 'sessions' && (
            <LiveSessionsView profile={profile} sessions={sessions} />
          )}

          {activeTab === 'assistant' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  AI Study Tutor & Help Assistant
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Get instant explanations for any Nursery-to-Masters syllabus topic, practice quizzes,
                  or help using ScholarAxis Academy.
                </p>
              </div>
              <AiStudyChatbot profile={profile} mode="full" contextHint={aiContextHint} />
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Progress & Curriculum Tracker
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Track chapter completion across all Nursery-to-Masters syllabus books.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Coverage by Academic Tier
                  </h2>
                  <span className="text-xs font-mono-tabular text-slate-500">
                    {books.length} total books
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {ACADEMIC_LEVELS.map((level) => {
                    const levelBooks = books.filter((b) => b.academicLevel === level);
                    const trackedInLevel = levelBooks.filter((b) => progressMap[b.id]);
                    const avgPct =
                      trackedInLevel.length > 0
                        ? Math.round(
                            trackedInLevel.reduce(
                              (sum, b) => sum + (progressMap[b.id]?.percentComplete || 0),
                              0
                            ) / trackedInLevel.length
                          )
                        : 0;
                    return (
                      <div
                        key={level}
                        className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{level}</div>
                          <div className="text-xs text-slate-500">
                            {levelBooks.length} syllabus {levelBooks.length === 1 ? 'book' : 'books'}{' '}
                            available · {trackedInLevel.length} started
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-56">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600"
                              style={{ width: `${avgPct}%` }}
                            />
                          </div>
                          <span className="font-mono-tabular text-xs font-semibold text-slate-800 w-10 text-right">
                            {avgPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {progressList.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-base font-bold text-slate-900">Tracked Books Detail</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="px-6 py-3 font-medium">Syllabus Book</th>
                          <th className="px-6 py-3 font-medium">Level</th>
                          <th className="px-6 py-3 font-medium text-right">Chapters</th>
                          <th className="px-6 py-3 font-medium text-right">Mastery</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {progressList.map((p) => (
                          <tr key={p.id}>
                            <td className="px-6 py-3.5 font-medium text-slate-900">
                              <span className="inline-flex items-center gap-2">
                                {p.percentComplete === 100 && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                )}
                                {p.bookTitle}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-slate-600">{p.academicLevel}</td>
                            <td className="px-6 py-3.5 text-right font-mono-tabular text-slate-700">
                              {p.completedChapters.length} / {p.totalChapters}
                            </td>
                            <td className="px-6 py-3.5 text-right font-mono-tabular font-semibold text-emerald-700">
                              {p.percentComplete}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <PaymentsAdminView
              profile={profile}
              paymentSettings={paymentSettings}
              payments={payments}
            />
          )}

          {activeTab === 'marketing' && profile.role === 'admin' && (
            <MarketingAdminView
              profile={profile}
              paymentSettings={paymentSettings}
              campaigns={campaigns}
            />
          )}
        </main>
      </div>

      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        currentUid={profile.uid}
        seenBroadcastIds={seenBroadcastIds}
        onMarkBroadcastSeen={handleMarkBroadcastSeen}
      />

      {/* Floating Ask AI Tutor Button (hidden when already on full AI tab or drawer open) */}
      {activeTab !== 'assistant' && !aiDrawerOpen && (
        <button
          type="button"
          onClick={() => setAiDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          <Bot className="w-4 h-4" />
          Ask AI Tutor
        </button>
      )}

      {/* Slide-Over AI Assistant Drawer */}
      {aiDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <AiStudyChatbot
            profile={profile}
            mode="drawer"
            contextHint={aiContextHint}
            onClose={() => setAiDrawerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

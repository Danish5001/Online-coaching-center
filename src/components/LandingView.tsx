import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ACADEMIC_LEVELS, DEFAULT_PAYMENT_SETTINGS } from '../types';
import { EasyPaisaQRCard } from './EasyPaisaQRCard';

interface LandingViewProps {
  onOpenAuth: (preferredRole?: 'student' | 'teacher') => void;
}

const HERO_IMG = '/src/assets/images/hero_coaching_library_1795114739697.jpg';
const BOOKS_IMG = '/src/assets/images/syllabus_books_stack_1795114739029.jpg';
const LIVE_IMG = '/src/assets/images/live_session_studio_1795114738795.jpg';

export function LandingView({ onOpenAuth }: LandingViewProps) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            ScholarAxis Academy
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#curriculum"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Curriculum
            </a>
            <a
              href="#live-classes"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Live Classes
            </a>
            <a
              href="#enrollment-fee"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Enrollment Fee
            </a>
            <a
              href="#verification"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Verification
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('student')}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section: Balanced 2-Column Split */}
        <section className="max-w-[1200px] mx-auto px-6 pt-12 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-emerald-700 mb-3">
                Nursery to Masters · Verified Online Coaching Center
              </p>
              <h1
                className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] mb-5"
                style={{ textWrap: 'balance' }}
              >
                One structured academy for every syllabus from Nursery to Masters.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl mb-8">
                Students access complete syllabus books, chapter-by-chapter progress tracking, and
                scheduled live coaching sessions. Teachers upload curriculum books and host live
                classes — all with verified email authentication and a single $10 one-time
                registration fee via EasyPaisa.
              </p>

              {/* Role-Specific Sign-In Entry */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth('student')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" />
                  Sign In as Student
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('teacher')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Users className="w-4 h-4 text-slate-700" />
                  Sign In as Teacher
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>$10 One-Time Fee</span>
                <span aria-hidden="true">·</span>
                <span>EasyPaisa QR Supported</span>
                <span aria-hidden="true">·</span>
                <span>Email-Verified Accounts</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={HERO_IMG}
                  alt="ScholarAxis Academy study hall and coaching library"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Column Structural KPI Strip Below Hero */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-white p-6">
              <div className="text-2xl font-bold text-slate-900 font-mono-tabular">7 Tiers</div>
              <div className="text-sm text-slate-600 mt-1">Nursery through Masters</div>
            </div>
            <div className="bg-white p-6">
              <div className="text-2xl font-bold text-slate-900 font-mono-tabular">$10 Once</div>
              <div className="text-sm text-slate-600 mt-1">Lifetime enrollment via EasyPaisa</div>
            </div>
            <div className="bg-white p-6">
              <div className="text-2xl font-bold text-slate-900 font-mono-tabular">100% Live</div>
              <div className="text-sm text-slate-600 mt-1">Scheduled faculty coaching sessions</div>
            </div>
            <div className="bg-white p-6">
              <div className="text-2xl font-bold text-slate-900 font-mono-tabular">Real-Time</div>
              <div className="text-sm text-slate-600 mt-1">Chapter tracking & notifications</div>
            </div>
          </div>
        </section>

        {/* Section 2: Complete Curriculum Ladder (Nursery to Masters) */}
        <section id="curriculum" className="bg-white border-y border-slate-200 py-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-5">
                <p className="text-sm font-medium text-emerald-700 mb-2">
                  Complete Syllabus Library
                </p>
                <h2
                  className="text-3xl font-bold tracking-tight text-slate-900 mb-4"
                  style={{ textWrap: 'balance' }}
                >
                  Every academic level organized in one searchable library.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Teachers upload structured syllabus books with chapter outlines and digital study
                  resources. Students filter directly to their grade or semester and check off
                  chapters as they master each topic.
                </p>
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3]">
                  <img
                    src={BOOKS_IMG}
                    alt="Stacked academic textbooks from early childhood to masters curriculum"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="lg:col-span-7 divide-y divide-slate-200 border-t border-b border-slate-200">
                {ACADEMIC_LEVELS.map((level, idx) => (
                  <div
                    key={level}
                    className="py-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 px-3 transition-colors"
                  >
                    <div className="flex items-baseline gap-4 min-w-0">
                      <span className="font-mono-tabular text-xs font-semibold text-slate-400 shrink-0">
                        0{idx + 1}
                      </span>
                      <span className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                        {level}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                      Syllabus Books · Progress · Live Classes
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Live Coaching & Progress Dashboard */}
        <section id="live-classes" className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3]">
                <img
                  src={LIVE_IMG}
                  alt="Online teacher desk setup for live coaching sessions"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
              <div>
                <p className="text-sm font-medium text-emerald-700 mb-2">
                  Live Sessions & Progress Tracking
                </p>
                <h2
                  className="text-3xl font-bold tracking-tight text-slate-900 mb-4"
                  style={{ textWrap: 'balance' }}
                >
                  Scheduled live classes paired with automated alerts.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Faculty schedule live lectures with meeting links, subject tags, and duration.
                  Every new book upload or scheduled live class triggers an automated real-time
                  notification across student dashboards.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Chapter-by-Chapter Progress Tracking
                    </h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Students track exact completion percentages per syllabus book and receive
                      milestone notifications upon finishing modules.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Live Session Calendar & Direct Join
                    </h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Teachers publish live classes with status updates (Scheduled, Live Now,
                      Completed) and students join in one click.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3" id="verification">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Email-Verified Authentication & Role Security
                    </h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Every account requires verified email authentication before accessing
                      classroom resources, protecting student and faculty records.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: One-Time $10 EasyPaisa Registration Fee */}
        <section id="enrollment-fee" className="bg-white border-t border-slate-200 py-20">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-5">
                <p className="text-sm font-medium text-emerald-700 mb-2">
                  Simple One-Time Enrollment
                </p>
                <h2
                  className="text-3xl font-bold tracking-tight text-slate-900 mb-4"
                  style={{ textWrap: 'balance' }}
                >
                  $10 one-time fee via EasyPaisa QR. No monthly subscriptions.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Pay once to unlock permanent access to all syllabus books from Nursery to Masters,
                  progress analytics, and live coaching sessions.
                </p>
                <ul className="space-y-2.5 text-sm text-slate-700 mb-8">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    Full Nursery through Masters syllabus book catalog
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    Personal progress dashboard & chapter completion records
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    Live coaching sessions & automated class notifications
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => onOpenAuth('student')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Create Verified Account
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="lg:col-span-7">
                <EasyPaisaQRCard settings={DEFAULT_PAYMENT_SETTINGS} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-[#F8FAFC] py-8">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">ScholarAxis Academy</span>
          <span>Nursery to Masters Online Coaching Center · One-Time $10 EasyPaisa Enrollment</span>
        </div>
      </footer>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  BookOpen,
  Bot,
  Check,
  CheckSquare,
  Download,
  ExternalLink,
  FileDown,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dispatchNotification } from '../lib/notifications';
import {
  exportBooksAsReadableHtml,
  getCachedLesson,
  getOfflineBooks,
  OfflineBookRecord,
  saveAllBooksOffline,
  saveBookOffline,
  saveCachedLesson,
} from '../lib/offlineBooks';
import {
  ACADEMIC_LEVELS,
  AcademicLevel,
  STARTER_SYLLABUS_BOOKS,
  StudentProgress,
  SyllabusBook,
  UserProfile,
} from '../types';
import { ChatContextHint } from './AiStudyChatbot';

interface SyllabusLibraryProps {
  profile: UserProfile;
  books: SyllabusBook[];
  progressMap: Record<string, StudentProgress>;
  onAskAi?: (context: ChatContextHint) => void;
}

export function SyllabusLibrary({
  profile,
  books,
  progressMap,
  onAskAi,
}: SyllabusLibraryProps) {
  const canManageBooks = profile.role === 'teacher' || profile.role === 'admin';

  const [selectedLevel, setSelectedLevel] = useState<string>('All Levels');
  const [selectedGrade, setSelectedGrade] = useState<string>('All Grades');
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');
  const [progressFilter, setProgressFilter] = useState<
    'all' | 'not-started' | 'in-progress' | 'completed'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBook, setActiveBook] = useState<SyllabusBook | null>(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(0);
  const [lessonContent, setLessonContent] = useState<string>('');
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [lessonError, setLessonError] = useState('');
  const [offlineBooks, setOfflineBooks] = useState<Record<string, OfflineBookRecord>>(() =>
    getOfflineBooks()
  );
  const [downloadBannerMsg, setDownloadBannerMsg] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Upload book form state
  const [title, setTitle] = useState('');
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel>(ACADEMIC_LEVELS[0]);
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [boardOrAuthor, setBoardOrAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [chaptersText, setChaptersText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const availableGrades = useMemo(() => {
    const scope =
      selectedLevel === 'All Levels'
        ? books
        : books.filter((b) => b.academicLevel === selectedLevel);
    return Array.from(new Set(scope.map((b) => b.grade.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [books, selectedLevel]);

  const availableSubjects = useMemo(() => {
    const scope = books.filter((b) => {
      const okLevel = selectedLevel === 'All Levels' || b.academicLevel === selectedLevel;
      const okGrade = selectedGrade === 'All Grades' || b.grade === selectedGrade;
      return okLevel && okGrade;
    });
    return Array.from(new Set(scope.map((b) => b.subject.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [books, selectedLevel, selectedGrade]);

  const hasActiveFilters =
    selectedLevel !== 'All Levels' ||
    selectedGrade !== 'All Grades' ||
    selectedSubject !== 'All Subjects' ||
    progressFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedLevel('All Levels');
    setSelectedGrade('All Grades');
    setSelectedSubject('All Subjects');
    setProgressFilter('all');
    setSearchQuery('');
  };

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const matchesLevel =
        selectedLevel === 'All Levels' || book.academicLevel === selectedLevel;
      const matchesGrade = selectedGrade === 'All Grades' || book.grade === selectedGrade;
      const matchesSubject =
        selectedSubject === 'All Subjects' || book.subject === selectedSubject;

      const pct = progressMap[book.id]?.percentComplete || 0;
      const matchesProgress =
        progressFilter === 'all' ||
        (progressFilter === 'not-started' && pct === 0) ||
        (progressFilter === 'in-progress' && pct > 0 && pct < 100) ||
        (progressFilter === 'completed' && pct === 100);

      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.subject.toLowerCase().includes(q) ||
        book.grade.toLowerCase().includes(q) ||
        book.academicLevel.toLowerCase().includes(q) ||
        book.boardOrAuthor.toLowerCase().includes(q) ||
        book.chapters.some((ch) => ch.toLowerCase().includes(q));

      return matchesLevel && matchesGrade && matchesSubject && matchesProgress && matchesQuery;
    });
  }, [books, selectedLevel, selectedGrade, selectedSubject, progressFilter, searchQuery, progressMap]);

  const handleSeedStarterBooks = async () => {
    if (!canManageBooks || seeding) return;
    setSeeding(true);
    try {
      for (const item of STARTER_SYLLABUS_BOOKS) {
        await addDoc(collection(db, 'syllabusBooks'), {
          ...item,
          uploadedByUid: profile.uid,
          uploadedByName: profile.displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await dispatchNotification({
        recipientUid: 'all',
        type: 'book',
        title: 'Nursery to Masters Syllabus Library Published',
        message: `${STARTER_SYLLABUS_BOOKS.length} core syllabus books spanning Nursery–KG through Masters are now available in the library.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'syllabusBooks');
    } finally {
      setSeeding(false);
    }
  };

  const handleUploadBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const chapters = chaptersText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 30);

    if (title.trim().length < 2 || subject.trim().length < 2 || grade.trim().length < 1) {
      setFormError('Please fill in Book Title, Grade/Semester, and Subject.');
      return;
    }
    if (chapters.length === 0) {
      setFormError('Please enter at least one chapter (one chapter per line).');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'syllabusBooks'), {
        title: title.trim().slice(0, 160),
        academicLevel,
        grade: grade.trim().slice(0, 60),
        subject: subject.trim().slice(0, 80),
        boardOrAuthor: (boardOrAuthor.trim() || 'Academy Curriculum').slice(0, 100),
        description: description.trim().slice(0, 1000),
        resourceUrl: resourceUrl.trim().slice(0, 500),
        chapters,
        uploadedByUid: profile.uid,
        uploadedByName: profile.displayName,
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await dispatchNotification({
        recipientUid: 'all',
        type: 'book',
        title: `New Syllabus Book: ${title.trim().slice(0, 100)}`,
        message: `${profile.displayName} uploaded a ${academicLevel} (${grade.trim()}) textbook for ${subject.trim()} with ${chapters.length} chapters.`,
      });

      setTitle('');
      setGrade('');
      setSubject('');
      setBoardOrAuthor('');
      setDescription('');
      setResourceUrl('');
      setChaptersText('');
      setShowUploadModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'syllabusBooks');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async (book: SyllabusBook) => {
    try {
      await deleteDoc(doc(db, 'syllabusBooks', book.id));
      if (activeBook?.id === book.id) {
        setActiveBook(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `syllabusBooks/${book.id}`);
    }
  };

  const handleToggleChapter = async (book: SyllabusBook, chapterIdx: number) => {
    const progressDocId = `${profile.uid}_${book.id}`;
    const existing = progressMap[book.id];
    const currentList = existing ? existing.completedChapters : [];
    const exists = currentList.includes(chapterIdx);
    const nextList = exists
      ? currentList.filter((i) => i !== chapterIdx)
      : [...currentList, chapterIdx].sort((a, b) => a - b);

    const totalChapters = Math.max(1, book.chapters.length);
    const percentComplete = Math.round((nextList.length / totalChapters) * 100);

    try {
      if (!existing) {
        await setDoc(doc(db, 'progress', progressDocId), {
          userId: profile.uid,
          bookId: book.id,
          bookTitle: book.title.slice(0, 160),
          academicLevel: book.academicLevel,
          completedChapters: nextList,
          totalChapters,
          percentComplete,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'progress', progressDocId), {
          completedChapters: nextList,
          totalChapters,
          percentComplete,
          bookTitle: book.title.slice(0, 160),
          academicLevel: book.academicLevel,
          updatedAt: serverTimestamp(),
        });
      }

      if (!exists && percentComplete === 100) {
        await dispatchNotification({
          recipientUid: profile.uid,
          type: 'progress',
          title: `Syllabus Completed: ${book.title.slice(0, 90)}`,
          message: `Congratulations! You have completed all ${totalChapters} chapters of ${book.title} (${book.academicLevel}).`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `progress/${progressDocId}`);
    }
  };

  const loadChapterForReading = async (book: SyllabusBook, idx: number) => {
    setActiveChapterIdx(idx);
    setLessonError('');
    const cached = getCachedLesson(book.id, idx);
    if (cached) {
      setLessonContent(cached);
      setLoadingLesson(false);
      return;
    }

    setLessonContent('');
    setLoadingLesson(true);
    try {
      const res = await fetch('/api/ai/chapter-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookTitle: book.title,
          academicLevel: book.academicLevel,
          grade: book.grade,
          subject: book.subject,
          chapterTitle: book.chapters[idx],
        }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Could not load chapter (${res.status})`);
      }
      const text = data.content || '';
      saveCachedLesson(book.id, idx, text);
      setLessonContent(text);
    } catch (err) {
      setLessonError(
        err instanceof Error ? err.message : 'Unable to load chapter reading material.'
      );
    } finally {
      setLoadingLesson(false);
    }
  };

  const handleOpenBookReader = (book: SyllabusBook) => {
    setActiveBook(book);
    setOfflineBooks(saveBookOffline(book));
    loadChapterForReading(book, 0);
  };

  const handleDownloadAllBooks = () => {
    if (books.length === 0) return;
    const updated = saveAllBooksOffline(books);
    setOfflineBooks(updated);
    setDownloadBannerMsg(
      `All ${books.length} syllabus books have been downloaded onto the app for direct reading.`
    );
    setTimeout(() => setDownloadBannerMsg(''), 5000);
  };

  const handleDownloadSingleBook = (book: SyllabusBook) => {
    setOfflineBooks(saveBookOffline(book));
    const safeFile = book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48);
    exportBooksAsReadableHtml([book], `${safeFile || 'syllabus-book'}.html`);
  };

  const downloadedCount = books.filter((b) => Boolean(offlineBooks[b.id])).length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Syllabus Books Library
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Complete academic curriculum from Nursery–KG through Masters ·{' '}
            <span className="font-mono-tabular font-medium text-emerald-700">
              {downloadedCount}/{books.length} saved for direct reading
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {books.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleDownloadAllBooks}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-700" />
                Download All on App
              </button>
              <button
                type="button"
                onClick={() =>
                  exportBooksAsReadableHtml(books, 'scholaraxis-all-syllabus-books.html')
                }
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                Export Pack (.html)
              </button>
            </>
          )}

          {canManageBooks && books.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedStarterBooks}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-700" />
              {seeding ? 'Loading Catalog...' : 'Load Nursery–Masters Starter Books'}
            </button>
          )}

          {canManageBooks && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Upload Syllabus Book
            </button>
          )}
        </div>
      </div>

      {downloadBannerMsg && (
        <div className="p-3 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            {downloadBannerMsg}
          </span>
          <button
            type="button"
            onClick={() => setDownloadBannerMsg('')}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Multi-Facet Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
        {/* Row 1: Search Input + Grade, Subject & Progress Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-5">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, subject, grade, or chapter..."
              aria-label="Search syllabus books"
              className="w-full pl-10 pr-9 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedSubject('All Subjects');
              }}
              aria-label="Filter by grade"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
            >
              <option value="All Grades">All Grades / Semesters</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              aria-label="Filter by subject"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
            >
              <option value="All Subjects">All Subjects</option>
              {availableSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={progressFilter}
              onChange={(e) =>
                setProgressFilter(
                  e.target.value as 'all' | 'not-started' | 'in-progress' | 'completed'
                )
              }
              aria-label="Filter by progress status"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
            >
              <option value="all">All Progress</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Row 2: Academic Level Tabs + Results Count & Reset */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {['All Levels', ...ACADEMIC_LEVELS].map((lvl) => {
              const active = selectedLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setSelectedLevel(lvl);
                    setSelectedGrade('All Grades');
                    setSelectedSubject('All Subjects');
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {lvl === 'All Levels' ? 'All Levels' : lvl.split(' (')[0]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-mono-tabular whitespace-nowrap">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              Showing {filteredBooks.length} of {books.length}{' '}
              {books.length === 1 ? 'book' : 'books'}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State or Books Grid */}
      {filteredBooks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No syllabus books found
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
            {books.length === 0
              ? canManageBooks
                ? 'Start by uploading your first syllabus book or loading the Nursery-to-Masters starter catalog.'
                : 'Your faculty has not uploaded books for this level yet. Check back soon or check your notifications.'
              : 'No books match your current grade, subject, or search filters.'}
          </p>
          {hasActiveFilters && books.length > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset All Filters
            </button>
          )}
          {canManageBooks && books.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedStarterBooks}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {seeding ? 'Loading...' : 'Load Nursery–Masters Starter Books'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredBooks.map((book) => {
            const prog = progressMap[book.id];
            const pct = prog ? prog.percentComplete : 0;
            const completedCount = prog ? prog.completedChapters.length : 0;

            return (
              <div
                key={book.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap mb-2">
                    <span className="font-medium text-emerald-700">{book.academicLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{book.grade}</span>
                    <span aria-hidden="true">·</span>
                    <span>{book.subject}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug mb-1.5">
                    {book.title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    {book.boardOrAuthor} · Uploaded by {book.uploadedByName}
                  </p>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4">
                    {book.description || 'Structured curriculum textbook with tracked chapters.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-600">Chapter Progress</span>
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {completedCount}/{book.chapters.length} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenBookReader(book)}
                      className="flex-1 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {offlineBooks[book.id] ? 'Read Directly (Saved)' : 'Read Directly'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSingleBook(book)}
                      title="Download book for offline reading"
                      aria-label={`Download ${book.title}`}
                      className="p-2 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {canManageBooks &&
                      (profile.role === 'admin' || book.uploadedByUid === profile.uid) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBook(book)}
                          aria-label={`Delete ${book.title}`}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Direct In-App Book Reader Modal (Split Chapter List + Full Textbook Reading View) */}
      {activeBook && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-xl">
            {/* Reader Top Bar */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div className="text-xs text-emerald-700 font-medium truncate">
                  {activeBook.academicLevel} · {activeBook.grade} · {activeBook.subject}
                </div>
                <h2 className="text-lg font-bold text-slate-900 truncate">{activeBook.title}</h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadSingleBook(activeBook)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download Book (.html)</span>
                </button>
                {onAskAi && (
                  <button
                    type="button"
                    onClick={() => {
                      const chTitle = activeBook.chapters[activeChapterIdx] || '';
                      onAskAi({
                        activeBookTitle: activeBook.title,
                        activeChapter: chTitle,
                        initialPrompt: `Help me understand "${chTitle}" from the book "${activeBook.title}" (${activeBook.academicLevel}, ${activeBook.subject}). Explain the main ideas simply and give 1 example.`,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Ask AI Tutor
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveBook(null)}
                  aria-label="Close direct book reader"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split Reader Body */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
              {/* Left Pane: Chapter Navigation & Progress Checklist */}
              <aside className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-[#F8FAFC] overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-semibold text-slate-700">
                    Chapters ({activeBook.chapters.length})
                  </span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    {progressMap[activeBook.id]?.percentComplete || 0}% Complete
                  </span>
                </div>

                <div className="space-y-1">
                  {activeBook.chapters.map((chapter, idx) => {
                    const checked =
                      progressMap[activeBook.id]?.completedChapters.includes(idx) || false;
                    const isSelected = activeChapterIdx === idx;
                    return (
                      <div
                        key={`${activeBook.id}-ch-${idx}`}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                          isSelected
                            ? 'bg-white border border-emerald-300 shadow-2xs'
                            : 'hover:bg-white/80 border border-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleChapter(activeBook, idx)}
                          aria-label={`Toggle chapter ${idx + 1} completed`}
                          className="shrink-0 p-0.5 cursor-pointer"
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadChapterForReading(activeBook, idx)}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <div className="text-[11px] font-mono-tabular text-slate-400">
                            Chapter {String(idx + 1).padStart(2, '0')}
                          </div>
                          <div
                            className={`text-xs leading-snug truncate ${
                              isSelected
                                ? 'font-bold text-slate-900'
                                : checked
                                ? 'text-slate-400 line-through'
                                : 'font-medium text-slate-700'
                            }`}
                          >
                            {chapter}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {activeBook.resourceUrl && (
                  <div className="pt-3 border-t border-slate-200">
                    <a
                      href={activeBook.resourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      External PDF Reference
                    </a>
                  </div>
                )}
              </aside>

              {/* Right Pane: Direct Chapter Reading Canvas */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white">
                <div className="max-w-2xl mx-auto space-y-5">
                  <div className="pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono-tabular text-emerald-700 font-semibold">
                        Chapter {String(activeChapterIdx + 1).padStart(2, '0')} of{' '}
                        {activeBook.chapters.length}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        {activeBook.chapters[activeChapterIdx]}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleChapter(activeBook, activeChapterIdx)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        progressMap[activeBook.id]?.completedChapters.includes(activeChapterIdx)
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {progressMap[activeBook.id]?.completedChapters.includes(activeChapterIdx) ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Chapter Completed
                        </>
                      ) : (
                        'Mark Chapter Complete'
                      )}
                    </button>
                  </div>

                  {loadingLesson ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
                      <Loader2 className="w-6 h-6 text-emerald-700 animate-spin" />
                      <p className="text-sm font-medium text-slate-700">
                        Loading textbook lesson for direct reading...
                      </p>
                      <p className="text-xs text-slate-500">
                        Once loaded, this chapter is automatically saved on your app for offline
                        reading.
                      </p>
                    </div>
                  ) : lessonError ? (
                    <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg space-y-3">
                      <p>{lessonError}</p>
                      <button
                        type="button"
                        onClick={() => loadChapterForReading(activeBook, activeChapterIdx)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800 cursor-pointer"
                      >
                        Retry Loading Chapter
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-800 leading-7 whitespace-pre-wrap">
                      {lessonContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Book Modal (Teachers & Admin) */}
      {showUploadModal && canManageBooks && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              aria-label="Close upload book modal"
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Upload Syllabus Book</h2>
            <p className="text-sm text-slate-500 mb-6">
              Add a textbook for any level from Nursery to Masters. All students will be notified
              automatically.
            </p>

            <form onSubmit={handleUploadBook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Book Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Organic Chemistry Foundations"
                  maxLength={160}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Academic Level
                  </label>
                  <select
                    value={academicLevel}
                    onChange={(e) => setAcademicLevel(e.target.value as AcademicLevel)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  >
                    {ACADEMIC_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Grade / Class / Semester
                  </label>
                  <input
                    type="text"
                    required
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g. Nursery, Grade 9, BS Sem 2, MS"
                    maxLength={60}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Chemistry, Mathematics, English"
                    maxLength={80}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Board / Publisher / Author
                  </label>
                  <input
                    type="text"
                    value={boardOrAuthor}
                    onChange={(e) => setBoardOrAuthor(e.target.value)}
                    placeholder="e.g. PTB, Oxford, Cambridge, HEC"
                    maxLength={100}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Digital PDF / Book Resource URL (optional)
                </label>
                <input
                  type="url"
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://..."
                  maxLength={500}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Overview Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of syllabus coverage and learning outcomes..."
                  maxLength={1000}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Syllabus Chapters (one chapter per line, up to 30)
                </label>
                <textarea
                  rows={5}
                  required
                  value={chaptersText}
                  onChange={(e) => setChaptersText(e.target.value)}
                  placeholder={`Chapter 1: Introduction & Core Concepts\nChapter 2: Foundations & Problem Solving\nChapter 3: Applied Exercises`}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              {formError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Publishing...' : 'Publish Syllabus Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

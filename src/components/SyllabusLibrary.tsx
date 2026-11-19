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
  CheckSquare,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dispatchNotification } from '../lib/notifications';
import {
  ACADEMIC_LEVELS,
  AcademicLevel,
  STARTER_SYLLABUS_BOOKS,
  StudentProgress,
  SyllabusBook,
  UserProfile,
} from '../types';

interface SyllabusLibraryProps {
  profile: UserProfile;
  books: SyllabusBook[];
  progressMap: Record<string, StudentProgress>;
}

export function SyllabusLibrary({ profile, books, progressMap }: SyllabusLibraryProps) {
  const canManageBooks = profile.role === 'teacher' || profile.role === 'admin';

  const [selectedLevel, setSelectedLevel] = useState<string>('All Levels');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBook, setActiveBook] = useState<SyllabusBook | null>(null);
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

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesLevel =
        selectedLevel === 'All Levels' || book.academicLevel === selectedLevel;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.subject.toLowerCase().includes(q) ||
        book.grade.toLowerCase().includes(q) ||
        book.boardOrAuthor.toLowerCase().includes(q);
      return matchesLevel && matchesQuery;
    });
  }, [books, selectedLevel, searchQuery]);

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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Syllabus Books Library
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Complete academic curriculum from Nursery–KG through Masters.
          </p>
        </div>

        {canManageBooks && (
          <div className="flex items-center gap-2.5 shrink-0">
            {books.length === 0 && (
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
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Upload Syllabus Book
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {['All Levels', ...ACADEMIC_LEVELS].map((lvl) => {
            const active = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
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

        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search book, subject, or grade..."
            className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
          />
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
              : 'Try clearing your search filter or switching academic levels.'}
          </p>
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
                      onClick={() => setActiveBook(book)}
                      className="flex-1 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Open Chapters & Study
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

      {/* Book Reader & Chapter Progress Slide-Over */}
      {activeBook && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto border-l border-slate-200 p-6 sm:p-8 flex flex-col">
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <div className="text-xs text-emerald-700 font-medium mb-1">
                  {activeBook.academicLevel} · {activeBook.grade} · {activeBook.subject}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{activeBook.title}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {activeBook.boardOrAuthor} · Uploaded by {activeBook.uploadedByName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveBook(null)}
                aria-label="Close book reader"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-5 flex-1">
              {activeBook.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{activeBook.description}</p>
              )}

              {activeBook.resourceUrl && (
                <a
                  href={activeBook.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Digital Textbook / PDF Resource
                </a>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Syllabus Chapters ({activeBook.chapters.length})
                  </h3>
                  <span className="text-xs font-mono-tabular font-semibold text-emerald-700">
                    {progressMap[activeBook.id]?.percentComplete || 0}% Complete
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {activeBook.chapters.map((chapter, idx) => {
                    const checked =
                      progressMap[activeBook.id]?.completedChapters.includes(idx) || false;
                    return (
                      <button
                        key={`${activeBook.id}-ch-${idx}`}
                        type="button"
                        onClick={() => handleToggleChapter(activeBook, idx)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="font-mono-tabular text-xs text-slate-400 w-6 shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={`text-sm ${
                            checked ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                          }`}
                        >
                          {chapter}
                        </span>
                      </button>
                    );
                  })}
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

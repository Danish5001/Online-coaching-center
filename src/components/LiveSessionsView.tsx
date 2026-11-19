import React, { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  Calendar,
  Clock,
  ExternalLink,
  Plus,
  Radio,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dispatchNotification } from '../lib/notifications';
import { ACADEMIC_LEVELS, LiveSession, SessionStatus, UserProfile } from '../types';

interface LiveSessionsViewProps {
  profile: UserProfile;
  sessions: LiveSession[];
}

export function LiveSessionsView({ profile, sessions }: LiveSessionsViewProps) {
  const canSchedule = profile.role === 'teacher' || profile.role === 'admin';

  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all');
  const [showModal, setShowModal] = useState(false);

  // Schedule form state
  const [title, setTitle] = useState('');
  const [academicLevel, setAcademicLevel] = useState<string>(ACADEMIC_LEVELS[3]);
  const [subject, setSubject] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetingUrl, setMeetingUrl] = useState('https://meet.google.com/');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => statusFilter === 'all' || s.status === statusFilter)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }, [sessions, statusFilter]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (title.trim().length < 3 || subject.trim().length < 2 || !scheduledAt) {
      setFormError('Please provide a session title, subject, and scheduled date/time.');
      return;
    }

    const dur = Math.min(240, Math.max(15, Number(durationMinutes) || 60));

    setSaving(true);
    try {
      await addDoc(collection(db, 'liveSessions'), {
        title: title.trim().slice(0, 160),
        academicLevel,
        subject: subject.trim().slice(0, 80),
        description: description.trim().slice(0, 1000),
        scheduledAt: scheduledAt.slice(0, 40),
        durationMinutes: dur,
        meetingUrl: meetingUrl.trim().slice(0, 500),
        teacherUid: profile.uid,
        teacherName: profile.displayName,
        status: 'scheduled',
        visibility: 'public',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const formattedDate = new Date(scheduledAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      await dispatchNotification({
        recipientUid: 'all',
        type: 'session',
        title: `Live Session Scheduled: ${title.trim().slice(0, 90)}`,
        message: `${profile.displayName} scheduled a ${dur}-min live class for ${academicLevel} (${subject.trim()}) on ${formattedDate}.`,
      });

      setTitle('');
      setSubject('');
      setDescription('');
      setScheduledAt('');
      setDurationMinutes(60);
      setShowModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'liveSessions');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (session: LiveSession, nextStatus: SessionStatus) => {
    try {
      await updateDoc(doc(db, 'liveSessions', session.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });

      if (nextStatus === 'live') {
        await dispatchNotification({
          recipientUid: 'all',
          type: 'session',
          title: `Live Now: ${session.title.slice(0, 100)}`,
          message: `${session.teacherName} has started the live coaching session for ${session.academicLevel}. Join now from the Live Sessions tab.`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `liveSessions/${session.id}`);
    }
  };

  const handleDelete = async (session: LiveSession) => {
    try {
      await deleteDoc(doc(db, 'liveSessions', session.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `liveSessions/${session.id}`);
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Live Coaching Sessions
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Join scheduled interactive lectures or host live sessions for your students.
          </p>
        </div>

        {canSchedule && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Schedule Live Session
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-2 w-fit">
        {(['all', 'live', 'scheduled', 'completed'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
              statusFilter === status
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {status === 'live' ? 'Live Now' : status}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Video className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No live sessions scheduled
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {canSchedule
              ? 'Schedule your first live coaching class to automatically notify enrolled students.'
              : 'Upcoming live lectures from your teachers will appear here as soon as they are scheduled.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const isOwnerOrAdmin =
              profile.role === 'admin' || session.teacherUid === profile.uid;
            const isActive = session.status === 'scheduled' || session.status === 'live';

            return (
              <div
                key={session.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                    <span
                      className={`font-semibold ${
                        session.status === 'live'
                          ? 'text-red-600'
                          : session.status === 'scheduled'
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {session.status === 'live'
                        ? 'LIVE NOW'
                        : session.status === 'scheduled'
                        ? 'Scheduled'
                        : session.status === 'completed'
                        ? 'Completed'
                        : 'Cancelled'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{session.academicLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{session.subject}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{session.title}</h3>

                  {session.description && (
                    <p className="text-sm text-slate-600 max-w-2xl">{session.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500 font-mono-tabular">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDateTime(session.scheduledAt)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {session.durationMinutes} min
                    </span>
                    <span className="font-sans">Instructor: {session.teacherName}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {session.meetingUrl && isActive && (
                    <a
                      href={session.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        session.status === 'live'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {session.status === 'live' ? 'Join Live Classroom' : 'Open Meeting Link'}
                    </a>
                  )}

                  {canSchedule && isOwnerOrAdmin && session.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(session, 'live')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      Start Live
                    </button>
                  )}

                  {canSchedule && isOwnerOrAdmin && session.status === 'live' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(session, 'completed')}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer whitespace-nowrap"
                    >
                      Mark Completed
                    </button>
                  )}

                  {canSchedule && isOwnerOrAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(session)}
                      aria-label={`Delete session ${session.title}`}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Modal */}
      {showModal && canSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              aria-label="Close schedule modal"
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Schedule Live Session</h2>
            <p className="text-sm text-slate-500 mb-6">
              Students will receive an automated notification with the session time and classroom
              link.
            </p>

            <form onSubmit={handleSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Session Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Calculus Integration Problem-Solving Workshop"
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
                    onChange={(e) => setAcademicLevel(e.target.value)}
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Mathematics"
                    maxLength={80}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date & Start Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Live Meeting Link (Google Meet / Zoom / Jitsi)
                </label>
                <input
                  type="url"
                  required
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  maxLength={500}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Session Agenda (optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Topics to cover and required preparation..."
                  maxLength={1000}
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Scheduling...' : 'Publish Live Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

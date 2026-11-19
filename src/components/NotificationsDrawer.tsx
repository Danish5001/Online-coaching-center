import { doc, updateDoc } from 'firebase/firestore';
import { Bell, BookOpen, Calendar, Check, CreditCard, ShieldCheck, Trophy, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { NotificationItem, NotificationType } from '../types';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  currentUid: string;
  seenBroadcastIds: string[];
  onMarkBroadcastSeen: (ids: string[]) => void;
}

export function NotificationsDrawer({
  open,
  onClose,
  notifications,
  currentUid,
  seenBroadcastIds,
  onMarkBroadcastSeen,
}: NotificationsDrawerProps) {
  if (!open) return null;

  const isItemRead = (n: NotificationItem) => {
    if (n.recipientUid === 'all') {
      return seenBroadcastIds.includes(n.id);
    }
    return n.isRead;
  };

  const handleMarkOneRead = async (n: NotificationItem) => {
    if (n.recipientUid === 'all') {
      if (!seenBroadcastIds.includes(n.id)) {
        onMarkBroadcastSeen([...seenBroadcastIds, n.id]);
      }
      return;
    }
    if (n.isRead || n.recipientUid !== currentUid) return;
    try {
      await updateDoc(doc(db, 'notifications', n.id), { isRead: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${n.id}`);
    }
  };

  const handleMarkAllRead = async () => {
    const broadcastIds = notifications
      .filter((n) => n.recipientUid === 'all')
      .map((n) => n.id);
    if (broadcastIds.length > 0) {
      onMarkBroadcastSeen(Array.from(new Set([...seenBroadcastIds, ...broadcastIds])));
    }

    const unreadPersonal = notifications.filter(
      (n) => n.recipientUid === currentUid && !n.isRead
    );
    for (const item of unreadPersonal) {
      try {
        await updateDoc(doc(db, 'notifications', item.id), { isRead: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${item.id}`);
      }
    }
  };

  const renderIcon = (type: NotificationType) => {
    switch (type) {
      case 'book':
        return <BookOpen className="w-4 h-4 text-emerald-700" />;
      case 'session':
        return <Calendar className="w-4 h-4 text-blue-700" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-amber-700" />;
      case 'progress':
        return <Trophy className="w-4 h-4 text-emerald-700" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-slate-700" />;
    }
  };

  const formatTime = (n: NotificationItem) => {
    try {
      if (!n.createdAt) return 'Just now';
      return n.createdAt.toDate().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full border-l border-slate-200 flex flex-col">
        <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Automated Notifications</h2>
          </div>
          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell className="w-7 h-7 text-slate-300 mx-auto mb-2.5" />
              <p className="text-sm font-medium text-slate-700">No notifications yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Automated alerts for new syllabus books, live sessions, payments, and progress
                milestones appear here.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const read = isItemRead(n);
              return (
                <div
                  key={n.id}
                  onClick={() => handleMarkOneRead(n)}
                  className={`px-6 py-4 transition-colors cursor-pointer ${
                    read ? 'bg-white hover:bg-slate-50' : 'bg-emerald-50/40 hover:bg-emerald-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{renderIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 truncate">{n.title}</h3>
                        {!read && (
                          <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mt-1">{n.message}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                        <span>
                          {n.recipientUid === 'all' ? 'Academy Broadcast' : 'Personal Alert'} ·{' '}
                          {formatTime(n)}
                        </span>
                        {read && (
                          <span className="inline-flex items-center gap-0.5 text-slate-400 font-sans">
                            <Check className="w-3 h-3" /> Read
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

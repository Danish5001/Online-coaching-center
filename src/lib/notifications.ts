import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { NotificationType } from '../types';

export async function dispatchNotification(params: {
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const safeTitle = params.title.trim().slice(0, 140);
  const safeMessage = params.message.trim().slice(0, 500);

  if (safeTitle.length < 2 || safeMessage.length < 2) return;

  try {
    await addDoc(collection(db, 'notifications'), {
      recipientUid: params.recipientUid,
      type: params.type,
      title: safeTitle,
      message: safeMessage,
      isRead: false,
      createdByUid: uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notifications');
  }
}

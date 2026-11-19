import React, { useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Clock, Upload, XCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dispatchNotification } from '../lib/notifications';
import { PaymentRecord, PaymentSettings, UserProfile } from '../types';
import { EasyPaisaQRCard } from './EasyPaisaQRCard';

interface PaymentsAdminViewProps {
  profile: UserProfile;
  paymentSettings: PaymentSettings;
  payments: PaymentRecord[];
}

export function PaymentsAdminView({
  profile,
  paymentSettings,
  payments,
}: PaymentsAdminViewProps) {
  const isAdmin = profile.role === 'admin';

  // Student / Teacher payment submission state
  const [tid, setTid] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // Admin EasyPaisa QR Settings state
  const [accountTitle, setAccountTitle] = useState(paymentSettings.easypaisaAccountTitle);
  const [accountNumber, setAccountNumber] = useState(paymentSettings.easypaisaNumber);
  const [feePkr, setFeePkr] = useState(paymentSettings.feePkr);
  const [qrImageData, setQrImageData] = useState(paymentSettings.qrImageData);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 350 * 1024) {
      setSettingsMsg('Please choose a QR image under 350 KB (PNG or JPG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setQrImageData(reader.result);
        setSettingsMsg('QR image loaded. Click "Save EasyPaisa Settings" to publish.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg('');
    setSavingSettings(true);
    try {
      const clampedPkr = Math.min(3500, Math.max(2500, Math.round(Number(feePkr) || 2780)));
      await setDoc(doc(db, 'settings', 'payment'), {
        easypaisaAccountTitle: accountTitle.trim().slice(0, 100),
        easypaisaNumber: accountNumber.trim().slice(0, 30),
        qrImageData: qrImageData.slice(0, 500000),
        feeUsd: 10,
        feePkr: clampedPkr,
        updatedByUid: profile.uid,
        updatedAt: serverTimestamp(),
      });
      setSettingsMsg('EasyPaisa QR and payment account details updated for all users.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/payment');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReviewPayment = async (record: PaymentRecord, decision: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'payments', record.id), {
        status: decision,
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', record.userId), {
        paymentStatus: decision === 'approved' ? 'verified' : 'unpaid',
        updatedAt: serverTimestamp(),
      });

      await dispatchNotification({
        recipientUid: record.userId,
        type: 'payment',
        title:
          decision === 'approved'
            ? 'One-Time $10 Fee Verified'
            : 'EasyPaisa Payment Needs Attention',
        message:
          decision === 'approved'
            ? `Your EasyPaisa payment (TID: ${record.transactionId}) has been approved. Full lifetime academy access is now active.`
            : `We could not verify EasyPaisa TID ${record.transactionId}. Please check your receipt and resubmit in the EasyPaisa & Billing tab.`,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payments/${record.id}`);
    }
  };

  const handleUserSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    const cleanTid = tid.trim().replace(/\s+/g, '');
    const cleanPhone = senderPhone.trim();

    if (!/^[a-zA-Z0-9-]{6,40}$/.test(cleanTid)) {
      setPaymentError('Enter a valid EasyPaisa Transaction ID (6–40 alphanumeric characters).');
      return;
    }
    if (cleanPhone.length < 7 || cleanPhone.length > 20) {
      setPaymentError('Enter the sender phone number used for EasyPaisa.');
      return;
    }

    setSubmittingPayment(true);
    try {
      await addDoc(collection(db, 'payments'), {
        userId: profile.uid,
        userName: profile.displayName,
        userEmail: profile.email,
        userRole: profile.role === 'teacher' ? 'teacher' : 'student',
        amountUsd: 10,
        amountPkr: paymentSettings.feePkr,
        method: 'easypaisa',
        transactionId: cleanTid,
        senderPhone: cleanPhone,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', profile.uid), {
        paymentStatus: 'pending',
        easypaisaTid: cleanTid,
        updatedAt: serverTimestamp(),
      });

      await dispatchNotification({
        recipientUid: profile.uid,
        type: 'payment',
        title: 'EasyPaisa Receipt Received',
        message: `Transaction ID ${cleanTid} ($10 one-time fee) is pending verification.`,
      });

      setTid('');
      setSenderPhone('');
      setPaymentSuccess('Payment receipt submitted! You will be notified once verified.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'payments');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isAdmin ? 'EasyPaisa QR Settings & Fee Verification' : 'One-Time $10 Enrollment Fee'}
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          {isAdmin
            ? 'Upload your personal EasyPaisa QR code and verify incoming $10 one-time student and teacher registrations.'
            : 'Single lifetime registration fee of $10 USD via EasyPaisa QR.'}
        </p>
      </div>

      {/* Admin View: Custom EasyPaisa QR Config + Verification Queue */}
      {isAdmin ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleSaveSettings}
              className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-slate-900">
                Your EasyPaisa QR & Account Details
              </h2>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  required
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  maxLength={100}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    EasyPaisa Mobile Number
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    maxLength={30}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    PKR Equivalent ($10 USD)
                  </label>
                  <input
                    type="number"
                    min={2500}
                    max={3500}
                    value={feePkr}
                    onChange={(e) => setFeePkr(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Upload Your EasyPaisa QR Code Image (optional — auto-generates QR if blank)
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Choose QR Image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleQrFileUpload}
                      className="hidden"
                    />
                  </label>
                  {qrImageData && qrImageData !== '/assets/aistudio/IMG-20261102-WA0000_ce0598ae.jpg' && (
                    <button
                      type="button"
                      onClick={() => setQrImageData('/assets/aistudio/IMG-20261102-WA0000_ce0598ae.jpg')}
                      className="text-xs text-slate-600 hover:underline cursor-pointer"
                    >
                      Restore default QR
                    </button>
                  )}
                </div>
              </div>

              {settingsMsg && (
                <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                  {settingsMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
              >
                {savingSettings ? 'Saving...' : 'Save EasyPaisa Settings'}
              </button>
            </form>

            <div className="lg:col-span-6">
              <EasyPaisaQRCard
                settings={{
                  ...paymentSettings,
                  easypaisaAccountTitle: accountTitle,
                  easypaisaNumber: accountNumber,
                  feePkr,
                  qrImageData,
                }}
              />
            </div>
          </div>

          {/* Payment Verification Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Submitted EasyPaisa Payments ({payments.length})
              </h2>
            </div>

            {payments.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No payment receipts submitted yet. When students or teachers submit their $10
                EasyPaisa Transaction ID, they will appear here for one-click approval.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">Member</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">EasyPaisa TID</th>
                      <th className="px-6 py-3 font-medium">Sender Phone</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-3.5">
                          <div className="font-semibold text-slate-900">{p.userName}</div>
                          <div className="text-xs text-slate-500">{p.userEmail}</div>
                        </td>
                        <td className="px-6 py-3.5 capitalize text-slate-700">{p.userRole}</td>
                        <td className="px-6 py-3.5 font-mono-tabular font-semibold text-slate-900">
                          {p.transactionId}
                        </td>
                        <td className="px-6 py-3.5 font-mono-tabular text-slate-600">
                          {p.senderPhone}
                        </td>
                        <td className="px-6 py-3.5 font-mono-tabular text-slate-900">
                          ${p.amountUsd} · PKR {p.amountPkr.toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`text-xs font-semibold capitalize ${
                              p.status === 'approved'
                                ? 'text-emerald-700'
                                : p.status === 'rejected'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {p.status === 'pending' ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleReviewPayment(p, 'approved')}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewPayment(p, 'rejected')}
                                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Student / Teacher View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="text-xs text-slate-500 mb-1">Current Enrollment Status</div>
              <div className="flex items-center gap-2.5">
                {profile.paymentStatus === 'verified' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    <span className="text-lg font-bold text-emerald-800">
                      Verified — Lifetime Access Active
                    </span>
                  </>
                ) : profile.paymentStatus === 'pending' ? (
                  <>
                    <Clock className="w-5 h-5 text-amber-600" />
                    <span className="text-lg font-bold text-amber-800">
                      Pending Admin Verification
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-slate-400" />
                    <span className="text-lg font-bold text-slate-900">
                      Payment Not Yet Submitted
                    </span>
                  </>
                )}
              </div>
              {profile.easypaisaTid && (
                <p className="text-xs text-slate-500 mt-2 font-mono-tabular">
                  Submitted EasyPaisa TID: {profile.easypaisaTid}
                </p>
              )}
            </div>

            {profile.paymentStatus === 'unpaid' && (
              <form
                onSubmit={handleUserSubmitPayment}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="text-base font-bold text-slate-900">
                  Submit $10 EasyPaisa Receipt
                </h2>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    EasyPaisa Transaction ID (TID)
                  </label>
                  <input
                    type="text"
                    required
                    value={tid}
                    onChange={(e) => setTid(e.target.value)}
                    placeholder="e.g. EP8923410922"
                    maxLength={40}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sender EasyPaisa Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="e.g. 0345-1234567"
                    maxLength={20}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                  />
                </div>

                {paymentError && (
                  <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                    {paymentError}
                  </div>
                )}
                {paymentSuccess && (
                  <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                    {paymentSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                >
                  {submittingPayment ? 'Submitting...' : 'Submit EasyPaisa Payment'}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-6">
            <EasyPaisaQRCard settings={paymentSettings} />
          </div>
        </div>
      )}
    </div>
  );
}

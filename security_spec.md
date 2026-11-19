# Security Specification & Payload-First TDD — ScholarAxis Academy

## 1. Data Invariants
1. **Email Verification Gate**: All standard writes require `request.auth != null && request.auth.token.email_verified == true`.
2. **PII Isolation**: `/users/{userId}` and `/payments/{paymentId}` contain email/phone PII and are strictly readable only by the document owner or bootstrapped admin (`danishmehmood5001@gmail.com` with `email_verified == true`).
3. **Role & Privilege Integrity**: Non-admin users may only register as `student` or `teacher` with `paymentStatus == 'unpaid'`. Users cannot self-escalate `role` to `admin` or self-verify `paymentStatus` to `verified`.
4. **Teacher/Admin Content Authority**: Only verified `teacher` or `admin` users can create or manage `/syllabusBooks/{bookId}` and `/liveSessions/{sessionId}`.
5. **Relational Progress Integrity**: `/progress/{progressId}` requires `userId == request.auth.uid` and verifies the referenced `syllabusBooks/{bookId}` exists on create.
6. **Terminal State Locking**: Payments in `approved` or `rejected` status and Live Sessions in `completed` or `cancelled` status cannot be modified by non-admins.
7. **Temporal Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time` on create/update, and `createdAt` is immutable.
8. **Secure List Queries**: No blanket `allow list: if isSignedIn();` rules exist; every `list` rule evaluates `resource.data`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Admin Escalation**: Creating `/users/attacker` with `{ role: "admin", paymentStatus: "verified" }`. -> MUST BE DENIED.
2. **Shadow Field Injection**: Updating `/users/u1` with `{ displayName: "Alice", isSuperUser: true }`. -> MUST BE DENIED.
3. **Payment Self-Approval**: Updating `/payments/p1` as student with `{ status: "approved" }`. -> MUST BE DENIED.
4. **Student Uploading Syllabus Book**: Student creating `/syllabusBooks/b1`. -> MUST BE DENIED.
5. **Unverified Email Write**: User with `email_verified: false` creating `/payments/p2`. -> MUST BE DENIED.
6. **PII Cross-User Read**: Student A reading `/users/studentB`. -> MUST BE DENIED.
7. **Orphaned Progress Record**: Student creating `/progress/u1_nonexistent` referencing missing `bookId`. -> MUST BE DENIED.
8. **ID Poisoning**: Writing to `/syllabusBooks/` with a 500-character or invalid-char document ID. -> MUST BE DENIED.
9. **Oversized Array / String**: Creating `/syllabusBooks/b2` with 31 chapters or a 5000-char title. -> MUST BE DENIED.
10. **Client-Spoofed Timestamp**: Creating `/liveSessions/s1` with `createdAt` != `request.time`. -> MUST BE DENIED.
11. **Terminal State Mutation**: Teacher updating a `completed` live session back to `scheduled`. -> MUST BE DENIED.
12. **Unauthorized Settings Tampering**: Non-admin writing to `/settings/payment` to hijack the EasyPaisa QR. -> MUST BE DENIED.

import { Timestamp } from 'firebase/firestore';

export type UserRole = 'student' | 'teacher' | 'admin';
export type PaymentStatus = 'unpaid' | 'pending' | 'verified';
export type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type NotificationType = 'system' | 'payment' | 'book' | 'session' | 'progress';

export const ADMIN_EMAIL = 'danishmehmood5001@gmail.com';

export const ACADEMIC_LEVELS = [
  'Early Years (Nursery–KG)',
  'Primary (Grades 1–5)',
  'Middle (Grades 6–8)',
  'Secondary (Grades 9–10)',
  'Higher Secondary (Grades 11–12)',
  'Bachelors (BS/BA/BSc)',
  'Masters (MS/MA/MPhil)',
] as const;

export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  academicLevel: string;
  gradeOrSpecialty: string;
  paymentStatus: PaymentStatus;
  easypaisaTid?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SyllabusBook {
  id: string;
  title: string;
  academicLevel: AcademicLevel;
  grade: string;
  subject: string;
  boardOrAuthor: string;
  description: string;
  resourceUrl: string;
  chapters: string[];
  uploadedByUid: string;
  uploadedByName: string;
  visibility: 'public';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudentProgress {
  id: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  academicLevel: string;
  completedChapters: number[];
  totalChapters: number;
  percentComplete: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LiveSession {
  id: string;
  title: string;
  academicLevel: string;
  subject: string;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl: string;
  teacherUid: string;
  teacherName: string;
  status: SessionStatus;
  visibility: 'public';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'student' | 'teacher';
  amountUsd: number;
  amountPkr: number;
  method: 'easypaisa';
  transactionId: string;
  senderPhone: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface NotificationItem {
  id: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdByUid: string;
  createdAt: Timestamp;
}

export interface PaymentSettings {
  easypaisaAccountTitle: string;
  easypaisaNumber: string;
  qrImageData: string;
  feeUsd: number;
  feePkr: number;
  updatedByUid: string;
  updatedAt?: Timestamp;
}

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  easypaisaAccountTitle: 'MUHAMMAD DANISH MEHMOOD',
  easypaisaNumber: '923132746091',
  qrImageData: '/assets/aistudio/IMG-20261102-WA0000_ce0598ae.jpg',
  feeUsd: 10,
  feePkr: 2780,
  updatedByUid: 'system',
};

export const STARTER_SYLLABUS_BOOKS: Omit<
  SyllabusBook,
  'id' | 'uploadedByUid' | 'uploadedByName' | 'createdAt' | 'updatedAt'
>[] = [
  {
    title: 'Early Phonics, Numbers & World Discovery',
    academicLevel: 'Early Years (Nursery–KG)',
    grade: 'Nursery & Prep',
    subject: 'Foundational Literacy & Numeracy',
    boardOrAuthor: 'Oxford Early Years Series',
    description:
      'Structured visual phonics, letter tracing, number recognition (1–100), shapes, and everyday science concepts for Nursery and Kindergarten learners.',
    resourceUrl: 'https://openstax.org/subjects',
    chapters: [
      'Alphabet Sounds & Vowel Recognition',
      'Counting 1 to 50 & Number Patterns',
      'Basic Geometric Shapes & Colors',
      'Living Things, Seasons & My Family',
      'Short Word Blending & Reading Readiness',
      'Simple Addition & Subtraction with Objects',
    ],
    visibility: 'public',
  },
  {
    title: 'Primary Mathematics & Mental Arithmetic',
    academicLevel: 'Primary (Grades 1–5)',
    grade: 'Grade 5',
    subject: 'Mathematics',
    boardOrAuthor: 'Single National Curriculum / PTB',
    description:
      'Complete primary mathematics syllabus covering place value, fractions, decimals, unitary method, geometry, and introductory data handling.',
    resourceUrl: 'https://openstax.org/subjects/math',
    chapters: [
      'Whole Numbers & Operations up to Millions',
      'HCF, LCM & Prime Factorization',
      'Fractions: Addition, Subtraction & Multiplication',
      'Decimals & Percentage Conversions',
      'Distance, Time & Temperature Measurements',
      'Perimeter, Area & Angles of Polygons',
      'Average & Bar Graph Interpretation',
    ],
    visibility: 'public',
  },
  {
    title: 'General Science & Foundations of Lab Inquiry',
    academicLevel: 'Middle (Grades 6–8)',
    grade: 'Grade 8',
    subject: 'General Science',
    boardOrAuthor: 'Cambridge Lower Secondary / Federal Board',
    description:
      'Bridges primary science to secondary physics, chemistry, and biology with structured experiments and conceptual checkpoints.',
    resourceUrl: 'https://openstax.org/subjects/science',
    chapters: [
      'Human Nervous & Excretory Systems',
      'Cell Division, Genetics & Heredity',
      'Chemical Reactions & Balancing Equations',
      'Acids, Bases & Salts in Everyday Life',
      'Force, Pressure & Atmospheric Dynamics',
      'Light, Lenses & Optical Instruments',
      'Electricity, Circuits & Magnetism',
    ],
    visibility: 'public',
  },
  {
    title: 'Secondary Physics: Mechanics, Waves & Electromagnetism',
    academicLevel: 'Secondary (Grades 9–10)',
    grade: 'Grade 10 (Matric / O-Level)',
    subject: 'Physics',
    boardOrAuthor: 'Federal Board / Cambridge O-Level',
    description:
      'Exam-focused secondary physics textbook covering simple harmonic motion, acoustics, geometrical optics, electrostatics, and nuclear physics.',
    resourceUrl: 'https://openstax.org/details/books/physics',
    chapters: [
      'Simple Harmonic Motion & Waves',
      'Sound Waves & Acoustic Intensity',
      'Geometrical Optics: Mirrors & Lenses',
      'Electrostatics & Capacitors',
      'Current Electricity & Ohm’s Law',
      'Electromagnetism & Transformers',
      'Basic Electronics & Logic Gates',
      'Atomic & Nuclear Physics',
    ],
    visibility: 'public',
  },
  {
    title: 'Higher Secondary Calculus & Analytical Geometry',
    academicLevel: 'Higher Secondary (Grades 11–12)',
    grade: 'Grade 12 (FSc / A-Level)',
    subject: 'Mathematics',
    boardOrAuthor: 'PTB / Cambridge A-Level',
    description:
      'Comprehensive differential and integral calculus, analytical geometry, conic sections, and vector algebra for pre-engineering and ICS students.',
    resourceUrl: 'https://openstax.org/details/books/calculus-volume-1',
    chapters: [
      'Functions, Limits & Continuity',
      'Differentiation Techniques & Chain Rule',
      'Applications of Derivatives & Optimization',
      'Indefinite & Definite Integration',
      'Introduction to Analytic Geometry',
      'Linear Inequalities & Linear Programming',
      'Conic Sections: Parabola, Ellipse & Hyperbola',
      'Vectors in Two & Three Dimensions',
    ],
    visibility: 'public',
  },
  {
    title: 'Data Structures, Algorithms & Discrete Systems',
    academicLevel: 'Bachelors (BS/BA/BSc)',
    grade: 'BS Semester 3–4',
    subject: 'Computer Science',
    boardOrAuthor: 'HEC Undergraduate Curriculum',
    description:
      'Core undergraduate computer science syllabus covering asymptotic complexity, trees, graphs, dynamic programming, and hash tables.',
    resourceUrl: 'https://openstax.org/subjects/computer-science',
    chapters: [
      'Asymptotic Notation & Recurrence Relations',
      'Linked Lists, Stacks & Queues',
      'Binary Search Trees, AVL & Red-Black Trees',
      'Heaps & Priority Queues',
      'Hash Tables & Collision Resolution',
      'Graph Traversal: BFS, DFS & Shortest Paths',
      'Greedy Algorithms & Minimum Spanning Trees',
      'Dynamic Programming & Memoization',
    ],
    visibility: 'public',
  },
  {
    title: 'Advanced Research Methodology & Statistical Inference',
    academicLevel: 'Masters (MS/MA/MPhil)',
    grade: 'MS / MPhil Semester 1–2',
    subject: 'Research & Quantitative Methods',
    boardOrAuthor: 'HEC Postgraduate Standards',
    description:
      'Graduate-level treatise on experimental design, multivariate statistics, hypothesis testing, literature synthesis, and thesis publication standards.',
    resourceUrl: 'https://openstax.org/details/books/introductory-statistics-2e',
    chapters: [
      'Epistemology & Quantitative vs Qualitative Paradigms',
      'Systematic Literature Reviews & Gap Identification',
      'Experimental & Quasi-Experimental Research Design',
      'Sampling Theory & Statistical Power Analysis',
      'Parametric & Non-Parametric Hypothesis Testing',
      'Multivariate Regression & Structural Equation Modeling',
      'Research Ethics, Peer Review & Thesis Defense',
    ],
    visibility: 'public',
  },
];

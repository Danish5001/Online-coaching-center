import React, { useEffect, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, Sparkles, User as UserIcon, X } from 'lucide-react';
import { UserProfile } from '../types';

export interface ChatContextHint {
  activeBookTitle?: string;
  activeChapter?: string;
  initialPrompt?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AiStudyChatbotProps {
  profile: UserProfile;
  mode: 'full' | 'drawer';
  contextHint?: ChatContextHint | null;
  onClose?: () => void;
}

export function AiStudyChatbot({
  profile,
  mode,
  contextHint,
  onClose,
}: AiStudyChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Hello ${profile.displayName}! I am your ScholarAxis AI Tutor & Academy Assistant.\n\nAsk me to explain any chapter from Nursery to Masters, solve math or science problems, quiz you before an exam, or help you navigate EasyPaisa enrollment and live classes.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastPromptHandledRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setError('');
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, text: m.text })),
          context: {
            userName: profile.displayName,
            role: profile.role,
            academicLevel: profile.academicLevel,
            activeBookTitle: contextHint?.activeBookTitle,
            activeChapter: contextHint?.activeChapter,
          },
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status})`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: data.reply || 'No response received.',
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach the AI assistant. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-send when user clicks "Ask AI Tutor about this chapter"
  useEffect(() => {
    if (
      contextHint?.initialPrompt &&
      contextHint.initialPrompt !== lastPromptHandledRef.current
    ) {
      lastPromptHandledRef.current = contextHint.initialPrompt;
      sendMessage(contextHint.initialPrompt);
    }
  }, [contextHint?.initialPrompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const quickPrompts =
    profile.role === 'teacher' || profile.role === 'admin'
      ? [
          'Draft a 45-minute live lesson plan for my class',
          'Create 5 exam-style questions with answer key',
          'Summarize how students verify their $10 EasyPaisa fee',
        ]
      : [
          `Explain a key concept for ${profile.academicLevel}`,
          'Give me a 5-question practice quiz with answers',
          'How do I download syllabus books and join live sessions?',
        ];

  const containerClass =
    mode === 'full'
      ? 'bg-white border border-slate-200 rounded-xl flex flex-col h-[calc(100vh-11rem)] min-h-[540px]'
      : 'bg-white w-full max-w-md h-full border-l border-slate-200 flex flex-col';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="px-5 h-16 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              AI Study Tutor & Help Assistant
            </h2>
            <p className="text-[11px] text-slate-500 truncate">
              {contextHint?.activeBookTitle
                ? `Reading: ${contextHint.activeBookTitle}`
                : `${profile.academicLevel} · Instant Study & App Support`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMessages([messages[0]]);
              setError('');
            }}
            title="Start new conversation"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {mode === 'drawer' && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI assistant"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8FAFC]/60">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isUser
                    ? 'bg-slate-900 text-white'
                    : 'bg-emerald-700 text-white'
                }`}
              >
                {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              </div>
              <div
                className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
              Thinking...
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Starters */}
      {messages.length <= 1 && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-white flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              className="text-xs text-slate-700 bg-slate-50 border border-slate-200 hover:border-emerald-600 hover:text-emerald-800 rounded-lg px-3 py-1.5 transition-colors text-left cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask any syllabus question or get app help..."
          disabled={loading}
          className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}

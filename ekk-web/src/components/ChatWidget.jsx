import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { askAI, getChatStarters } from '../services/apiService';
import useProjectSession from '../hooks/useProjectSession';

const WELCOME_MESSAGE = {
  type: 'assistant',
  text: 'Hello! I am your IDMS Progress Analyst. Ask me about project status, delays, contractor performance, or pending approvals.',
  suggestions: [],
};

const ChatWidget = () => {
  const { selectedProjectId } = useProjectSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const scrollRef = useRef(null);

  const visibleMessages = useMemo(() => messages.slice(-10), [messages]);

  const loadSummary = async () => {
    try {
      if (!selectedProjectId) {
        setPendingCount(0);
        return;
      }
      const data = await getChatStarters(selectedProjectId);
      setPendingCount(data?.project_summary?.pending_count || 0);
    } catch (_err) {
      setPendingCount(0);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [selectedProjectId]);

  useEffect(() => {
    if (!isOpen || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [isOpen, visibleMessages, loading]);

  const handleSend = async (text) => {
    if (!text.trim() || loading) return;

    setMessages((prev) => [...prev, { type: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const limitedHistory = history.slice(-12);
      const response = await askAI(selectedProjectId, text, limitedHistory);

      setMessages((prev) => [
        ...prev,
        {
          type: 'assistant',
          text: response.reply,
          suggestions: Array.isArray(response.suggested_questions) ? response.suggested_questions.slice(0, 3) : [],
        },
      ]);

      setHistory((prev) => {
        const next = [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: response.reply },
        ];
        return next.slice(-12);
      });

      loadSummary();
    } catch (_err) {
      toast.error('AI is unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSend(input);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 h-[500px] w-[380px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex h-full min-h-[500px] flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">IDMS AI Assistant</h3>
                <p className="text-xs text-gray-500">Project-ready progress insights</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                X
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {visibleMessages.map((message, idx) => {
                const isUser = message.type === 'user';
                return (
                  <div key={`${message.type}-${idx}`}>
                    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                        <div className={`mb-1 text-[11px] font-semibold ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                          {isUser ? 'You' : 'AI'}
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                      </div>
                    </div>

                    {message.type === 'assistant' && Array.isArray(message.suggestions) && message.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {message.suggestions.map((question) => (
                          <button
                            key={`${idx}-${question}`}
                            type="button"
                            onClick={() => handleSend(question)}
                            disabled={loading}
                            className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-700 shadow-sm">
                    <div className="mb-1 text-[11px] font-semibold text-gray-500">AI</div>
                    <div className="flex items-center gap-1">
                      <span>AI is thinking</span>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-3 py-2">
              <div className="mb-2 text-right">
                <Link to="/chat" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Open full chat
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about progress..."
                  disabled={loading}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => handleSend(input)}
                  disabled={loading || !input.trim()}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
        aria-label="Open AI assistant"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" />
        </svg>

        {pendingCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {pendingCount}
          </span>
        )}
      </button>
    </>
  );
};

export default ChatWidget;

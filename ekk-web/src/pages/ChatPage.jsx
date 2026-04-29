import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { askAI, getChatStarters } from '../services/apiService';
import useProjectSession from '../hooks/useProjectSession';

const WELCOME_MESSAGE = {
  type: 'assistant',
  text: 'Hello! I am your IDMS Progress Analyst. I have access to your project data and can help you understand progress, identify issues, and analyse contractor performance. What would you like to know?',
  suggestions: [],
};

const STARTER_FALLBACK = [
  'What is the overall project completion status?',
  'Which stage is furthest behind schedule?',
  'How are the contractors performing?',
  'Are there any overdue items I should know about?',
  'What work was submitted in the last 7 days?',
  'Which entries are still pending approval?',
];

const MessageBubble = ({ message }) => {
  const isUser = message.type === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl rounded-2xl px-4 py-3 shadow-sm ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
        <div className={`mb-1 text-xs font-semibold ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {isUser ? 'You' : 'AI'}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
      </div>
    </div>
  );
};

const ThinkingIndicator = () => {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-700 shadow-sm">
        <div className="mb-1 text-xs font-semibold text-gray-500">AI</div>
        <div className="flex items-center gap-1">
          <span>AI is thinking</span>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
        </div>
      </div>
    </div>
  );
};

const ChatPage = () => {
  const { projects, selectedProjectId, setSelectedProjectId } = useProjectSession();
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starters, setStarters] = useState(STARTER_FALLBACK);
  const [projectSummary, setProjectSummary] = useState({
    overall_pct: 0,
    pending_count: 0,
    overdue_count: 0,
  });

  const scrollRef = useRef(null);

  const visibleMessages = useMemo(() => messages, [messages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visibleMessages, loading]);

  const loadStarters = async () => {
    try {
      const data = await getChatStarters(selectedProjectId);
      setProjectSummary(data.project_summary || { overall_pct: 0, pending_count: 0, overdue_count: 0 });
      setStarters(Array.isArray(data.starter_questions) && data.starter_questions.length > 0 ? data.starter_questions : STARTER_FALLBACK);
    } catch (_err) {
      toast.error('Could not load starter questions');
      setStarters(STARTER_FALLBACK);
      setProjectSummary({ overall_pct: 0, pending_count: 0, overdue_count: 0 });
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadStarters();
    }
  }, [selectedProjectId]);

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
    <div className="flex h-[calc(100vh-170px)] min-h-[600px] gap-4">
      <aside className="w-72 shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        <p className="mt-1 text-xs text-gray-500">Choose a project and ask data-backed progress questions.</p>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-gray-700">Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            disabled={loading}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_code} - {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-sm font-semibold text-gray-800">Project Summary</div>
          <div className="mt-2 text-sm text-gray-700">Overall: {projectSummary.overall_pct}%</div>
          <div className="text-sm text-gray-700">Pending: {projectSummary.pending_count}</div>
          <div className="text-sm text-gray-700">Overdue: {projectSummary.overdue_count}</div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Suggested Questions</h3>
          <button
            type="button"
            onClick={loadStarters}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {starters.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => handleSend(question)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {question}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {visibleMessages.map((message, idx) => (
            <div key={`${message.type}-${idx}`}>
              <MessageBubble message={message} />

              {message.type === 'assistant' && Array.isArray(message.suggestions) && message.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 pl-2">
                  {message.suggestions.map((question) => (
                    <button
                      key={`${idx}-${question}`}
                      type="button"
                      onClick={() => handleSend(question)}
                      disabled={loading}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && <ThinkingIndicator />}
        </div>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about project progress..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
            />
            <button
              type="button"
              onClick={() => handleSend(input)}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ChatPage;

import React, { useState, useEffect, useRef } from "react";
import './index.css';
import axios from 'axios';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hillgpt_email') || '';
    }
    return '';
  });
  const [verified, setVerified] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hillgpt_verified') === 'true';
    }
    return false;
  });

  const allowedDomains = [
    'cassidy.senate.gov', // ONLY this exact domain is allowed
  ];

  // Ref for chat input
  const inputRef = useRef(null);
  // Ref for auto-scrolling to bottom of messages
  const messagesEndRef = useRef(null);

  // Persist a single Assistants API thread so the bot remembers context
  const [threadId, setThreadId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hillgpt_thread_id') || '';
    }
    return '';
  });

  const [modelTier, setModelTier] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hillgpt_model_tier') || 'mini';
    }
    return 'mini';
  });

  useEffect(() => {
    if (threadId) {
      localStorage.setItem('hillgpt_thread_id', threadId);
    }
    if (modelTier) {
      localStorage.setItem('hillgpt_model_tier', modelTier);
    }
  }, [threadId, modelTier]);

  // Autofocus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (el && el.value && !el.dataset.touched) {
      el.value = '';
    }
  }, []);

  function getDomain(addr='') {
    const match = String(addr).toLowerCase().match(/@([^@]+)$/);
    return match ? match[1] : '';
  }

  function handleVerify(e) {
    e.preventDefault();
    const domain = getDomain(email);
    const ok = allowedDomains.some(d => domain === d); // exact match only, no subdomains
    if (!ok) {
      alert('Access restricted: please use a verified congressional office email.');
      return;
    }
    setVerified(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hillgpt_verified', 'true');
      localStorage.setItem('hillgpt_email', email);
    }
  }

  function handleSignOut() {
    setVerified(false);
    setEmail('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hillgpt_verified');
      localStorage.removeItem('hillgpt_email');
      localStorage.removeItem('hillgpt_thread_id');
      localStorage.removeItem('hillgpt_model_tier');
    }
    setThreadId('');
    setModelTier('mini');
    setMessages([]);
  }

  // Frontend call that sends/receives the threadId
  async function talkToGPT(userMessage) {
    try {
      // Calculate complexity
      const keywords = ['bill', 'legislation', 'policy', 'history', 'dataset'];
      const wordCount = userMessage.trim().split(/\s+/).length;
      const containsKeyword = keywords.some(keyword => userMessage.toLowerCase().includes(keyword));
      const complexity = (wordCount > 20 || containsKeyword) ? "complex" : "simple";

      const response = await axios.post('/api/ask-assistant', {
        message: userMessage,
        threadId: threadId || undefined,
        complexity: complexity,
        modelTier: modelTier || 'mini',
      });

      const replyText = response.data?.text ?? '';
      const newThreadId = response.data?.threadId;
      const usedTier = response.data?.modelTier;
      if (newThreadId && newThreadId !== threadId) {
        setThreadId(newThreadId);
      }
      if (usedTier && usedTier !== modelTier) {
        setModelTier(usedTier);
      }
      return replyText;
    } catch (err) {
      console.error('Error from OpenAI (via Vercel):', err);
      return '❌ There was an error fetching the response.';
    }
  }

  function handleNewChat() {
    setThreadId('');
    setModelTier('mini');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hillgpt_thread_id');
      localStorage.setItem('hillgpt_model_tier', 'mini');
    }
    setMessages([]);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    const newMessage = { sender: "user", text: content };

    // Optimistically render user message immediately
    setMessages(prev => [...prev, newMessage]);
    setInput("");

    // Fetch assistant reply and append when it arrives
    const reply = await talkToGPT(content);
    setMessages(prev => [...prev, { sender: "assistant", text: reply }]);
  };

  if (!verified) {
    return (
      <div className="min-h-screen bg-[#74001a] text-gray-900 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md rounded-xl border border-blue-700 bg-blue-900 backdrop-blur-xl shadow-2xl overflow-hidden p-6">
          <h1 className="text-3xl text-white font-bold mb-2">HillGPT Access</h1>
          <p className="text-sm text-white mb-4">Restricted to congressional office staff. Verify with your office email.</p>
          <form onSubmit={handleVerify} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Congressional email address"
              className="w-full rounded-lg px-4 py-2 text-sm text-white bg-blue-800 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 border border-blue-600"
              ref={inputRef}
              autoComplete="email"
              required
            />
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-white font-semibold transition"
            >
              Verify & Enter
            </button>
          </form>
          <p className="text-xs text-white mt-4">Allowed Offices: Cassidy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfdf9] text-gray-900 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl h-[90vh] flex flex-col rounded-xl border border-blue-700 bg-blue-900 backdrop-blur-xl shadow-2xl overflow-hidden">
        <header className="px-6 py-4 border-b border-blue-700 bg-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">HillGPT</h1>
            <p className="text-sm text-blue-200">Your assistant for Capitol Hill</p>
            <div className="mt-2">
              <span className="text-white text-xs font-semibold">
                Model: {modelTier}
              </span>
            </div>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleNewChat}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-800 rounded-lg text-white text-sm font-semibold transition"
              title="Start a fresh conversation"
            >
              New Chat
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-2 px-3 py-2 bg-blue-600 hover:bg-blue-800 rounded-lg text-white text-sm font-semibold transition"
              title="Sign out and clear verification"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-4 space-y-3 flex flex-col">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`block w-fit max-w-[75%] break-words px-5 py-3 rounded-xl text-sm whitespace-pre-wrap ${
                msg.sender === "user"
                  ? "self-end bg-blue-600 text-white shadow-lg"
                  : "self-start bg-blue-300 text-blue-900 shadow-md"
              }`}
            >
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        {/* Autofill bait for Safari */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
          <input type="text" name="email" autoComplete="email" />
          <input type="text" name="name" autoComplete="name" />
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="flex items-center gap-3 px-6 py-4 border-t border-blue-700 bg-white/10"
        >
          <input
            type="text"
            inputMode="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg px-4 py-2 text-sm text-white bg-blue-800 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 border border-blue-600"
            ref={inputRef}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            readOnly
            onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
            onInput={(e) => { e.currentTarget.dataset.touched = '1'; }}
            name="chatMessage"
            id="chatMessage"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-800 rounded-lg text-white font-semibold transition"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
import React, { useState, useEffect, useRef } from "react";
import './index.css';
import axios from 'axios';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

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
    if (!input.trim()) return;
    const newMessage = { sender: "user", text: input };
    setInput("");
    const reply = await talkToGPT(input);
    setMessages(prev => [...prev, newMessage, { sender: "assistant", text: reply }]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl h-[90vh] flex flex-col rounded-xl border border-blue-700 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
        <header className="px-6 py-4 border-b border-blue-700 bg-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">HillGPT</h1>
            <p className="text-sm text-blue-200">Your assistant for Capitol Hill</p>
            <div className="mt-2">
              <span className="inline-block px-2 py-1 rounded bg-blue-700 text-white text-xs font-semibold">
                Model: {modelTier}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewChat}
            className="px-3 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-white text-sm font-semibold transition"
            title="Start a fresh conversation"
          >
            New Chat
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`max-w-[80%] px-5 py-3 rounded-xl text-sm whitespace-pre-wrap ${
                msg.sender === "user"
                  ? "ml-auto bg-blue-600 text-white shadow-lg"
                  : "mr-auto bg-blue-300 text-blue-900 shadow-md"
              }`}
            >
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 px-6 py-4 border-t border-blue-700 bg-white/10"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg px-4 py-2 text-sm text-white bg-blue-800 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 border border-blue-600"
            ref={inputRef}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-white font-semibold transition"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
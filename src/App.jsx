import React, { useState } from 'react';
import { Analytics } from "@vercel/analytics/react";
function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newMessage = { sender: "user", text: input };
    setMessages([...messages, newMessage]);
    setInput("");
    // Add AI response simulation here if desired
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[90vh] flex flex-col rounded-2xl border border-blue-800 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden">
        
        <div className="px-6 py-4 border-b border-blue-800 bg-blue-900/70">
          <h1 className="text-2xl font-semibold text-white tracking-wide">HillGPT</h1>
          <p className="text-sm text-blue-300">Your assistant for Capitol Hill</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-line ${
                msg.sender === "user"
                  ? "ml-auto bg-blue-600 text-white shadow-lg"
                  : "mr-auto bg-blue-200 text-blue-900 shadow"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 px-6 py-4 border-t border-blue-800 bg-blue-900/70"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-full px-5 py-3 text-sm text-white bg-blue-950/70 placeholder-blue-400 focus:outline-none border border-blue-700"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-full text-white font-semibold transition"
          >
            Send
          </button>
        </form>
      </div>
      <Analytics />
    </div>
  );
}

export default App;
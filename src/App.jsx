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
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-between p-6">
      <div className="w-full max-w-4xl flex flex-col rounded-xl border border-gray-700 bg-gray-800/70 backdrop-blur-lg shadow-xl overflow-hidden">
        
        <div className="px-8 py-6 border-b border-gray-700 bg-gray-900/90">
          <h1 className="text-3xl font-bold text-white">HillGPT</h1>
          <p className="text-base text-gray-400 mt-1">Your assistant for Capitol Hill</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-line ${
                msg.sender === "user"
                  ? "ml-auto bg-blue-700 text-white shadow-lg"
                  : "mr-auto bg-gray-700 text-gray-100 shadow"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-4 px-8 py-6 border-t border-gray-700 bg-gray-900/90"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg px-5 py-3 text-sm text-gray-100 bg-gray-800/70 placeholder-gray-500 focus:outline-none border border-gray-700"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-blue-700 hover:bg-blue-800 rounded-lg text-white font-semibold transition"
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
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-3xl h-[85vh] flex flex-col rounded-xl border border-blue-600 bg-white/10 backdrop-blur-md shadow-xl overflow-hidden">

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`max-w-[75%] px-4 py-3 rounded-xl text-sm ${
                msg.sender === "user"
                  ? "ml-auto bg-blue-600 text-white shadow-md"
                  : "mr-auto bg-white text-gray-900 shadow-sm"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 p-4 border-t border-blue-700 bg-blue-800/60 backdrop-blur-sm"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg px-4 py-3 text-sm text-white bg-blue-900/60 placeholder-blue-300 focus:outline-none border border-blue-600"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition"
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
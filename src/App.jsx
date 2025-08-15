import React, { useState } from "react";
import './index.css';
import axios from 'axios';

async function talkToGPT(userMessage) {
  try {
    const response = await axios.post('/api/ask-assistant', {
      message: userMessage,
    });

    return response.data.text;
  } catch (err) {
    console.error("Error from OpenAI (via Vercel):", err);
    return "❌ There was an error fetching the response.";
  }
}

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

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
        <header className="px-6 py-4 border-b border-blue-700 bg-white/10">
          <h1 className="text-4xl font-bold text-white">HillGPT</h1>
          <p className="text-sm text-blue-200">Your assistant for Capitol Hill</p>
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
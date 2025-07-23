import { useState } from "react";
import { Analytics } from "@vercel/analytics/react";

function App() {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Welcome to HillGPT. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    setMessages((prev) => [...prev, { sender: "user", text: input }]);

    // Placeholder bot response
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: input },
      { sender: "bot", text: "🧠 (This is where HillGPT will reply.)" },
    ]);

    setInput("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white flex flex-col items-center justify-between px-4 py-6">
      <div className="w-full max-w-2xl flex flex-col grow overflow-hidden border border-blue-700 rounded-xl bg-white/5 backdrop-blur p-4">
        <div className="overflow-y-auto flex-1 space-y-4 mb-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`px-4 py-2 rounded-lg max-w-[80%] ${
                msg.sender === "user"
                  ? "self-end bg-blue-700 text-white"
                  : "self-start bg-gray-100 text-gray-900"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg px-4 py-2 text-gray-900 focus:outline-none"
            placeholder="Ask HillGPT something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
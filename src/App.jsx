function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white flex flex-col items-center justify-center px-6 text-center">
      <img src="/logo.png" alt="HillGPT logo" className="w-32 h-32 mb-6" />
      <h1 className="text-5xl font-extrabold mb-4 tracking-tight text-blue-100 drop-shadow-lg">
        HillGPT
      </h1>
      <p className="text-xl text-blue-200 max-w-md mb-8">
        A professional-grade chatbot assistant for congressional staffers.
      </p>
      <div className="rounded-lg border border-blue-400 px-4 py-2 text-sm text-blue-300 bg-blue-800/40">
        🚧 Work in Progress — Launching Soon
      </div>
    </div>
  );
}
export default App;
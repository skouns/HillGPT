<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeRaw]}
  className="prose prose-sm max-w-none prose-li:my-1 prose-p:my-1 prose-ul:my-2 prose-ol:my-2"
  components={{
    ul: ({ node, ...props }) => (
      <ul className="list-disc pl-6 ml-2 space-y-2" {...props} />
    ),
    ol: ({ node, ...props }) => (
      <ol className="list-decimal pl-6 ml-2 space-y-2" {...props} />
    ),
    li: ({ node, ...props }) => (
      <li className="leading-relaxed pl-1" {...props} />
    ),
    p: ({ node, ...props }) => (
      <p className="my-1" {...props} />
    ),
    code: ({ node, inline, ...props }) =>
      inline ? (
        <code className="bg-blue-900/20 rounded px-1 py-0.5" {...props} />
      ) : (
        <pre className="bg-blue-900/20 p-3 rounded-xl overflow-x-auto">
          <code {...props} />
        </pre>
      ),
  }}
>
  {normalizeMarkdown(msg.text)}
</ReactMarkdown>
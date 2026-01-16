import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/50 via-slate-950 to-fuchsia-950/30" />

      <header className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center text-xl">
            ⚡
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Ziip
          </span>
        </Link>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-invert prose-slate">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">Your Data Stays Local</h2>
            <p className="text-slate-400 mb-4">
              Ziip processes your data entirely in your browser using DuckDB-WASM.
              Your files are never uploaded to our servers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">What We Collect</h2>
            <ul className="text-slate-400 space-y-2">
              <li>• Account information (email) if you sign up</li>
              <li>• Usage analytics (page views, feature usage)</li>
              <li>• Saved recipes (queries) if you choose to save them</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">AI Processing</h2>
            <p className="text-slate-400 mb-4">
              When you ask questions, we send your query and table schema to Claude (Anthropic's AI)
              to generate SQL. We do not send your actual data rows.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">Contact</h2>
            <p className="text-slate-400">
              Questions? Email us at privacy@ziip.community
            </p>
          </section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          <Link to="/" className="hover:text-white transition">← Back to Ziip</Link>
        </div>
      </footer>
    </div>
  );
}

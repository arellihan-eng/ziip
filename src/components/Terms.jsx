import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
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
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

        <div className="prose prose-invert prose-slate">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">Using Ziip</h2>
            <p className="text-slate-400 mb-4">
              Ziip is a data analysis tool. You're responsible for the data you upload
              and the questions you ask. Don't use it for anything illegal.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">Open Beta</h2>
            <p className="text-slate-400 mb-4">
              We're in beta. Things might break. We'll do our best to keep things running,
              but we can't guarantee 100% uptime or that your saved recipes won't disappear.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">Community Features</h2>
            <p className="text-slate-400 mb-4">
              If you build features for the community, you retain ownership of your code.
              By submitting, you grant Ziip a license to use and distribute it.
              Revenue sharing (40%) applies to approved community features.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">API Keys</h2>
            <p className="text-slate-400 mb-4">
              You provide your own Anthropic API key. Keep it secret.
              We store it in your browser's localStorage, never on our servers.
              You're responsible for any charges from Anthropic.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-violet-400">No Warranty</h2>
            <p className="text-slate-400">
              Ziip is provided "as is". We're not responsible for data loss, incorrect analysis,
              or any decisions you make based on Ziip's output. Always verify important results.
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

import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LandingPage({ onFileLoad }) {
  const { user, loading, signIn, signOut } = useAuth();

  const handleSignIn = async () => {
    try {
      await signIn('google');
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []);
    if (files.length > 0 && onFileLoad) {
      onFileLoad(files);
    }
  }, [onFileLoad]);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/50 via-slate-950 to-fuchsia-950/30" />
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-violet-500/25">
            ⚡
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Ziip
          </span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="flex items-center gap-3">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-sm font-medium">
                    {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                  </div>
                )}
                <span className="text-slate-300 text-sm hidden sm:block">{user.name || user.email}</span>
              </div>
              <button
                onClick={signOut}
                className="px-4 py-2 text-slate-400 hover:text-white transition text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition text-sm"
              >
                Sign in
              </button>
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 rounded-lg font-medium transition text-sm shadow-lg shadow-violet-500/25"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-sm mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            A Data Community
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Talk to your data.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
              Get answers fast.
            </span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-4">
            Drop a spreadsheet. Ask questions in plain English.
            <br />
            Analysis in seconds, not hours.
          </p>

          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            This is just the beginning. What gets built next is up to you.
            <br />
            Creators propose, the community votes, everyone benefits.
          </p>
        </div>

        {/* File Drop Zone */}
        <div className="max-w-2xl mx-auto mb-16">
          <div
            className="relative group"
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-300" />
            <label className="relative block bg-slate-900 border-2 border-dashed border-slate-700 hover:border-violet-500 rounded-2xl p-12 text-center transition duration-300 cursor-pointer">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                onChange={handleFileDrop}
                className="hidden"
              />
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl">
                📄
              </div>
              <div className="text-xl font-semibold mb-2">Drop your file here</div>
              <div className="text-slate-400 mb-4">CSV or Excel • No signup required</div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/20 rounded-full text-sm text-violet-300">
                ⚡ Open Beta - 100% Free
              </div>
            </label>
          </div>

          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <span className="text-green-400">✓</span> No signup needed
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Data stays in browser
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Results in 60 seconds
            </span>
          </div>
        </div>

        {/* How it works - Flow */}
        <div className="max-w-3xl mx-auto mb-24">
          <h3 className="text-xl font-semibold text-center mb-12 text-slate-200">How it works</h3>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-violet-500 via-fuchsia-500 to-violet-500 hidden md:block" />

            <div className="space-y-8">
              {[
                {
                  step: '1',
                  title: 'Drop your file',
                  desc: 'Excel exports, CSVs, Salesforce dumps - messy headers, merged cells, we handle it',
                  detail: 'We auto-detect issues and help you clean them up'
                },
                {
                  step: '2',
                  title: 'Ask what you need',
                  desc: '"Revenue by partner", "Top 10 accounts", "Group by month"',
                  detail: 'Plain English → we figure out the transforms'
                },
                {
                  step: '3',
                  title: 'Review & export',
                  desc: 'See the plan, run it, download your cleaned & transformed data',
                  detail: 'CSV export, ready for your next step'
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold shrink-0 relative z-10 shadow-lg shadow-violet-500/25">
                    {item.step}
                  </div>
                  <div className="pt-2">
                    <h4 className="text-lg font-semibold mb-1 text-white">{item.title}</h4>
                    <p className="text-slate-400 mb-1">{item.desc}</p>
                    <p className="text-sm text-slate-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Community Section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            We're at the starting line.
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent"> Run with us.</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-8">
            Today: rapid data analysis for anyone. Tomorrow: whatever the community decides.
            Propose features, vote on the roadmap, build tools and earn when others use them.
          </p>

          {/* How the community works */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            {[
              { icon: '💡', title: 'Propose', desc: 'Have an idea? Submit it. Need a QuickBooks connector? A churn predictor? Put it up for vote.' },
              { icon: '🗳️', title: 'Vote', desc: 'Contributors shape what gets built. 60% majority passes. Your voice matters.' },
              { icon: '🛠️', title: 'Build & Earn', desc: 'Creators build features and earn 40% of revenue when others use them.' },
            ].map((step, i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-left hover:border-slate-700 transition duration-300">
                <div className="text-3xl mb-3">{step.icon}</div>
                <h3 className="text-lg font-semibold mb-2 text-white">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Beta CTA */}
        <div className="max-w-xl mx-auto text-center">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
            <h3 className="text-2xl font-semibold mb-2">Join the beta</h3>
            <p className="text-slate-400 mb-6">Free while we build this together. Your feedback shapes what comes next.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 rounded-xl font-medium transition shadow-lg shadow-violet-500/25 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign up with Google'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-4">Or just drop a file above - no signup required to try</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-sm text-slate-500">
          <span>© 2025 Ziip. Built with the community.</span>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import React, { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { isSuperAdmin } from '@/lib/admin';
import Footer from '@/components/Footer';
import {
  Search,
  GitMerge,
  CheckSquare,
  Table,
  Scale,
  GitBranch,
  BarChart2,
  FileText,
  Bell,
  Link as LinkIcon,
  FlaskConical,
  ArrowRight,
  User,
  LogOut,
  LogIn
} from 'lucide-react';

function OAuthHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // If we have OAuth data in the URL, redirect to the unified callback handler
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        const code = searchParams.get('code');
        
        // If we have OAuth data, redirect to unified callback
        if (hash || code) {
          const currentUrl = window.location.href;
          // Redirect to the unified callback page with all the OAuth data
          router.replace(`/auth/callback${window.location.search}${hash}`);
          return;
        }
      }
    };

    handleOAuthCallback();
  }, [router, searchParams]);

  return null;
}

function HomePageContent() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  // Redirect logged-in users to their appropriate dashboard (only if not already there)
  useEffect(() => {
    if (user && !loading && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      const redirectPath = isSuperAdmin(user.email) ? '/admin' : '/research';
      
      // Only redirect if we're on the homepage
      if (currentPath === '/' || currentPath === '') {
        router.replace(redirectPath);
      }
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const researchTools = [
    {
      icon: Search,
      title: "Literature Search",
      description: "Search PubMed, OpenAlex, and medRxiv simultaneously. Export in RIS format.",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    },
    {
      icon: GitMerge,
      title: "Deduplication",
      description: "Remove duplicate papers across databases with smart matching algorithms.",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20"
    },
    {
      icon: CheckSquare,
      title: "Screening",
      description: "Title/abstract and full-text screening with conflict resolution.",
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20"
    },
    {
      icon: Table,
      title: "Data Extraction",
      description: "Structured forms for extracting study characteristics and outcomes.",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20"
    },
    {
      icon: Scale,
      title: "Risk of Bias",
      description: "ROB 2.0 and ROBINS-I assessment tools with domain-level judgments.",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    },
    {
      icon: GitBranch,
      title: "PRISMA Generator",
      description: "Auto-generate PRISMA 2020 flow diagrams from your data.",
      color: "text-teal-400",
      bg: "bg-teal-500/10",
      border: "border-teal-500/20"
    },
    {
      icon: BarChart2,
      title: "Meta-Analysis",
      description: "Forest plots, heterogeneity, and subgroup analysis.",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20"
    },
    {
      icon: FileText,
      title: "GRADE Tables",
      description: "Evidence certainty assessment and Summary of Findings tables.",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20"
    },
    {
      icon: Bell,
      title: "Search Monitor",
      description: "Alerts for new publications matching your criteria.",
      color: "text-pink-400",
      bg: "bg-pink-500/10",
      border: "border-pink-500/20"
    },
    {
      icon: LinkIcon,
      title: "Citation Chaining",
      description: "Forward and backward citation tracking for snowball searches.",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30">
      <Suspense fallback={null}>
        <OAuthHandler />
      </Suspense>

      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur fixed top-0 w-full z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-900/20">
              <span className="text-white font-bold text-sm">MS</span>
            </div>
            <span className="font-semibold text-white tracking-tight">MSDrills</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            ) : user ? (
              <>
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.email}</span>
                </div>
                <Link
                  href="/research"
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
                <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
                  Admin Portal
                </Link>
              </>
            )}
            <Link
              href="https://masteringseries.com"
              target="_blank"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors border border-slate-700"
            >
              MasteringSeries.com
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-teal-500/10 rounded-full blur-3xl -z-10 opacity-30"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-20"></div>

        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium mb-8">
            <FlaskConical size={16} />
            Research Tools
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
            Systematic Review <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Made Simple</span>
          </h1>

          {/* Subhead */}
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            10 integrated tools for literature search, screening, meta-analysis, and PRISMA compliance.
            Built for rigorous academic research.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/signup"
              className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition-all hover:scale-105 shadow-xl shadow-teal-500/20 flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white font-medium rounded-xl border border-slate-700 transition-all hover:border-slate-500"
            >
              Sign In
            </Link>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <span className="text-teal-400">✓</span> Project Management
            </span>
            <span className="flex items-center gap-2">
              <span className="text-teal-400">✓</span> Team Collaboration
            </span>
            <span className="flex items-center gap-2">
              <span className="text-teal-400">✓</span> PRISMA Compliant
            </span>
            <span className="flex items-center gap-2">
              <span className="text-teal-400">✓</span> Export to RIS/CSV
            </span>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="py-20 px-6 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {researchTools.map((tool) => (
              <div
                key={tool.title}
                className="group p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${tool.bg} ${tool.border} border`}>
                  <tool.icon className={`w-6 h-6 ${tool.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 border-b border-slate-800 bg-slate-950">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-white mb-1">10</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-medium">Research Tools</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-1">900+</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-medium">Videos Created</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-1">Free</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-medium">To Use</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-1">∞</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-medium">Possibilities</div>
          </div>
        </div>
      </section>

      {/* Admin Section (Minimal) */}
      {user && isSuperAdmin(user.email) && (
        <section className="py-12 px-6 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-slate-950 text-sm text-slate-500">Internal Tools</span>
            </div>
          </div>

          <p className="text-slate-500 text-sm mb-6">
            Content creation hub for MasteringSeries
          </p>

          <Link
            href="/admin"
            className="inline-flex items-center text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            Go to Admin Portal <ArrowRight size={14} className="ml-1" />
          </Link>
        </section>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}

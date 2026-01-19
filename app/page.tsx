'use client';

import React, { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
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
  Briefcase,
  ArrowRight,
  User,
  LogOut,
  LogIn,
  BookOpen,
  TrendingUp,
  PieChart,
  Users
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

  // Redirect logged-in users to program selector
  useEffect(() => {
    if (user && !loading && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;

      // Only redirect if we're on the homepage
      if (currentPath === '/' || currentPath === '') {
        router.replace('/select-program');
      }
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // MPH Tools
  const mphTools = [
    { icon: Search, title: "Literature Search", description: "PubMed, OpenAlex, medRxiv" },
    { icon: GitMerge, title: "Deduplication", description: "Smart duplicate removal" },
    { icon: CheckSquare, title: "Screening", description: "Title/abstract screening" },
    { icon: Scale, title: "Risk of Bias", description: "ROB 2.0, ROBINS-I, NOS" },
    { icon: BarChart2, title: "Meta-Analysis", description: "Forest & funnel plots" },
    { icon: GitBranch, title: "PRISMA Generator", description: "PRISMA 2020 diagrams" },
  ];

  // MHA/MBA Tools (Coming Soon)
  const mhambaTools = [
    { icon: BookOpen, title: "Business Literature", description: "SSRN, JSTOR, ProQuest" },
    { icon: TrendingUp, title: "Case Study Analysis", description: "Structured frameworks" },
    { icon: PieChart, title: "Market Research", description: "Industry analysis tools" },
    { icon: Users, title: "Stakeholder Mapping", description: "Relationship visualization" },
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
              <span className="text-white font-bold text-sm">MA</span>
            </div>
            <span className="font-semibold text-white tracking-tight">Mastering Academia</span>
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
                  href="/select-program"
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
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl -z-10 opacity-20"></div>
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-20"></div>

        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium mb-8">
            Academic Research Tools
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
            Research Tools for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-purple-400">Graduate Students</span>
          </h1>

          {/* Subhead */}
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Comprehensive research tools tailored for MPH and MHA/MBA programs.
            Literature search, systematic reviews, case analysis, and more.
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
        </div>
      </section>

      {/* Program Cards Section */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-4">Choose Your Program</h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Access specialized research tools designed for your academic discipline
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* MPH Card */}
            <div className="group relative p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6">
                <FlaskConical className="w-7 h-7 text-teal-400" />
              </div>

              <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">
                MPH
              </h3>
              <p className="text-slate-500 text-sm mb-4">Master of Public Health</p>

              <p className="text-slate-400 mb-6">
                Systematic review and meta-analysis tools for epidemiology and public health research.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {mphTools.map((tool) => (
                  <div key={tool.title} className="flex items-center gap-2 text-sm text-slate-400">
                    <tool.icon className="w-4 h-4 text-teal-400" />
                    <span>{tool.title}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/mph"
                className="inline-flex items-center gap-2 text-teal-400 font-medium hover:gap-3 transition-all"
              >
                Explore MPH Tools
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium">
                10 Tools
              </div>
            </div>

            {/* MHA/MBA Card */}
            <div className="group relative p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
                <Briefcase className="w-7 h-7 text-purple-400" />
              </div>

              <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                MHA/MBA
              </h3>
              <p className="text-slate-500 text-sm mb-4">Master of Health Administration / Business Administration</p>

              <p className="text-slate-400 mb-6">
                Business and healthcare management research tools for organizational analysis and strategy.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {mhambaTools.map((tool) => (
                  <div key={tool.title} className="flex items-center gap-2 text-sm text-slate-500">
                    <tool.icon className="w-4 h-4 text-purple-400/50" />
                    <span>{tool.title}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/mhamba"
                className="inline-flex items-center gap-2 text-purple-400 font-medium hover:gap-3 transition-all"
              >
                View MHA/MBA Tools
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
                Coming Soon
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-12">Why Mastering Academia?</h2>

          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-white mb-2">10+</div>
              <div className="text-sm text-slate-400">Research Tools</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">1B+</div>
              <div className="text-sm text-slate-400">Papers Searchable</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">Free</div>
              <div className="text-sm text-slate-400">To Use</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">PRISMA</div>
              <div className="text-sm text-slate-400">Compliant</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Your Research?
          </h2>
          <p className="text-slate-400 mb-8">
            Join graduate students using Mastering Academia for their academic research projects.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition-all"
            >
              Create Free Account
            </Link>
            <Link
              href="https://youtube.com/@MasteringPublicHealth"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border border-slate-700 hover:border-slate-500 text-white font-medium rounded-xl transition-all"
            >
              Watch Tutorials
            </Link>
          </div>
        </div>
      </section>

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

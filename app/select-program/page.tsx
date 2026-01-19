'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  FlaskConical,
  Briefcase,
  ArrowRight,
  Search,
  GitBranch,
  BarChart2,
  FileText,
  TrendingUp,
  Users,
  PieChart,
  BookOpen
} from 'lucide-react';

export default function SelectProgramPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl -z-10 opacity-20"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-20"></div>

      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-900/20">
              <span className="text-white font-bold text-sm">MA</span>
            </div>
            <span className="font-semibold text-white tracking-tight">Mastering Academia</span>
          </div>
          <div className="text-sm text-slate-400">
            {user.email}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Program
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Select the research tools tailored for your academic program. You can switch between programs anytime.
          </p>
        </div>

        {/* Program Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* MPH Card */}
          <Link
            href="/mph"
            className="group relative p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10"
          >
            {/* Icon */}
            <div className="w-16 h-16 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6">
              <FlaskConical className="w-8 h-8 text-teal-400" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">
              MPH
            </h2>
            <p className="text-slate-500 text-sm mb-4">Master of Public Health</p>

            {/* Description */}
            <p className="text-slate-400 mb-6">
              Systematic review and meta-analysis tools for epidemiology, biostatistics, and public health research.
            </p>

            {/* Features */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Search className="w-4 h-4 text-teal-400" />
                <span>Literature Search (PubMed, OpenAlex, medRxiv)</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <GitBranch className="w-4 h-4 text-teal-400" />
                <span>PRISMA Flow Diagrams</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <BarChart2 className="w-4 h-4 text-teal-400" />
                <span>Meta-Analysis & Forest Plots</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <FileText className="w-4 h-4 text-teal-400" />
                <span>ROB 2.0, GRADE Assessment</span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2 text-teal-400 font-medium group-hover:gap-3 transition-all">
              Enter MPH Tools
              <ArrowRight className="w-4 h-4" />
            </div>

            {/* Badge */}
            <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium">
              10 Tools
            </div>
          </Link>

          {/* MHAMBA Card */}
          <Link
            href="/mhamba"
            className="group relative p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10"
          >
            {/* Icon */}
            <div className="w-16 h-16 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <Briefcase className="w-8 h-8 text-purple-400" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
              MHA/MBA
            </h2>
            <p className="text-slate-500 text-sm mb-4">Master of Health Administration / Business Administration</p>

            {/* Description */}
            <p className="text-slate-400 mb-6">
              Business and healthcare management research tools for organizational analysis, strategy, and leadership studies.
            </p>

            {/* Features */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>Business Literature Search</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span>Case Study Analysis</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <PieChart className="w-4 h-4 text-purple-400" />
                <span>Strategic Frameworks</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Management Research Tools</span>
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2 text-purple-400 font-medium group-hover:gap-3 transition-all">
              Enter MHA/MBA Tools
              <ArrowRight className="w-4 h-4" />
            </div>

            {/* Badge */}
            <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
              Coming Soon
            </div>
          </Link>
        </div>

        {/* Footer Note */}
        <p className="text-center text-slate-500 text-sm mt-12">
          You can access both programs with your account. Switch anytime from the dashboard.
        </p>
      </main>
    </div>
  );
}

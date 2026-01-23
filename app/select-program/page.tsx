'use client';

import React, { useEffect, useState } from 'react';
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
  BookOpen,
  LogOut,
  Home,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Clock,
  Award
} from 'lucide-react';

export default function SelectProgramPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

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

  const mphFeatures = [
    { icon: Search, text: "Literature Search (PubMed, OpenAlex, medRxiv)" },
    { icon: GitBranch, text: "PRISMA Flow Diagrams" },
    { icon: BarChart2, text: "Meta-Analysis & Forest Plots" },
    { icon: FileText, text: "ROB 2.0, GRADE Assessment" }
  ];

  const mhambaFeatures = [
    { icon: BookOpen, text: "Business Literature Search" },
    { icon: TrendingUp, text: "Case Study Analysis" },
    { icon: PieChart, text: "Strategic Frameworks" },
    { icon: Users, text: "Management Research Tools" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30">
      {/* Animated Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl -z-10 opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-900/20 group-hover:shadow-teal-900/40 transition-shadow">
              <span className="text-white font-bold text-sm">MA</span>
            </div>
            <span className="font-semibold text-white tracking-tight">Mastering Academia</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                <span className="text-teal-400 font-semibold text-xs">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden md:inline">{user.email}</span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700 text-slate-300 text-sm font-medium mb-6 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>Welcome to Mastering Academia</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-purple-400">Program</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Select the research tools tailored for your academic discipline. Access specialized features designed 
            to streamline your research workflow and produce publication-quality results.
          </p>
        </div>

        {/* Benefits Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm">All Tools Included</div>
              <div className="text-slate-500 text-xs">Full access to every feature</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Switch Anytime</div>
              <div className="text-slate-500 text-xs">Access both programs freely</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Research Grade</div>
              <div className="text-slate-500 text-xs">Publication-ready outputs</div>
            </div>
          </div>
        </div>

        {/* Program Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* MPH Card */}
          <Link
            href="/mph"
            onMouseEnter={() => setSelectedCard('mph')}
            onMouseLeave={() => setSelectedCard(null)}
            className="group relative p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 hover:border-teal-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-teal-500/20"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-transparent transition-all duration-300"></div>
            
            {/* Icon */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-teal-600/20 border border-teal-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <FlaskConical className="w-10 h-10 text-teal-400" />
            </div>

            {/* Title */}
            <h2 className="relative text-3xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">
              MPH
            </h2>
            <p className="relative text-slate-500 text-sm mb-4 font-medium">Master of Public Health</p>

            {/* Description */}
            <p className="relative text-slate-400 mb-6 leading-relaxed">
              Complete systematic review toolkit for epidemiology, biostatistics, and public health research 
              with PRISMA-compliant workflows.
            </p>

            {/* Features */}
            <div className="relative space-y-3 mb-8">
              {mphFeatures.map((feature, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 text-sm text-slate-400 group-hover:text-slate-300 transition-colors"
                >
                  <div className="w-5 h-5 rounded-md bg-teal-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <feature.icon className="w-3 h-3 text-teal-400" />
                  </div>
                  <span className="leading-tight">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="relative flex items-center gap-2 text-teal-400 font-semibold group-hover:gap-3 transition-all">
              <span>Enter MPH Tools</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Badge */}
            <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold backdrop-blur-sm">
              10 Tools Available
            </div>

            {/* Hover Indicator */}
            <div className="absolute bottom-6 left-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-2 text-xs text-teal-400">
                <ArrowRight className="w-3 h-3 animate-pulse" />
                <span>Click to explore</span>
              </div>
            </div>
          </Link>

          {/* MHAMBA Card */}
          <Link
            href="/mhamba"
            onMouseEnter={() => setSelectedCard('mhamba')}
            onMouseLeave={() => setSelectedCard(null)}
            className="group relative p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-transparent transition-all duration-300"></div>
            
            {/* Icon */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Briefcase className="w-10 h-10 text-purple-400" />
            </div>

            {/* Title */}
            <h2 className="relative text-3xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
              MHA/MBA
            </h2>
            <p className="relative text-slate-500 text-sm mb-4 font-medium">Master of Health Administration / Business Administration</p>

            {/* Description */}
            <p className="relative text-slate-400 mb-6 leading-relaxed">
              Business and healthcare management research tools for organizational analysis, strategic planning, 
              and leadership studies.
            </p>

            {/* Features */}
            <div className="relative space-y-3 mb-8">
              {mhambaFeatures.map((feature, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 text-sm text-slate-500 group-hover:text-slate-400 transition-colors"
                >
                  <div className="w-5 h-5 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <feature.icon className="w-3 h-3 text-purple-400/70" />
                  </div>
                  <span className="leading-tight">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="relative flex items-center gap-2 text-purple-400 font-semibold group-hover:gap-3 transition-all">
              <span>View MHA/MBA Tools</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Badge */}
            <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold backdrop-blur-sm">
              Coming Soon
            </div>

            {/* Hover Indicator */}
            <div className="absolute bottom-6 left-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <ArrowRight className="w-3 h-3 animate-pulse" />
                <span>Preview available</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Info Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="p-6 rounded-2xl bg-slate-900/30 border border-slate-800/50 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">Flexible Access</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your account provides access to both program toolkits. You can switch between MPH and MHA/MBA 
                  tools anytime from your dashboard. All your projects and data are saved automatically and 
                  remain accessible across both programs.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-slate-500 text-sm mt-12">
          Need help choosing? <Link href="https://youtube.com/@MasteringPublicHealth" target="_blank" className="text-teal-400 hover:text-teal-300 transition-colors">Watch our tutorial videos</Link> to learn more about each program.
        </p>
      </main>
    </div>
  );
}

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Briefcase,
  ArrowLeft,
  Search,
  Star,
  FolderOpen,
  Target,
  Layers,
  FileText,
  TrendingUp,
  Users,
  PieChart,
  BarChart3,
  Building2,
  Lightbulb,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function MHAMBADashboard() {
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
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Active tools
  const activeTools = [
    {
      icon: Search,
      title: "Literature Search",
      description: "Search OpenAlex, Crossref, Semantic Scholar, CORE, Google Scholar & SSRN with journal quality rankings.",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      href: "/mhamba/search",
      badge: "New"
    },
    {
      icon: Star,
      title: "Journal Rankings",
      description: "Browse ABS, ABDC, and FT50 journal rankings for business and management research.",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      href: "/mhamba/journals",
      badge: "New"
    },
    {
      icon: FolderOpen,
      title: "Project Management",
      description: "Create projects, save papers, track searches, and export citations in multiple formats.",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      href: "/mhamba/dashboard",
      badge: "New"
    }
  ];

  // Upcoming tools
  const upcomingTools = [
    {
      icon: Target,
      title: "SWOT Analysis",
      description: "Structured framework for organizational strengths, weaknesses, opportunities, and threats.",
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20"
    },
    {
      icon: Layers,
      title: "Porter's Five Forces",
      description: "Industry analysis framework for competitive strategy research.",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20"
    },
    {
      icon: FileText,
      title: "Case Study Builder",
      description: "Templates and tools for structured business case analysis.",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20"
    },
    {
      icon: TrendingUp,
      title: "Financial Analysis",
      description: "Tools for analyzing financial statements and performance metrics.",
      color: "text-pink-400",
      bg: "bg-pink-500/10",
      border: "border-pink-500/20"
    },
    {
      icon: Users,
      title: "Stakeholder Mapping",
      description: "Visualize and analyze stakeholder relationships and influence.",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20"
    },
    {
      icon: PieChart,
      title: "Market Research",
      description: "Templates for market analysis, segmentation, and competitive positioning.",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-purple-500/30">
      {/* Background Gradients */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-20"></div>
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl -z-10 opacity-20"></div>

      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/select-program"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Switch Program</span>
            </Link>
            <div className="h-6 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-900/20">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white tracking-tight">MHA/MBA Tools</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/mhamba/dashboard"
              className="text-sm text-purple-400 hover:text-purple-300"
            >
              My Projects
            </Link>
            <div className="text-sm text-slate-400">
              {user.email}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-6">
            <Briefcase size={16} />
            MHA/MBA Research Tools
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Business Literature Research
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Search across multiple academic databases with automatic journal quality rankings.
            Perfect for MBA dissertations, MHA capstones, and business research.
          </p>
        </div>

        {/* Active Tools */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Available Now</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {activeTools.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="group p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 transition-all hover:bg-slate-900"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${tool.bg} ${tool.border} border group-hover:scale-110 transition-transform`}>
                    <tool.icon className={`w-6 h-6 ${tool.color}`} />
                  </div>
                  {tool.badge && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  {tool.description}
                </p>
                <span className="text-purple-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open tool
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Journal Quality Info */}
        <div className="mb-16 p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-lg font-bold text-white mb-4">Journal Quality Ranking System</h3>
          <p className="text-slate-400 text-sm mb-4">
            Papers are automatically enriched with journal rankings when available.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-yellow-400 font-semibold text-sm">Tier 1 - Elite</p>
              <p className="text-xs text-slate-400">ABS 4*/ABDC A*/FT50</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-purple-400 font-semibold text-sm">Tier 2 - Top Field</p>
              <p className="text-xs text-slate-400">ABS 4/ABDC A*</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-blue-400 font-semibold text-sm">Tier 3 - High Quality</p>
              <p className="text-xs text-slate-400">ABS 3/ABDC A</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-green-400 font-semibold text-sm">Tier 4 - Good</p>
              <p className="text-xs text-slate-400">ABS 2/ABDC B</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20">
              <p className="text-slate-400 font-semibold text-sm">Tier 5 - Emerging</p>
              <p className="text-xs text-slate-500">ABS 1/ABDC C</p>
            </div>
          </div>
        </div>

        {/* Upcoming Tools */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6">Coming Soon</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingTools.map((tool) => (
              <div
                key={tool.title}
                className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 opacity-60"
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${tool.bg} ${tool.border} border`}>
                  <tool.icon className={`w-6 h-6 ${tool.color}`} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {tool.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-8 rounded-2xl bg-slate-900 border border-slate-800">
          <h3 className="text-xl font-bold text-white mb-3">
            Need Systematic Review Tools?
          </h3>
          <p className="text-slate-400 mb-6">
            Our MPH tools include PRISMA compliance, meta-analysis, and more.
          </p>
          <Link
            href="/mph"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition-all"
          >
            Go to MPH Tools
          </Link>
        </div>
      </main>
    </div>
  );
}

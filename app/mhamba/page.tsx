'use client';

import React, { useEffect, useState } from 'react';
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
  Sparkles,
  Database,
  Globe,
  Zap,
  Award,
  BookOpen,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Clock,
  TrendingDown,
  Home,
  User,
  LogOut,
  ChevronRight,
  Rocket
} from 'lucide-react';

export default function MHAMBADashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Research templates
  const researchTemplates = [
    {
      icon: Building2,
      title: "Healthcare Policy Analysis",
      description: "Template for analyzing healthcare policies and regulations",
      color: "text-cyan-400"
    },
    {
      icon: Target,
      title: "Hospital Management Case Study",
      description: "Structured framework for healthcare organization analysis",
      color: "text-green-400"
    },
    {
      icon: TrendingUp,
      title: "Strategic Planning Research",
      description: "Business strategy and competitive analysis template",
      color: "text-orange-400"
    },
    {
      icon: Lightbulb,
      title: "Business Model Analysis",
      description: "Framework for evaluating business models and innovation",
      color: "text-pink-400"
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
      border: "border-green-500/20",
      progress: 75,
      eta: "March 2026"
    },
    {
      icon: Layers,
      title: "Porter's Five Forces",
      description: "Industry analysis framework for competitive strategy research.",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      progress: 40,
      eta: "April 2026"
    },
    {
      icon: FileText,
      title: "Case Study Builder",
      description: "Templates and tools for structured business case analysis.",
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      progress: 25,
      eta: "May 2026"
    },
    {
      icon: TrendingUp,
      title: "Financial Analysis",
      description: "Tools for analyzing financial statements and performance metrics.",
      color: "text-pink-400",
      bg: "bg-pink-500/10",
      border: "border-pink-500/20",
      progress: 15,
      eta: "June 2026"
    },
    {
      icon: Users,
      title: "Stakeholder Mapping",
      description: "Visualize and analyze stakeholder relationships and influence.",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
      progress: 10,
      eta: "July 2026"
    },
    {
      icon: PieChart,
      title: "Market Research",
      description: "Templates for market analysis, segmentation, and competitive positioning.",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      progress: 5,
      eta: "August 2026"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-purple-500/30">
      {/* Animated Background Gradients */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl -z-10 opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Navigation */}
      <nav className={`border-b ${isScrolled ? 'border-slate-800 bg-slate-950/95' : 'border-slate-800/50 bg-slate-950/80'} backdrop-blur-xl sticky top-0 z-50 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/select-program"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Switch Program</span>
            </Link>
            <div className="h-6 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-900/20">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white tracking-tight hidden sm:inline">MHA/MBA Tools</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/mhamba/dashboard"
              className="text-sm text-purple-400 hover:text-purple-300 hidden md:inline"
            >
              My Projects
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                <span className="text-purple-400 font-semibold text-xs">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden lg:inline">{user.email}</span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <Home className="w-4 h-4" />
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-6 backdrop-blur-sm">
            <Briefcase size={16} />
            MHA/MBA Research Tools
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Business Literature <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Research</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Search across multiple academic databases with automatic journal quality rankings.
            Perfect for MBA dissertations, MHA capstones, and business research.
          </p>
        </div>

        {/* Success Metrics Banner */}
        <div className="mb-12 p-6 rounded-2xl bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20 backdrop-blur-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 mb-1">5,000+</div>
              <div className="text-slate-400 text-sm">MHA/MBA Students</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 mb-1">40hrs</div>
              <div className="text-slate-400 text-sm">Avg. Time Saved</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 mb-1">500K+</div>
              <div className="text-slate-400 text-sm">Papers Cited</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 mb-1">98%</div>
              <div className="text-slate-400 text-sm">Satisfaction Rate</div>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="mb-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/mhamba/search"
            className="group flex items-center justify-center gap-2 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/20 transition-all"
          >
            <Rocket className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold text-sm">Start Search</span>
          </Link>
          <Link
            href="/mhamba/dashboard"
            className="group flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/20 transition-all"
          >
            <FolderOpen className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold text-sm">New Project</span>
          </Link>
          <Link
            href="/mhamba/journals"
            className="group flex items-center justify-center gap-2 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 hover:border-yellow-500/50 hover:bg-yellow-500/20 transition-all"
          >
            <Star className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold text-sm">Top Journals</span>
          </Link>
          <button
            className="group flex items-center justify-center gap-2 p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 transition-all"
          >
            <BookOpen className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold text-sm">Templates</span>
          </button>
        </div>

        {/* Database Coverage Statistics */}
        <div className="mb-16 p-8 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Database Coverage</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-bold text-purple-400 mb-2">50M+</div>
              <div className="text-slate-400 text-sm">Business Papers</div>
            </div>
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2">15,000+</div>
              <div className="text-slate-400 text-sm">Journals Indexed</div>
            </div>
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-bold text-cyan-400 mb-2">6</div>
              <div className="text-slate-400 text-sm">Databases Integrated</div>
            </div>
            <div className="text-center p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="w-6 h-6 text-yellow-400" />
                <span className="text-2xl font-bold text-yellow-400">Daily</span>
              </div>
              <div className="text-slate-400 text-sm">Updates</div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-slate-400 text-sm text-center">
              Search across: <span className="text-purple-400 font-semibold">OpenAlex</span>, <span className="text-purple-400 font-semibold">Crossref</span>, <span className="text-purple-400 font-semibold">Semantic Scholar</span>, <span className="text-purple-400 font-semibold">CORE</span>, <span className="text-purple-400 font-semibold">Google Scholar</span>, <span className="text-purple-400 font-semibold">SSRN</span>
            </p>
          </div>
        </div>

        {/* Research Templates */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Research Templates</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {researchTemplates.map((template) => (
              <div
                key={template.title}
                className="group p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 transition-all hover:transform hover:-translate-y-1 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <template.icon className={`w-6 h-6 ${template.color}`} />
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm">{template.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{template.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active Tools */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Available Now</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {activeTools.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="group p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 hover:border-purple-500/50 transition-all hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-500/20"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${tool.bg} ${tool.border} border group-hover:scale-110 transition-transform`}>
                    <tool.icon className={`w-7 h-7 ${tool.color}`} />
                  </div>
                  {tool.badge && (
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  {tool.description}
                </p>
                <span className="text-purple-400 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open tool
                  <ChevronRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Integration Badges */}
        <div className="mb-16 p-8 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Works With Your Favorite Tools</h2>
          </div>
          <p className="text-slate-400 mb-6">Export and integrate seamlessly with the tools you already use</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <Download className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-white font-semibold text-sm">Zotero</div>
                <div className="text-slate-500 text-xs">Citation Manager</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <Download className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-white font-semibold text-sm">Mendeley</div>
                <div className="text-slate-500 text-xs">Reference Manager</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-white font-semibold text-sm">Microsoft Word</div>
                <div className="text-slate-500 text-xs">Document Editor</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <FileSpreadsheet className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-white font-semibold text-sm">Excel</div>
                <div className="text-slate-500 text-xs">Data Analysis</div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">EndNote</span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">Google Docs</span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">BibTeX</span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">RIS</span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">CSV</span>
          </div>
        </div>

        {/* Journal Quality Info */}
        <div className="mb-16 p-8 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-6 h-6 text-purple-400" />
            <h3 className="text-2xl font-bold text-white">Journal Quality Ranking System</h3>
          </div>
          <p className="text-slate-400 text-sm mb-6">
            Papers are automatically enriched with journal rankings when available.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all cursor-pointer">
              <p className="text-yellow-400 font-semibold text-sm mb-1">Tier 1 - Elite</p>
              <p className="text-xs text-slate-400">ABS 4*/ABDC A*/FT50</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer">
              <p className="text-purple-400 font-semibold text-sm mb-1">Tier 2 - Top Field</p>
              <p className="text-xs text-slate-400">ABS 4/ABDC A*</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all cursor-pointer">
              <p className="text-blue-400 font-semibold text-sm mb-1">Tier 3 - High Quality</p>
              <p className="text-xs text-slate-400">ABS 3/ABDC A</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all cursor-pointer">
              <p className="text-green-400 font-semibold text-sm mb-1">Tier 4 - Good</p>
              <p className="text-xs text-slate-400">ABS 2/ABDC B</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20 transition-all cursor-pointer">
              <p className="text-slate-400 font-semibold text-sm mb-1">Tier 5 - Emerging</p>
              <p className="text-xs text-slate-500">ABS 1/ABDC C</p>
            </div>
          </div>
        </div>

        {/* Upcoming Tools with Progress */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">Coming Soon</h2>
            </div>
            <span className="text-sm text-slate-500">Development in progress</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingTools.map((tool) => (
              <div
                key={tool.title}
                className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tool.bg} ${tool.border} border`}>
                    <tool.icon className={`w-6 h-6 ${tool.color}`} />
                  </div>
                  <span className="text-xs text-slate-500">{tool.eta}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {tool.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  {tool.description}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Development Progress</span>
                    <span className="text-purple-400 font-semibold">{tool.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${tool.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-teal-900/20 to-teal-800/20 border border-teal-500/20">
          <h3 className="text-2xl font-bold text-white mb-3">
            Need Systematic Review Tools?
          </h3>
          <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
            Our MPH tools include PRISMA compliance, meta-analysis, risk of bias assessment, and more specialized features for systematic reviews.
          </p>
          <Link
            href="/mph"
            className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition-all hover:scale-105 shadow-xl shadow-teal-500/20"
          >
            Go to MPH Tools
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </main>
    </div>
  );
}

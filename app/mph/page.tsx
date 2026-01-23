'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ResearchHeader from '@/components/ResearchHeader';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  FolderOpen,
  Plus,
  ArrowRight,
  Clock,
  AlertCircle,
  Database,
  Zap,
  Award,
  BookOpen,
  FileSpreadsheet,
  Download,
  Rocket,
  Star,
  Search,
  FileText,
  Target,
  Activity,
  Microscope,
  BarChart3,
  Users,
  TrendingUp
} from 'lucide-react';

// MPH Research Tools Landing Page - Dashboard for logged-in users
// Route: /mph

interface ToolCardProps {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  status: 'available' | 'coming-soon'
  features?: string[]
}

const ToolCard: React.FC<ToolCardProps> = ({
  icon,
  title,
  description,
  href,
  status,
  features,
}) => {
  const isAvailable = status === 'available'

  return (
    <a
      href={isAvailable ? href : undefined}
      className={`
        relative block p-6 rounded-xl border transition-all duration-300
        ${isAvailable
          ? 'bg-gradient-to-br from-slate-900 to-slate-900/50 border-slate-800 hover:border-violet-500/50 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-500/20 cursor-pointer'
          : 'bg-slate-800/30 border-slate-700/50 cursor-default'
        }
      `}
    >
      {/* Glow Effect */}
      {isAvailable && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500/0 to-violet-500/0 group-hover:from-violet-500/5 group-hover:to-transparent transition-all duration-300"></div>
      )}

      {/* Status Badge */}
      {status === 'coming-soon' && (
        <span className="absolute top-4 right-4 px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
          Coming Soon
        </span>
      )}

      {/* Icon */}
      <div
        className={`
        w-14 h-14 rounded-xl flex items-center justify-center mb-4
        ${isAvailable ? 'bg-violet-500/20 border border-violet-500/30' : 'bg-slate-700/50'}
        ${isAvailable ? 'group-hover:scale-110 transition-transform' : ''}
      `}
      >
        <span className={`text-3xl ${!isAvailable && 'opacity-50'}`}>{icon}</span>
      </div>

      {/* Content */}
      <h3 className={`text-xl font-bold mb-2 ${isAvailable ? 'text-white' : 'text-slate-400'}`}>
        {title}
      </h3>
      <p className={`text-sm mb-4 leading-relaxed ${isAvailable ? 'text-slate-300' : 'text-slate-500'}`}>
        {description}
      </p>

      {/* Features List */}
      {features && (
        <ul className="space-y-1.5">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-center text-xs text-slate-400">
              <svg className="w-3 h-3 mr-2 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      )}
    </a>
  )
}

const DatabaseBadge: React.FC<{ name: string; papers: string }> = ({ name, papers }) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-violet-500/30 transition-all">
    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
    <span className="text-sm font-medium text-white">{name}</span>
    <span className="text-xs text-slate-400">{papers}</span>
  </div>
)

const ResearchPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's projects if logged in
  useEffect(() => {
    if (user && !authLoading) {
      fetchProjects();
    }
  }, [user, authLoading]);

  const fetchProjects = async () => {
    if (!user) return;
    setProjectsLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('research_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (queryError) {
        console.error('Error fetching projects:', queryError);
        setProjects([]);
        setError('Unable to load projects. You can still use all tools below.');
        return;
      }
      setProjects(data || []);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setProjects([]);
      setError('Unable to load projects. You can still use all tools below.');
    } finally {
      setProjectsLoading(false);
    }
  };

  const tools: ToolCardProps[] = [
    {
      icon: '🔍',
      title: 'Literature Search',
      description: 'Search PubMed and other databases efficiently.',
      href: '/mph/search',
      status: 'available',
      features: ['Multi-database search', 'Advanced query builder', 'Auto-save history', 'Export to RIS'],
    },
    {
      icon: '📊',
      title: 'PRISMA Generator',
      description: 'Generate PRISMA 2020 flow diagrams automatically.',
      href: '/mph/prisma',
      status: 'available',
      features: ['PRISMA 2020 compliant', 'Editable nodes', 'Export to PNG/SVG', 'Live preview'],
    },
    {
      icon: '🔄',
      title: 'Deduplication',
      description: 'Remove duplicate records from your search results.',
      href: '/mph/dedupe',
      status: 'available',
      features: ['Intelligent matching', 'Manual review mode', 'Merge records', 'Conflict resolution'],
    },
    {
      icon: '👀',
      title: 'Screening Tracker',
      description: 'Track titles and abstracts for inclusion/exclusion.',
      href: '/mph/screener',
      status: 'available',
      features: ['Keyboard shortcuts', 'Progress stats', 'Conflict highlighting', 'Team collaboration'],
    },
    {
      icon: '📄',
      title: 'Data Extraction',
      description: 'Customizable extraction forms for systematic data collection.',
      href: '/mph/extraction',
      status: 'available',
      features: ['Custom form builder', 'PICO extraction templates', 'Export to Excel/CSV', 'RevMan XML export'],
    },
    {
      icon: '🛡️',
      title: 'Risk of Bias',
      description: 'Assess study quality using Cochrane ROB 2, ROBINS-I, and NOS tools.',
      href: '/mph/rob',
      status: 'available',
      features: ['Standardized tools', 'Traffic light plots', 'Summary statistics', 'Export to CSV'],
    },
    {
      icon: '🧮',
      title: 'Meta-Analysis',
      description: 'Perform statistical pooling and generate forest/funnel plots.',
      href: '/mph/meta',
      status: 'available',
      features: ['Random/Fixed effects', 'Forest & Funnel plots', 'I² heterogeneity', 'Export high-res plots'],
    },
    {
      icon: '⭐',
      title: 'GRADE Evidence',
      description: 'Create Summary of Findings tables and assess certainty of evidence.',
      href: '/mph/grade',
      status: 'available',
      features: ['GRADE methodology', 'Summary of Findings tables', 'Certainty rating', 'Export to HTML/CSV'],
    },
    {
      icon: '🔗',
      title: 'Citation Chaining',
      description: 'Explore forward and backward citations for snowball searches.',
      href: '/mph/citations',
      status: 'available',
      features: ['Forward/Backward citations', 'Snowballing methodology', 'Visual chain navigation', 'Export to CSV'],
    },
    {
      icon: '🔔',
      title: 'Search Monitor',
      description: 'Get alerts when new papers match your search criteria.',
      href: '/mph/monitor',
      status: 'available',
      features: ['Weekly/monthly alerts', 'OpenAlex integration', 'New paper tracking', 'Export results'],
    },
  ];

  const researchTemplates = [
    {
      icon: Microscope,
      title: "Systematic Review Template",
      description: "Complete PRISMA-compliant systematic review framework",
      color: "text-cyan-400"
    },
    {
      icon: BarChart3,
      title: "Meta-Analysis Template",
      description: "Statistical pooling and forest plot generation guide",
      color: "text-green-400"
    },
    {
      icon: FileText,
      title: "Scoping Review Template",
      description: "Structured framework for scoping review methodology",
      color: "text-orange-400"
    },
    {
      icon: Target,
      title: "Rapid Review Template",
      description: "Accelerated evidence synthesis template",
      color: "text-pink-400"
    }
  ];

  const databases = [
    { name: 'PubMed', papers: '35M' },
    { name: 'OpenAlex', papers: '250M' },
    { name: 'Semantic Scholar', papers: '200M' },
    { name: 'medRxiv', papers: '50K+' },
    { name: 'Europe PMC', papers: '40M' },
    { name: 'CORE', papers: '200M' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-violet-500/30">
      {/* Animated Background Gradients */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-3xl -z-10 opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl -z-10 opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

      <ResearchHeader showBackToTools={false} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* My Projects Section - Only for logged-in users */}
        {user && !authLoading && (
          <section className="mb-12">
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-violet-400" />
                  <h2 className="text-xl font-bold text-white">My Projects</h2>
                </div>
                <Link
                  href="/mph/dashboard"
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </Link>
              </div>
              {error && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm">
                  {error}
                </div>
              )}
              {projectsLoading ? (
                <div className="text-center py-4 text-slate-400">Loading projects...</div>
              ) : projects.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/mph/project/${project.id}`}
                      className="block p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-violet-500/50 hover:bg-slate-800/50 transition-all"
                    >
                      <h3 className="text-white font-semibold mb-1 truncate">{project.title}</h3>
                      <p className="text-slate-400 text-sm mb-2 line-clamp-2">{project.description || 'No description'}</p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(project.updated_at).toLocaleDateString()}
                        </span>
                        <span className="px-2 py-1 bg-violet-500/20 text-violet-400 rounded">
                          {project.status || 'planning'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-400 mb-4">You don't have any projects yet.</p>
                  <Link
                    href="/mph/dashboard"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Project
                  </Link>
                </div>
              )}
              {projects.length > 0 && (
                <div className="mt-4 text-center">
                  <Link
                    href="/mph/dashboard"
                    className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition-colors"
                  >
                    View All Projects
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-6 backdrop-blur-sm">
            <Microscope size={16} />
            MPH Research Tools
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
            Systematic Review <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">Made Simple</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed mb-8">
            {user 
              ? 'Manage your systematic reviews and access all research tools. Create projects, collaborate with your team, and track your progress.'
              : 'Tools for literature search, deduplication, and PRISMA compliance. Search 1+ billion papers across multiple databases.'}
          </p>

          {/* Database Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            {databases.map((db) => (
              <DatabaseBadge key={db.name} name={db.name} papers={db.papers} />
            ))}
          </div>
        </div>

        {/* Success Metrics Banner */}
        <div className="mb-12 p-6 rounded-2xl bg-gradient-to-r from-violet-900/20 to-purple-900/20 border border-violet-500/20 backdrop-blur-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-violet-600 mb-1">10,000+</div>
              <div className="text-slate-400 text-sm">MPH Students</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-violet-600 mb-1">60hrs</div>
              <div className="text-slate-400 text-sm">Avg. Time Saved</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-violet-600 mb-1">1M+</div>
              <div className="text-slate-400 text-sm">Reviews Completed</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-violet-600 mb-1">99%</div>
              <div className="text-slate-400 text-sm">PRISMA Compliant</div>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="mb-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/mph/search"
            className="group flex items-center justify-center gap-2 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 hover:border-violet-500/50 hover:bg-violet-500/20 transition-all"
          >
            <Rocket className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold text-sm">Start Search</span>
          </Link>
          <Link
            href="/mph/dashboard"
            className="group flex items-center justify-center gap-2 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/20 transition-all"
          >
            <FolderOpen className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold text-sm">New Project</span>
          </Link>
          <Link
            href="/mph/prisma"
            className="group flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/20 transition-all"
          >
            <FileText className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold text-sm">PRISMA</span>
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
            <Database className="w-6 h-6 text-violet-400" />
            <h2 className="text-2xl font-bold text-white">Database Coverage</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-bold text-violet-400 mb-2">1B+</div>
              <div className="text-slate-400 text-sm">Papers Searchable</div>
            </div>
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-bold text-purple-400 mb-2">10+</div>
              <div className="text-slate-400 text-sm">Database Sources</div>
            </div>
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2">100%</div>
              <div className="text-slate-400 text-sm">PRISMA Compliant</div>
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
              Search across: <span className="text-violet-400 font-semibold">PubMed</span>, <span className="text-violet-400 font-semibold">OpenAlex</span>, <span className="text-violet-400 font-semibold">Semantic Scholar</span>, <span className="text-violet-400 font-semibold">medRxiv</span>, <span className="text-violet-400 font-semibold">Europe PMC</span>, <span className="text-violet-400 font-semibold">CORE</span>
            </p>
          </div>
        </div>

        {/* Research Templates */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-violet-400" />
            <h2 className="text-2xl font-bold text-white">Research Templates</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {researchTemplates.map((template) => (
              <div
                key={template.title}
                className="group p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-violet-500/50 transition-all hover:transform hover:-translate-y-1 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <template.icon className={`w-6 h-6 ${template.color}`} />
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm">{template.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{template.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tools Grid */}
        <section id="tools" className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">Available Tools</h2>
            <p className="text-slate-400">Everything you need for systematic reviews and meta-analyses</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <ToolCard key={tool.title} {...tool} />
            ))}
          </div>
        </section>

        {/* Integration Badges */}
        <div className="mb-16 p-8 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <Download className="w-6 h-6 text-violet-400" />
            <h2 className="text-2xl font-bold text-white">Works With Your Favorite Tools</h2>
          </div>
          <p className="text-slate-400 mb-6">Export and integrate seamlessly with the tools you already use</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'ASReview', desc: 'AI Screening', icon: Activity },
              { name: 'Zotero', desc: 'References', icon: BookOpen },
              { name: 'RevMan', desc: 'Meta-analysis', icon: BarChart3 },
              { name: 'R/meta', desc: 'Statistics', icon: TrendingUp },
              { name: 'Rayyan', desc: 'Screening', icon: Users },
            ].map((tool) => (
              <div
                key={tool.name}
                className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-violet-500/30 transition-all"
              >
                <tool.icon className="w-5 h-5 text-violet-400" />
                <div>
                  <div className="text-white font-semibold text-sm">{tool.name}</div>
                  <div className="text-slate-500 text-xs">{tool.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">EndNote</span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">Mendeley</span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">Excel</span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">CSV</span>
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">RIS</span>
          </div>
        </div>

        {/* Workflow Section */}
        <section className="mb-16">
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Systematic Review Workflow</h2>

            <div className="grid md:grid-cols-5 gap-4">
              {[
                { step: '1', title: 'Search', desc: 'Multi-database', tool: 'Literature Search' },
                { step: '2', title: 'Dedupe', desc: 'Remove duplicates', tool: 'Deduplication' },
                { step: '3', title: 'Screen', desc: 'Title/Abstract', tool: 'ASReview Export' },
                { step: '4', title: 'Extract', desc: 'Data collection', tool: 'Extraction Forms' },
                { step: '5', title: 'Report', desc: 'PRISMA diagram', tool: 'PRISMA Generator' },
              ].map((item, idx) => (
                <div key={item.step} className="relative">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-violet-500/20 border-2 border-violet-500/30 flex items-center justify-center">
                      <span className="text-violet-400 font-bold text-lg">{item.step}</span>
                    </div>
                    <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                    <p className="text-xs text-slate-400 mb-2">{item.desc}</p>
                    <span className="text-xs text-violet-400 font-medium">{item.tool}</span>
                  </div>
                  {/* Arrow */}
                  {idx < 4 && <div className="hidden md:block absolute top-6 -right-2 text-violet-500/50 text-xl">→</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-violet-900/20 to-purple-900/20 border border-violet-500/20">
          <h3 className="text-2xl font-bold text-white mb-3">
            Ready to Start Your Systematic Review?
          </h3>
          <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
            Join MPH and MHA students using Mastering Academia for their research projects. Start searching across 1B+ papers today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/mph/search"
              className="inline-flex items-center gap-2 px-8 py-4 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-xl shadow-violet-500/20"
            >
              Get Started Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://youtube.com/@MasteringPublicHealth"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 border border-slate-600 hover:border-slate-500 text-slate-300 font-semibold rounded-xl transition-all"
            >
              Watch Tutorials →
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default ResearchPage

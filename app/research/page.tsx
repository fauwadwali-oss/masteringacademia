'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ResearchHeader from '@/components/ResearchHeader';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { FolderOpen, Plus, ArrowRight, Clock, AlertCircle } from 'lucide-react';

// Research Tools Landing Page - Dashboard for logged-in users
// Route: /research

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
        relative block p-6 rounded-xl border transition-all duration-200
        ${isAvailable
          ? 'bg-slate-800/50 border-slate-700 hover:border-violet-500/50 hover:bg-slate-800 cursor-pointer'
          : 'bg-slate-800/30 border-slate-700/50 cursor-default'
        }
      `}
    >
      {/* Status Badge */}
      {status === 'coming-soon' && (
        <span className="absolute top-4 right-4 px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
          Coming Soon
        </span>
      )}

      {/* Icon */}
      <div
        className={`
        w-12 h-12 rounded-lg flex items-center justify-center mb-4
        ${isAvailable ? 'bg-violet-500/20' : 'bg-slate-700/50'}
      `}
      >
        <span className={`text-2xl ${!isAvailable && 'opacity-50'}`}>{icon}</span>
      </div>

      {/* Content */}
      <h3 className={`text-lg font-semibold mb-2 ${isAvailable ? 'text-white' : 'text-slate-400'}`}>
        {title}
      </h3>
      <p className={`text-sm mb-4 ${isAvailable ? 'text-slate-300' : 'text-slate-500'}`}>
        {description}
      </p>

      {/* Features List */}
      {features && (
        <ul className="space-y-1">
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
  <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
    <div className="w-2 h-2 rounded-full bg-green-400"></div>
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
      // Use research_projects table directly (more reliable than view)
      const { data, error: queryError } = await supabase
        .from('research_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (queryError) {
        console.error('Error fetching projects:', queryError);
        // Don't throw - just set empty array so page still works
        setProjects([]);
        setError('Unable to load projects. You can still use all tools below.');
        return;
      }
      setProjects(data || []);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      // Set empty array on any error so page still works
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
      href: '/research/search',
      status: 'available',
      features: ['Multi-database search', 'Advanced query builder', 'Auto-save history', 'Export to RIS'],
    },
    {
      icon: '📊',
      title: 'PRISMA Generator',
      description: 'Generate PRISMA 2020 flow diagrams automatically.',
      href: '/research/prisma',
      status: 'available',
      features: ['PRISMA 2020 compliant', 'Editable nodes', 'Export to PNG/SVG', 'Live preview'],
    },
    {
      icon: '🔄',
      title: 'Deduplication',
      description: 'Remove duplicate records from your search results.',
      href: '/research/dedupe',
      status: 'available',
      features: ['Intelligent matching', 'Manual review mode', 'Merge records', 'Conflict resolution'],
    },
    {
      icon: '👀',
      title: 'Screening Tracker',
      description: 'Track titles and abstracts for inclusion/exclusion.',
      href: '/research/screener',
      status: 'available',
      features: ['Keyboard shortcuts', 'Progress stats', 'Conflict highlighting', 'Team collaboration'],
    },
    {
      icon: '📄',
      title: 'Data Extraction',
      description: 'Customizable extraction forms for systematic data collection.',
      href: '/research/extraction',
      status: 'available',
      features: ['Custom form builder', 'PICO extraction templates', 'Export to Excel/CSV', 'RevMan XML export'],
    },
    {
      icon: '🛡️',
      title: 'Risk of Bias',
      description: 'Assess study quality using Cochrane ROB 2, ROBINS-I, and NOS tools.',
      href: '/research/rob',
      status: 'available',
      features: ['Standardized tools', 'Traffic light plots', 'Summary statistics', 'Export to CSV'],
    },
    {
      icon: '🧮',
      title: 'Meta-Analysis',
      description: 'Perform statistical pooling and generate forest/funnel plots.',
      href: '/research/meta',
      status: 'available',
      features: ['Random/Fixed effects', 'Forest & Funnel plots', 'I² heterogeneity', 'Export high-res plots'],
    },
    {
      icon: '⭐',
      title: 'GRADE Evidence',
      description: 'Create Summary of Findings tables and assess certainty of evidence.',
      href: '/research/grade',
      status: 'available',
      features: ['GRADE methodology', 'Summary of Findings tables', 'Certainty rating', 'Export to HTML/CSV'],
    },
    {
      icon: '🔗',
      title: 'Citation Chaining',
      description: 'Explore forward and backward citations for snowball searches.',
      href: '/research/citations',
      status: 'available',
      features: ['Forward/Backward citations', 'Snowballing methodology', 'Visual chain navigation', 'Export to CSV'],
    },
    {
      icon: '🔔',
      title: 'Search Monitor',
      description: 'Get alerts when new papers match your search criteria.',
      href: '/research/monitor',
      status: 'available',
      features: ['Weekly/monthly alerts', 'OpenAlex integration', 'New paper tracking', 'Export results'],
    },
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      <ResearchHeader showBackToTools={false} />

      {/* My Projects Section - Only for logged-in users */}
      {user && !authLoading && (
        <section className="max-w-6xl mx-auto px-6 pt-8 pb-6">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-violet-400" />
                <h2 className="text-xl font-bold text-white">My Projects</h2>
              </div>
              <Link
                href="/research/dashboard"
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
                    href={`/research/project/${project.id}`}
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
                  href="/research/dashboard"
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
                  href="/research/dashboard"
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
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-full mb-6">
          <span className="text-violet-400 text-sm">🔬</span>
          <span className="text-violet-300 text-sm font-medium">Research Tools</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Systematic Review
          <span className="block text-violet-400">Made Simple</span>
        </h1>

        {/* Subheadline */}
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
          {user 
            ? 'Manage your systematic reviews and access all research tools. Create projects, collaborate with your team, and track your progress.'
            : 'Tools for literature search, deduplication, and PRISMA compliance. Search 1+ billion papers across multiple databases. No login required.'}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <a
            href="/research/search"
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>Start Searching</span>
          </a>
          <a
            href="#tools"
            className="px-6 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 font-medium rounded-lg transition-colors"
          >
            View All Tools
          </a>
        </div>

        {/* Database Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {databases.map((db) => (
            <DatabaseBadge key={db.name} name={db.name} papers={db.papers} />
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <div className="text-3xl font-bold text-white mb-1">1B+</div>
            <div className="text-sm text-slate-400">Papers Searchable</div>
          </div>
          <div className="text-center p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <div className="text-3xl font-bold text-white mb-1">10+</div>
            <div className="text-sm text-slate-400">Database Sources</div>
          </div>
          <div className="text-center p-6 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <div className="text-3xl font-bold text-white mb-1">100%</div>
            <div className="text-sm text-slate-400">PRISMA Compliant</div>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section id="tools" className="max-w-6xl mx-auto px-6 py-12">
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

      {/* Workflow Section */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-8">
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
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                    <span className="text-violet-400 font-bold">{item.step}</span>
                  </div>
                  <h3 className="text-white font-medium mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-400 mb-2">{item.desc}</p>
                  <span className="text-xs text-violet-400">{item.tool}</span>
                </div>
                {/* Arrow */}
                {idx < 4 && <div className="hidden md:block absolute top-5 -right-2 text-slate-600">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Works With Your Tools</h2>
          <p className="text-slate-400">Export to your favorite systematic review software</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          {[
            { name: 'ASReview', desc: 'AI Screening' },
            { name: 'Zotero', desc: 'References' },
            { name: 'RevMan', desc: 'Meta-analysis' },
            { name: 'R/meta', desc: 'Statistics' },
            { name: 'Rayyan', desc: 'Screening' },
          ].map((tool) => (
            <div
              key={tool.name}
              className="px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700/50 text-center"
            >
              <div className="text-white font-medium">{tool.name}</div>
              <div className="text-xs text-slate-400">{tool.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-2xl border border-violet-500/20 p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Start Your Systematic Review?</h2>
          <p className="text-slate-300 mb-6 max-w-xl mx-auto">
            Join MPH and MHA students using MSDrills for their research projects. No account needed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/research/search"
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
            >
              Get Started Now
            </a>
            <a
              href="https://youtube.com/@MasteringPublicHealth"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 font-medium rounded-lg transition-colors"
            >
              Watch Tutorials →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default ResearchPage

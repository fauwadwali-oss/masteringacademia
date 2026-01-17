// ProjectDashboard.tsx
// Main dashboard for managing systematic review projects
// Integrates all 10 tools with project-level navigation

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Filter, MoreVertical, Users, Settings,
  Clock, CheckCircle, AlertCircle, Archive, Trash2,
  FileText, Database, GitBranch, BarChart3, Shield,
  Table2, Bell, Link2, FileDown, ChevronRight,
  FolderOpen, Calendar, TrendingUp
} from 'lucide-react';

const ADMIN_EMAIL = 'fauwadwali@gmail.com';

// Types
interface Project {
  id: string;
  title: string;
  description: string;
  pico_population: string;
  pico_intervention: string;
  pico_comparison: string;
  pico_outcome: string;
  review_type: 'systematic_review' | 'meta_analysis' | 'scoping_review' | 'rapid_review';
  status: 'planning' | 'searching' | 'screening' | 'extraction' | 'analysis' | 'writing' | 'complete' | 'archived';
  settings: {
    dual_screening: boolean;
    dual_extraction: boolean;
    blind_mode: boolean;
    require_exclusion_reason: boolean;
  };
  created_at: string;
  updated_at: string;
  total_papers: number;
  unique_papers: number;
  papers_screened: number;
  papers_included: number;
  papers_extracted: number;
  rob_assessed: number;
  overall_progress: number;
  team_count: number;
}

interface ProjectStats {
  total_papers: number;
  unique_papers: number;
  duplicates_removed: number;
  papers_screened: number;
  papers_included: number;
  papers_excluded: number;
  papers_maybe: number;
  papers_extracted: number;
  rob_assessed: number;
  grade_assessed: number;
  meta_analyses_run: number;
  screening_progress: number;
  extraction_progress: number;
  overall_progress: number;
}

// Status configuration
const STATUS_CONFIG = {
  planning: { label: 'Planning', color: 'bg-gray-100 text-gray-700', icon: FileText },
  searching: { label: 'Searching', color: 'bg-blue-100 text-blue-700', icon: Search },
  screening: { label: 'Screening', color: 'bg-yellow-100 text-yellow-700', icon: Filter },
  extraction: { label: 'Extraction', color: 'bg-orange-100 text-orange-700', icon: Database },
  analysis: { label: 'Analysis', color: 'bg-purple-100 text-purple-700', icon: BarChart3 },
  writing: { label: 'Writing', color: 'bg-indigo-100 text-indigo-700', icon: FileText },
  complete: { label: 'Complete', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-500', icon: Archive }
};

const REVIEW_TYPES = {
  systematic_review: 'Systematic Review',
  meta_analysis: 'Meta-Analysis',
  scoping_review: 'Scoping Review',
  rapid_review: 'Rapid Review'
};

// Tool navigation configuration
const TOOLS = [
  { id: 'search', name: 'Literature Search', icon: Search, route: '/research/search', phase: 1 },
  { id: 'dedupe', name: 'Deduplication', icon: GitBranch, route: '/research/dedupe', phase: 2 },
  { id: 'screen', name: 'Screening', icon: Filter, route: '/research/screen', phase: 3 },
  { id: 'extract', name: 'Data Extraction', icon: Database, route: '/research/extract', phase: 4 },
  { id: 'rob', name: 'Risk of Bias', icon: Shield, route: '/research/rob', phase: 5 },
  { id: 'meta', name: 'Meta-Analysis', icon: BarChart3, route: '/research/meta', phase: 6 },
  { id: 'grade', name: 'GRADE Tables', icon: Table2, route: '/research/grade', phase: 7 },
  { id: 'prisma', name: 'PRISMA Flow', icon: GitBranch, route: '/research/prisma', phase: 8 },
  { id: 'monitor', name: 'Search Monitor', icon: Bell, route: '/research/monitor', phase: 9 },
  { id: 'citations', name: 'Citation Chaining', icon: Link2, route: '/research/citations', phase: 10 }
];

export default function ProjectDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title' | 'progress'>('updated');

  // Redirect to research page if not authenticated (research page is the dashboard)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/research');
    }
  }, [user, authLoading, router]);

  // Fetch projects
  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // Use research_projects table directly (more reliable than view)
      const { data, error: fetchError } = await supabase
        .from('research_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching projects:', fetchError);
        setProjects([]);
        return;
      }

      setProjects(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort projects
  const filteredProjects = projects
    .filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return p.title.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.pico_population?.toLowerCase().includes(query) ||
          p.pico_intervention?.toLowerCase().includes(query);
      }
      return true;
    })
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'progress':
          return b.overall_progress - a.overall_progress;
        default:
          return 0;
      }
    });

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  const activeProjects = projects.filter(p => p.status !== 'complete' && p.status !== 'archived');
  const completedProjects = projects.filter(p => p.status === 'complete');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Research Dashboard</h1>
                <p className="text-sm text-gray-500">Manage your systematic reviews</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user?.email === ADMIN_EMAIL && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Admin Portal
                </Link>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                New Review
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Reviews"
            value={activeProjects.length}
            icon={FileText}
            color="blue"
          />
          <StatCard
            label="Completed"
            value={completedProjects.length}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            label="Total Papers"
            value={projects.reduce((sum, p) => sum + (p.total_papers || 0), 0)}
            icon={Database}
            color="purple"
          />
          <StatCard
            label="Team Members"
            value={projects.reduce((sum, p) => sum + (p.team_count || 0), 0)}
            icon={Users}
            color="orange"
          />
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Date Created</option>
              <option value="title">Title</option>
              <option value="progress">Progress</option>
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState onCreateClick={() => setShowCreateModal(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onRefresh={fetchProjects}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchProjects();
          }}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  color
}: {
  label: string;
  value: number;
  icon: any;
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Project Card Component
function ProjectCard({
  project,
  onRefresh
}: {
  project: Project;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const status = STATUS_CONFIG[project.status];
  const StatusIcon = status.icon;

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  const navigateToProject = () => {
    router.push(`/research/project/${project.id}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600"
              onClick={navigateToProject}
            >
              {project.title}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {REVIEW_TYPES[project.review_type]}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>
              {status.label}
            </span>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMenu && (
                <ProjectMenu
                  project={project}
                  onClose={() => setShowMenu(false)}
                  onRefresh={onRefresh}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-4">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Overall Progress</span>
            <span className="font-medium text-gray-900">
              {Math.round(project.overall_progress || 0)}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${project.overall_progress || 0}%` }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-lg font-semibold text-gray-900">{project.unique_papers || 0}</p>
            <p className="text-xs text-gray-500">Papers</p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-lg font-semibold text-gray-900">{project.papers_screened || 0}</p>
            <p className="text-xs text-gray-500">Screened</p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-lg font-semibold text-gray-900">{project.papers_included || 0}</p>
            <p className="text-xs text-gray-500">Included</p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-lg font-semibold text-gray-900">{project.papers_extracted || 0}</p>
            <p className="text-xs text-gray-500">Extracted</p>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatDate(project.updated_at)}
          </span>
          {project.team_count > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {project.team_count + 1}
            </span>
          )}
        </div>

        <button
          onClick={navigateToProject}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Project Menu Component
function ProjectMenu({
  project,
  onClose,
  onRefresh
}: {
  project: Project;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const handleArchive = async () => {
    const newStatus = project.status === 'archived' ? 'planning' : 'archived';
    await supabase
      .from('research_projects')
      .update({ status: newStatus })
      .eq('id', project.id);
    onRefresh();
    onClose();
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      await supabase
        .from('research_projects')
        .delete()
        .eq('id', project.id);
      onRefresh();
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
        <a
          href={`/research/project/${project.id}`}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <FolderOpen className="w-4 h-4" />
          Open Project
        </a>
        <a
          href={`/research/project/${project.id}/team`}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Users className="w-4 h-4" />
          Team
        </a>
        <a
          href={`/research/project/${project.id}/settings`}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Settings className="w-4 h-4" />
          Settings
        </a>
        <hr className="my-1" />
        <button
          onClick={handleArchive}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
        >
          <Archive className="w-4 h-4" />
          {project.status === 'archived' ? 'Unarchive' : 'Archive'}
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </>
  );
}

// Empty State Component
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-12">
      <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
      <p className="text-gray-500 mb-6">
        Create your first systematic review project to get started.
      </p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Plus className="w-5 h-5" />
        Create Your First Review
      </button>
    </div>
  );
}

// Create Project Modal Component
function CreateProjectModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    review_type: 'systematic_review' as const,
    pico_population: '',
    pico_intervention: '',
    pico_comparison: '',
    pico_outcome: '',
    settings: {
      dual_screening: false,
      dual_extraction: false,
      blind_mode: true,
      require_exclusion_reason: true
    }
  });

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a project title');
      return;
    }

    if (authLoading) {
      alert('Please wait while we verify your authentication...');
      return;
    }

    if (!user?.id) {
      alert('You must be logged in to create a project. Please sign in and try again.');
      return;
    }

    setSaving(true);
    try {
      // Get current session to ensure we have auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No active session. Please sign in again.');
      }

      // Use session user ID to ensure it matches auth.uid() for RLS
      const userId = session.user.id;
      
      if (userId !== user?.id) {
        console.warn('Session user ID does not match hook user ID. Using session user ID.');
      }

      // Verify session token is present
      if (!session.access_token) {
        throw new Error('Session token missing. Please sign in again.');
      }

      console.log('Creating project with session:', {
        userId,
        hasAccessToken: !!session.access_token,
        tokenPrefix: session.access_token.substring(0, 20) + '...'
      });

      // Prepare the insert data, ensuring settings is properly formatted as JSONB
      const insertData = {
        user_id: userId,
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        review_type: formData.review_type,
        pico_population: formData.pico_population?.trim() || null,
        pico_intervention: formData.pico_intervention?.trim() || null,
        pico_comparison: formData.pico_comparison?.trim() || null,
        pico_outcome: formData.pico_outcome?.trim() || null,
        settings: formData.settings
      };

      console.log('Creating project with data:', { ...insertData, user_id: '***' });

      let data, error;
      
      // Try inserting with settings first
      const result = await supabase
        .from('research_projects')
        .insert(insertData)
        .select()
        .single();
      
      data = result.data;
      error = result.error;

      // If error is about missing settings column (PostgREST cache issue), retry without settings
      if (error && error.code === 'PGRST204' && error.message?.includes('settings')) {
        console.warn('PostgREST schema cache issue detected. Retrying without settings column...');
        
        // Insert without settings (will use default)
        const { settings: _, ...insertWithoutSettings } = insertData;
        
        const retryResult = await supabase
          .from('research_projects')
          .insert(insertWithoutSettings)
          .select()
          .single();
        
        if (retryResult.error) {
          console.error('Retry also failed:', retryResult.error);
          throw retryResult.error;
        }
        
        data = retryResult.data;
        
        // Update with settings after creation
        if (data?.id) {
          const updateResult = await supabase
            .from('research_projects')
            .update({ settings: formData.settings })
            .eq('id', data.id)
            .select()
            .single();
          
          if (updateResult.data) {
            data = updateResult.data;
          } else if (updateResult.error) {
            console.warn('Failed to update settings, but project was created:', updateResult.error);
            // Don't fail - project was created successfully
          }
        }
      } else if (error) {
        console.error('Supabase insert error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        
        // Check for API key errors
        if (error.message?.includes('API key') || error.message?.includes('apikey')) {
          console.error('⚠️ API key issue detected. Checking session...');
          const { data: { session: checkSession } } = await supabase.auth.getSession();
          if (!checkSession) {
            throw new Error('No active session. Please sign in again.');
          }
          if (!checkSession.access_token) {
            throw new Error('Session token missing. Please sign in again.');
          }
          throw new Error('API key authentication failed. Please try signing out and signing in again.');
        }
        
        throw error;
      }

      if (!data) {
        throw new Error('Project was created but no data was returned');
      }

      // Initialize stats record
      const { error: statsError } = await supabase
        .from('project_stats')
        .insert({ project_id: data.id });

      if (statsError) {
        console.error('Error creating project stats:', statsError);
        // Don't fail the whole operation if stats fail
      }

      // Log activity (non-blocking)
      try {
        await supabase.rpc('log_project_activity', {
          p_project_id: data.id,
          p_user_id: userId,
          p_action: 'project_created',
          p_details: { title: formData.title }
        });
      } catch (activityError) {
        console.error('Error logging activity:', activityError);
        // Don't fail the whole operation if activity logging fails
      }

      onCreated();
    } catch (error: any) {
      console.error('Error creating project:', error);
      let errorMessage = 'Failed to create project. Please try again.';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      alert(`Failed to create project: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Review</h2>
          <p className="text-sm text-gray-500 mt-1">
            Step {step} of 3: {step === 1 ? 'Basic Info' : step === 2 ? 'PICO Framework' : 'Settings'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Effect of Metformin on Weight Loss in Type 2 Diabetes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description of your review objectives..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Type
                </label>
                <select
                  value={formData.review_type}
                  onChange={(e) => setFormData({ ...formData, review_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(REVIEW_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-1">PICO Framework</h4>
                <p className="text-sm text-blue-700">
                  Define your research question using Population, Intervention, Comparison, and Outcome.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Population (P)
                </label>
                <textarea
                  value={formData.pico_population}
                  onChange={(e) => setFormData({ ...formData, pico_population: e.target.value })}
                  rows={2}
                  placeholder="e.g., Adults with Type 2 Diabetes Mellitus"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Intervention (I)
                </label>
                <textarea
                  value={formData.pico_intervention}
                  onChange={(e) => setFormData({ ...formData, pico_intervention: e.target.value })}
                  rows={2}
                  placeholder="e.g., Metformin therapy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comparison (C)
                </label>
                <textarea
                  value={formData.pico_comparison}
                  onChange={(e) => setFormData({ ...formData, pico_comparison: e.target.value })}
                  rows={2}
                  placeholder="e.g., Placebo or no treatment"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outcome (O)
                </label>
                <textarea
                  value={formData.pico_outcome}
                  onChange={(e) => setFormData({ ...formData, pico_outcome: e.target.value })}
                  rows={2}
                  placeholder="e.g., Weight change (kg), BMI reduction"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Review Settings</h4>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.settings.dual_screening}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, dual_screening: e.target.checked }
                      })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Dual Screening</span>
                      <p className="text-sm text-gray-500">Two reviewers independently screen papers</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.settings.dual_extraction}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, dual_extraction: e.target.checked }
                      })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Dual Extraction</span>
                      <p className="text-sm text-gray-500">Two reviewers independently extract data</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.settings.blind_mode}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, blind_mode: e.target.checked }
                      })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Blind Mode</span>
                      <p className="text-sm text-gray-500">Hide other reviewer's decisions until conflict resolution</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.settings.require_exclusion_reason}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, require_exclusion_reason: e.target.checked }
                      })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Require Exclusion Reason</span>
                      <p className="text-sm text-gray-500">Must select reason when excluding papers</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !formData.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving || !formData.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Project'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ProjectDetailPage.tsx
// Project detail view with navigation to all 10 tools
// Shows workflow progress and tool-specific stats

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Search, GitBranch, Filter, Database, Shield,
  BarChart3, Table2, FileDown, Bell, Link2, Settings,
  Users, Clock, CheckCircle, AlertCircle, ChevronRight,
  Play, Lock, Unlock, ExternalLink, Activity
} from 'lucide-react';

// Types
interface Project {
  id: string;
  title: string;
  description: string;
  pico_population: string;
  pico_intervention: string;
  pico_comparison: string;
  pico_outcome: string;
  review_type: string;
  status: string;
  settings: {
    dual_screening: boolean;
    dual_extraction: boolean;
    blind_mode: boolean;
    require_exclusion_reason: boolean;
  };
  created_at: string;
  updated_at: string;
}

interface ProjectStats {
  total_papers: number;
  unique_papers: number;
  duplicates_removed: number;
  papers_screened: number;
  papers_included: number;
  papers_excluded: number;
  papers_maybe: number;
  fulltext_retrieved: number;
  fulltext_included: number;
  papers_extracted: number;
  rob_assessed: number;
  grade_assessed: number;
  meta_analyses_run: number;
  screening_progress: number;
  extraction_progress: number;
  overall_progress: number;
}

interface ActivityItem {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  details: any;
  created_at: string;
  user_email?: string;
}

// Tool configuration with dependencies
const TOOLS = [
  {
    id: 'search',
    name: 'Literature Search',
    description: 'Search PubMed, Scopus, and other databases',
    icon: Search,
    route: 'search',
    phase: 1,
    statKey: 'total_papers',
    statLabel: 'papers found',
    color: 'blue',
    dependencies: []
  },
  {
    id: 'dedupe',
    name: 'Deduplication',
    description: 'Remove duplicate papers across sources',
    icon: GitBranch,
    route: 'dedupe',
    phase: 2,
    statKey: 'duplicates_removed',
    statLabel: 'duplicates removed',
    color: 'purple',
    dependencies: ['search']
  },
  {
    id: 'screen',
    name: 'Screening',
    description: 'Title and abstract screening',
    icon: Filter,
    route: 'screen',
    phase: 3,
    statKey: 'papers_screened',
    statLabel: 'papers screened',
    progressKey: 'screening_progress',
    color: 'yellow',
    dependencies: ['dedupe']
  },
  {
    id: 'extract',
    name: 'Data Extraction',
    description: 'Extract study data into forms',
    icon: Database,
    route: 'extract',
    phase: 4,
    statKey: 'papers_extracted',
    statLabel: 'papers extracted',
    progressKey: 'extraction_progress',
    color: 'orange',
    dependencies: ['screen']
  },
  {
    id: 'rob',
    name: 'Risk of Bias',
    description: 'Assess study quality (RoB 2, ROBINS-I)',
    icon: Shield,
    route: 'rob',
    phase: 5,
    statKey: 'rob_assessed',
    statLabel: 'assessments complete',
    color: 'red',
    dependencies: ['extract']
  },
  {
    id: 'meta',
    name: 'Meta-Analysis',
    description: 'Pool effects and create forest plots',
    icon: BarChart3,
    route: 'meta',
    phase: 6,
    statKey: 'meta_analyses_run',
    statLabel: 'analyses run',
    color: 'indigo',
    dependencies: ['extract']
  },
  {
    id: 'grade',
    name: 'GRADE Tables',
    description: 'Rate certainty of evidence',
    icon: Table2,
    route: 'grade',
    phase: 7,
    statKey: 'grade_assessed',
    statLabel: 'outcomes graded',
    color: 'green',
    dependencies: ['meta', 'rob']
  },
  {
    id: 'prisma',
    name: 'PRISMA Flow',
    description: 'Generate flow diagram',
    icon: FileDown,
    route: 'prisma',
    phase: 8,
    statKey: null,
    statLabel: 'Ready to generate',
    color: 'teal',
    dependencies: ['screen']
  },
  {
    id: 'monitor',
    name: 'Search Monitor',
    description: 'Track new publications',
    icon: Bell,
    route: 'monitor',
    phase: 9,
    statKey: null,
    statLabel: 'monitoring active',
    color: 'pink',
    dependencies: []
  },
  {
    id: 'citations',
    name: 'Citation Chaining',
    description: 'Forward and backward citations',
    icon: Link2,
    route: 'citations',
    phase: 10,
    statKey: null,
    statLabel: 'citation search',
    color: 'cyan',
    dependencies: []
  }
];

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const router = useRouter();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'workflow' | 'activity' | 'pico'>('workflow');
  const [mounted, setMounted] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (projectId && mounted) {
      fetchProjectData();
    }
  }, [projectId, mounted]);

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('research_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        // If project not found, set project to null (will show "not found" message)
        if (projectError.code === 'PGRST116') {
          setProject(null);
          setLoading(false);
          return;
        }
        throw projectError;
      }
      
      if (!projectData) {
        setProject(null);
        setLoading(false);
        return;
      }
      
      setProject(projectData);

      // Fetch stats (may not exist for new projects)
      const { data: statsData, error: statsError } = await supabase
        .from('project_stats')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      // If no stats exist, that's okay - project is new
      // PGRST116 is "not found" which is expected for new projects
      if (statsError && statsError.code !== 'PGRST116') {
        console.warn('Error fetching project stats:', statsError);
      }
      
      setStats(statsData || null);

      // Fetch recent activity (optional, may be empty)
      const { data: activityData, error: activityError } = await supabase
        .from('project_activity')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (activityError) {
        console.warn('Error fetching activity:', activityError);
        setActivity([]);
      } else {
        setActivity(activityData || []);
      }

    } catch (error) {
      console.error('Error fetching project data:', error);
      setProject(null);
      setStats(null);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  };

  const getToolStatus = (tool: typeof TOOLS[0]) => {
    if (!stats) return 'locked';

    // Check dependencies
    const dependenciesMet = tool.dependencies.every(depId => {
      const depTool = TOOLS.find(t => t.id === depId);
      if (!depTool?.statKey) return true;
      return (stats[depTool.statKey as keyof ProjectStats] as number) > 0;
    });

    if (!dependenciesMet) return 'locked';

    // Check if tool has been used
    if (tool.statKey && (stats[tool.statKey as keyof ProjectStats] as number) > 0) {
      return 'active';
    }

    return 'available';
  };

  const navigateToTool = (tool: typeof TOOLS[0]) => {
    const status = getToolStatus(tool);
    if (status === 'locked') return;
    router.push(`/research/project/${projectId}/${tool.route}`);
  };

  // Don't render until mounted (client-side only)
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
          <button
            onClick={() => router.push('/research')}
            className="text-blue-600 hover:text-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/research')}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{project.title}</h1>
                <p className="text-sm text-gray-500">
                  {stats?.overall_progress?.toFixed(0) || 0}% complete
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/research/project/${projectId}/team`)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
              >
                <Users className="w-5 h-5" />
                Team
              </button>
              <button
                onClick={() => router.push(`/research/project/${projectId}/settings`)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Progress Overview</h2>
            <span className="text-2xl font-bold text-blue-600">
              {stats?.overall_progress?.toFixed(0) || 0}%
            </span>
          </div>

          {/* Main Progress Bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${stats?.overall_progress || 0}%` }}
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatBox label="Total Papers" value={stats?.total_papers || 0} />
            <StatBox label="After Dedup" value={stats?.unique_papers || 0} />
            <StatBox label="Screened" value={stats?.papers_screened || 0} />
            <StatBox label="Included" value={stats?.papers_included || 0} />
            <StatBox label="Extracted" value={stats?.papers_extracted || 0} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <TabButton
            active={activeTab === 'workflow'}
            onClick={() => setActiveTab('workflow')}
            icon={GitBranch}
            label="Workflow"
          />
          <TabButton
            active={activeTab === 'activity'}
            onClick={() => setActiveTab('activity')}
            icon={Activity}
            label="Activity"
          />
          <TabButton
            active={activeTab === 'pico'}
            onClick={() => setActiveTab('pico')}
            icon={FileDown}
            label="PICO"
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'workflow' && (
          <WorkflowView
            tools={TOOLS}
            stats={stats}
            getToolStatus={getToolStatus}
            navigateToTool={navigateToTool}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityView activity={activity} />
        )}

        {activeTab === 'pico' && (
          <PICOView project={project} />
        )}
      </main>
    </div>
  );
}

// Stat Box Component
function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${active
        ? 'bg-blue-100 text-blue-700'
        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
        }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

// Workflow View Component
function WorkflowView({
  tools,
  stats,
  getToolStatus,
  navigateToTool
}: {
  tools: typeof TOOLS;
  stats: ProjectStats | null;
  getToolStatus: (tool: typeof TOOLS[0]) => string;
  navigateToTool: (tool: typeof TOOLS[0]) => void;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    pink: 'bg-pink-50 border-pink-200 text-pink-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700'
  };

  // Group tools into main workflow and auxiliary
  const mainWorkflow = tools.filter(t => t.phase <= 8);
  const auxiliary = tools.filter(t => t.phase > 8);

  return (
    <div className="space-y-8">
      {/* Main Workflow */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Main Workflow</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mainWorkflow.map((tool, index) => {
            if (!tool || !tool.icon) {
              console.error('Invalid tool at index', index, tool);
              return null;
            }
            const status = getToolStatus(tool);
            const Icon = tool.icon;
            const statValue = tool.statKey ? stats?.[tool.statKey as keyof ProjectStats] : null;

            return (
              <div
                key={tool.id}
                onClick={() => navigateToTool(tool)}
                className={`relative p-4 rounded-lg border-2 transition-all ${status === 'locked'
                  ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                  : status === 'active'
                    ? `${colorClasses[tool.color]} cursor-pointer hover:shadow-md`
                    : 'bg-white border-gray-200 cursor-pointer hover:border-gray-300 hover:shadow-md'
                  }`}
              >
                {/* Phase Badge */}
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-gray-700 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {tool.phase}
                </div>

                {/* Status Icon */}
                <div className="absolute top-2 right-2">
                  {status === 'locked' ? (
                    <Lock className="w-4 h-4 text-gray-400" />
                  ) : status === 'active' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Play className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                <div className="flex items-start gap-3 mt-2">
                  <div className={`p-2 rounded-lg ${status === 'locked' ? 'bg-gray-100' : `bg-${tool.color}-100`
                    }`}>
                    <Icon className={`w-5 h-5 ${status === 'locked' ? 'text-gray-400' : `text-${tool.color}-600`
                      }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{tool.name}</h4>
                    <p className="text-sm text-gray-500 truncate">{tool.description}</p>
                    {statValue !== null && statValue !== undefined && (
                      <p className="text-sm font-medium mt-1">
                        {typeof statValue === 'number' ? statValue.toLocaleString() : statValue} {tool.statLabel}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress indicator for tools with progress */}
                {tool.progressKey && stats?.[tool.progressKey as keyof ProjectStats] !== undefined && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-${tool.color}-500 rounded-full`}
                        style={{ width: `${stats[tool.progressKey as keyof ProjectStats]}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Auxiliary Tools */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Auxiliary Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {auxiliary.map(tool => {
            if (!tool || !tool.icon) {
              console.error('Invalid auxiliary tool', tool);
              return null;
            }
            const status = getToolStatus(tool);
            const Icon = tool.icon;

            return (
              <div
                key={tool.id}
                onClick={() => navigateToTool(tool)}
                className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${colorClasses[tool.color]
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${tool.color}-100`}>
                    <Icon className={`w-5 h-5 text-${tool.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{tool.name}</h4>
                    <p className="text-sm text-gray-500">{tool.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workflow Diagram */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Diagram</h3>
        <div className="overflow-x-auto">
          <pre className="text-sm text-gray-600 font-mono">
            {`
1. Literature Search ──→ 2. Deduplication ──→ 3. Screening
                                                    ↓
6. Citation Chaining ←── 5. Search Monitor    4. Data Extraction
                                                    ↓
                                              5. Risk of Bias
                                                    ↓
                                              6. Meta-Analysis
                                                    ↓
                                              7. GRADE Tables
                                                    ↓
                                              8. PRISMA Flow
`}
          </pre>
        </div>
      </div>
    </div>
  );
}

// Activity View Component
function ActivityView({ activity }: { activity: ActivityItem[] }) {
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      project_created: 'Created project',
      paper_added: 'Added papers',
      paper_screened: 'Screened paper',
      data_extracted: 'Extracted data',
      rob_assessed: 'Assessed risk of bias',
      meta_analysis_run: 'Ran meta-analysis',
      grade_assessed: 'Rated evidence',
      member_invited: 'Invited team member',
      conflict_resolved: 'Resolved screening conflict'
    };
    return labels[action] || action;
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, any> = {
      project_created: FileDown,
      paper_added: Database,
      paper_screened: Filter,
      data_extracted: Database,
      rob_assessed: Shield,
      meta_analysis_run: BarChart3,
      grade_assessed: Table2,
      member_invited: Users,
      conflict_resolved: CheckCircle
    };
    return icons[action] || Activity;
  };

  if (activity.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No activity yet</h3>
        <p className="text-gray-500">Activity will appear here as you work on this project.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {activity.map(item => {
        const Icon = getActionIcon(item.action);

        return (
          <div key={item.id} className="p-4 flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Icon className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">
                {getActionLabel(item.action)}
                {item.details?.count && ` (${item.details.count})`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDate(item.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// PICO View Component
function PICOView({ project }: { project: Project }) {
  const picoItems = [
    { label: 'Population', value: project.pico_population, color: 'blue' },
    { label: 'Intervention', value: project.pico_intervention, color: 'green' },
    { label: 'Comparison', value: project.pico_comparison, color: 'orange' },
    { label: 'Outcome', value: project.pico_outcome, color: 'purple' }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">PICO Framework</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {picoItems.map(item => (
          <div
            key={item.label}
            className={`p-4 rounded-lg bg-${item.color}-50 border border-${item.color}-200`}
          >
            <h4 className={`font-medium text-${item.color}-700 mb-2`}>
              {item.label} ({item.label[0]})
            </h4>
            <p className="text-gray-700">
              {item.value || <span className="text-gray-400 italic">Not specified</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Research Question */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-700 mb-2">Research Question</h4>
        <p className="text-gray-900">
          {project.pico_population && project.pico_intervention && project.pico_outcome ? (
            <>
              In <strong>{project.pico_population}</strong>,
              does <strong>{project.pico_intervention}</strong>
              {project.pico_comparison && <> compared to <strong>{project.pico_comparison}</strong></>}
              affect <strong>{project.pico_outcome}</strong>?
            </>
          ) : (
            <span className="text-gray-400 italic">
              Complete PICO fields to generate research question
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

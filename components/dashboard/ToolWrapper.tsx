// ToolWrapper.tsx
// Wraps individual tools with project context and navigation
// Provides consistent header and project data to all 10 tools

import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronRight, Home, Search, GitBranch, Filter,
  Database, Shield, BarChart3, Table2, FileDown, Bell, Link2
} from 'lucide-react';

// Project Context
interface ProjectContextType {
  projectId: string;
  project: Project | null;
  stats: ProjectStats | null;
  refreshStats: () => Promise<void>;
  logActivity: (action: string, entityType?: string, entityId?: string, details?: any) => Promise<void>;
}

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
  settings: any;
}

interface ProjectStats {
  total_papers: number;
  unique_papers: number;
  papers_screened: number;
  papers_included: number;
  papers_extracted: number;
  rob_assessed: number;
  grade_assessed: number;
  overall_progress: number;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ToolWrapper');
  }
  return context;
};

// Tool configuration
const TOOL_CONFIG: Record<string, { name: string; icon: any; phase: number }> = {
  search: { name: 'Literature Search', icon: Search, phase: 1 },
  dedupe: { name: 'Deduplication', icon: GitBranch, phase: 2 },
  screen: { name: 'Screening', icon: Filter, phase: 3 },
  extract: { name: 'Data Extraction', icon: Database, phase: 4 },
  rob: { name: 'Risk of Bias', icon: Shield, phase: 5 },
  meta: { name: 'Meta-Analysis', icon: BarChart3, phase: 6 },
  grade: { name: 'GRADE Tables', icon: Table2, phase: 7 },
  prisma: { name: 'PRISMA Flow', icon: FileDown, phase: 8 },
  monitor: { name: 'Search Monitor', icon: Bell, phase: 9 },
  citations: { name: 'Citation Chaining', icon: Link2, phase: 10 }
};

interface ToolWrapperProps {
  toolId: string;
  children: React.ReactNode;
}

export default function ToolWrapper({ toolId, children }: ToolWrapperProps) {
  const { projectId } = useParams() as { projectId: string };
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);

  const toolConfig = TOOL_CONFIG[toolId];

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    } else {
      setLoading(false);
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      const { data: projectData, error } = await supabase
        .from('research_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(projectData);

      const { data: statsData } = await supabase
        .from('project_stats')
        .select('*')
        .eq('project_id', projectId)
        .single();

      setStats(statsData);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async () => {
    if (!projectId) return;

    // Call the database function to recalculate stats
    await supabase.rpc('update_project_stats', { p_project_id: projectId });

    // Fetch updated stats
    const { data } = await supabase
      .from('project_stats')
      .select('*')
      .eq('project_id', projectId)
      .single();

    setStats(data);
  };

  const logActivity = async (
    action: string,
    entityType?: string,
    entityId?: string,
    details?: any
  ) => {
    if (!projectId) return;

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.rpc('log_project_activity', {
      p_project_id: projectId,
      p_user_id: user?.id,
      p_action: action,
      p_entity_type: entityType || null,
      p_entity_id: entityId || null,
      p_details: details || {}
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Standalone mode (no project)
  if (!projectId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <StandaloneHeader toolConfig={toolConfig} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    );
  }

  // Project mode
  return (
    <ProjectContext.Provider value={{
      projectId,
      project,
      stats,
      refreshStats,
      logActivity
    }}>
      <div className="min-h-screen bg-gray-50">
        <ProjectHeader
          project={project}
          toolConfig={toolConfig}
          stats={stats}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </ProjectContext.Provider>
  );
}

// Standalone Header (no project context)
function StandaloneHeader({
  toolConfig
}: {
  toolConfig: { name: string; icon: any; phase: number }
}) {
  const router = useRouter();
  const Icon = toolConfig.icon;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          <button
            onClick={() => router.push('/research')}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 mr-4"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{toolConfig.name}</h1>
              <p className="text-sm text-gray-500">Standalone Mode</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// Project Header (with project context)
function ProjectHeader({
  project,
  toolConfig,
  stats
}: {
  project: Project | null;
  toolConfig: { name: string; icon: any; phase: number };
  stats: ProjectStats | null;
}) {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string; // Access from params object safely
  const Icon = toolConfig.icon;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 py-2 text-sm">
          <button
            onClick={() => router.push('/research')}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => router.push(`/research/project/${projectId}`)}
            className="text-gray-500 hover:text-gray-700 truncate max-w-[200px]"
          >
            {project?.title || 'Project'}
          </button>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium">{toolConfig.name}</span>
        </div>

        {/* Main Header */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/research/project/${projectId}`)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{toolConfig.name}</h1>
                <p className="text-sm text-gray-500">Phase {toolConfig.phase}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {stats && (
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="font-semibold text-gray-900">{stats.unique_papers || 0}</p>
                <p className="text-gray-500">Papers</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">{stats.papers_included || 0}</p>
                <p className="text-gray-500">Included</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-blue-600">{stats.overall_progress?.toFixed(0) || 0}%</p>
                <p className="text-gray-500">Progress</p>
              </div>
            </div>
          )}

          {/* Tool Quick Nav */}
          <ToolQuickNav currentTool={Object.keys(TOOL_CONFIG).find(k => TOOL_CONFIG[k] === toolConfig) || ''} />
        </div>
      </div>
    </header>
  );
}

// Quick navigation between tools
function ToolQuickNav({ currentTool }: { currentTool: string }) {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;
  const [showMenu, setShowMenu] = useState(false);

  const tools = Object.entries(TOOL_CONFIG).map(([id, config]) => ({
    id,
    ...config
  }));

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
      >
        <span className="text-sm">Tools</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-90' : ''}`} />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            {tools.map(tool => {
              const Icon = tool.icon;
              const isCurrent = tool.id === currentTool;

              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    router.push(`/research/project/${projectId}/${tool.id}`);
                    setShowMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left ${isCurrent
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1">{tool.name}</span>
                  <span className="text-xs text-gray-400">{tool.phase}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Export helper hook for tools to access project context
export function useProjectContext() {
  return useContext(ProjectContext);
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Project {
    id: string;
    title: string;
    description: string;
    status: string;
    settings: any;
    created_at: string;
    updated_at: string;
    overall_progress?: number;
    total_papers?: number;
    unique_papers?: number;
    papers_screened?: number;
    papers_included?: number;
    papers_extracted?: number;
    team_count?: number;
    pico_population?: string;
    pico_intervention?: string;
    pico_comparison?: string;
    pico_outcome?: string;
    review_type?: any;
}

export interface ProjectStats {
    total_papers: number;
    unique_papers: number;
    papers_screened: number;
    papers_included: number;
    papers_extracted: number;
    overall_progress: number;
}

export function useProjectData(projectId: string | undefined) {
    const [project, setProject] = useState<Project | null>(null);
    const [stats, setStats] = useState<ProjectStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchProject = useCallback(async () => {
        if (!projectId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const { data: projectData, error: projectError } = await supabase
                .from('research_projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (projectError) throw projectError;
            setProject(projectData);

            const { data: statsData } = await supabase
                .from('project_stats')
                .select('*')
                .eq('project_id', projectId)
                .single();

            setStats(statsData);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchProject();
    }, [fetchProject]);

    const refreshStats = useCallback(async () => {
        if (!projectId) return;

        await supabase.rpc('update_project_stats', { p_project_id: projectId });

        const { data } = await supabase
            .from('project_stats')
            .select('*')
            .eq('project_id', projectId)
            .single();

        setStats(data);
    }, [projectId]);

    const updateProject = useCallback(async (updates: Partial<Project>) => {
        if (!projectId) return;

        const { error } = await supabase
            .from('research_projects')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', projectId);

        if (!error) {
            setProject(prev => prev ? { ...prev, ...updates } : null);
        }

        return { error };
    }, [projectId]);

    return {
        project,
        stats,
        loading,
        error,
        refreshProject: fetchProject,
        refreshStats,
        updateProject
    };
}

export function useProjectPapers(projectId: string | undefined) {
    const [papers, setPapers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 50,
        total: 0
    });

    const fetchPapers = useCallback(async (options?: {
        page?: number;
        filter?: 'all' | 'included' | 'excluded' | 'maybe' | 'unscreened';
        search?: string;
    }) => {
        if (!projectId) return;

        const page = options?.page || 1;
        const from = (page - 1) * pagination.pageSize;
        const to = from + pagination.pageSize - 1;

        let query = supabase
            .from('research_papers')
            .select('*, screening_decisions(*)', { count: 'exact' })
            .eq('project_id', projectId)
            .eq('is_duplicate', false)
            .range(from, to)
            .order('created_at', { ascending: false });

        if (options?.search) {
            query = query.or(`title.ilike.%${options.search}%,authors.ilike.%${options.search}%`);
        }

        const { data, count, error } = await query;

        if (!error) {
            setPapers(data || []);
            setPagination(prev => ({ ...prev, page, total: count || 0 }));
        }

        setLoading(false);
    }, [projectId, pagination.pageSize]);

    useEffect(() => {
        fetchPapers();
    }, [fetchPapers]);

    return {
        papers,
        loading,
        pagination,
        fetchPapers,
        setPagination
    };
}

export function useActivityLog(projectId: string | undefined) {
    const [activity, setActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchActivity = useCallback(async (limit = 20) => {
        if (!projectId) return;

        const { data, error } = await supabase
            .from('project_activity')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!error) {
            setActivity(data || []);
        }

        setLoading(false);
    }, [projectId]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    const logActivity = useCallback(async (
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

        // Refresh activity list
        fetchActivity();
    }, [projectId, fetchActivity]);

    return {
        activity,
        loading,
        logActivity,
        refreshActivity: fetchActivity
    };
}

export function useTeamMembers(projectId: string | undefined) {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMembers = useCallback(async () => {
        if (!projectId) return;

        const { data, error } = await supabase
            .from('project_members')
            .select(`
        *,
        user:user_id (
          id,
          email,
          raw_user_meta_data
        )
      `)
            .eq('project_id', projectId)
            .order('invited_at', { ascending: true });

        if (!error) {
            setMembers(data || []);
        }

        setLoading(false);
    }, [projectId]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const inviteMember = useCallback(async (email: string, role: 'reviewer' | 'viewer') => {
        if (!projectId) return { error: new Error('No project ID') };

        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from('project_members')
            .insert({
                project_id: projectId,
                invited_email: email,
                role,
                invited_by: user?.id
            });

        if (!error) {
            fetchMembers();
        }

        return { error };
    }, [projectId, fetchMembers]);

    const updateMemberRole = useCallback(async (memberId: string, role: 'reviewer' | 'viewer') => {
        const { error } = await supabase
            .from('project_members')
            .update({ role })
            .eq('id', memberId);

        if (!error) {
            fetchMembers();
        }

        return { error };
    }, [fetchMembers]);

    const removeMember = useCallback(async (memberId: string) => {
        const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('id', memberId);

        if (!error) {
            fetchMembers();
        }

        return { error };
    }, [fetchMembers]);

    return {
        members,
        loading,
        inviteMember,
        updateMemberRole,
        removeMember,
        refreshMembers: fetchMembers
    };
}

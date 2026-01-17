import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  review_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  total_papers?: number;
  unique_papers?: number;
  papers_screened?: number;
  papers_included?: number;
  papers_extracted?: number;
  overall_progress?: number;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      
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
        setError('Unable to load projects. You can still use all tools below.');
        setProjects([]);
        return;
      }
      
      setProjects(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Unable to load projects. You can still use all tools below.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refetch: fetchProjects };
}


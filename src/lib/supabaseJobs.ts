import { supabase } from './supabaseClient';
import type { Job } from '../types';

/**
 * Supabase helper for the `jobs` table.
 * All functions are async and throw on error so callers can handle failures.
 */
export const Jobs = {
  /** Retrieve all jobs */
  async list(): Promise<Job[]> {
    const { data, error } = await supabase.from('jobs').select('*');
    if (error) throw error;
    return data as Job[];
  },

  /** Get a single job by its ID */
  async get(id: string): Promise<Job | null> {
    const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (error) {
      // If not found, return null instead of throwing
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as Job;
  },

  /** Create a new job record */
  async create(job: Omit<Job, 'id' | 'created_at' | 'updated_at'>): Promise<Job> {
    const { data, error } = await supabase.from('jobs').insert(job).single();
    if (error) throw error;
    return data as Job;
  },

  /** Update an existing job */
  async update(id: string, updates: Partial<Job>): Promise<Job> {
    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Job;
  },

  /** Delete a job */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) throw error;
  },
};

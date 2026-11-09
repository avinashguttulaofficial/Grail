import React, { useState, useEffect, useMemo } from 'react';
import { HimalayasService, HimalayasRawJob } from '../../services/himalayas';
import { DataStore } from '../../services/store';
import { Job } from '../../types';
import {
  Globe,
  Download,
  CheckCircle2,
  ExternalLink,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Clock,
  RotateCcw,
  MapPin,
  Tag,
  DollarSign,
  ArrowUpDown,
  Check,
  Edit3,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Play,
  AlertCircle,
  Trash2,
  Calendar,
  Zap,
  History,
  Power,
  Terminal,
  CheckSquare,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  SchedulerClientService,
  SchedulerTaskKey,
  SchedulerTaskSummary,
  SchedulerRunItem,
  SchedulerJobErrorItem,
  SchedulerOverviewStats,
} from '../../services/scheduler';

export const AdminHimalayasPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<HimalayasRawJob[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedSlugs, setImportedSlugs] = useState<Set<string>>(new Set());
  const [existingDbJobs, setExistingDbJobs] = useState<Job[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [streamingMore, setStreamingMore] = useState(false);

  // Status Filter for Table: all, sync (ready to sync / unimported), imported
  const [syncStatusFilter, setSyncStatusFilter] = useState<'all' | 'sync' | 'imported'>('all');

  // Filter state for batch sync
  const [searchTerm, setSearchTerm] = useState('');
  const [seniorityFilter, setSeniorityFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [timezoneFilter, setTimezoneFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState<'all' | 'recent' | 'oldest' | 'salary' | 'salary_asc' | 'relevant' | 'company' | 'title'>('all');
  const [batchSyncLimit, setBatchSyncLimit] = useState<number>(5);

  // Edit Job Modal State
  const [editingJob, setEditingJob] = useState<HimalayasRawJob | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    companyName: '',
    seniority: 'Mid-level',
    minSalary: '',
    maxSalary: '',
    currency: 'USD',
    location: '',
    employmentType: 'Full Time',
    applicationLink: '',
    excerpt: '',
  });

  // Scheduler Dashboard State
  const [schedulerTasks, setSchedulerTasks] = useState<SchedulerTaskSummary[]>([]);
  const [schedulerOverview, setSchedulerOverview] = useState<SchedulerOverviewStats | null>(null);
  const [schedulerRuns, setSchedulerRuns] = useState<SchedulerRunItem[]>([]);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [schedulerActionKey, setSchedulerActionKey] = useState<string | null>(null);
  const [serverTimeIst, setServerTimeIst] = useState<string>('');
  const [selectedRunForErrors, setSelectedRunForErrors] = useState<SchedulerRunItem | null>(null);
  const [runErrors, setRunErrors] = useState<SchedulerJobErrorItem[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [showRetentionConfirmModal, setShowRetentionConfirmModal] = useState(false);

  const loadSchedulerData = async () => {
    setSchedulerLoading(true);
    try {
      const res = await SchedulerClientService.getStatus();
      setSchedulerTasks(res.tasks || []);
      setSchedulerOverview(res.overview || null);
      setServerTimeIst(res.currentServerTimeIst || '');
      const runs = await SchedulerClientService.getRuns(undefined, 20);
      setSchedulerRuns(runs);
      const syncedCount = await SchedulerClientService.syncBackgroundJobs();
      if (syncedCount > 0) {
        refreshExistingDbJobs();
      }
    } catch (e) {
      console.warn('Failed to load scheduler data:', e);
    } finally {
      setSchedulerLoading(false);
    }
  };

  const handleToggleScheduler = async (taskKey: SchedulerTaskKey, currentEnabled: boolean) => {
    setSchedulerActionKey(taskKey);
    try {
      await SchedulerClientService.toggleTask(taskKey, !currentEnabled);
      await loadSchedulerData();
      setNotice(`Updated schedule status for ${taskKey}.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert(`Toggle failed: ${err.message}`);
    } finally {
      setSchedulerActionKey(null);
    }
  };

  const handleTriggerTask = async (taskKey: SchedulerTaskKey) => {
    if (taskKey === 'task_e_retention' && !showRetentionConfirmModal) {
      setShowRetentionConfirmModal(true);
      return;
    }
    setShowRetentionConfirmModal(false);
    setSchedulerActionKey(taskKey);
    try {
      const run = await SchedulerClientService.triggerRun(taskKey);
      await loadSchedulerData();
      refreshExistingDbJobs();
      setNotice(
        `Task completed (${run.status}): ${run.synced_count} processed, ${run.duplicate_count} skipped, ${run.failed_count} errors.`
      );
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      alert(`Run failed: ${err.message}`);
    } finally {
      setSchedulerActionKey(null);
    }
  };

  const handleViewRunErrors = async (run: SchedulerRunItem) => {
    setSelectedRunForErrors(run);
    setLoadingErrors(true);
    try {
      const errs = await SchedulerClientService.getRunErrors(run.id);
      setRunErrors(errs);
    } catch (e) {
      setRunErrors([]);
    } finally {
      setLoadingErrors(false);
    }
  };

  const refreshExistingDbJobs = () => {
    try {
      const dbList = DataStore.getJobs();
      setExistingDbJobs(dbList);
    } catch (e) {
      console.warn('Failed to read DataStore jobs:', e);
    }
  };

  const isJobImported = (job: HimalayasRawJob): boolean => {
    const key = job.companySlug + job.title;
    if (importedSlugs.has(key)) return true;
    return existingDbJobs.some(
      (dbJob) =>
        dbJob.title.toLowerCase().trim() === job.title.toLowerCase().trim() ||
        (job.guid && dbJob.external_application_url === job.guid) ||
        (job.applicationLink && dbJob.external_application_url === job.applicationLink)
    );
  };

  const getImportedDbJob = (job: HimalayasRawJob): Job | undefined => {
    return existingDbJobs.find(
      (dbJob) =>
        dbJob.title.toLowerCase().trim() === job.title.toLowerCase().trim() ||
        (job.guid && dbJob.external_application_url === job.guid) ||
        (job.applicationLink && dbJob.external_application_url === job.applicationLink)
    );
  };

  const loadHimalayasFeed = async () => {
    setLoading(true);
    try {
      // Fetch multi-page live stream feed (~100 jobs across 5 pages) for rich filtering & batch sync
      const res = await HimalayasService.fetchJobs({ limit: 20, pages: 5 });
      setJobs(res.jobs);
      setTotalCount(res.totalCount);
      setCursor(res.nextCursor);
    } catch (err) {
      console.error('Failed to load Himalayas live feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamMore = async () => {
    if (!cursor || streamingMore) return;
    setStreamingMore(true);
    try {
      const res = await HimalayasService.fetchJobs({ cursor, pages: 3 });
      setJobs((prev) => [...prev, ...res.jobs]);
      setCursor(res.nextCursor);
      setNotice(`Streamed ${res.jobs.length} additional live vacancies into feed.`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      console.error('Failed to stream more vacancies:', err);
    } finally {
      setStreamingMore(false);
    }
  };

  useEffect(() => {
    loadHimalayasFeed();
    refreshExistingDbJobs();
    loadSchedulerData();
  }, []);

  const handleImportSingle = async (job: HimalayasRawJob) => {
    setImportingId(job.guid || job.title);
    try {
      HimalayasService.importJob(job);
      setImportedSlugs((prev) => new Set(prev).add(job.companySlug + job.title));
      refreshExistingDbJobs();
      setNotice(`Imported "${job.title}" by ${job.companyName} directly into Grail Jobs board.`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImportingId(null);
    }
  };

  // Resilient, deep filter and sort logic across live stream
  const filteredJobs = useMemo(() => {
    const list = jobs.filter((j) => {
      const titleLower = (j.title || '').toLowerCase();
      const companyLower = (j.companyName || '').toLowerCase();
      const catList = (j.categories || []).map((c) => c.replace(/-/g, ' ').toLowerCase());
      const parentList = (j.parentCategories || []).map((p) => p.toLowerCase());
      const allCategoryText = [...catList, ...parentList, titleLower].join(' ');

      // 1. Text Search (title, company, category, or location)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = titleLower.includes(q);
        const matchesCompany = companyLower.includes(q);
        const matchesCategory = allCategoryText.includes(q);
        const matchesLocation = (j.locationRestrictions || []).some((l) => l.toLowerCase().includes(q));
        if (!matchesTitle && !matchesCompany && !matchesCategory && !matchesLocation) return false;
      }

      // 2. Seniority (Experience Level) - matches both seniority tags and title markers
      if (seniorityFilter !== 'all') {
        const senList = (j.seniority || []).map((s) => s.toLowerCase());
        if (seniorityFilter === 'senior') {
          const matchSen = senList.some((s) => s.includes('senior') || s.includes('lead') || s.includes('principal') || s.includes('director') || s.includes('staff'));
          const matchTitle = titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('principal') || titleLower.includes('staff');
          if (!matchSen && !matchTitle) return false;
        } else if (seniorityFilter === 'mid') {
          const matchSen = senList.some((s) => s.includes('mid') || s.includes('intermediate'));
          const matchTitle = !titleLower.includes('junior') && !titleLower.includes('senior') && !titleLower.includes('lead') && !titleLower.includes('intern') && !titleLower.includes('director') && !titleLower.includes('vp');
          if (!matchSen && !(senList.length === 0 && matchTitle)) return false;
        } else if (seniorityFilter === 'junior' || seniorityFilter === 'entry') {
          const matchSen = senList.some((s) => s.includes('junior') || s.includes('entry') || s.includes('associate'));
          const matchTitle = titleLower.includes('junior') || titleLower.includes('entry') || titleLower.includes('associate') || titleLower.includes('jr.');
          if (!matchSen && !matchTitle) return false;
        } else if (seniorityFilter === 'freshers') {
          const matchSen = senList.some((s) => s.includes('intern') || s.includes('fresher') || s.includes('graduate') || s.includes('entry'));
          const matchTitle = titleLower.includes('intern') || titleLower.includes('fresher') || titleLower.includes('graduate') || titleLower.includes('trainee') || titleLower.includes('entry');
          if (!matchSen && !matchTitle) return false;
        } else if (seniorityFilter === 'lead') {
          const matchSen = senList.some((s) => s.includes('lead') || s.includes('director') || s.includes('head') || s.includes('executive') || s.includes('vp') || s.includes('chief'));
          const matchTitle = titleLower.includes('lead') || titleLower.includes('head') || titleLower.includes('director') || titleLower.includes('vp ') || titleLower.includes('vp,') || titleLower.includes('vice president') || titleLower.includes('chief');
          if (!matchSen && !matchTitle) return false;
        }
      }

      // 3. Location Restrictions (Array of countries; empty array or worldwide = worldwide)
      if (locationFilter !== 'all') {
        if (locationFilter === 'worldwide') {
          const hasSpecific = j.locationRestrictions && j.locationRestrictions.length > 0;
          const mentionsWorldwide = (j.locationRestrictions || []).some((l) => l.toLowerCase().includes('worldwide') || l.toLowerCase().includes('anywhere'));
          if (hasSpecific && !mentionsWorldwide) return false;
        } else {
          const locs = (j.locationRestrictions || []).map((l) => l.toLowerCase());
          const target = locationFilter.toLowerCase();
          const matchesCountry = locs.some((l) => l.includes(target) || (target === 'united states' && (l === 'us' || l === 'usa')));
          if (!matchesCountry) return false;
        }
      }

      // 4. Timezone Restrictions (Array of accepted timezone offsets; empty array = all timezones)
      if (timezoneFilter !== 'all') {
        const tzList = j.timezoneRestrictions || [];
        if (tzList.length > 0) {
          if (timezoneFilter === 'americas') {
            if (!tzList.some((tz) => tz >= -10 && tz <= -4)) return false;
          } else if (timezoneFilter === 'europe_africa') {
            if (!tzList.some((tz) => tz >= -1 && tz <= 4)) return false;
          } else if (timezoneFilter === 'asia_pacific') {
            if (!tzList.some((tz) => tz >= 5 && tz <= 14)) return false;
          } else {
            const numTz = parseFloat(timezoneFilter);
            if (!isNaN(numTz) && !tzList.includes(numTz)) return false;
          }
        }
      }

      // 5. Categories (De-hyphenated categories, parent categories, or role title keywords)
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'design') {
          if (!allCategoryText.match(/(design|creative|ui|ux|graphic|visual|art|product designer|animat|figma|brand)/)) return false;
        } else if (categoryFilter === 'engineering') {
          if (!allCategoryText.match(/(engineer|developer|software|frontend|backend|full-stack|full stack|architect|devops|data|qa|tech|cloud|sysadmin|security|code)/)) return false;
        } else if (categoryFilter === 'product') {
          if (!allCategoryText.match(/(product manager|product lead|product owner|scrum|product analyst|program manager)/)) return false;
        } else if (categoryFilter === 'marketing') {
          if (!allCategoryText.match(/(market|content|growth|seo|brand|copywrit|social media|community|pr|acquisition)/)) return false;
        } else if (categoryFilter === 'sales') {
          if (!allCategoryText.match(/(sale|account executive|account manager|bdr|sdr|business develop|revenue|partnership)/)) return false;
        } else if (categoryFilter === 'operations') {
          if (!allCategoryText.match(/(operat|support|success|customer|people|hr|talent|recruit|admin|legal|finance|accountant|compliance)/)) return false;
        }
      }

      // 6. Employment Type
      if (employmentTypeFilter !== 'all') {
        const rawType = (j.employmentType || '').toLowerCase();
        if (employmentTypeFilter === 'full-time' && !rawType.includes('full')) return false;
        if (employmentTypeFilter === 'contract' && !rawType.includes('contract')) return false;
        if (employmentTypeFilter === 'part-time' && !rawType.includes('part')) return false;
        if (employmentTypeFilter === 'freelance' && !rawType.includes('freelance')) return false;
        if (employmentTypeFilter === 'internship' && !rawType.includes('intern')) return false;
      }

      return true;
    });

    // 7. Listing Order & Ranking: all listing order (default feed), most recent, salary, oldest, alphabetical
    if (sortFilter === 'all') {
      // Natural stream order as fetched from Himalayas feed
    } else if (sortFilter === 'recent') {
      list.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
    } else if (sortFilter === 'oldest') {
      list.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0));
    } else if (sortFilter === 'salary') {
      list.sort((a, b) => (b.maxSalary || b.minSalary || 0) - (a.maxSalary || a.minSalary || 0));
    } else if (sortFilter === 'salary_asc') {
      list.sort((a, b) => (a.minSalary || a.maxSalary || 0) - (b.minSalary || b.maxSalary || 0));
    } else if (sortFilter === 'company') {
      list.sort((a, b) => a.companyName.localeCompare(b.companyName));
    } else if (sortFilter === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortFilter === 'relevant' && searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list.sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(q) ? 2 : 0;
        const bTitle = b.title.toLowerCase().includes(q) ? 2 : 0;
        return bTitle - aTitle;
      });
    }

    return list;
  }, [jobs, searchTerm, seniorityFilter, locationFilter, timezoneFilter, categoryFilter, employmentTypeFilter, sortFilter]);

  // Execute batch sync with filtered items
  const handleBatchSync = async (countOverride?: number) => {
    const limit = countOverride ?? batchSyncLimit;
    const candidates = filteredJobs.slice(0, limit);
    if (candidates.length === 0) {
      alert('No jobs match the current filter selection to sync.');
      return;
    }

    setLoading(true);
    let count = 0;
    try {
      for (const item of candidates) {
        HimalayasService.importJob(item);
        setImportedSlugs((prev) => new Set(prev).add(item.companySlug + item.title));
        count++;
      }
      refreshExistingDbJobs();
      setNotice(`Batch synced ${count} remote positions matching your active filters into Grail Jobs.`);
      setTimeout(() => setNotice(null), 6000);
    } catch (err: any) {
      alert(`Batch sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter jobs by sync status (all, ready to sync, imported)
  const displayedJobs = useMemo(() => {
    return filteredJobs.filter((job) => {
      const imported = isJobImported(job);
      if (syncStatusFilter === 'imported') return imported;
      if (syncStatusFilter === 'sync') return !imported;
      return true; // 'all'
    });
  }, [filteredJobs, syncStatusFilter, importedSlugs, existingDbJobs]);

  // Table pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, seniorityFilter, locationFilter, timezoneFilter, categoryFilter, employmentTypeFilter, sortFilter, syncStatusFilter]);

  const totalPages = Math.ceil(displayedJobs.length / itemsPerPage) || 1;
  const activePage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedHimalayasJobs = useMemo(() => {
    return displayedJobs.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);
  }, [displayedJobs, activePage, itemsPerPage]);

  const handlePageChange = (newPage: number) => {
    const clamped = Math.min(Math.max(newPage, 1), totalPages);
    setCurrentPage(clamped);
  };

  const getPaginationNumbers = (current: number, total: number) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  const statusCounts = useMemo(() => {
    let imported = 0;
    let readyToSync = 0;
    filteredJobs.forEach((j) => {
      if (isJobImported(j)) imported++;
      else readyToSync++;
    });
    return {
      all: filteredJobs.length,
      readyToSync,
      imported,
    };
  }, [filteredJobs, importedSlugs, existingDbJobs]);

  const handleOpenEditJobListing = (job: HimalayasRawJob) => {
    let dbJob = getImportedDbJob(job);
    if (!dbJob) {
      // Auto-import vacancy to assign a unique ID, then open Edit Job Listing
      const { job: importedJob } = HimalayasService.importJob(job);
      setImportedSlugs((prev) => new Set(prev).add(job.companySlug + job.title));
      refreshExistingDbJobs();
      navigate(`/admin/jobs/${importedJob.id}/edit`);
    } else {
      navigate(`/admin/jobs/${dbJob.id}/edit`);
    }
  };

  const handleOpenEditModal = (job: HimalayasRawJob) => {
    setEditingJob(job);
    setEditForm({
      title: job.title || '',
      companyName: job.companyName || '',
      seniority: job.seniority?.[0] || 'Mid-level',
      minSalary: job.minSalary ? String(job.minSalary) : '',
      maxSalary: job.maxSalary ? String(job.maxSalary) : '',
      currency: job.currency || 'USD',
      location: (job.locationRestrictions || []).join(', ') || 'Worldwide',
      employmentType: job.employmentType || 'Full Time',
      applicationLink: job.applicationLink || job.guid || '',
      excerpt: job.excerpt || job.description || '',
    });
  };

  const handleSaveEdit = (syncToBoard: boolean = false) => {
    if (!editingJob) return;

    const locRestrictions = editForm.location.trim()
      ? editForm.location.split(',').map((s) => s.trim()).filter((s) => s.toLowerCase() !== 'worldwide')
      : [];

    const updatedJob: HimalayasRawJob = {
      ...editingJob,
      title: editForm.title.trim() || editingJob.title,
      companyName: editForm.companyName.trim() || editingJob.companyName,
      seniority: editForm.seniority ? [editForm.seniority] : editingJob.seniority,
      minSalary: editForm.minSalary ? Number(editForm.minSalary) : null,
      maxSalary: editForm.maxSalary ? Number(editForm.maxSalary) : null,
      currency: editForm.currency,
      locationRestrictions: locRestrictions,
      employmentType: editForm.employmentType,
      applicationLink: editForm.applicationLink.trim() || editingJob.applicationLink,
      excerpt: editForm.excerpt.trim() || editingJob.excerpt,
    };

    // Update in memory jobs stream
    setJobs((prev) =>
      prev.map((j) => {
        const matchesGuid = j.guid && editingJob.guid && j.guid === editingJob.guid;
        const matchesName = j.companySlug === editingJob.companySlug && j.title === editingJob.title;
        return matchesGuid || matchesName ? updatedJob : j;
      })
    );

    const existingDbJob = getImportedDbJob(editingJob);

    if (existingDbJob) {
      DataStore.updateJob(existingDbJob.id, {
        title: updatedJob.title,
        salary_min: updatedJob.minSalary || undefined,
        salary_max: updatedJob.maxSalary || undefined,
        salary_currency: updatedJob.currency || 'USD',
        location: updatedJob.locationRestrictions?.length
          ? `Remote (${updatedJob.locationRestrictions.join(', ')})`
          : 'Remote Worldwide',
        external_application_url: updatedJob.applicationLink,
        experience_level: updatedJob.seniority?.[0]?.toLowerCase().includes('senior')
          ? 'senior'
          : updatedJob.seniority?.[0]?.toLowerCase().includes('lead')
          ? 'lead'
          : updatedJob.seniority?.[0]?.toLowerCase().includes('fresher')
          ? 'freshers'
          : updatedJob.seniority?.[0]?.toLowerCase().includes('junior')
          ? 'entry'
          : 'mid',
      });
      refreshExistingDbJobs();
      setNotice(`Updated "${updatedJob.title}" in Grail Jobs database.`);
    } else if (syncToBoard) {
      HimalayasService.importJob(updatedJob);
      setImportedSlugs((prev) => new Set(prev).add(updatedJob.companySlug + updatedJob.title));
      refreshExistingDbJobs();
      setNotice(`Saved & synced "${updatedJob.title}" directly to Grail Jobs board.`);
    } else {
      setNotice(`Updated details for "${updatedJob.title}" in live stream feed.`);
    }

    setEditingJob(null);
    setTimeout(() => setNotice(null), 4000);
  };

  const activeFiltersCount = [
    Boolean(searchTerm.trim()),
    seniorityFilter !== 'all',
    locationFilter !== 'all',
    timezoneFilter !== 'all',
    categoryFilter !== 'all',
    employmentTypeFilter !== 'all',
    sortFilter !== 'all',
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchTerm('');
    setSeniorityFilter('all');
    setLocationFilter('all');
    setTimezoneFilter('all');
    setCategoryFilter('all');
    setEmploymentTypeFilter('all');
    setSortFilter('all');
    setSyncStatusFilter('all');
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Extension Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-semibold">
              Himalayas Plugin Extension · Connected
            </span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-neutral-900 uppercase tracking-tight">
            Himalayas Remote Jobs Sync
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Synchronize live remote opportunities directly from{' '}
            <a
              href="https://github.com/Himalayas-App/himalayas-plugin"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-900 underline font-mono"
            >
              Himalayas-App/himalayas-plugin
            </a>
          </p>
        </div>

        {/* Action button toolbar - resized to match UI with unified h-9 height */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadHimalayasFeed}
            disabled={loading}
            className="h-9 px-3.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
            title="Refresh feed from Himalayas live stream"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Feed</span>
          </button>

          <div className="h-9 flex items-center rounded-lg border border-neutral-900 bg-[#121212] text-white shadow-xs overflow-hidden shrink-0">
            <select
              value={batchSyncLimit}
              onChange={(e) => setBatchSyncLimit(Number(e.target.value))}
              className="h-full bg-neutral-900 text-white text-xs px-2.5 border-r border-neutral-800 focus:outline-none font-mono cursor-pointer"
              title="Number of filtered roles to sync"
            >
              <option value={5}>Sync 5</option>
              <option value={10}>Sync 10</option>
              <option value={20}>Sync 20</option>
              <option value={filteredJobs.length || 50}>All ({filteredJobs.length})</option>
            </select>

            <button
              onClick={() => handleBatchSync()}
              disabled={loading || filteredJobs.length === 0}
              className="h-full px-3.5 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Batch Sync Filtered ({Math.min(batchSyncLimit, filteredJobs.length)})</span>
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-neutral-900 text-white text-xs font-mono rounded-lg shadow-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <Link to="/admin/jobs" className="underline text-emerald-400 text-[11px] hover:text-white">
            View on Jobs Board →
          </Link>
        </div>
      )}

      {/* Network Stats Card */}
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white p-6 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
            Himalayas Network Pool
          </span>
          <span className="font-display font-black text-3xl">
            {totalCount ? totalCount.toLocaleString() : '114,000+'}
          </span>
          <span className="text-[11px] text-neutral-400 block mt-1">Verified remote vacancies</span>
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
            Batch Sync Filters
          </span>
          <span className="font-display font-bold text-xl block">
            {activeFiltersCount === 0 ? 'No Filters (All)' : `${activeFiltersCount} Active Filters`}
          </span>
          <span className="text-[11px] text-neutral-400 block mt-1">
            {filteredJobs.length} roles matching current criteria
          </span>
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
            Target Destination
          </span>
          <span className="font-display font-bold text-xl block">Grail Jobs Database</span>
          <Link
            to="/admin/jobs"
            className="text-[11px] text-emerald-400 underline block mt-1 hover:text-emerald-300"
          >
            Review all imported listings →
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Automated Himalayas Scheduler & Lifecycle Management Section  */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                Autonomous Background Scheduler & Lifecycle Engine
              </span>
            </div>
            <h2 className="font-display font-black text-xl text-neutral-900 uppercase tracking-tight">
              Feed Automation & Retention Schedulers
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Persistent server-side scheduling running independently of admin browser sessions. Free plan compatible via Supabase & pg_cron.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-[11px] font-mono text-neutral-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>IST: {serverTimeIst || 'Asia/Kolkata'}</span>
            </div>
            <button
              type="button"
              onClick={loadSchedulerData}
              disabled={schedulerLoading}
              className="h-8 px-3 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${schedulerLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Overview Metrics Strip (8 core metrics) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Total Synced</span>
            <span className="font-display font-black text-lg text-neutral-900">{schedulerOverview?.totalImported ?? '0'}</span>
            <span className="text-[10px] text-neutral-400 block">Himalayas jobs</span>
          </div>

          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Imported Today</span>
            <span className="font-display font-black text-lg text-emerald-600">+{schedulerOverview?.importedToday ?? '0'}</span>
            <span className="text-[10px] text-neutral-400 block">New positions</span>
          </div>

          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Updated Today</span>
            <span className="font-display font-black text-lg text-neutral-800">{schedulerOverview?.updatedToday ?? '0'}</span>
            <span className="text-[10px] text-neutral-400 block">Source refreshed</span>
          </div>

          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Duplicates</span>
            <span className="font-display font-black text-lg text-neutral-700">{schedulerOverview?.duplicatesSkipped ?? '0'}</span>
            <span className="text-[10px] text-neutral-400 block">Safely skipped</span>
          </div>

          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Failed Imports</span>
            <span className={`font-display font-black text-lg ${(schedulerOverview?.failedImports || 0) > 0 ? 'text-red-600' : 'text-neutral-500'}`}>
              {schedulerOverview?.failedImports ?? '0'}
            </span>
            <span className="text-[10px] text-neutral-400 block">Errors logged</span>
          </div>

          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Expired Jobs</span>
            <span className="font-display font-black text-lg text-amber-600">{schedulerOverview?.expiredJobs ?? '0'}</span>
            <span className="text-[10px] text-neutral-400 block">Past deadline</span>
          </div>

          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Retention Cleaned</span>
            <span className="font-display font-black text-lg text-neutral-700">{schedulerOverview?.retentionDeleted ?? '0'}</span>
            <span className="text-[10px] text-neutral-400 block">Aged &gt;3 months</span>
          </div>

          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-0.5">Next Run</span>
            <span className="font-mono font-bold text-xs text-neutral-800 truncate block mt-1">
              {schedulerOverview?.nextScheduledSync
                ? new Date(schedulerOverview.nextScheduledSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
                : 'Active'}
            </span>
            <span className="text-[10px] text-neutral-400 block">Automatic tick</span>
          </div>
        </div>

        {/* 5 Scheduler Task Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {schedulerTasks.map((task) => {
            const isActing = schedulerActionKey === task.taskKey;
            const lastStatus = task.lastRun?.status || 'never';
            const istTimeDesc = task.configurationJson?.istTime || task.scheduleExpression;

            return (
              <div
                key={task.taskKey}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                  task.enabled ? 'bg-white border-neutral-200 hover:border-neutral-300' : 'bg-neutral-50/60 border-neutral-200/60 opacity-80'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 bg-neutral-100 text-neutral-700 font-bold rounded">
                      {task.taskKey.replace('task_', 'TASK ').replace('_', ' ').toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleScheduler(task.taskKey, task.enabled)}
                      disabled={isActing}
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                        task.enabled
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                      }`}
                      title={task.enabled ? 'Click to disable scheduler' : 'Click to enable scheduler'}
                    >
                      <Power className="w-2.5 h-2.5" />
                      <span>{task.enabled ? 'Enabled' : 'Disabled'}</span>
                    </button>
                  </div>

                  {/* Task Title & Schedule */}
                  <h3 className="font-display font-bold text-sm text-neutral-900 leading-snug">
                    {task.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono">
                    <Clock className="w-3 h-3 text-neutral-400 shrink-0" />
                    <span>{istTimeDesc}</span>
                  </div>

                  {/* Next Execution */}
                  <div className="mt-2 text-[10px] text-neutral-500 font-mono bg-neutral-50 px-2 py-1 rounded border border-neutral-100">
                    <span className="text-neutral-400 block">Next Run (IST):</span>
                    <span className="font-semibold text-neutral-800">
                      {new Date(task.nextExecutionTime).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Last Run Stats */}
                  <div className="mt-3 pt-3 border-t border-neutral-100 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400 text-[10px] uppercase font-mono">Last Run</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                          lastStatus === 'success'
                            ? 'bg-emerald-100 text-emerald-700'
                            : lastStatus === 'partial_success'
                            ? 'bg-amber-100 text-amber-700'
                            : lastStatus === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {lastStatus}
                      </span>
                    </div>

                    {task.lastRun ? (
                      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono pt-1 text-neutral-600">
                        <div>
                          <span className="text-neutral-400">Synced: </span>
                          <span className="font-semibold text-neutral-900">{task.lastRun.synced_count}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">Skipped: </span>
                          <span className="font-semibold text-neutral-900">{task.lastRun.duplicate_count}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">Fetched: </span>
                          <span className="font-semibold text-neutral-900">{task.lastRun.fetched_count}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">Errors: </span>
                          <span className={`font-semibold ${task.lastRun.failed_count > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                            {task.lastRun.failed_count}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-400 italic block pt-1">No prior run recorded</span>
                    )}
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="pt-4 mt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => handleTriggerTask(task.taskKey)}
                    disabled={isActing}
                    className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs ${
                      task.taskKey === 'task_e_retention'
                        ? 'bg-neutral-900 hover:bg-neutral-800 text-white'
                        : task.taskKey === 'task_d_expiry'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-[#121212] hover:bg-neutral-800 text-white'
                    } disabled:opacity-50`}
                  >
                    {isActing ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : task.taskKey === 'task_e_retention' ? (
                      <Trash2 className="w-3 h-3" />
                    ) : task.taskKey === 'task_d_expiry' ? (
                      <Calendar className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                    <span>
                      {isActing
                        ? 'Executing...'
                        : task.taskKey === 'task_e_retention'
                        ? 'Run Retention Cleanup'
                        : task.taskKey === 'task_d_expiry'
                        ? 'Run Expiry Check'
                        : 'Run Now'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Execution Runs History Table */}
        <div className="pt-4 border-t border-neutral-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-neutral-500" />
              <h3 className="font-display font-bold text-sm text-neutral-900 uppercase tracking-tight">
                Recent Scheduler Execution Runs
              </h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">
              Showing latest {schedulerRuns.length} runs
            </span>
          </div>

          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 font-mono uppercase text-[10px] text-neutral-500 tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Task Name</th>
                  <th className="py-2.5 px-3">Started (IST)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Fetched</th>
                  <th className="py-2.5 px-3 text-right">Matched</th>
                  <th className="py-2.5 px-3 text-right">Synced</th>
                  <th className="py-2.5 px-3 text-right">Duplicates</th>
                  <th className="py-2.5 px-3 text-right">Failed</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                {schedulerRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-neutral-400 italic font-sans text-xs">
                      No scheduler runs recorded yet. Use &ldquo;Run Now&rdquo; to execute a task immediately.
                    </td>
                  </tr>
                ) : (
                  schedulerRuns.map((r) => {
                    const taskName =
                      r.task_key === 'task_a_nightly'
                        ? 'Nightly Himalayas Import'
                        : r.task_key === 'task_b_morning'
                        ? 'Morning Himalayas Import'
                        : r.task_key === 'task_c_india'
                        ? 'India-Eligible Jobs'
                        : r.task_key === 'task_d_expiry'
                        ? 'Job Expiry Check'
                        : r.task_key === 'task_e_retention'
                        ? 'Job Retention Cleanup'
                        : r.task_key;

                    return (
                      <tr key={r.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-semibold text-neutral-900">
                          {taskName}
                          <span className="block font-mono text-[9px] text-neutral-400 font-normal">{r.task_key}</span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600">
                          {new Date(r.started_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              r.status === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'partial_success'
                                ? 'bg-amber-100 text-amber-800'
                                : r.status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800 animate-pulse'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-neutral-600">{r.fetched_count}</td>
                        <td className="py-2.5 px-3 text-right text-neutral-600">{r.matched_count}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">+{r.synced_count}</td>
                        <td className="py-2.5 px-3 text-right text-neutral-500">{r.duplicate_count}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={r.failed_count > 0 ? 'text-red-600 font-bold' : 'text-neutral-400'}>
                            {r.failed_count}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.failed_count > 0 || r.error_message ? (
                            <button
                              type="button"
                              onClick={() => handleViewRunErrors(r)}
                              className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-[10px] font-semibold transition-colors"
                            >
                              View Errors
                            </button>
                          ) : (
                            <span className="text-neutral-400 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Batch Sync Filter Control Panel */}
      <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs space-y-4">
        {/* Top search & stream continuation header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search live stream by keyword, role, studio, or skill..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-50 rounded-lg text-xs border border-neutral-200 focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
            <span className="text-[11px] font-mono text-neutral-500">
              <strong className="text-neutral-900">{filteredJobs.length}</strong> matching of {jobs.length} loaded
            </span>

            {cursor && (
              <button
                onClick={handleStreamMore}
                disabled={streamingMore}
                className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                title="Stream next batch of live vacancies from Himalayas cursor"
              >
                <RefreshCw className={`w-3 h-3 ${streamingMore ? 'animate-spin' : ''}`} />
                <span>{streamingMore ? 'Streaming...' : 'Stream +60'}</span>
              </button>
            )}

            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* 6 Specialized Filter Dropdowns matching exact user requirements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* 1. Seniority (Experience Level) */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
              Seniority (Experience Level)
            </label>
            <select
              value={seniorityFilter}
              onChange={(e) => setSeniorityFilter(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 p-2 rounded-lg text-neutral-800 text-xs focus:border-neutral-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Seniorities</option>
              <option value="senior">Senior Level</option>
              <option value="mid">Mid-Level</option>
              <option value="junior">Junior / Entry Level</option>
              <option value="freshers">Freshers / Graduate (0-1 yr)</option>
              <option value="lead">Lead / Principal / Executive</option>
            </select>
          </div>

          {/* 2. Location Restrictions */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
              Location Restrictions
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 p-2 rounded-lg text-neutral-800 text-xs focus:border-neutral-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Locations (Any)</option>
              <option value="worldwide">Worldwide (No Restrictions / Empty Array)</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Germany">Germany</option>
              <option value="France">France</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
              <option value="India">India</option>
              <option value="Spain">Spain</option>
              <option value="Brazil">Brazil</option>
              <option value="Singapore">Singapore</option>
            </select>
          </div>

          {/* 3. Timezone Restrictions */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
              Timezone Restrictions
            </label>
            <select
              value={timezoneFilter}
              onChange={(e) => setTimezoneFilter(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 p-2 rounded-lg text-neutral-800 text-xs focus:border-neutral-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Timezones (Worldwide)</option>
              <option value="americas">Americas (UTC-10 to UTC-4)</option>
              <option value="europe_africa">Europe & Africa (UTC-1 to UTC+4)</option>
              <option value="asia_pacific">Asia & Pacific (UTC+5 to UTC+14)</option>
              <option value="-8">UTC-8 (US Pacific / PST)</option>
              <option value="-5">UTC-5 (US Eastern / EST)</option>
              <option value="0">UTC+0 (London / GMT)</option>
              <option value="1">UTC+1 / UTC+2 (CET / Europe)</option>
              <option value="5.5">UTC+5:30 (India / IST)</option>
            </select>
          </div>

          {/* 4. Categories */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
              Job Categories
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 p-2 rounded-lg text-neutral-800 text-xs focus:border-neutral-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="design">Design / UX / UI / Motion</option>
              <option value="engineering">Engineering / Software / Web</option>
              <option value="product">Product Management</option>
              <option value="marketing">Marketing & Growth</option>
              <option value="sales">Sales & Business Development</option>
              <option value="operations">Operations & Customer Support</option>
            </select>
          </div>

          {/* 5. Employment Type */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
              Employment Type
            </label>
            <select
              value={employmentTypeFilter}
              onChange={(e) => setEmploymentTypeFilter(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 p-2 rounded-lg text-neutral-800 text-xs focus:border-neutral-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Employment Types</option>
              <option value="full-time">Full-Time</option>
              <option value="contract">Contractor / Contract</option>
              <option value="part-time">Part-Time</option>
              <option value="freelance">Freelance</option>
              <option value="internship">Internship / Freshers</option>
            </select>
          </div>

          {/* 6. Latest Listing Sorting */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
              Listing Order & Ranking
            </label>
            <select
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value as any)}
              className="w-full bg-neutral-50 border border-neutral-200 p-2 rounded-lg text-neutral-800 text-xs focus:border-neutral-900 focus:outline-none cursor-pointer font-medium"
            >
              <option value="all">All Listings (Original Listing Order)</option>
              <option value="recent">Most Recent (Newest First)</option>
              <option value="oldest">Oldest Listings First</option>
              <option value="salary">Highest Compensation (High to Low)</option>
              <option value="salary_asc">Lowest Compensation (Low to High)</option>
              <option value="relevant">Most Relevant</option>
              <option value="company">Company Name (A–Z)</option>
              <option value="title">Role Title (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Quick batch sync status action bar - filters feed from Himalayas into batch */}
        <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-neutral-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                <strong>{filteredJobs.length}</strong> roles filtered into batch
              </span>
            </div>
            <span className="hidden sm:inline text-neutral-300">·</span>
            <span className="text-[11px] text-neutral-500 font-mono">
              Order: {sortFilter === 'all' ? 'All Listings (Feed Order)' : sortFilter === 'recent' ? 'Most Recent' : sortFilter === 'oldest' ? 'Oldest First' : sortFilter === 'salary' ? 'Highest Salary' : sortFilter === 'salary_asc' ? 'Lowest Salary' : sortFilter === 'company' ? 'Company A-Z' : sortFilter === 'title' ? 'Title A-Z' : 'Most Relevant'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1">
              <span className="text-[10px] font-mono text-neutral-500 uppercase">Batch:</span>
              <select
                value={batchSyncLimit}
                onChange={(e) => setBatchSyncLimit(Number(e.target.value))}
                className="bg-transparent text-neutral-800 text-xs font-mono font-medium focus:outline-none cursor-pointer"
                title="Select batch size"
              >
                <option value={5}>5 roles</option>
                <option value={10}>10 roles</option>
                <option value={20}>20 roles</option>
                <option value={50}>50 roles</option>
                <option value={filteredJobs.length || 100}>All Filtered ({filteredJobs.length})</option>
              </select>
            </div>

            {filteredJobs.length > 0 && (
              <button
                onClick={() => handleBatchSync(filteredJobs.length)}
                disabled={loading}
                className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-800 transition-colors"
                title="Sync all jobs currently filtered"
              >
                Sync All Filtered ({filteredJobs.length})
              </button>
            )}

            <button
              onClick={() => handleBatchSync()}
              disabled={loading || filteredJobs.length === 0}
              className="px-4 py-1.5 bg-[#121212] hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              title="Batch sync top positions according to selected listing order"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Batch Sync Filtered ({Math.min(batchSyncLimit, filteredJobs.length)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Stream Table - Clean 5 columns */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
        {/* Table header with filter for imported, sync (ready to sync), and all */}
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-neutral-900 text-xs">
              Live Stream Feed ({displayedJobs.length} of {jobs.length} loaded)
            </h3>
            {sortFilter === 'all' && (
              <span className="text-[10px] font-mono text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                All Listings (Feed Order)
              </span>
            )}
            {sortFilter === 'recent' && (
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Sorted by Latest
              </span>
            )}
            {sortFilter === 'oldest' && (
              <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Sorted by Oldest
              </span>
            )}
            {sortFilter === 'salary' && (
              <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Sorted by Salary (High-Low)
              </span>
            )}
            {sortFilter === 'salary_asc' && (
              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Sorted by Salary (Low-High)
              </span>
            )}
            {sortFilter === 'company' && (
              <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Sorted by Company (A-Z)
              </span>
            )}
            {sortFilter === 'title' && (
              <span className="text-[10px] font-mono text-pink-700 bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                Sorted by Title (A-Z)
              </span>
            )}
            {sortFilter === 'relevant' && (
              <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                Sorted by Relevance
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter for imported, sync (ready to sync), and all */}
            <div className="inline-flex p-0.5 bg-neutral-200/80 rounded-lg text-xs font-medium">
              <button
                onClick={() => setSyncStatusFilter('all')}
                className={`px-3 py-1 rounded-md text-[11px] transition-all flex items-center gap-1.5 ${
                  syncStatusFilter === 'all'
                    ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Show all vacancies matching current criteria"
              >
                <span>All</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${syncStatusFilter === 'all' ? 'bg-neutral-100 text-neutral-900 font-mono font-bold' : 'text-neutral-500'}`}>
                  {statusCounts.all}
                </span>
              </button>

              <button
                onClick={() => setSyncStatusFilter('sync')}
                className={`px-3 py-1 rounded-md text-[11px] transition-all flex items-center gap-1.5 ${
                  syncStatusFilter === 'sync'
                    ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Show vacancies ready to be synced into Grail Jobs"
              >
                <span>Ready to Sync</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${syncStatusFilter === 'sync' ? 'bg-neutral-100 text-neutral-900 font-mono font-bold' : 'text-neutral-500'}`}>
                  {statusCounts.readyToSync}
                </span>
              </button>

              <button
                onClick={() => setSyncStatusFilter('imported')}
                className={`px-3 py-1 rounded-md text-[11px] transition-all flex items-center gap-1.5 ${
                  syncStatusFilter === 'imported'
                    ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Show vacancies already imported into Grail Jobs"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Imported</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${syncStatusFilter === 'imported' ? 'bg-emerald-50 text-emerald-700 font-mono font-bold' : 'text-neutral-500'}`}>
                  {statusCounts.imported}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-neutral-100 border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-600">
              <span className="text-[11px] font-mono text-neutral-500 whitespace-nowrap">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-semibold text-neutral-900 border-none focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={70}>70</option>
              </select>
            </div>

            <span className="text-[11px] font-mono text-neutral-400 hidden xl:inline">Source: himalayas.app</span>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-xs text-neutral-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-neutral-600" />
            <p>Fetching and filtering remote vacancies from Himalayas...</p>
          </div>
        ) : displayedJobs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 font-mono text-neutral-500 uppercase text-[10px]">
                  <th className="py-3 px-4">Role & Studio</th>
                  <th className="py-3 px-4">Seniority</th>
                  <th className="py-3 px-4">Compensation</th>
                  <th className="py-3 px-4">Location Scope</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginatedHimalayasJobs.map((job, idx) => {
                  const isImported = isJobImported(job);
                  const isBusy = importingId === (job.guid || job.title);

                  return (
                    <tr key={idx} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {job.companyLogo ? (
                            <img
                              src={job.companyLogo}
                              alt={job.companyName}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-neutral-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-neutral-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {job.companyName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-neutral-900 block truncate max-w-xs">{job.title}</span>
                            <span className="text-[11px] font-mono text-neutral-400 block truncate">
                              {job.companyName} · {job.employmentType || 'Remote'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-neutral-600">
                        <span className="px-2 py-0.5 bg-neutral-100 rounded text-neutral-700">
                          {job.seniority?.join(', ') || 'Mid-level'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-neutral-800">
                        {job.minSalary
                          ? `${job.currency || '$'}${job.minSalary.toLocaleString()} ${job.maxSalary && job.maxSalary !== job.minSalary ? `– ${job.maxSalary.toLocaleString()}` : ''}`
                          : 'Undisclosed'}
                      </td>

                      <td className="py-3.5 px-4 text-neutral-600 font-mono text-[11px]">
                        {job.locationRestrictions && job.locationRestrictions.length > 0 ? (
                          <span className="text-neutral-800">
                            {job.locationRestrictions.slice(0, 2).join(', ')}
                            {job.locationRestrictions.length > 2 ? ` (+${job.locationRestrictions.length - 2})` : ''}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Worldwide</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {job.applicationLink && (
                            <a
                              href={job.applicationLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors rounded hover:bg-neutral-100"
                              title="Direct Application Link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Edit Job Listing option */}
                          <button
                            onClick={() => handleOpenEditJobListing(job)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                            title="Edit Job Listing"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleImportSingle(job)}
                            disabled={isImported || isBusy}
                            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                              isImported
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                                : 'bg-[#121212] text-white hover:bg-neutral-800'
                            }`}
                          >
                            {isImported ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Imported</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                <span>{isBusy ? 'Importing...' : 'Sync'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-neutral-200 bg-neutral-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="font-mono text-neutral-500">
              {displayedJobs.length > 0 ? (
                <>
                  Showing <strong className="text-neutral-900 font-semibold">{(activePage - 1) * itemsPerPage + 1}</strong> to{' '}
                  <strong className="text-neutral-900 font-semibold">{Math.min(activePage * itemsPerPage, displayedJobs.length)}</strong> of{' '}
                  <strong className="text-neutral-900 font-semibold">{displayedJobs.length}</strong> listings
                  <span className="text-neutral-400 ml-1.5">(Page {activePage} of {totalPages})</span>
                </>
              ) : (
                <span>No listings</span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
                <button
                  onClick={() => handlePageChange(activePage - 1)}
                  disabled={activePage <= 1}
                  className="h-8 px-2.5 sm:px-3 border border-neutral-200 bg-white rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                {getPaginationNumbers(activePage, totalPages).map((item, idx) => {
                  if (item === '...') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-8 h-8 flex items-center justify-center text-xs font-mono text-neutral-400 select-none"
                      >
                        …
                      </span>
                    );
                  }
                  const p = item as number;
                  const isActive = p === activePage;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-mono font-semibold transition-all ${
                        isActive
                          ? 'bg-[#121212] text-white shadow-xs'
                          : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(activePage + 1)}
                  disabled={activePage >= totalPages}
                  className="h-8 px-2.5 sm:px-3 border border-neutral-200 bg-white rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs"
                  title="Next Page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-xs text-neutral-500 space-y-3">
            <p className="text-neutral-700 font-medium">
              {syncStatusFilter === 'imported'
                ? 'No imported positions match the current criteria.'
                : syncStatusFilter === 'sync'
                ? 'No unimported positions ready to sync match the current criteria.'
                : `No remote vacancies in current ${jobs.length} streamed jobs match your active filters.`}
            </p>
            <p className="text-[11px] text-neutral-400">
              The live stream has over {totalCount.toLocaleString()} total vacancies. You can pull more live positions or reset filters.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              {cursor && (
                <button
                  onClick={handleStreamMore}
                  disabled={streamingMore}
                  className="px-3.5 py-1.5 bg-[#121212] text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${streamingMore ? 'animate-spin' : ''}`} />
                  <span>Stream More Vacancies (+60)</span>
                </button>
              )}
              <button
                onClick={handleResetFilters}
                className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-medium transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-neutral-700" />
                <h3 className="font-display font-black text-base text-neutral-900 uppercase tracking-tight">
                  {isJobImported(editingJob) ? 'Edit Imported Job' : 'Edit Live Vacancy'}
                </h3>
              </div>
              <button
                onClick={() => setEditingJob(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                  Role Title
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-900 focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                    Company / Studio
                  </label>
                  <input
                    type="text"
                    value={editForm.companyName}
                    onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                    Seniority Level
                  </label>
                  <select
                    value={editForm.seniority}
                    onChange={(e) => setEditForm({ ...editForm, seniority: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
                  >
                    <option value="Senior">Senior</option>
                    <option value="Mid-level">Mid-level</option>
                    <option value="Junior">Junior / Entry</option>
                    <option value="Freshers">Freshers / Graduate</option>
                    <option value="Lead">Lead / Principal</option>
                    <option value="Executive">Director / Executive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                    Min Salary
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 90000"
                    value={editForm.minSalary}
                    onChange={(e) => setEditForm({ ...editForm, minSalary: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-800 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                    Max Salary
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 140000"
                    value={editForm.maxSalary}
                    onChange={(e) => setEditForm({ ...editForm, maxSalary: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-800 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                    Currency
                  </label>
                  <select
                    value={editForm.currency}
                    onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-800 focus:outline-none focus:border-neutral-900"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                    Employment Type
                  </label>
                  <select
                    value={editForm.employmentType}
                    onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
                  >
                    <option value="Full Time">Full-Time</option>
                    <option value="Contractor">Contract</option>
                    <option value="Part Time">Part-Time</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                    Location Scope
                  </label>
                  <input
                    type="text"
                    placeholder="Worldwide, or United States, Canada"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                  Application Link / External URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={editForm.applicationLink}
                  onChange={(e) => setEditForm({ ...editForm, applicationLink: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-800 focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="px-3 py-2 text-neutral-600 hover:text-neutral-900 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {!isJobImported(editingJob) && (
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(false)}
                    className="px-3.5 py-2 border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs font-medium transition-colors"
                  >
                    Update in Stream
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveEdit(!isJobImported(editingJob))}
                  className="px-4 py-2 bg-[#121212] hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isJobImported(editingJob) ? 'Save Changes' : 'Save & Sync to Board'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retention Cleanup Confirmation Modal */}
      {showRetentionConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-neutral-900">
                  Confirm Retention Cleanup
                </h3>
                <span className="text-[11px] font-mono text-neutral-500 uppercase">
                  Destructive Database Maintenance
                </span>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Permanent Job Deletion Policy</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                This will permanently delete eligible <strong>Himalayas-imported jobs</strong> that have been expired, filled, or archived for over <strong>3 months</strong> (after the later of closure date and most recent candidate application date).
              </p>
              <div className="p-2 bg-white/80 rounded border border-amber-300 text-[10px] font-mono text-amber-950">
                ✓ Guaranteed: Manually posted jobs (source: manual) and active published listings will <strong>NEVER</strong> be deleted.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRetentionConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleTriggerTask('task_e_retention')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm & Clean Eligible Jobs</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job-Level Errors Inspection Modal */}
      {selectedRunForErrors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-neutral-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-neutral-900">
                    Execution Errors & Audit Details
                  </h3>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Run ID: {selectedRunForErrors.id} · Task: {selectedRunForErrors.task_key}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRunForErrors(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedRunForErrors.error_message && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-mono text-red-700">
                <strong>Run Error:</strong> {selectedRunForErrors.error_message}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
                Failed Jobs Log ({runErrors.length})
              </h4>

              {loadingErrors ? (
                <div className="py-6 text-center text-xs text-neutral-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                  <span>Loading job error log...</span>
                </div>
              ) : runErrors.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-3 text-center bg-neutral-50 rounded-lg">
                  No individual job-level errors recorded for this run.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {runErrors.map((err) => (
                    <div key={err.id} className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1 font-mono">
                      <div className="flex items-center justify-between font-sans font-semibold text-neutral-900">
                        <span>{err.job_title}</span>
                        {err.external_job_id && (
                          <span className="text-[9px] font-mono text-neutral-400">ID: {err.external_job_id}</span>
                        )}
                      </div>
                      <p className="text-red-600 text-[11px]">{err.error_message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRunForErrors(null)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


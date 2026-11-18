import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Search, Bookmark, Shield, User, LogOut, LayoutDashboard, ChevronDown, Sparkles } from 'lucide-react';
import { DataStore } from '../../services/store';
import { Job } from '../../types';

// Curated fallback roles in case jobs are loading or empty
const FALLBACK_MARQUEE_JOBS: Array<{
  title: string;
  companyName: string;
  location: string;
  comp?: string;
  slug?: string;
}> = [
    {
      title: 'Senior Product Designer',
      companyName: 'Linear',
      location: 'Remote',
      comp: '$160k–$210k',
      slug: 'senior-product-designer-remote-linear',
    },
    {
      title: 'Creative Technologist (WebGL)',
      companyName: 'Supabase',
      location: 'Remote',
      comp: '$140k–$180k',
      slug: 'remote-creative-technologist-webgl-supabase',
    },
    {
      title: 'Design Systems Architect',
      companyName: 'Frontify',
      location: 'Hybrid · St. Gallen',
      comp: '130k–160k CHF',
      slug: 'lead-design-systems-architect-frontify',
    },
    {
      title: 'Senior UI/UX Designer',
      companyName: 'Storetasker',
      location: 'Remote · US',
      comp: '$90k–$130k',
      slug: 'senior-ui-ux-designer-ecommerce-storetasker',
    },
    {
      title: 'Art Director, Digital Campaigns',
      companyName: 'Pentagram',
      location: 'London · Hybrid',
      comp: '£75k–£95k',
      slug: 'art-director-digital-campaigns-17',
    },
    {
      title: 'Lead 3D Motion Specialist',
      companyName: 'Resn',
      location: 'Remote · NL',
      comp: '€85–€140/hr',
      slug: 'lead-3d-motion-specialist-19',
    },
  ];

export const Navbar: React.FC = () => {
  const { user, isAdmin, logout, switchDemoRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);

  // Load latest live jobs from the active store with subscriber reactivity
  useEffect(() => {
    const loadJobs = () => {
      try {
        const published = DataStore.getJobs().filter((j) => j.status === 'published');
        // Pick the 8-10 latest published listings
        const sorted = [...published].sort((a, b) => {
          const timeA = new Date(a.published_at || a.created_at).getTime();
          const timeB = new Date(b.published_at || b.created_at).getTime();
          return timeB - timeA;
        });
        setRecentJobs(sorted.slice(0, 10));
      } catch (err) {
        console.warn('Navbar ticker loadJobs error:', err);
      }
    };

    loadJobs();
    const unsubscribe = DataStore.subscribe(loadJobs);
    return unsubscribe;
  }, []);

  // Format compensation helper
  const formatCompensation = (job: Job) => {
    if (!job.salary_visible || (!job.salary_min && !job.salary_max)) return null;
    const curr = job.salary_currency === 'EUR' ? '€' : job.salary_currency === 'GBP' ? '£' : '$';
    const period = job.salary_period === 'hourly' ? '/hr' : job.salary_period === 'monthly' ? '/mo' : '';

    const formatNum = (n?: number) => {
      if (!n) return '';
      return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
    };

    if (job.salary_min && job.salary_max) {
      return `${curr}${formatNum(job.salary_min)}–${curr}${formatNum(job.salary_max)}${period}`;
    }
    if (job.salary_min) return `From ${curr}${formatNum(job.salary_min)}${period}`;
    if (job.salary_max) return `Up to ${curr}${formatNum(job.salary_max)}${period}`;
    return null;
  };

  // Prepare ticker items list with fallback
  const tickerItems = useMemo(() => {
    if (recentJobs.length > 0) {
      return recentJobs.map((j) => {
        const comp = formatCompensation(j);
        const loc = j.workplace_type === 'remote' ? 'Remote' : j.city || j.location || 'Hybrid';
        return {
          id: j.id,
          title: j.title,
          companyName: j.company?.name || 'Curated Studio',
          location: loc,
          comp,
          slug: j.slug,
        };
      });
    }
    return FALLBACK_MARQUEE_JOBS.map((f, i) => ({
      id: `fallback-${i}`,
      title: f.title,
      companyName: f.companyName,
      location: f.location,
      comp: f.comp || null,
      slug: f.slug,
    }));
  }, [recentJobs]);

  const savedCount = user ? DataStore.getSavedJobs(user.id).length : 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navLinks = [
    { name: 'Find Jobs', path: '/jobs' },
    { name: 'Companies', path: '/companies' },
    { name: 'Resources', path: '/resources' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#F8F9FA]/90 backdrop-blur-md border-b border-neutral-200">
      {/* Editorial Top Marquee / Live Jobs Ticker Bar */}
      <div className="bg-[#121212] text-white text-[11px] font-mono py-1.5 px-3 sm:px-4 flex items-center justify-between border-b border-neutral-900 select-none relative z-50">
        {/* Left Section: Live Pulse Badge + Infinite Marquee Track */}
        <div className="flex items-center min-w-0 flex-1 overflow-hidden mr-4">
          {/* Subtle Live Indicator Badge */}
          <div className="flex items-center gap-2 pr-3 sm:pr-4 border-r border-neutral-800 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 hidden sm:inline">
              LIVE ON GRAILJOBS
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 sm:hidden">
              LIVE
            </span>
          </div>

          {/* Marquee Overflow Container with Subtle Side Gradients */}
          <div className="relative overflow-hidden flex-1 mask-fade">
            <div className="animate-marquee flex items-center">
              {/* First Track Copy */}
              <div className="flex items-center gap-6 whitespace-nowrap shrink-0 pr-6">
                {tickerItems.map((item, idx) => (
                  <span key={`t1-${item.id}-${idx}`} className="flex items-center gap-2">
                    <span className="text-neutral-600">·</span>
                    <Link
                      to={item.slug ? `/jobs/${item.slug}` : '/jobs'}
                      className="group/item inline-flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors"
                    >
                      <span className="font-semibold text-white group-hover/item:underline underline-offset-2">
                        {item.title}
                      </span>
                      <span className="text-neutral-400">@{item.companyName}</span>
                      <span className="text-neutral-500 text-[10px]">
                        ({item.location}
                        {item.comp ? ` · ${item.comp}` : ''})
                      </span>
                    </Link>
                  </span>
                ))}
              </div>

              {/* Second Track Copy (Identical for seamless infinite scroll loop) */}
              <div className="flex items-center gap-6 whitespace-nowrap shrink-0 pr-6" aria-hidden="true">
                {tickerItems.map((item, idx) => (
                  <span key={`t2-${item.id}-${idx}`} className="flex items-center gap-2">
                    <span className="text-neutral-600">·</span>
                    <Link
                      to={item.slug ? `/jobs/${item.slug}` : '/jobs'}
                      tabIndex={-1}
                      className="group/item inline-flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors"
                    >
                      <span className="font-semibold text-white group-hover/item:underline underline-offset-2">
                        {item.title}
                      </span>
                      <span className="text-neutral-400">@{item.companyName}</span>
                      <span className="text-neutral-500 text-[10px]">
                        ({item.location}
                        {item.comp ? ` · ${item.comp}` : ''})
                      </span>
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          </div>




        </div>
      </div>

      {/* Primary Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (matching screenshot 1 & 5) */}
        <Link to="/" className="flex items-center gap-3 shrink-0 group">
          <div className="w-8 h-8 bg-[#121212] text-white flex items-center justify-center font-display font-black text-xl tracking-tighter rounded">
            W.
          </div>
          <span className="font-display font-black text-2xl tracking-tighter text-[#121212] group-hover:opacity-80 transition-opacity">
            GRAIL
          </span>
        </Link>

        {/* Zone 2: Navigation Links (single line, no wrapping) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${isActive
                  ? 'text-[#121212] font-semibold border-b-2 border-[#121212]'
                  : 'hover:text-[#121212]'
                  }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Search Input in Top Bar (matching screenshot 5) */}
        <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center relative w-64">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Jobs or Skills..."
            className="w-full bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white text-xs pl-9 pr-3 py-2 rounded-full border border-transparent focus:border-neutral-300 focus:outline-none transition-all placeholder:text-neutral-400"
          />
        </form>

        {/* Zone 3: Actions & User Account */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/saved-jobs"
                className="p-2 text-neutral-600 hover:text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors relative"
                title="Saved Jobs"
              >
                <Bookmark className="w-4 h-4" />
                {savedCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#121212] rounded-full ring-2 ring-white" />
                )}
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#121212] text-white rounded hover:bg-neutral-800 transition-colors tracking-tight"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Portal</span>
                </Link>
              )}

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100 rounded-full border border-neutral-200 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-[10px]">
                    {user.full_name.charAt(0)}
                  </div>
                  <span className="max-w-[90px] truncate hidden sm:inline">{user.full_name}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 z-50 text-xs">
                    <div className="px-4 py-2 border-b border-neutral-100">
                      <p className="font-semibold text-neutral-900 truncate">{user.full_name}</p>
                      <p className="text-neutral-500 truncate text-[11px]">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] uppercase font-mono px-1.5 py-0.5 bg-neutral-100 text-neutral-700 rounded">
                        {user.role}
                      </span>
                    </div>

                    <Link
                      to="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-neutral-700 hover:bg-neutral-50"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Dashboard Overview</span>
                    </Link>

                    <Link
                      to="/dashboard/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-neutral-700 hover:bg-neutral-50"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Candidate Profile</span>
                    </Link>

                    <Link
                      to="/dashboard/applications"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-neutral-700 hover:bg-neutral-50"
                    >
                      <span>My Applications</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-neutral-900 font-semibold hover:bg-neutral-100 border-t border-neutral-100"
                      >
                        <Shield className="w-3.5 h-3.5 text-neutral-900" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}

                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 border-t border-neutral-100 text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:text-black transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#121212] rounded hover:bg-neutral-800 transition-colors whitespace-nowrap"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

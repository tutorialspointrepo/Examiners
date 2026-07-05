import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faChevronLeft,
  faChevronRight,
  faBriefcase,
  faLocationDot,
  faClock,
  faFilter,
  faChevronDown,
  faChevronUp,
  faSpinner,
  faChevronsLeft,
  faChevronsRight,
  faHeart as faHeartSolid,
  faMoneyBill,
  faBuilding,
  faHouse,
} from '@fortawesome/sharp-light-svg-icons';
import { faHeart } from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';

// ============================================
// TYPES
// ============================================
export interface Job {
  id: string;
  jobId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  via: string;
  scheduleType: string;
  isRemote: boolean;
  category: string;
  salary: string | null;
  postedAt: string;
  firstSeen: any;
  lastSeen: any;
  postedTimestamp: any;
  scrapedDate: string;
  status: string;
  applyOptions: { source: string; link: string }[];
  shareLink: string;
  qualifications: string;
  highlights: any[];
  thumbnail: string | null;
}

interface JobListingProps {
  brandTheme: {
    colors: {
      primary: string;
      secondary: string;
    };
    gradients: {
      primary: string;
    };
  };
  onJobSelect: (job: Job | null) => void;
  selectedJob: Job | null;
  onCollapse?: () => void;
  currentUser?: any;
}

// ============================================
// HELPERS
// ============================================
const getTimeAgo = (timestamp: any): string => {
  if (!timestamp) return 'Recently';
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  } catch {
    return 'Recently';
  }
};

// ============================================
// CATEGORIES
// ============================================
const JOB_CATEGORIES = [
  { id: null, name: 'All Categories' },
  { id: 'IT & Software', name: 'IT & Software' },
  { id: 'Data Science & AI', name: 'Data Science & AI' },
  { id: 'Finance & Accounting', name: 'Finance & Accounting' },
  { id: 'Marketing & Sales', name: 'Marketing & Sales' },
  { id: 'HR & Admin', name: 'HR & Admin' },
  { id: 'Operations & Management', name: 'Operations & Management' },
  { id: 'Engineering', name: 'Engineering' },
  { id: 'Management & Consulting', name: 'Management & Consulting' },
  { id: 'Fresher Jobs', name: 'Fresher Jobs' },
  { id: 'Work From Home', name: 'Work From Home' },
  { id: 'Internship', name: 'Internship' },
];

// ============================================
// COMPONENT
// ============================================
const JobListing: React.FC<JobListingProps> = ({
  brandTheme,
  onJobSelect,
  selectedJob,
  onCollapse,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'remote' | 'saved'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Data states
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [, setLastDoc] = useState<any>(null);
  const [pageCache, setPageCache] = useState<Map<number, { jobs: Job[]; lastDoc: any }>>(new Map());
  const jobsPerPage = 10;

  // Saved jobs
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track filter changes
  const [filterVersion, setFilterVersion] = useState(0);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setPageCache(new Map());
    setLastDoc(null);
    setFilterVersion(v => v + 1);
  }, [selectedCategory, selectedFilter, debouncedSearchQuery]);

  // Load saved jobs for current user
  const currentUserId = currentUser?.userId || currentUser?.uid || '';

  useEffect(() => {
    const loadSavedJobs = async () => {
      if (!currentUserId) return;
      try {
        const ids = await firebaseService.getSavedJobIds(currentUserId);
        setSavedJobIds(ids);
      } catch (err) {
        console.error('Error loading saved jobs:', err);
      }
    };
    loadSavedJobs();
  }, [currentUserId]);

  // Fetch jobs from Firebase with server-side pagination
  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Handle "Saved" filter separately
        if (selectedFilter === 'saved') {
          if (!currentUserId || savedJobIds.size === 0) {
            setJobs([]);
            setTotalJobs(0);
            setIsLoading(false);
            return;
          }

          const savedIds = Array.from(savedJobIds);
          const result = await firebaseService.getJobsByIds(savedIds);

          let savedJobs: Job[] = result.map((jobData: any) => ({
            id: jobData.id,
            jobId: jobData.jobId || '',
            title: jobData.title || '',
            company: jobData.company || '',
            location: jobData.location || '',
            description: jobData.description || '',
            via: jobData.via || '',
            scheduleType: jobData.scheduleType || '',
            isRemote: jobData.isRemote || false,
            category: jobData.category || '',
            salary: jobData.salary || null,
            postedAt: jobData.postedAt || '',
            firstSeen: jobData.firstSeen,
            lastSeen: jobData.lastSeen,
            postedTimestamp: jobData.postedTimestamp || jobData.firstSeen,
            scrapedDate: jobData.scrapedDate || '',
            status: jobData.status || 'active',
            applyOptions: jobData.applyOptions || [],
            shareLink: jobData.shareLink || '',
            qualifications: jobData.qualifications || '',
            highlights: jobData.highlights || [],
            thumbnail: jobData.thumbnail || null,
          }));

          // Apply search filter (split into words, remove stop words)
          if (debouncedSearchQuery) {
            const stopWords = new Set(['in', 'at', 'for', 'the', 'a', 'an', 'of', 'and', 'or', 'to', 'is', 'on', 'with', 'by', 'from', 'near', 'jobs', 'job']);
            const searchWords = debouncedSearchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
            const finalWords = searchWords.length > 0 ? searchWords : debouncedSearchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
            savedJobs = savedJobs.filter(j => {
              const combined = [j.title, j.company, j.location].join(' ').toLowerCase();
              return finalWords.every(word => combined.includes(word));
            });
          }

          // Apply category filter
          if (selectedCategory) {
            savedJobs = savedJobs.filter(j => j.category === selectedCategory);
          }

          setTotalJobs(savedJobs.length);
          // Client-side pagination for saved jobs
          const startIdx = (currentPage - 1) * jobsPerPage;
          setJobs(savedJobs.slice(startIdx, startIdx + jobsPerPage));
          setLastDoc(null);
          setIsLoading(false);
          return;
        }

        // Get cursor from previous page cache
        const previousPageCache = currentPage > 1 ? pageCache.get(currentPage - 1) : null;
        const startAfterDoc = previousPageCache?.lastDoc || null;

        // If we have a cached version of this exact page, use it directly
        const cachedPage = pageCache.get(currentPage);
        if (cachedPage) {
          setJobs(cachedPage.jobs);
          setLastDoc(cachedPage.lastDoc);
          setTotalJobs(prev => prev); // keep existing total
          setIsLoading(false);
          return;
        }

        const result = await firebaseService.getJobsPaginated({
          category: selectedCategory || undefined,
          isRemote: selectedFilter === 'remote' ? true : undefined,
          limit: jobsPerPage,
          orderBy: 'postedTimestamp',
          orderDirection: 'desc',
          startAfterDoc: startAfterDoc,
          // When no cursor available (non-sequential jump), pass offset so service can skip records
          offset: !startAfterDoc && currentPage > 1 ? (currentPage - 1) * jobsPerPage : undefined,
          searchQuery: debouncedSearchQuery.length > 0 ? debouncedSearchQuery : undefined,
        });

        // Transform to Job type
        const transformedJobs: Job[] = result.jobs.map((jobData: any) => ({
          id: jobData.id,
          jobId: jobData.jobId || '',
          title: jobData.title || '',
          company: jobData.company || '',
          location: jobData.location || '',
          description: jobData.description || '',
          via: jobData.via || '',
          scheduleType: jobData.scheduleType || '',
          isRemote: jobData.isRemote || false,
          category: jobData.category || '',
          salary: jobData.salary || null,
          postedAt: jobData.postedAt || '',
          firstSeen: jobData.firstSeen,
          lastSeen: jobData.lastSeen,
          postedTimestamp: jobData.postedTimestamp || jobData.firstSeen,
          scrapedDate: jobData.scrapedDate || '',
          status: jobData.status || 'active',
          applyOptions: jobData.applyOptions || [],
          shareLink: jobData.shareLink || '',
          qualifications: jobData.qualifications || '',
          highlights: jobData.highlights || [],
          thumbnail: jobData.thumbnail || null,
        }));

        setTotalJobs(result.totalCount);
        setLastDoc(result.lastDoc);

        // Cache this page
        setPageCache(prev => new Map(prev).set(currentPage, {
          jobs: transformedJobs,
          lastDoc: result.lastDoc,
        }));

        setJobs(transformedJobs);
      } catch (err) {
        console.error('Error fetching jobs:', err);
        setError('Failed to load jobs. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, [selectedCategory, selectedFilter, currentPage, debouncedSearchQuery, filterVersion]);

  // Auto-select first job when jobs are loaded and no job is selected
  useEffect(() => {
    if (jobs.length > 0 && !selectedJob) {
      onJobSelect(jobs[0]);
    }
  }, [jobs]);

  // Toggle save job
  const toggleSaveJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!currentUserId) return;

    const isSaved = savedJobIds.has(jobId);
    const newSaved = new Set(savedJobIds);

    try {
      const nowSaved = await firebaseService.toggleSavedJob(currentUserId, jobId, isSaved);
      if (nowSaved) {
        newSaved.add(jobId);
      } else {
        newSaved.delete(jobId);
      }
      setSavedJobIds(newSaved);
    } catch (err) {
      console.error('Error toggling saved job:', err);
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalJobs / jobsPerPage);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsisThreshold = 7;

    if (totalPages <= showEllipsisThreshold) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  // Get company initial for avatar
  const getCompanyInitial = (company: string) => {
    return company?.charAt(0)?.toUpperCase() || '?';
  };

  // Convert to Title Case
  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.replace(/\b\w/g, c => c.toUpperCase());
  };

  // Get avatar background color based on company name
  const getAvatarColor = (company: string) => {
    const colors = [
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
      '#ec4899', '#f43f5e', '#ef4444', '#f97316',
      '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
      '#3b82f6', '#6366f1',
    ];
    let hash = 0;
    for (let i = 0; i < company.length; i++) {
      hash = company.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Format schedule type badge color
  const getScheduleBadgeStyle = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('full')) return { bg: '#dbeafe', text: '#1d4ed8' };
    if (t.includes('part')) return { bg: '#fef3c7', text: '#92400e' };
    if (t.includes('intern')) return { bg: '#ede9fe', text: '#6d28d9' };
    if (t.includes('contract')) return { bg: '#ffedd5', text: '#c2410c' };
    return { bg: '#f3f4f6', text: '#374151' };
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 flex-shrink-0">
        {/* Title Row with Filters */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <FontAwesomeIcon icon={faBriefcase} className="mr-2" style={{ color: brandTheme.colors.primary }} />
              Job Listing
            </h2>

            {/* Filter Pills */}
            <div className="flex gap-1 ml-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'saved', label: 'Saved' },
                { key: 'remote', label: 'Remote' },
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedFilter(filter.key as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedFilter === filter.key
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={selectedFilter === filter.key ? { background: brandTheme.gradients.primary } : {}}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <div ref={categoryDropdownRef} className="relative">
              <button
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium hover:bg-gray-50"
              >
                <FontAwesomeIcon icon={faFilter} className="text-gray-400" style={{ fontSize: '10px' }} />
                <span className="text-gray-600">{selectedCategory || 'All Categories'}</span>
                <FontAwesomeIcon
                  icon={isCategoryDropdownOpen ? faChevronUp : faChevronDown}
                  className="text-gray-400"
                  style={{ fontSize: '10px' }}
                />
              </button>

              {isCategoryDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
                  {JOB_CATEGORIES.map(option => (
                    <button
                      key={option.id || 'all'}
                      onClick={() => {
                        setSelectedCategory(option.id);
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                        selectedCategory === option.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search jobs by title, company, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Jobs List */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FontAwesomeIcon
              icon={faSpinner}
              className="text-4xl mb-4 animate-spin"
              style={{ color: brandTheme.colors.primary }}
            />
            <p className="text-gray-500">Loading jobs...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-red-500 mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: `${brandTheme.colors.primary}10` }}
            >
              <FontAwesomeIcon
                icon={debouncedSearchQuery ? faSearch : faBriefcase}
                className="text-3xl"
                style={{ color: brandTheme.colors.primary }}
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {debouncedSearchQuery ? 'No jobs found' : 'No jobs available'}
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-xs mb-4">
              {debouncedSearchQuery
                ? `No jobs matching "${debouncedSearchQuery}". Try a different search.`
                : selectedFilter === 'saved'
                  ? 'You haven\'t saved any jobs yet. Click the heart icon on a job to save it.'
                  : selectedCategory
                    ? `No jobs in ${selectedCategory} category.`
                    : 'No active job listings at the moment.'}
            </p>
            {(debouncedSearchQuery || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  setSelectedFilter('all');
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: `${brandTheme.colors.primary}15`,
                  color: brandTheme.colors.primary,
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {jobs.map(job => {
              const scheduleBadge = getScheduleBadgeStyle(job.scheduleType);
              const avatarColor = getAvatarColor(job.company);

              return (
                <div
                  key={job.id}
                  onClick={() => onJobSelect(job)}
                  className={`relative rounded-xl shadow-sm border p-5 transition-all duration-300 cursor-pointer ${
                    selectedJob?.id === job.id
                      ? 'shadow-md'
                      : 'bg-white border-gray-200 hover:shadow-md'
                  }`}
                  style={
                    selectedJob?.id === job.id
                      ? {
                          backgroundColor: `${brandTheme.colors.primary}06`,
                          borderColor: brandTheme.colors.primary,
                        }
                      : {}
                  }
                  onMouseEnter={(e) => {
                    if (selectedJob?.id !== job.id) {
                      e.currentTarget.style.borderColor = brandTheme.colors.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedJob?.id !== job.id) {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  {/* Row 1: Avatar + Title + Company + Location */}
                  <div className="flex items-start gap-3 mb-3">
                    {job.thumbnail ? (
                      <img
                        src={job.thumbnail}
                        alt={job.company}
                        className="w-11 h-11 rounded-lg object-contain bg-gray-50 flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {getCompanyInitial(job.company)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">
                        {toTitleCase(job.title)}
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">{job.company}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <FontAwesomeIcon icon={faLocationDot} style={{ fontSize: '10px' }} />
                        {job.location}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {job.salary && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold max-w-[200px]"
                        style={{ backgroundColor: '#dcfce7', color: '#166534' }}
                        title={job.salary}
                      >
                        <FontAwesomeIcon icon={faMoneyBill} style={{ fontSize: '9px', flexShrink: 0 }} />
                        <span className="truncate">{job.salary}</span>
                      </span>
                    )}
                    {job.scheduleType && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: scheduleBadge.bg, color: scheduleBadge.text }}
                      >
                        <FontAwesomeIcon icon={faBriefcase} style={{ fontSize: '9px' }} />
                        {job.scheduleType}
                      </span>
                    )}
                    {job.isRemote && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                      >
                        <FontAwesomeIcon icon={faHouse} style={{ fontSize: '9px' }} />
                        Remote
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ backgroundColor: `${brandTheme.colors.primary}12`, color: brandTheme.colors.primary }}
                    >
                      {job.category}
                    </span>
                  </div>

                  {/* Row 3: Via + Posted + Save + Apply */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1 min-w-0 max-w-[60%]" title={job.via?.replace('via ', '') || 'Direct'}>
                        <FontAwesomeIcon icon={faBuilding} style={{ fontSize: '9px', flexShrink: 0 }} />
                        <span className="truncate">{job.via?.replace('via ', '') || 'Direct'}</span>
                      </span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                        <FontAwesomeIcon icon={faClock} style={{ fontSize: '9px' }} />
                        {getTimeAgo(job.postedTimestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => toggleSaveJob(e, job.id)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                          savedJobIds.has(job.id)
                            ? 'border-red-200 bg-red-50 text-red-500'
                            : 'border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:text-red-400'
                        }`}
                      >
                        <FontAwesomeIcon
                          icon={savedJobIds.has(job.id) ? faHeartSolid : faHeart}
                          style={{ fontSize: '12px' }}
                        />
                      </button>

                      {/* Detail Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJobSelect(job);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-all hover:opacity-90 shadow-sm"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                        Detail
                        <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '9px' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Sticky Pagination Footer */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 sticky bottom-0 z-10">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{(currentPage - 1) * jobsPerPage + 1}</span>
              <span className="mx-1">-</span>
              <span className="font-medium">{Math.min(currentPage * jobsPerPage, totalJobs)}</span>
              <span className="mx-1">of</span>
              <span className="font-medium">{totalJobs}</span>
              <span className="ml-1 text-gray-400">jobs</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  currentPage === 1
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                }`}
                title="First page"
              >
                <FontAwesomeIcon icon={faChevronsLeft} className="text-xs" />
              </button>

              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  currentPage === 1
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                }`}
                title="Previous page"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
              </button>

              <div className="flex items-center gap-1.5 mx-1">
                {getPageNumbers().map((page, index) =>
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-1.5 text-gray-400 text-sm">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page as number)}
                      className={`min-w-[36px] h-9 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        currentPage === page
                          ? 'text-white shadow-lg transform scale-105'
                          : 'text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      style={currentPage === page ? { background: brandTheme.gradients.primary } : {}}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  currentPage === totalPages
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                }`}
                title="Next page"
              >
                <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
              </button>

              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  currentPage === totalPages
                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                }`}
                title="Last page"
              >
                <FontAwesomeIcon icon={faChevronsRight} className="text-xs" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobListing;
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListCheck, faXmark, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { firebaseService } from './services/firebase_service';

interface ProblemsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProblemSlug: string;
  onSelectProblem: (slug: string) => void;
  brandTheme: any;
  userId?: string;  // User ID for fetching attempt stats
  refreshTrigger?: number; // Trigger to refresh attempts data
}

const ProblemsListModal: React.FC<ProblemsListModalProps> = ({
  isOpen,
  onClose,
  selectedProblemSlug,
  onSelectProblem,
  brandTheme,
  userId,
  refreshTrigger,
}) => {
  
  // State
  const [problemsSearchQuery, setProblemsSearchQuery] = useState('');
  const [problemsCurrentPage, setProblemsCurrentPage] = useState(1);
  const [problemsList, setProblemsList] = useState<any[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [problemsTotalCount, setProblemsTotalCount] = useState(0);
  const [filteredTotalCount, setFilteredTotalCount] = useState<number | null>(null);
  const [problemsHasMore, setProblemsHasMore] = useState(false);
  const [problemsPageDocs, setProblemsPageDocs] = useState<Record<number, any>>({});
  const [problemsDifficultyFilter, setProblemsDifficultyFilter] = useState<string>('All');
  const [problemsTopicFilter, setProblemsTopicFilter] = useState<string>('All');
  const [problemsCompanyFilter, setProblemsCompanyFilter] = useState<string>('All');
  
  // User attempt stats
  const [userAttempts, setUserAttempts] = useState<Map<string, { status: 'attempted' | 'completed'; attemptCount: number }>>(new Map());
  const [userStats, setUserStats] = useState<{ solved: number; attempted: number }>({ solved: 0, attempted: 0 });
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  // Check if any filter is active
  const hasActiveFilters = problemsDifficultyFilter !== 'All' || problemsTopicFilter !== 'All' || problemsCompanyFilter !== 'All' || problemsSearchQuery.trim() !== '';

  // Fetch user's problem attempts - Always fetch fresh when modal opens
  useEffect(() => {
    const fetchUserAttempts = async () => {
      if (!userId) return;
      
      // Only fetch when modal is open
      if (!isOpen) return;
      
      setAttemptsLoading(true);
      try {
        console.log('🔄 Fetching user attempts for:', userId);
        const [attempts, stats] = await Promise.all([
          firebaseService.getUserProblemAttempts(userId),
          firebaseService.getUserProblemStats(userId),
        ]);
        setUserAttempts(attempts);
        setUserStats(stats);
        console.log('✅ Fetched user attempts:', attempts.size, 'Stats:', stats);
      } catch (error) {
        console.error('Error fetching user attempts:', error);
      } finally {
        setAttemptsLoading(false);
      }
    };
    
    fetchUserAttempts();
  }, [userId, isOpen, refreshTrigger]);

  // Fetch problems list from Firestore with pagination and filters
  useEffect(() => {
    const fetchProblems = async () => {
      if (!isOpen) return;
      
      setProblemsLoading(true);
      try {
        const problemsPerPage = 10;
        
        // Build filters object
        const filters: { difficulty?: string; category?: string; tags?: string[] } = {};
        if (problemsDifficultyFilter && problemsDifficultyFilter !== 'All') {
          filters.difficulty = problemsDifficultyFilter;
        }
        if (problemsTopicFilter && problemsTopicFilter !== 'All') {
          filters.tags = [problemsTopicFilter];
        }
        
        // If searching, use search function
        if (problemsSearchQuery.trim()) {
          const results = await firebaseService.searchCodingProblems(problemsSearchQuery, 50);
          // Apply client-side filters for search results
          let filtered = results;
          if (filters.difficulty) {
            filtered = filtered.filter((p: any) => p.difficulty === filters.difficulty);
          }
          if (filters.tags && filters.tags.length > 0) {
            filtered = filtered.filter((p: any) => 
              p.tags && filters.tags!.some(tag => p.tags.includes(tag))
            );
          }
          // Sort results by number
          filtered.sort((a: any, b: any) => (a.number ?? 9999) - (b.number ?? 9999));
          setProblemsList(filtered);
          setFilteredTotalCount(filtered.length);
          setProblemsHasMore(false);
        } else {
          // Use server pagination for all cases (with or without filters)
          // Reset to page 1 when filters change
          const lastDocForPage = problemsCurrentPage > 1 ? problemsPageDocs[problemsCurrentPage - 1] : undefined;
          
          const result = await firebaseService.getCodingProblems(
            Object.keys(filters).length > 0 ? filters : undefined,
            problemsPerPage,
            lastDocForPage
          );
          
          setProblemsList(result.problems);
          setProblemsHasMore(result.hasMore);
          
          // For filtered results, we don't know total count without fetching all
          // Just show "Filtered" without count
          if (hasActiveFilters && !problemsSearchQuery.trim()) {
            setFilteredTotalCount(null); // Will show "Filtered" without exact count
          } else {
            setFilteredTotalCount(null);
          }
          
          // Store lastDoc for this page (for next page navigation)
          if (result.lastDoc) {
            setProblemsPageDocs(prev => ({
              ...prev,
              [problemsCurrentPage]: result.lastDoc
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching problems:', error);
        setProblemsList([]);
      } finally {
        setProblemsLoading(false);
      }
    };
    
    fetchProblems();
  }, [isOpen, problemsCurrentPage, problemsSearchQuery, problemsDifficultyFilter, problemsTopicFilter, problemsCompanyFilter]);

  // Fetch total count only once when modal first opens
  useEffect(() => {
    const fetchTotalCount = async () => {
      if (isOpen && problemsTotalCount === 0) {
        const count = await firebaseService.getCodingProblemsCount();
        setProblemsTotalCount(count);
      }
    };
    fetchTotalCount();
  }, [isOpen]);

  const handleSelectProblem = (slug: string) => {
    onSelectProblem(slug);
    onClose();
  };

  const clearFilters = () => {
    setProblemsDifficultyFilter('All');
    setProblemsTopicFilter('All');
    setProblemsCompanyFilter('All');
    setProblemsCurrentPage(1);
    setProblemsPageDocs({});
  };

  return (
    <>
      <div className={`fixed inset-0 z-[10000] flex items-start justify-start p-2 transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"
          onClick={onClose}
        />
        
        {/* Panel - Slide in from left */}
        <div 
          className={`relative bg-white shadow-2xl w-[calc(100%-8px)] max-w-[30rem] h-[calc(100%-4px)] flex flex-col overflow-hidden z-10 transform transition-all duration-500 ease-in-out rounded-2xl ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            className="px-5 py-3 flex items-center justify-between border-b flex-shrink-0 rounded-t-2xl"
            style={{ background: brandTheme.gradients.primary }}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon icon={faListCheck} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Coding Problems List</h2>
                <p className="text-xs text-white/70">Select a problem to practice</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:rotate-90 duration-300"
            >
              <FontAwesomeIcon icon={faXmark} className="text-white" />
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <input
                type="text"
                placeholder="Search problems..."
                value={problemsSearchQuery}
                onChange={(e) => {
                  setProblemsSearchQuery(e.target.value);
                  setProblemsCurrentPage(1);
                  setProblemsPageDocs({});
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Filters Row */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {/* Difficulty Filter */}
              <select
                value={problemsDifficultyFilter}
                onChange={(e) => {
                  setProblemsDifficultyFilter(e.target.value);
                  setProblemsCurrentPage(1);
                  setProblemsPageDocs({});
                }}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 cursor-pointer"
              >
                <option value="All">All Difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              
              {/* Topic Filter */}
              <select
                value={problemsTopicFilter}
                onChange={(e) => {
                  setProblemsTopicFilter(e.target.value);
                  setProblemsCurrentPage(1);
                  setProblemsPageDocs({});
                }}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 cursor-pointer"
              >
                <option value="All">All Topics</option>
                <option value="Array">Array</option>
                <option value="String">String</option>
                <option value="Hash Table">Hash Table</option>
                <option value="Math">Math</option>
                <option value="Dynamic Programming">Dynamic Programming</option>
                <option value="Sorting">Sorting</option>
                <option value="Greedy">Greedy</option>
                <option value="Depth-First Search">Depth-First Search</option>
                <option value="Binary Search">Binary Search</option>
                <option value="Database">Database</option>
                <option value="Matrix">Matrix</option>
                <option value="Tree">Tree</option>
                <option value="Breadth-First Search">Breadth-First Search</option>
                <option value="Two Pointers">Two Pointers</option>
                <option value="Bit Manipulation">Bit Manipulation</option>
                <option value="Stack">Stack</option>
                <option value="Graph">Graph</option>
                <option value="Heap">Heap</option>
                <option value="Sliding Window">Sliding Window</option>
                <option value="Backtracking">Backtracking</option>
                <option value="Linked List">Linked List</option>
                <option value="Recursion">Recursion</option>
                <option value="Divide and Conquer">Divide and Conquer</option>
                <option value="Trie">Trie</option>
              </select>
              
              {/* Company Filter */}
              <select
                value={problemsCompanyFilter}
                onChange={(e) => {
                  setProblemsCompanyFilter(e.target.value);
                  setProblemsCurrentPage(1);
                  setProblemsPageDocs({});
                }}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-green-400 cursor-pointer"
              >
                <option value="All">All Companies</option>
                <option value="Google">Google</option>
                <option value="Amazon">Amazon</option>
                <option value="Microsoft">Microsoft</option>
                <option value="Meta">Meta</option>
                <option value="Apple">Apple</option>
                <option value="Facebook">Facebook</option>
                <option value="Netflix">Netflix</option>
                <option value="Uber">Uber</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Twitter">Twitter</option>
                <option value="Spotify">Spotify</option>
                <option value="Bloomberg">Bloomberg</option>
                <option value="Adobe">Adobe</option>
                <option value="Airbnb">Airbnb</option>
                <option value="Oracle">Oracle</option>
                <option value="Goldman Sachs">Goldman Sachs</option>
                <option value="ByteDance">ByteDance</option>
              </select>
              
              {/* Clear Filters */}
              {(problemsDifficultyFilter !== 'All' || problemsTopicFilter !== 'All' || problemsCompanyFilter !== 'All') && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
          
          {/* Problems List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {problemsLoading ? (
              // Loading skeleton
              <div className="p-4 space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gray-200"></div>
                      <div className="h-4 bg-gray-200 rounded w-48"></div>
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : problemsList.length === 0 ? (
              // No results
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 font-medium">No problems found</p>
                <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <>
                {problemsList.map((prob, index) => {
                  const problemSlug = prob.slug || prob.id;
                  const attemptData = userAttempts.get(problemSlug);
                  const isSolved = attemptData?.status === 'completed';
                  const isAttempted = attemptData?.status === 'attempted';
                  
                  return (
                  <div
                    key={prob.id || prob.slug}
                    onClick={() => handleSelectProblem(problemSlug)}
                    className={`flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all duration-200 border-b border-gray-100 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 group ${
                      problemSlug === selectedProblemSlug ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-500' : ''
                    }`}
                    style={{ 
                      animationDelay: `${index * 30}ms`,
                      animation: isOpen ? 'fadeSlideIn 0.3s ease-out forwards' : 'none'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Solved/Attempted indicator */}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSolved 
                          ? 'bg-green-500 text-white' 
                          : isAttempted
                          ? 'bg-amber-500 text-white'
                          : 'border-2 border-gray-300'
                      }`}>
                        {isSolved && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        {isAttempted && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm transition-colors ${
                        problemSlug === selectedProblemSlug 
                          ? 'font-semibold text-green-700' 
                          : 'text-gray-700 group-hover:text-gray-900'
                      }`}>
                        {prob.title}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-transform group-hover:scale-105 ${
                      prob.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      prob.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {prob.difficulty === 'Medium' ? 'MED.' : (prob.difficulty || 'MED.').toUpperCase()}
                    </span>
                  </div>
                  );
                })}

                {/* Pagination */}
                {(problemsHasMore || problemsCurrentPage > 1) && (
                  <div className="flex items-center justify-between py-3 px-4 border-t border-gray-100 bg-gray-50/30">
                    <button
                      onClick={() => setProblemsCurrentPage(p => Math.max(1, p - 1))}
                      disabled={problemsCurrentPage === 1}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                      <span>Previous</span>
                    </button>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">
                        Page {problemsCurrentPage} {problemsTotalCount > 0 ? `of ${Math.ceil(problemsTotalCount / 10)}` : ''}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => setProblemsCurrentPage(p => p + 1)}
                      disabled={!problemsHasMore}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    >
                      <span>Next</span>
                      <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Footer Stats */}
          <div className="px-5 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex-shrink-0">
            <div className="flex items-center justify-around text-center">
              <div className="group cursor-default">
                <div className="text-2xl font-bold text-green-600 group-hover:scale-110 transition-transform">
                  {userStats.solved}
                </div>
                <div className="text-xs text-gray-500 font-medium">SOLVED</div>
              </div>
              <div className="w-px h-10 bg-gray-300"></div>
              <div className="group cursor-default">
                <div className="text-2xl font-bold text-amber-500 group-hover:scale-110 transition-transform">
                  {userStats.attempted}
                </div>
                <div className="text-xs text-gray-500 font-medium">ATTEMPTED</div>
              </div>
              <div className="w-px h-10 bg-gray-300"></div>
              <div className="group cursor-default">
                <div className="text-2xl font-bold text-gray-600 group-hover:scale-110 transition-transform">
                  {hasActiveFilters && filteredTotalCount !== null ? filteredTotalCount : problemsTotalCount}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {hasActiveFilters ? 'FILTERED' : 'TOTAL'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Custom scrollbar styles and animations */}
      <style>{`
        .custom-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};

export default ProblemsListModal;
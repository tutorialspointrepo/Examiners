import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMagnifyingGlass, 
  faXmark, 
  faSpinner, 
  faUser, 
  faFileLines, 
  faCircleQuestion,
  faCalendar,
  faChevronRight,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service'; // Use your existing service!
import { SEARCH_RESULT_TYPES, UI_TIMINGS, type SearchResultType, type UserType } from './constants';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  metadata?: string;
  icon?: any;
  badge?: string;
  userType?: UserType; // ✅ Aligned with user.types.ts
  studentClass?: string; // ✅ Already aligned with user.types.ts
}

interface EnhancedSearchProps {
  onResultSelect: (result: SearchResult) => void;
  onUserSelect: (userId: string, userType?: UserType, studentClass?: string) => void; // ✅ Aligned with user.types.ts
  onExamSelect: (examId: string) => void;
  onQuestionSelect: (questionId: string) => void;
  activeCollegeId?: string;
  canSearchAllColleges?: boolean; // For system admins
  brandColors?: {
    primary: string;
    secondary: string;
  };
}

const EnhancedSearch: React.FC<EnhancedSearchProps> = ({
  onResultSelect,
  onUserSelect,
  onExamSelect,
  onQuestionSelect,
  activeCollegeId,
  canSearchAllColleges = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [results, setResults] = useState<{
    users: SearchResult[];
    exams: SearchResult[];
    questions: SearchResult[];
  }>({
    users: [],
    exams: [],
    questions: []
  });

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Log activeCollegeId for debugging
  useEffect(() => {
    console.log('🔍 [ENHANCED_SEARCH] Component mounted/updated with activeCollegeId:', activeCollegeId);
  }, [activeCollegeId]);

  // Calculate dropdown position
  useEffect(() => {
    const updatePosition = () => {
      if (searchRef.current && showResults) {
        const rect = searchRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [showResults]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear and close
      if (e.key === 'Escape') {
        setSearchTerm('');
        setShowResults(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Perform search with debouncing
  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults({ users: [], exams: [], questions: [] });
      setShowResults(false);
      return;
    }

    console.log('🔍 [ENHANCED_SEARCH] Starting search:', {
      searchTerm: term,
      activeCollegeId: activeCollegeId,
      canSearchAllColleges: canSearchAllColleges
    });

    setIsSearching(true);
    setShowResults(true);

    try {
      // Use your existing firebaseService!
      // System admins can search across all colleges
      const searchResults = await firebaseService.searchAll(term, activeCollegeId, canSearchAllColleges);
      console.log('✅ [ENHANCED_SEARCH] Search results received:', {
        users: searchResults.users.length,
        exams: searchResults.exams.length,
        questions: searchResults.questions.length
      });
      setResults(searchResults);
    } catch (error) {
      console.error('❌ [ENHANCED_SEARCH] Search error:', error);
      setResults({ users: [], exams: [], questions: [] });
    } finally {
      setIsSearching(false);
    }
  }, [activeCollegeId, canSearchAllColleges]);

  // Handle search input change with debouncing
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, UI_TIMINGS.DEBOUNCE_DELAY);
  };

   // Handle result selection
  const handleResultClick = (result: SearchResult) => {
    console.log('🎯 [SEARCH_CLICK] ========== Result clicked! ==========');
    console.log('🎯 [SEARCH_CLICK] Full result object:', result);
    console.log('🎯 [SEARCH_CLICK] Type:', result.type, 'ID:', result.id);
    console.log('🎯 [SEARCH_CLICK] Title:', result.title);
    
    setSearchTerm('');
    setShowResults(false);
    onResultSelect(result);

    // Call specific handlers
    if (result.type === SEARCH_RESULT_TYPES.USER) {
      console.log('🎯 [SEARCH_CLICK] Calling onUserSelect with:', result.id, 'userType:', result.userType, 'class:', result.studentClass);
      onUserSelect(result.id, result.userType, result.studentClass);
      console.log('✅ [SEARCH_CLICK] onUserSelect called!');
    } else if (result.type === SEARCH_RESULT_TYPES.EXAM) {
      console.log('🎯 [SEARCH_CLICK] Calling onExamSelect with:', result.id);
      onExamSelect(result.id);
      console.log('✅ [SEARCH_CLICK] onExamSelect called!');
    } else if (result.type === SEARCH_RESULT_TYPES.QUESTION) {
      console.log('🎯 [SEARCH_CLICK] ========== QUESTION CLICKED ==========');
      console.log('🎯 [SEARCH_CLICK] Question ID:', result.id);
      console.log('🎯 [SEARCH_CLICK] Question Title:', result.title);
      console.log('🎯 [SEARCH_CLICK] Calling onQuestionSelect...');
      onQuestionSelect(result.id);
      console.log('✅ [SEARCH_CLICK] onQuestionSelect called with ID:', result.id);
      console.log('🎯 [SEARCH_CLICK] ========================================');
    }
  };

  // Clear search
  const handleClear = () => {
    setSearchTerm('');
    setResults({ users: [], exams: [], questions: [] });
    setShowResults(false);
  };

  const totalResults = results.users.length + results.exams.length + results.questions.length;

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <FontAwesomeIcon 
          icon={faMagnifyingGlass} 
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
        />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search users, exams, questions... (Ctrl+K)"
          className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
          autoComplete="off"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
          >
            <FontAwesomeIcon icon={faXmark} className="text-sm" />
          </button>
        )}
      </div>

      {/* Results Dropdown Portal */}
      {showResults && createPortal(
        <div 
          className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-in"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 9999
          }}
        >
          {/* Results Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="text-gray-600 text-sm" />
                <span className="text-sm font-semibold text-gray-700">
                  Search Results
                </span>
                {totalResults > 0 && (
                  <span className="px-2 py-0.5 bg-white rounded-full text-xs font-semibold text-gray-700 shadow-sm">
                    {totalResults}
                  </span>
                )}
              </div>
              {searchTerm && (
                <span className="text-xs text-gray-500 max-w-xs truncate">
                  for "{searchTerm}"
                </span>
              )}
            </div>
          </div>

          {/* Results Content */}
          <div className="max-h-[420px] overflow-y-auto" style={{ position: 'relative', zIndex: 1000 }}>
            {isSearching ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400 text-2xl mb-2" />
                  <p className="text-sm text-gray-600">Searching...</p>
                </div>
              </div>
            ) : totalResults === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="text-gray-300 text-3xl mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">No results found</p>
                  <p className="text-xs text-gray-500">Try adjusting your search terms</p>
                </div>
              </div>
            ) : (
              <div>
                {/* Users Section */}
                {results.users.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-4 py-2.5 bg-blue-50/50 border-b border-blue-100">
                      <div className="flex items-center space-x-2">
                        <FontAwesomeIcon icon={faUser} className="text-blue-600 text-sm" />
                        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                          Users ({results.users.length})
                        </h4>
                      </div>
                    </div>
                    {results.users.map((user) => (
                    <button
                    key={user.id}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔴 MOUSE DOWN - Handling click!', user.title);
                        handleResultClick(user);
                    }}
                        className="w-full px-4 py-3 hover:bg-blue-50/50 transition-colors flex items-center space-x-3 group cursor-pointer"
                        style={{ position: 'relative', zIndex: 10 }}
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <FontAwesomeIcon icon={faUser} className="text-white text-sm" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {user.title}
                            </p>
                            {user.badge && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                                {user.badge}
                              </span>
                            )}
                          </div>
                          {user.subtitle && (
                            <p className="text-xs text-gray-600 truncate">{user.subtitle}</p>
                          )}
                          {user.metadata && (
                            <p className="text-xs text-gray-500 mt-0.5">{user.metadata}</p>
                          )}
                        </div>
                        <FontAwesomeIcon 
                          icon={faChevronRight} 
                          className="text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Exams Section */}
                {results.exams.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-4 py-2.5 bg-purple-50/50 border-b border-purple-100">
                      <div className="flex items-center space-x-2">
                        <FontAwesomeIcon icon={faFileLines} className="text-purple-600 text-sm" />
                        <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                          Exams ({results.exams.length})
                        </h4>
                      </div>
                    </div>
                    {results.exams.map((exam) => (
                      <button
                        key={exam.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔴 MOUSE DOWN - Handling exam click!', exam.title);
                          handleResultClick(exam);
                        }}
                        className="w-full px-4 py-3 hover:bg-purple-50/50 transition-colors flex items-center space-x-3 group cursor-pointer"
                        style={{ position: 'relative', zIndex: 10 }}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <FontAwesomeIcon icon={faFileLines} className="text-white text-sm" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {exam.title}
                            </p>
                            {exam.badge && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                                {exam.badge}
                              </span>
                            )}
                          </div>
                          {exam.subtitle && (
                            <p className="text-xs text-gray-600 truncate">{exam.subtitle}</p>
                          )}
                          {exam.metadata && (
                            <div className="flex items-center space-x-3 mt-1">
                              <span className="text-xs text-gray-500 flex items-center space-x-1">
                                <FontAwesomeIcon icon={faCalendar} />
                                <span>{exam.metadata}</span>
                              </span>
                            </div>
                          )}
                        </div>
                        <FontAwesomeIcon 
                          icon={faChevronRight} 
                          className="text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Questions Section */}
                {results.questions.length > 0 && (
                  <div>
                    <div className="px-4 py-2.5 bg-green-50/50 border-b border-green-100">
                      <div className="flex items-center space-x-2">
                        <FontAwesomeIcon icon={faCircleQuestion} className="text-green-600 text-sm" />
                        <h4 className="text-xs font-bold text-green-900 uppercase tracking-wide">
                          Questions ({results.questions.length})
                        </h4>
                      </div>
                    </div>
                    {results.questions.map((question) => (
                      <button
                        key={question.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔴 MOUSE DOWN - Handling question click!', question.title);
                          handleResultClick(question);
                        }}
                        className="w-full px-4 py-3 hover:bg-green-50/50 transition-colors flex items-center space-x-3 group cursor-pointer"
                        style={{ position: 'relative', zIndex: 10 }}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <FontAwesomeIcon icon={faCircleQuestion} className="text-white text-sm" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {question.title}
                            </p>
                            {question.badge && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex-shrink-0">
                                {question.badge}
                              </span>
                            )}
                          </div>
                          {question.subtitle && (
                            <p className="text-xs text-gray-600 truncate">{question.subtitle}</p>
                          )}
                          {question.metadata && (
                            <p className="text-xs text-gray-500 mt-0.5">{question.metadata}</p>
                          )}
                        </div>
                        <FontAwesomeIcon 
                          icon={faChevronRight} 
                          className="text-gray-400 group-hover:text-green-600 transition-colors flex-shrink-0"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default EnhancedSearch;
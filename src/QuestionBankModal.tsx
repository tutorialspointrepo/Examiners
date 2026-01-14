import React, { useState, useEffect, useCallback, memo } from 'react';
import { useBrand } from './BrandContext';
import { firebaseService, type QuestionBankItem } from './services/firebase_service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faMagnifyingGlass,
  faGraduationCap,
  faBook,
  faBuilding,
  faFilter,
  faChevronDown,
  faAward,
  faBookBookmark,
  faChevronLeft,
  faChevronRight,
  faCheck,
  faUser,
  faCalendar,
  faDollarSign,
  faGlobe,
  faBookAtlas,
} from '@fortawesome/pro-light-svg-icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuestions: (selectedQuestions: QuestionBankItem[]) => void;
  className: string;
  subject: string;
  board: string;
  boards: string[];
  activeCollegeId?: string;
  codingLanguages: string[];
  availableChapters: string[];
}

// Helper function to get question type display
const getQuestionTypeDisplay = (type: string) => {
  switch (type) {
    case 'mcq': return { label: 'MCQ', color: 'bg-blue-100 text-blue-700' };
    case 'fitb':
    case 'fillInTheBlank': return { label: 'FILL IN THE BLANK', color: 'bg-blue-100 text-blue-700' };
    case 'jumbled':
    case 'jumbledQuiz': return { label: 'JUMBLED', color: 'bg-purple-100 text-purple-700' };
    case 'descriptive': return { label: 'Descriptive', color: 'bg-orange-100 text-orange-700' };
    case 'code': return { label: 'CODE', color: 'bg-indigo-100 text-indigo-700' };
    default: return { label: type.toUpperCase(), color: 'bg-gray-100 text-gray-700' };
  }
};

// Helper function to map filter to actual question type
const getActualQuestionType = (filter: string): 'code' | 'mcq' | 'fitb' | 'jumbled' | 'descriptive' | 'all' | undefined => {
  if (filter === 'all') return undefined;
  return filter as 'code' | 'mcq' | 'fitb' | 'jumbled' | 'descriptive' | 'all' ;
};

const QuestionBankModal: React.FC<QuestionBankModalProps> = memo(({
  isOpen,
  onClose,
  onAddQuestions,
  className,
  subject,
  board,
  boards,
  activeCollegeId,
  availableChapters
}) => {
  const brand = useBrand();

  // State
  const [questionBankItems, setQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [isLoadingQuestionBank, setIsLoadingQuestionBank] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalQuestionBankItems, setTotalQuestionBankItems] = useState(0);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  
  // Filter states
  const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('all');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // Dropdown states
  const [showQuestionTypeDropdown, setShowQuestionTypeDropdown] = useState(false);
  const [showComplexityDropdown, setShowComplexityDropdown] = useState(false);
  const [showChapterDropdown, setShowChapterDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const questionsPerPage = 10;

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Fetch question bank items
  const fetchQuestionBankItems = useCallback(async () => {
    if (!activeCollegeId || !className || !subject) {
      return;
    }

    const trimmedSearch = debouncedSearchQuery.trim();

    try {
      setIsLoadingQuestionBank(true);

      const searchQueryToSend = trimmedSearch.length >= 2 ? trimmedSearch : undefined;

      const actualQuestionType = getActualQuestionType(questionTypeFilter);
      
      // Only apply board filter if institute has multiple boards
      // If single board, fetch all questions regardless of board
      const shouldFilterByBoard = boards.length > 1;
      const boardFilter = shouldFilterByBoard && board && board !== '' ? board : undefined;

      console.log('🔍 Fetching questions with filters:', {
        collegeId: activeCollegeId,
        class: className,
        board: boardFilter || 'No filter (showing all)',
        subject,
        questionType: actualQuestionType,
        complexity: complexityFilter,
        chapter: chapterFilter,
        searchQuery: searchQueryToSend || 'NONE'
      });

      const result = await firebaseService.getQuestionsPaginated(
        activeCollegeId,
        className,
        boardFilter, // Only filter by board if institute has multiple boards
        subject,
        actualQuestionType,
        'all', // proprietary filter - show both public and proprietary
        questionsPerPage,
        currentPage,
        searchQueryToSend,
        complexityFilter !== 'all' ? complexityFilter : undefined,
        chapterFilter !== 'all' ? chapterFilter : undefined,
        tagFilter !== 'all' ? tagFilter : undefined
      );

      console.log(`✅ Fetched ${result.questions.length} of ${result.total} questions from Question Bank`);

      // Extract unique tags from all results
      const tags = new Set<string>();
      result.questions.forEach(q => {
        q.tags?.forEach(tag => tags.add(tag));
      });
      setAvailableTags(Array.from(tags).sort());

      setQuestionBankItems(result.questions);
      setTotalQuestionBankItems(result.total);
    } catch (error) {
      console.error('Error fetching question bank:', error);
      setQuestionBankItems([]);
      setTotalQuestionBankItems(0);
    } finally {
      setIsLoadingQuestionBank(false);
    }
  }, [
    activeCollegeId,
    className,
    subject,
    board,
    boards,
    currentPage,
    debouncedSearchQuery,
    questionTypeFilter,
    complexityFilter,
    chapterFilter,
    tagFilter,
    questionsPerPage
  ]);

  // Fetch questions when modal opens or filters change
  useEffect(() => {
    if (isOpen) {
      fetchQuestionBankItems();
    }
  }, [isOpen, fetchQuestionBankItems]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [questionTypeFilter, complexityFilter, chapterFilter, debouncedSearchQuery]);

  // Handlers
  const handleToggleSelection = useCallback((questionId: string) => {
    setSelectedQuestionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }, []);

  const handleAddQuestions = useCallback(() => {
    const selectedQuestions = questionBankItems.filter(item => selectedQuestionIds.has(item.id));
    onAddQuestions(selectedQuestions);
    setSelectedQuestionIds(new Set());
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setCurrentPage(1);
    setQuestionTypeFilter('all');
    setComplexityFilter('all');
    setChapterFilter('all');
  }, [selectedQuestionIds, questionBankItems, onAddQuestions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b-2 flex-shrink-0"
          style={{ 
            background: brand.gradients.primary,
            borderColor: brand.colors.secondary
          }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                <FontAwesomeIcon icon={faBookAtlas} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Question Bank</h2>
                <p className="text-sm text-white/80">Select questions to add to your exam</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faXmark} className="text-white" />
            </button>
          </div>
          
          {/* Filters Row */}
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="text-xs font-semibold text-white/80">Filters:</span>
            <div className="flex items-center space-x-2 flex-wrap">
              <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-1.5">
                <FontAwesomeIcon icon={faGraduationCap} className="text-white" />
                <span className="text-xs font-bold text-white">Class {className}</span>
              </div>
              <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-1.5">
                <FontAwesomeIcon icon={faBook} className="text-white" />
                <span className="text-xs font-bold text-white">{subject}</span>
              </div>
              {boards.length > 1 && (
                <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-1.5">
                  <FontAwesomeIcon icon={faBuilding} className="text-white" />
                  <span className="text-xs font-bold text-white">{board}</span>
                </div>
              )}
              
              {/* Question Type Filter Dropdown */}
              <div className="relative filter-dropdown">
                <button
                  onClick={() => {
                    setShowQuestionTypeDropdown(!showQuestionTypeDropdown);
                    setShowComplexityDropdown(false);
                    setShowChapterDropdown(false);
                  }}
                  className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-1.5 hover:bg-white/30 transition-colors"
                >
                  <FontAwesomeIcon icon={faFilter} className="text-white" />
                  <span className="text-xs font-bold text-white">
                    {questionTypeFilter === 'all' ? 'All Types' : 
                     questionTypeFilter === 'mcq' ? 'MCQ' :
                     questionTypeFilter === 'fitb' ? 'Fill Blank' :
                     questionTypeFilter === 'jumbled' ? 'Jumbled' :
                     questionTypeFilter === 'code' ? 'Code' :
                     'Descriptive'}
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} className="text-white" />
                </button>
                
                {showQuestionTypeDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[150px] py-1">
                    {[
                      { value: 'all', label: 'All Types' },
                      { value: 'mcq', label: 'MCQ' },
                      { value: 'fitb', label: 'Fill in the Blank' },
                      { value: 'jumbled', label: 'Jumbled' },
                      { value: 'descriptive', label: 'Descriptive' },
                      { value: 'code', label: 'Code' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setQuestionTypeFilter(option.value);
                          setShowQuestionTypeDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                          questionTypeFilter === option.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Complexity Filter Dropdown */}
              <div className="relative filter-dropdown">
                <button
                  onClick={() => {
                    setShowComplexityDropdown(!showComplexityDropdown);
                    setShowQuestionTypeDropdown(false);
                    setShowChapterDropdown(false);
                  }}
                  className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-1.5 hover:bg-white/30 transition-colors"
                >
                  <FontAwesomeIcon icon={faAward} className="text-white" />
                  <span className="text-xs font-bold text-white">
                    {complexityFilter === 'all' ? 'All Levels' :
                     complexityFilter.charAt(0).toUpperCase() + complexityFilter.slice(1)}
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} className="text-white" />
                </button>
                
                {showComplexityDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[130px] py-1">
                    {[
                      { value: 'all', label: 'All Levels' },
                      { value: 'easy', label: 'Easy' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'hard', label: 'Hard' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setComplexityFilter(option.value);
                          setShowComplexityDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                          complexityFilter === option.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chapter Filter Dropdown */}
              {availableChapters.length > 0 && (
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => {
                      setShowChapterDropdown(!showChapterDropdown);
                      setShowQuestionTypeDropdown(false);
                      setShowComplexityDropdown(false);
                    }}
                    className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-1.5 hover:bg-white/30 transition-colors"
                  >
                    <FontAwesomeIcon icon={faBookBookmark} className="text-white" />
                    <span className="text-xs font-bold text-white">
                      {chapterFilter === 'all' ? 'All Chapters' : 
                       chapterFilter.length > 20 ? chapterFilter.substring(0, 20) + '...' : chapterFilter}
                    </span>
                    <FontAwesomeIcon icon={faChevronDown} className="text-white" />
                  </button>
                  
                  {showChapterDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[200px] max-w-[300px] py-1 max-h-[300px] overflow-y-auto">
                      <button
                        onClick={() => {
                          setChapterFilter('all');
                          setShowChapterDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                          chapterFilter === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        All Chapters
                      </button>
                      {availableChapters.map((chapter) => (
                        <button
                          key={chapter}
                          onClick={() => {
                            setChapterFilter(chapter);
                            setShowChapterDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                            chapterFilter === chapter ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                          }`}
                          title={chapter}
                        >
                          {chapter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tag Filter Dropdown */}
              {availableTags.length > 0 && (
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => {
                      setShowTagDropdown(!showTagDropdown);
                      setShowQuestionTypeDropdown(false);
                      setShowComplexityDropdown(false);
                      setShowChapterDropdown(false);
                    }}
                    className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-1.5 hover:bg-white/30 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-bold text-white">
                      {tagFilter === 'all' ? 'All Tags' : 
                       tagFilter.length > 15 ? tagFilter.substring(0, 15) + '...' : tagFilter}
                    </span>
                    <FontAwesomeIcon icon={faChevronDown} className="text-white" />
                  </button>
                  
                  {showTagDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl z-30 min-w-[180px] max-w-[250px] py-1 max-h-[300px] overflow-y-auto">
                      <button
                        onClick={() => {
                          setTagFilter('all');
                          setShowTagDropdown(false);
                          setCurrentPage(1);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                          tagFilter === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                        }`}
                      >
                        All Tags
                      </button>
                      {availableTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            setTagFilter(tag);
                            setShowTagDropdown(false);
                            setCurrentPage(1);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                            tagFilter === tag ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                          }`}
                          title={tag}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="w-full pl-10 pr-20 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 transition-all text-sm"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              {searchQuery !== debouncedSearchQuery && searchQuery !== '' && (
                <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span className="font-medium">...</span>
                </div>
              )}
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearchQuery('');
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-gray-500" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 min-h-[24px]">
              <div className="text-sm text-gray-600 transition-opacity duration-200">
                {isLoadingQuestionBank && questionBankItems.length === 0 ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span>Searching...</span>
                  </span>
                ) : searchQuery.trim().length > 0 && searchQuery.trim().length < 2 ? (
                  <span className="text-xs text-amber-600 font-medium">
                    Type at least 2 characters to search
                  </span>
                ) : (
                  <>
                    Found <span className="font-bold text-gray-900">{totalQuestionBankItems}</span> question{totalQuestionBankItems !== 1 ? 's' : ''}
                    {debouncedSearchQuery && debouncedSearchQuery.length >= 2 && (
                      <span className="ml-1 text-xs text-gray-500">
                        matching "{debouncedSearchQuery}"
                      </span>
                    )}
                  </>
                )}
              </div>
              {selectedQuestionIds.size > 0 && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: brand.gradients.primary }}>
                  {selectedQuestionIds.size} selected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
          {isLoadingQuestionBank && questionBankItems.length > 0 && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex items-center justify-center transition-opacity duration-200">
              <div className="bg-white rounded-xl shadow-lg px-5 py-3 flex items-center space-x-3 border-2" style={{ borderColor: brand.colors.primary + '20' }}>
                <div className="w-5 h-5 border-3 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: brand.colors.primary, borderTopColor: 'transparent', borderWidth: '3px' }} />
                <p className="text-gray-700 font-semibold text-sm">Searching...</p>
              </div>
            </div>
          )}

          {isLoadingQuestionBank && questionBankItems.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                  style={{ borderColor: brand.colors.primary, borderTopColor: 'transparent' }} />
                <p className="text-gray-600 font-semibold">Loading questions...</p>
              </div>
            </div>
          ) : questionBankItems.length === 0 ? (
            <div className="text-center py-20">
              <FontAwesomeIcon icon={faBook} className="mx-auto mb-4 text-gray-300 text-5xl" />
              <p className="text-xl font-bold text-gray-900 mb-2">No questions found</p>
              <p className="text-gray-600 mb-4">
                {debouncedSearchQuery 
                  ? `No questions match "${debouncedSearchQuery}" for the current filters`
                  : `No questions available for the current filters`
                }
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 flex-wrap">
                <span>Current filters:</span>
                <span className="px-2 py-1 bg-gray-100 rounded-md font-semibold">Class {className}</span>
                <span className="px-2 py-1 bg-gray-100 rounded-md font-semibold">{subject}</span>
                {boards.length > 1 && (
                  <span className="px-2 py-1 bg-gray-100 rounded-md font-semibold">{board}</span>
                )}
                {questionTypeFilter !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-semibold">
                    {questionTypeFilter === 'mcq' ? 'MCQ' :
                     questionTypeFilter === 'fitb' ? 'Fill Blank' :
                     questionTypeFilter === 'jumbled' ? 'Jumbled' :
                     questionTypeFilter === 'code' ? 'Code' : 'Descriptive'}
                  </span>
                )}
                {complexityFilter !== 'all' && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md font-semibold">
                    {complexityFilter.charAt(0).toUpperCase() + complexityFilter.slice(1)}
                  </span>
                )}
              </div>
              {debouncedSearchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearchQuery('');
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {questionBankItems.map((question, index) => {
                const isSelected = selectedQuestionIds.has(question.id);
                const isExpanded = expandedQuestionId === question.id;
                const typeDisplay = getQuestionTypeDisplay(question.type);
                
                return (
                  <div
                    key={question.id}
                    className={`bg-white rounded-2xl p-5 transition-all ${
                      isSelected 
                        ? 'shadow-md ring-2 ring-blue-200 border-2 border-blue-300' 
                        : 'border border-gray-200 hover:shadow-sm hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white text-xs font-bold">
                            {((currentPage - 1) * questionsPerPage) + index + 1}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-4">
                            <span className={`text-xs font-bold px-3 py-1 rounded-md ${typeDisplay.color}`}>
                              {typeDisplay.label}
                            </span>
                            
                            {question.type === 'code' && question.programmingLanguage && (
                              <span className="text-xs font-bold px-3 py-1 rounded-md bg-orange-100 text-orange-700">
                                {(question.programmingLanguage || '').charAt(0).toUpperCase() + (question.programmingLanguage || '').slice(1).toLowerCase()}
                              </span>
                            )}
                            
                            <span className="text-xs font-bold px-3 py-1 rounded-md bg-green-100 text-green-700">
                              {question.marks} {question.marks === 1 ? 'Mark' : 'Marks'}
                            </span>

                            <span className={`text-xs font-bold px-3 py-1 rounded-md ${
                              question.complexity === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                              question.complexity === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {question.complexity ? question.complexity.charAt(0).toUpperCase() + question.complexity.slice(1) : 'Medium'}
                            </span>

                            {/* Tags Display */}
                            {question.tags && question.tags.length > 0 && (
                              <div className="inline-flex items-center ml-2">
                                {question.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTagFilter(tag);
                                      setCurrentPage(1);
                                    }}
                                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors mr-2"
                                    title={`Filter by tag: ${tag}`}
                                  >
                                    <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Question Title - Rendered HTML with code highlighting */}
                          <div className="mb-2 leading-relaxed">
                            {(() => {
                              // Process the HTML to wrap code blocks with copy buttons and syntax highlighting
                              const processHTML = (html: string) => {
                                // Split content by <code> tags
                                const parts = html.split(/(<code>.*?<\/code>)/gs);
                                
                                return parts.map((part, partIndex) => {
                                  // Check if this is a code block
                                  const codeMatch = part.match(/<code>(.*?)<\/code>/s);
                                  
                                  if (codeMatch) {
                                    const codeContent = codeMatch[1];
            
                                    
                                    // Determine programming language
                                    const detectLanguage = (code: string): string => {
                                      // If it's a code question, use its language
                                      if (question.programmingLanguage) {
                                        return (question.programmingLanguage || '').toLowerCase();
                                      }
                                      
                                      // Simple auto-detection based on code patterns
                                      if (code.includes('def ') || code.includes('import numpy') || code.includes('print(')) {
                                        return 'python';
                                      }
                                      if (code.includes('function ') || code.includes('const ') || code.includes('let ') || code.includes('=>')) {
                                        return 'javascript';
                                      }
                                      if (code.includes('public class') || code.includes('public static void') || code.includes('System.out')) {
                                        return 'java';
                                      }
                                      if (code.includes('#include') || code.includes('int main()')) {
                                        return 'cpp';
                                      }
                                      if (code.includes('SELECT') || code.includes('FROM') || code.includes('WHERE')) {
                                        return 'sql';
                                      }
                                      
                                      // Default to java for educational content
                                      return 'java';
                                    };
                                    
                                    const language = detectLanguage(codeContent);
                                    
                                    return (
                                      <div key={partIndex} className="relative rounded-lg overflow-hidden mb-2 mt-2">
                                        {/* Code content with minimal padding */}
                                        <SyntaxHighlighter
                                          language={language}
                                          style={vscDarkPlus}
                                          customStyle={{
                                            margin: 0,
                                            borderRadius: '0.5rem',
                                            fontSize: '0.75rem',
                                            padding: '0.75rem',
                                          }}
                                          showLineNumbers={false}
                                        >
                                          {codeContent}
                                        </SyntaxHighlighter>
                                      </div>
                                    );
                                  }
                                  
                                  // Regular HTML content
                                  return (
                                    <div
                                      key={partIndex}
                                      className="prose prose-sm max-w-none
                                        [&>h1]:text-base [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-1 [&>h1]:mt-0
                                        [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-1 [&>h2]:mt-0
                                        [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-0.5 [&>h3]:mt-0
                                        [&>p]:text-sm [&>p]:text-gray-800 [&>p]:mb-0.5 [&>p]:leading-relaxed [&>p]:mt-0
                                        [&_strong]:font-bold [&_strong]:text-gray-900
                                        [&_br]:block [&_br]:mb-0.5
                                        [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-1 [&>ul]:text-sm
                                        [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:mb-1 [&>ol]:text-sm
                                        [&_li]:mb-0.5 [&_li]:text-sm"
                                      dangerouslySetInnerHTML={{ __html: part }}
                                    />
                                  );
                                });
                              };
                              
                              return <>{processHTML(question.questionText)}</>;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Checkbox */}
                      <div className="flex-shrink-0 ml-4">
                        <div
                          onClick={() => handleToggleSelection(question.id)}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300 hover:border-blue-400 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <FontAwesomeIcon icon={faCheck} className="text-white text-sm" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <FontAwesomeIcon icon={faUser} />
                          <span>{question.createdByName}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <FontAwesomeIcon icon={faCalendar} />
                          <span>
                            {new Date(question.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {question.isProprietaryQuestion ? (
                          <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                            <FontAwesomeIcon icon={faDollarSign} />
                            <span className="text-xs font-semibold">Private</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                            <FontAwesomeIcon icon={faGlobe} />
                            <span className="text-xs font-semibold">Public</span>
                          </div>
                        )}

                        <button
                          onClick={() => setExpandedQuestionId(expandedQuestionId === question.id ? null : question.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                          style={{ color: brand.colors.primary }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `${brand.colors.primary}10`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalQuestionBankItems > questionsPerPage && (
            <div className="mt-6 pt-4 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{((currentPage - 1) * questionsPerPage) + 1}</span> to{' '}
                <span className="font-semibold">
                  {Math.min(currentPage * questionsPerPage, totalQuestionBankItems)}
                </span>{' '}
                of <span className="font-semibold">{totalQuestionBankItems}</span> questions
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || isLoadingQuestionBank}
                  className={`p-2 rounded-lg transition-all ${
                    currentPage === 1 || isLoadingQuestionBank
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-2 text-gray-700 hover:shadow-md'
                  }`}
                  style={currentPage > 1 && !isLoadingQuestionBank ? {
                    borderColor: brand.colors.primary + '40'
                  } : {}}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.ceil(totalQuestionBankItems / questionsPerPage) }, (_, i) => i + 1)
                    .filter(page => {
                      const totalPages = Math.ceil(totalQuestionBankItems / questionsPerPage);
                      return (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      );
                    })
                    .map((page, index, array) => {
                      const prevPage = array[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;

                      return (
                        <div key={page} className="flex items-center">
                          {showEllipsis && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            disabled={isLoadingQuestionBank}
                            className={`min-w-[40px] h-10 rounded-lg font-semibold transition-all ${
                              currentPage === page
                                ? 'text-white shadow-md'
                                : 'text-gray-700 bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
                            } ${isLoadingQuestionBank ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={currentPage === page ? {
                              background: brand.gradients.primary
                            } : {}}
                          >
                            {page}
                          </button>
                        </div>
                      );
                    })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(Math.ceil(totalQuestionBankItems / questionsPerPage), currentPage + 1))}
                  disabled={currentPage >= Math.ceil(totalQuestionBankItems / questionsPerPage) || isLoadingQuestionBank}
                  className={`p-2 rounded-lg transition-all ${
                    currentPage >= Math.ceil(totalQuestionBankItems / questionsPerPage) || isLoadingQuestionBank
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-2 text-gray-700 hover:shadow-md'
                  }`}
                  style={currentPage < Math.ceil(totalQuestionBankItems / questionsPerPage) && !isLoadingQuestionBank ? {
                    borderColor: brand.colors.primary + '40'
                  } : {}}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-4 flex items-center justify-between border-t-2 border-gray-200 flex-shrink-0">
          <p className="text-sm font-semibold text-gray-700">
            {selectedQuestionIds.size} question{selectedQuestionIds.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddQuestions}
              disabled={selectedQuestionIds.size === 0}
              className="px-6 py-2.5 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: brand.gradients.primary }}
            >
              <FontAwesomeIcon icon={faCheck} />
              <span>Add {selectedQuestionIds.size > 0 ? `${selectedQuestionIds.size} ` : ''}Question{selectedQuestionIds.size !== 1 ? 's' : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

QuestionBankModal.displayName = 'QuestionBankModal';

export default QuestionBankModal;
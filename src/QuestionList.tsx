import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faBookOpen,
  faBuilding,
  faTrophy,
  faUser,
  faCalendar,
  faLayerGroup,
  faXmark,
  faChevronLeft,
  faChevronRight,
  faCopy,
  faCheck,
  faGlobe,
  faGripVertical,
  faImage
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';
import { 
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  FILTER_VALUES,
  PROPRIETARY_FILTER,
  PROPRIETARY_FILTER_LABELS,
  type QuestionType,
  type ProprietaryFilter,
} from './constants';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface QuestionListProps {
  selectedSubject: any;
  activeCollegeId: string;
  brandTheme: any;
  questionType: 'all' | QuestionType;
  onCreateQuestion?: () => void;
  scrollToQuestionId?: string | null;
  onQuestionScrolled?: () => void;
}

export default function QuestionList({
  selectedSubject,
  activeCollegeId,
  brandTheme,
  questionType,
  scrollToQuestionId,
  onQuestionScrolled
}: QuestionListProps) {
  // No conversion needed - database has modern types after migration
  // Just pass questionType directly (undefined for 'all')
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState<string>(FILTER_VALUES.ALL);
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [selectedProprietaryFilter, setSelectedProprietaryFilter] = useState<ProprietaryFilter>(PROPRIETARY_FILTER.ALL);
  const [isProprietaryDropdownOpen, setIsProprietaryDropdownOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>(FILTER_VALUES.ALL);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string>(FILTER_VALUES.ALL);
  const [isChapterDropdownOpen, setIsChapterDropdownOpen] = useState(false);
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);
  const [boards, setBoards] = useState<string[]>([FILTER_VALUES.ALL]);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [imageCarouselOpen, setImageCarouselOpen] = useState(false);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Debug: Log state changes
  useEffect(() => {
    console.log('📊 Component State:', {
      expandedQuestionId,
      copiedCode,
      questionsCount: questions.length
    });
  }, [expandedQuestionId, copiedCode, questions.length]);

  // Scroll to selected question from search
  useEffect(() => {
    if (scrollToQuestionId && questions.length > 0) {
      console.log('📍 [SCROLL] Attempting to scroll to question:', scrollToQuestionId);
      console.log('📍 [SCROLL] Currently loaded questions:', questions.length);
      console.log('📍 [SCROLL] Question IDs in list:', questions.map(q => q.id).join(', '));
      
      // Check if the question exists in the current list
      const questionExists = questions.some(q => q.id === scrollToQuestionId);
      console.log('📍 [SCROLL] Question exists in current list?', questionExists);
      
      if (!questionExists) {
        console.warn('⚠️ [SCROLL] Question NOT in current page! It might be on another page.');
        console.warn('⚠️ [SCROLL] Currently showing first', questions.length, 'questions');
        
        // Fetch the specific question and add it to the top of the list
        console.log('🔄 [SCROLL] Fetching specific question:', scrollToQuestionId);
        firebaseService.getQuestionById(scrollToQuestionId).then((questionDoc) => {
          if (questionDoc) {
            console.log('✅ [SCROLL] Found question, adding to list');
            // Add the question to the beginning of the list
            setQuestions(prev => [questionDoc, ...prev.filter(q => q.id !== scrollToQuestionId)]);
          } else {
            console.error('❌ [SCROLL] Could not fetch question:', scrollToQuestionId);
            if (onQuestionScrolled) {
              onQuestionScrolled();
            }
          }
        });
        return;
      }
      
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        const questionElement = document.getElementById(`question-${scrollToQuestionId}`);
        
        if (questionElement) {
          console.log('✅ [SCROLL] Found question element, scrolling...');
          
          // Scroll to the question with smooth animation
          questionElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          // Add highlight effect
          questionElement.classList.add('highlight-question');
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            questionElement.classList.remove('highlight-question');
          }, 3000);
          
          // Call callback to clear the selected question
          if (onQuestionScrolled) {
            onQuestionScrolled();
          }
          
          console.log('✨ [SCROLL] Question highlighted successfully');
        } else {
          console.warn('⚠️ [SCROLL] Question element not found in DOM:', `question-${scrollToQuestionId}`);
        }
      }, 500);
    }
  }, [scrollToQuestionId, questions, onQuestionScrolled]);

  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const proprietaryDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const chapterDropdownRef = useRef<HTMLDivElement>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const questionsPerPage = 10;

  // Fetch boards from college
  useEffect(() => {
    const loadBoards = async () => {
      if (!activeCollegeId) {
        setBoards([FILTER_VALUES.ALL]);
        return;
      }

      try {
        const college = await firebaseService.getCollegeById(activeCollegeId);
        if (college && college.supportedBoards) {
          setBoards([FILTER_VALUES.ALL, ...college.supportedBoards]);
        } else {
          setBoards([FILTER_VALUES.ALL]);
        }
      } catch (error) {
        console.error('Error loading boards:', error);
        setBoards([FILTER_VALUES.ALL]);
      }
    };

    loadBoards();
  }, [activeCollegeId]);

  // Fetch all available tags for the subject
  useEffect(() => {
    const fetchAllTags = async () => {
      if (!selectedSubject || !activeCollegeId) {
        console.log('⚠️ No subject or collegeId, clearing tags');
        setAvailableTags([]);
        return;
      }

      console.log('🔍 Fetching tags for:', {
        collegeId: activeCollegeId,
        class: selectedSubject.class,
        subject: selectedSubject.subject
      });

      try {
        const tags = await firebaseService.getAllTagsForSubject(
          activeCollegeId,
          selectedSubject.class,
          selectedSubject.subject
        );
        console.log('✅ Tags fetched:', tags);
        setAvailableTags(tags.sort());
        console.log(`✅ Loaded ${tags.length} unique tags for ${selectedSubject.subject}:`, tags);
      } catch (error) {
        console.error('❌ Error fetching tags:', error);
        setAvailableTags([]);
      }
    };

    fetchAllTags();
  }, [selectedSubject, activeCollegeId]);

  // Fetch all available chapters for the subject
  useEffect(() => {
    const fetchAllChapters = async () => {
      if (!selectedSubject || !activeCollegeId) {
        console.log('⚠️ No subject or collegeId, clearing chapters');
        setAvailableChapters([]);
        return;
      }

      console.log('📚 Fetching chapters for:', {
        collegeId: activeCollegeId,
        class: selectedSubject.class,
        subject: selectedSubject.subject
      });

      try {
        const chapters = await firebaseService.getChaptersForSubject(
          activeCollegeId,
          selectedSubject.class,
          selectedSubject.subject
        );
        setAvailableChapters(chapters);
        console.log(`✅ Loaded ${chapters.length} unique chapters for ${selectedSubject.subject}:`, chapters);
      } catch (error) {
        console.error('❌ Error fetching chapters:', error);
        setAvailableChapters([]);
      }
    };

    fetchAllChapters();
  }, [selectedSubject, activeCollegeId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (boardDropdownRef.current && !boardDropdownRef.current.contains(event.target as Node)) {
        setIsBoardDropdownOpen(false);
      }
      if (proprietaryDropdownRef.current && !proprietaryDropdownRef.current.contains(event.target as Node)) {
        setIsProprietaryDropdownOpen(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target as Node)) {
        setIsChapterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch questions when subject, questionType, or filters change
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!selectedSubject || !activeCollegeId) {
        setQuestions([]);
        setTotalQuestions(0);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Pass questionType directly - database has modern types after migration
        const actualQuestionType = questionType === FILTER_VALUES.ALL ? undefined : questionType;
        
        console.log('🔍 Fetching paginated questions for page:', currentPage, {
          subject: selectedSubject.subject,
          class: selectedSubject.class,
          collegeId: activeCollegeId,
          questionType,
          actualQuestionType,
          board: selectedBoard,
          proprietary: selectedProprietaryFilter,
          tag: selectedTag
        });

        // Fetch questions with all filters applied at Firebase level
        const result = await firebaseService.getQuestionsPaginated(
          activeCollegeId,
          selectedSubject.class,
          selectedBoard !== FILTER_VALUES.ALL ? selectedBoard : undefined,
          selectedSubject.subject,
          actualQuestionType, // Pass modern question type directly to Firebase
          selectedProprietaryFilter, // Already typed as ProprietaryFilter
          questionsPerPage,
          currentPage,
          undefined, // searchQuery
          undefined, // complexityFilter
          selectedChapter !== FILTER_VALUES.ALL ? selectedChapter : undefined, // chapterFilter
          selectedTag !== FILTER_VALUES.ALL ? selectedTag : undefined // tagFilter
        );

        console.log(`✅ Fetched page ${currentPage}: ${result.questions.length} of ${result.total} questions`);
        
        // Debug: Log code questions to check programming language field
        result.questions.forEach((q: any) => {
          if (q.type === QUESTION_TYPES.CODE) {
            console.log('🔍 Code Question:', {
              id: q.id,
              type: q.type,
              programmingLanguage: q.programmingLanguage,
              programming_language: q.programming_language,
              allFields: Object.keys(q)
            });
          }
        });
        
        setQuestions(result.questions);
        setTotalQuestions(result.total);
      } catch (error) {
        console.error('❌ Error fetching questions:', error);
        setQuestions([]);
        setTotalQuestions(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [selectedSubject, activeCollegeId, questionType, selectedBoard, selectedProprietaryFilter, selectedTag, selectedChapter, currentPage]);

  // Reset pagination when filters change (but not currentPage)
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSubject, questionType, selectedBoard, selectedProprietaryFilter, selectedTag, selectedChapter]);

  // Keyboard navigation for image carousel
  useEffect(() => {
    if (!imageCarouselOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImageCarouselOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageCarouselOpen, carouselImages.length]);

  // Copy to clipboard function
  const copyToClipboard = async (text: string, id: string) => {
    console.log('🔵 Copy button clicked!');
    console.log('📋 ID:', id);
    console.log('📝 Text length:', text?.length || 0);
    console.log('📄 Text preview:', text?.substring(0, 100));
    
    try {
      await navigator.clipboard.writeText(text);
      console.log('✅ Copy successful!');
      setCopiedCode(id);
      console.log('🎯 State updated to:', id);
      setTimeout(() => {
        setCopiedCode(null);
        console.log('🔄 State reset to null');
      }, 2000);
    } catch (err) {
      console.error('❌ Failed to copy:', err);
      alert('Failed to copy to clipboard. Error: ' + err);
    }
  };

  // Safe render function to handle special characters
  const safeRender = (text: any): string => {
    if (text === null || text === undefined) return '';
    return String(text);
  };

  // Helper function to check if text contains HTML tags
  const containsHTML = (text: string): boolean => {
    if (!text) return false;
    // Check for common HTML tags like <p>, <h1>, <h2>, <code>, <strong>, etc.
    const htmlPattern = /<[a-z][\s\S]*>/i;
    return htmlPattern.test(text);
  };

  // Get question type display name using constants
  const getTypeDisplayName = (type: string) => {
    if (type === FILTER_VALUES.ALL) return 'All Types';
    return QUESTION_TYPE_LABELS[type as keyof typeof QUESTION_TYPE_LABELS] || type;
  };

  return (
    <>
      <div className="flex-1 flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="sticky top-0 z-[100] bg-white px-6 py-4 shadow-sm border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-3">
          <FontAwesomeIcon icon={faLayerGroup} className="text-gray-900" />
          <h3 className="text-xl font-bold text-gray-900">Question List ({totalQuestions})</h3>
        </div>

        {/* Subject + Class + Type Info + Filters */}
        <div className="relative">
          <div className="overflow-x-auto scrollbar-hide pb-2">
            <div className="flex items-center space-x-2 whitespace-nowrap">
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
              style={{ background: brandTheme.gradients.primary }}
            >
              {selectedSubject.subject}
            </span>
            <span className="px-3 py-1.5 rounded-xl  text-xs font-semibold bg-gray-100 text-gray-700">
              Class {selectedSubject.class}
            </span>
            <span className="px-3 py-1.5 rounded-xl  text-xs font-semibold bg-purple-100 text-purple-700">
              {getTypeDisplayName(questionType)}
            </span>

            {/* Board Filter Dropdown - Only show if more than one board */}
            {boards.length > 2 && (
              <div ref={boardDropdownRef} className="relative inline-block">
                <button
                  onClick={() => setIsBoardDropdownOpen(!isBoardDropdownOpen)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-semibold transition-colors text-xs bg-orange-100 text-orange-700 hover:bg-orange-200"
                >
                  <FontAwesomeIcon icon={faBuilding} />
                  <span>{selectedBoard === FILTER_VALUES.ALL ? 'All Boards' : selectedBoard}</span>
                  <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isBoardDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isBoardDropdownOpen && (
                  <div className="fixed w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[9999] flex flex-col"
                    style={{
                      top: `${proprietaryDropdownRef.current?.getBoundingClientRect().bottom ?? 0 + 8}px`,
                      left: `${proprietaryDropdownRef.current?.getBoundingClientRect().left ?? 0}px`
                    }}>
                    {boards.map((board) => (
                      <button
                        key={board}
                        onClick={() => {
                          setSelectedBoard(board);
                          setIsBoardDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedBoard === board
                            ? 'font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        style={selectedBoard === board ? {
                          backgroundColor: `${brandTheme.colors.primary}15`,
                          color: brandTheme.colors.primary
                        } : {}}
                      >
                        {board === FILTER_VALUES.ALL ? 'All Boards' : board}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Private/Public Filter Dropdown */}
            <div ref={proprietaryDropdownRef} className="relative inline-block">
              <button
                onClick={() => {
                  console.log('🟡 All Questions clicked! Current state:', isProprietaryDropdownOpen);
                  setIsProprietaryDropdownOpen(!isProprietaryDropdownOpen);
                }}
                className="flex items-center space-x-1.5 py-0.5 px-3 py-1.5 rounded-xl  font-semibold transition-colors text-xs bg-amber-100 text-amber-700 hover:bg-amber-200"
              >
                <FontAwesomeIcon icon={faTrophy} />
                <span>
                  {PROPRIETARY_FILTER_LABELS[selectedProprietaryFilter]}
                </span>
                <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isProprietaryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isProprietaryDropdownOpen && (() => {
                console.log('🎨 PROPRIETARY DROPDOWN RENDERING!');
                return (
                  <div className="fixed w-44 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[9999] flex flex-col"
                    style={{
                      top: `${proprietaryDropdownRef.current?.getBoundingClientRect().bottom ?? 0 + 8}px`,
                      left: `${proprietaryDropdownRef.current?.getBoundingClientRect().left ?? 0}px`
                    }}>
                  <button
                    onClick={() => {
                      setSelectedProprietaryFilter(PROPRIETARY_FILTER.ALL);
                      setIsProprietaryDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedProprietaryFilter === PROPRIETARY_FILTER.ALL
                        ? 'font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    style={selectedProprietaryFilter === PROPRIETARY_FILTER.ALL ? {
                      backgroundColor: `${brandTheme.colors.primary}15`,
                      color: brandTheme.colors.primary
                    } : {}}
                  >
                    {PROPRIETARY_FILTER_LABELS[PROPRIETARY_FILTER.ALL]}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProprietaryFilter(PROPRIETARY_FILTER.PROPRIETARY);
                      setIsProprietaryDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedProprietaryFilter === PROPRIETARY_FILTER.PROPRIETARY
                        ? 'font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    style={selectedProprietaryFilter === PROPRIETARY_FILTER.PROPRIETARY ? {
                      backgroundColor: `${brandTheme.colors.primary}15`,
                      color: brandTheme.colors.primary
                    } : {}}
                  >
                    Private Only
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProprietaryFilter(PROPRIETARY_FILTER.COMMON);
                      setIsProprietaryDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedProprietaryFilter === PROPRIETARY_FILTER.COMMON
                        ? 'font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    style={selectedProprietaryFilter === PROPRIETARY_FILTER.COMMON ? {
                      backgroundColor: `${brandTheme.colors.primary}15`,
                      color: brandTheme.colors.primary
                    } : {}}
                  >
                    Public Only
                  </button>
                </div>
                );
              })()}
            </div>

            {/* Tag Filter Dropdown - Only show if tags are available */}
            {availableTags.length > 0 && (
              <div ref={tagDropdownRef} className="relative inline-block">
                <button
                  onClick={() => {
                    console.log('🔵 Tag button clicked! Current state:', isTagDropdownOpen, 'Available tags:', availableTags.length);
                    setIsTagDropdownOpen(!isTagDropdownOpen);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-semibold transition-colors text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span>
                    {selectedTag === FILTER_VALUES.ALL ? 'All Tags' : selectedTag.length > 15 ? selectedTag.substring(0, 15) + '...' : selectedTag}
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isTagDropdownOpen && (() => {
                  const rect = tagDropdownRef.current?.getBoundingClientRect();
                  console.log('🎨 Rendering dropdown!', { isOpen: isTagDropdownOpen, rect, tagsCount: availableTags.length });
                  return (
                    <div className="fixed mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[9999] max-h-60 overflow-y-auto flex flex-col"
                      style={{
                        top: rect ? `${rect.bottom + 8}px` : '0px',
                        left: rect ? `${rect.left}px` : '0px'
                      }}>
                    <button
                      onClick={() => {
                        setSelectedTag(FILTER_VALUES.ALL);
                        setIsTagDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedTag === FILTER_VALUES.ALL
                          ? 'font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      style={selectedTag === FILTER_VALUES.ALL ? {
                        backgroundColor: `${brandTheme.colors.primary}15`,
                        color: brandTheme.colors.primary
                      } : {}}
                    >
                      All Tags
                    </button>
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setSelectedTag(tag);
                          setIsTagDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedTag === tag
                            ? 'font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        style={selectedTag === tag ? {
                          backgroundColor: `${brandTheme.colors.primary}15`,
                          color: brandTheme.colors.primary
                        } : {}}
                        title={tag}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  );
                })()}
              </div>
            )}

            {/* Chapter Filter Dropdown - Only show if chapters are available */}
            {availableChapters.length > 0 && (
              <div ref={chapterDropdownRef} className="relative inline-block">
                <button
                  onClick={() => {
                    console.log('📚 Chapter button clicked! Current state:', isChapterDropdownOpen, 'Available chapters:', availableChapters.length);
                    setIsChapterDropdownOpen(!isChapterDropdownOpen);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-semibold transition-colors text-xs bg-green-100 text-green-700 hover:bg-green-200"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  <span>
                    {selectedChapter === FILTER_VALUES.ALL ? 'All Chapters' : selectedChapter.length > 20 ? selectedChapter.substring(0, 20) + '...' : selectedChapter}
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isChapterDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isChapterDropdownOpen && (() => {
                  const rect = chapterDropdownRef.current?.getBoundingClientRect();
                  console.log('📚 Rendering chapter dropdown!', { isOpen: isChapterDropdownOpen, rect, chaptersCount: availableChapters.length });
                  return (
                    <div className="fixed mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[9999] max-h-60 overflow-y-auto flex flex-col"
                      style={{
                        top: rect ? `${rect.bottom + 8}px` : '0px',
                        left: rect ? `${rect.left}px` : '0px'
                      }}>
                    <button
                      onClick={() => {
                        setSelectedChapter(FILTER_VALUES.ALL);
                        setIsChapterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedChapter === FILTER_VALUES.ALL
                          ? 'font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      style={selectedChapter === FILTER_VALUES.ALL ? {
                        backgroundColor: `${brandTheme.colors.primary}15`,
                        color: brandTheme.colors.primary
                      } : {}}
                    >
                      All Chapters
                    </button>
                    {availableChapters.map((chapter) => (
                      <button
                        key={chapter}
                        onClick={() => {
                          setSelectedChapter(chapter);
                          setIsChapterDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedChapter === chapter
                            ? 'font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        style={selectedChapter === chapter ? {
                          backgroundColor: `${brandTheme.colors.primary}15`,
                          color: brandTheme.colors.primary
                        } : {}}
                        title={chapter}
                      >
                        {chapter}
                      </button>
                    ))}
                  </div>
                  );
                })()}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600 font-medium">Loading questions...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FontAwesomeIcon icon={faBookOpen} className="text-gray-300 mb-4" />
            <p className="text-gray-600 font-semibold text-lg mb-2">No questions found</p>
            <p className="text-gray-500 text-sm">
              {questionType !== FILTER_VALUES.ALL
                ? `No ${getTypeDisplayName(questionType)} questions available for this subject`
                : 'No questions available for this subject'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => {
              // DEBUG: Log jumbled question data
              if (question.type === QUESTION_TYPES.JUMBLED) {
                console.log('═══════════════════════════════════════════════');
                console.log(`📋 JUMBLED QUESTION #${index + 1}: ${question.id}`);
                console.log('═══════════════════════════════════════════════');
                console.log('🔍 Question Type:', question.type);
                console.log('📝 Question Text:', question.questionText?.substring(0, 50) + '...');
                console.log('');
                console.log('📦 JUMBLED ITEMS (Raw from Firebase):');
                console.log('   Type:', typeof (question as any).jumbledItems);
                console.log('   Is Array?:', Array.isArray((question as any).jumbledItems));
                console.log('   Value:', (question as any).jumbledItems);
                console.log('   Keys:', (question as any).jumbledItems ? Object.keys((question as any).jumbledItems) : 'null');
                console.log('');
                console.log('✅ CORRECT ANSWERS (Raw from Firebase):');
                console.log('   Type:', typeof question.correctAnswers);
                console.log('   Is Array?:', Array.isArray(question.correctAnswers));
                console.log('   Value:', question.correctAnswers);
                console.log('   Keys:', question.correctAnswers ? Object.keys(question.correctAnswers) : 'null');
                console.log('');
                console.log('🎯 FULL QUESTION OBJECT:');
                console.log(question);
                console.log('═══════════════════════════════════════════════');
              }
              
              // Debug: Check for images in question
              if (question.imageUrls || question.imageUrl) {
                console.log('📸 Question has images:', {
                  id: question.id,
                  imageUrls: question.imageUrls,
                  imageUrl: question.imageUrl,
                  hasImageUrls: !!question.imageUrls,
                  imageUrlsLength: question.imageUrls?.length || 0
                });
              }
              
              return (
              <div
                key={question.id}
                id={`question-${question.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-200"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = brandTheme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                {/* Question Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ background: brandTheme.gradients.primary }}
                      >
                      {index + 1}
                    </div>
                    <div className="overflow-x-auto scrollbar-hide flex-1 min-w-0">
                      <div className="flex items-center space-x-2 whitespace-nowrap">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                          {getTypeDisplayName(question.type)}
                        </span>
                        {question.type === QUESTION_TYPES.CODE && (question.programmingLanguage || question.programming_language) && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-orange-100 text-orange-700">
                            {(question.programmingLanguage || question.programming_language).charAt(0).toUpperCase() + (question.programmingLanguage || question.programming_language).slice(1).toLowerCase()}
                          </span>
                        )}
                        {question.board && question.board.trim() !== '' && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700">
                            {question.board.toUpperCase()}
                          </span>
                        )}
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${question.complexity === 'easy' ? 'bg-pink-100 text-pink-700' :
                            question.complexity === 'medium' ? 'bg-green-100 text-green-700' :
                              'bg-cyan-100 text-cyan-700'
                          }`}>
                          {question.complexity.charAt(0).toUpperCase() + question.complexity.slice(1).toLowerCase()}
                        </span>
                        
                        {/* Chapter Display */}
                        {question.chapter && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedChapter(question.chapter);
                            }}
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer transition-colors"
                            title={`Filter by chapter: ${question.chapter}`}
                          >
                            <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                            </svg>
                            {question.chapter}
                          </span>
                        )}

                        {/* Tags Display */}
                        {question.tags && Array.isArray(question.tags) && question.tags.length > 0 && (
                          <>
                            {question.tags.map((tag: string, tagIdx: number) => (
                              <span
                                key={tagIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTag(tag);
                                }}
                                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors"
                                title={`Filter by tag: ${tag}`}
                              >
                                <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                {tag}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* Image Gallery Icon - Show if question has images */}
                    {question.imageUrls && Array.isArray(question.imageUrls) && question.imageUrls.length > 0 && (
                      <button
                        onClick={() => {
                          console.log('🖼️ Opening carousel with images:', question.imageUrls);
                          setCarouselImages(question.imageUrls);
                          setCurrentImageIndex(0);
                          setImageCarouselOpen(true);
                        }}
                        className="relative h-8 bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 px-3 rounded-lg transition-all hover:shadow-md group flex items-center"
                        title="View question images"
                      >
                        <div className="flex items-center space-x-1.5">
                          <FontAwesomeIcon icon={faImage} className="text-purple-600 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold text-purple-700">{question.imageUrls.length}</span>
                        </div>
                      </button>
                    )}
                    
                    <div className="h-8 bg-gray-100 px-3 rounded-lg flex items-center">
                      <span className="text-sm font-bold text-gray-900">{question.marks}</span>
                      <span className="text-xs text-gray-600 ml-1">marks</span>
                    </div>
                    {expandedQuestionId === question.id && (
                      <button
                        onClick={() => setExpandedQuestionId(null)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close details"
                      >
                        <FontAwesomeIcon icon={faXmark} className="text-gray-600" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div className="mb-3">
                  <div className="space-y-3">
                    {(() => {
                      // Process the HTML to wrap code blocks with copy buttons and syntax highlighting
                      const processHTML = (html: string) => {
                        // First, render math formulas
                        html = html.replace(
                          /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                          (match: string, latex: string) => {
                            try {
                              const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                              return katex.renderToString(decodedLatex, {
                                throwOnError: false,
                                displayMode: false
                              });
                            } catch (e) {
                              console.error('KaTeX rendering error:', e);
                              return match;
                            }
                          }
                        );
                        
                        // Split by code tags
                        const parts = html.split(/(<code>.*?<\/code>)/gs);
                        
                        return parts.map((part, index) => {
                          // Check if this is a code block
                          const codeMatch = part.match(/<code>(.*?)<\/code>/s);
                          
                          if (codeMatch) {
                            const codeContent = codeMatch[1];
                            const codeId = `code-${question.id}-${index}`;
                            
                            // Determine programming language
                            // Priority: 1. Question's programmingLanguage, 2. Auto-detect, 3. Default to 'java'
                            const detectLanguage = (code: string): string => {
                              // If it's a code question, use its language
                              if (question.programmingLanguage) {
                                return question.programmingLanguage.toLowerCase();
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
                              <div key={index} className="relative rounded-lg overflow-hidden">
                                {/* Terminal-style header with dots and copy button */}
                                <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                  {/* macOS-style dots */}
                                  <div className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                  </div>
                                  
                                  {/* Copy button */}
                                  <button
                                    onClick={() => copyToClipboard(codeContent, codeId)}
                                    className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                    title="Copy to clipboard"
                                  >
                                    {copiedCode === codeId ? (
                                      <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                    ) : (
                                      <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                    )}
                                  </button>
                                </div>
                                
                                {/* Code content with top padding for header */}
                                <div className="pt-10">
                                  <SyntaxHighlighter
                                    language={language}
                                    style={vscDarkPlus}
                                    customStyle={{
                                      margin: 0,
                                      borderRadius: 0,
                                      borderBottomLeftRadius: '0.5rem',
                                      borderBottomRightRadius: '0.5rem',
                                      fontSize: '0.875rem',
                                      padding: '1rem',
                                      paddingTop: '0.5rem'
                                    }}
                                    showLineNumbers={false}
                                  >
                                    {codeContent}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            );
                          }
                          
                          // Regular HTML content
                          return (
                            <div
                              key={index}
                              className="prose prose-sm max-w-none
                                [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-3 [&>h1]:mt-2
                                [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-2 [&>h2]:mt-2
                                [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-2 [&>h3]:mt-2
                                [&>p]:text-base [&>p]:text-gray-800 [&>p]:mb-2 [&>p]:leading-relaxed
                                [&_strong]:font-bold [&_strong]:text-gray-900
                                [&_br]:block [&_br]:mb-2
                                [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2
                                [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2
                                [&_li]:mb-1
                                [&_.katex]:text-sm [&_.katex]:inline-block"
                              dangerouslySetInnerHTML={{ __html: part }}
                            />
                          );
                        });
                      };
                      
                      return processHTML(question.questionText);
                    })()}
                  </div>
                </div>

                {/* MCQ Options - Simple view without correct answer */}
                {question.type === QUESTION_TYPES.MCQ && question.options && question.options.length > 0 && expandedQuestionId !== question.id && (
                  <div className="mt-3">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Options</h4>
                    <div className="space-y-2">
                      {question.options.map((option: string, optIndex: number) => (
                        <div
                          key={optIndex}
                          className="flex items-center space-x-2 p-2.5 rounded-lg border bg-gray-50 border-gray-200"
                        >
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-300 text-gray-700">
                            {String.fromCharCode(65 + optIndex)}
                          </div>
                          <span className="text-sm text-gray-700">
                            {option}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Jumbled Question Items - Simple MCQ-style display with grip dots */}
                {question.type === QUESTION_TYPES.JUMBLED && expandedQuestionId !== question.id && (
                  <div className="mt-3 space-y-2">
                    {(() => {
                      // Get jumbledOptions or jumbledItems if they exist
                      const jumbledItems = (question as any).jumbledOptions || (question as any).jumbledItems;
                      
                      // If no pre-shuffled items, use correctAnswers (shuffled)
                      const itemsToShow = jumbledItems && jumbledItems.length > 0
                        ? jumbledItems
                        : question.correctAnswers
                        ? [...question.correctAnswers].sort(() => Math.random() - 0.5)
                        : [];
                      
                      return itemsToShow.length > 0 ? itemsToShow.map((item: string, itemIndex: number) => (
                        <div
                          key={itemIndex}
                          className="flex items-center space-x-2 p-2.5 rounded-lg border bg-purple-50 border-purple-200"
                        >
                          <div className="w-6 h-6 flex items-center justify-center text-purple-500">
                            <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                          </div>
                          <span className="text-sm text-gray-700">
                            {item}
                          </span>
                        </div>
                      )) : null;
                    })()}
                  </div>
                )}

                {/* Fill in the Blank - Hide answers in collapsed view */}

                {/* Chapter Section - Outside Question Details (CODE ONLY) */}
                {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.chapter && (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                    <p className="text-sm text-gray-900">{question.chapter}</p>
                  </div>
                )}

                {/* Solution Hint Section - Outside Question Details (CODE ONLY) */}
                {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.hint && (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Solution Hint</h2>
                    {containsHTML(question.hint) ? (
                      <div 
                        className="text-sm text-gray-700 italic prose prose-sm max-w-none [&_.katex]:text-sm [&_.katex]:inline-block"
                        dangerouslySetInnerHTML={{ 
                          __html: question.hint.replace(
                            /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                            (match: string, latex: string) => {
                              try {
                                const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                return katex.renderToString(decodedLatex, { throwOnError: false, displayMode: false });
                              } catch (e) { return match; }
                            }
                          )
                        }}
                      />
                    ) : (
                      <p className="text-sm text-gray-700 italic">{question.hint}</p>
                    )}
                  </div>
                )}

                {/* Expanded Details View - Only show if there's content */}
                {expandedQuestionId === question.id && (() => {
                  // Check if there's content to display in Question Details box
                  const hasFITB = (() => {
                    const typeStr = (question.type || '').toString().toLowerCase().replace(/\s+/g, '');
                    const isFITB = typeStr === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.FITB;
                    const answers = question.correctAnswers;
                    return isFITB && answers && Array.isArray(answers) && answers.length > 0;
                  })();
                  const hasJumbled = (question.type === QUESTION_TYPES.JUMBLED) && 
                                     question.correctAnswers && 
                                     Array.isArray(question.correctAnswers) && 
                                     question.correctAnswers.length > 0;
  
                  
                  const hasContent = hasFITB || hasJumbled;
                  
                  if (!hasContent) return null;
                  
                  return (
                    <>
                      {/* FITB - Correct Answers (Outside the gray box) */}
                      {(() => {
                      // Check all possible type variations
                      const typeStr = (question.type || '').toString().toLowerCase().replace(/\s+/g, '');
                      const isFITB = typeStr === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.FITB;
                      
                      // Get answers from correctAnswers
                      const answers = question.correctAnswers;
                      
                      if (!isFITB || !answers || !Array.isArray(answers) || answers.length === 0) {
                        return null;
                      }

                      return (
                        <div className="mt-4">
                          {/* Correct Answers - as h2 heading without box */}
                          <h2 className="text-lg font-bold text-gray-900 mb-3">Correct Answers:</h2>
                          <div className="flex flex-wrap gap-2">
                            {answers.map((blank: string, blankIndex: number) => (
                              <span
                                key={blankIndex}
                                className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg"
                              >
                                Blank {blankIndex + 1}: {safeRender(blank)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                      })()}

                      {/* Jumbled questions sections */}
                      {hasJumbled && (
                        <>
                        {/* Jumbled - Show items with grip dots and correct sequence */}
                        {(() => {
                        // Helper function to convert Firebase object-arrays to real arrays
                        const convertToArray = (obj: any): any[] | null => {
                          if (!obj) return null;
                          if (Array.isArray(obj)) return obj;
                          
                          // Check if it's a Firebase object with numeric keys
                          if (typeof obj === 'object') {
                            const keys = Object.keys(obj);
                            const numericKeys = keys.filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
                            if (numericKeys.length > 0) {
                              console.log('🔄 Converting Firebase object to array:', obj);
                              return numericKeys.map(k => obj[k]);
                            }
                          }
                          
                          return null;
                        };
                        
                        const isJumbledType = question.type === QUESTION_TYPES.JUMBLED;
                        
                        // Convert correctAnswers from Firebase format if needed
                        const correctAnswersArray = convertToArray(question.correctAnswers);
                        const hasCorrectAnswers = correctAnswersArray && correctAnswersArray.length > 0;
                        
                        // COMPREHENSIVE DEBUG LOGGING
                        console.log('🔍 JUMBLED QUESTION FULL DEBUG:', {
                          questionId: question.id,
                          questionType: question.type,
                          typeOfType: typeof question.type,
                          isJumbledType: isJumbledType,
                          hasCorrectAnswers: hasCorrectAnswers,
                          correctAnswersRaw: question.correctAnswers,
                          correctAnswersConverted: correctAnswersArray,
                          correctAnswersType: typeof question.correctAnswers,
                          correctAnswersIsArray: Array.isArray(question.correctAnswers),
                          correctAnswersLength: correctAnswersArray?.length || 0,
                          jumbledItemsRaw: (question as any).jumbledItems,
                          jumbledItemsType: typeof (question as any).jumbledItems,
                          jumbledItemsIsArray: Array.isArray((question as any).jumbledItems),
                          jumbledItemsLength: (question as any).jumbledItems?.length || 0,
                          jumbledOptions: (question as any).jumbledOptions
                        });
                        
                        if (!isJumbledType) {
                          console.log('❌ NOT JUMBLED TYPE - Type is:', question.type);
                          return null;
                        }
                        
                        if (!hasCorrectAnswers) {
                          console.log('❌ NO CORRECT ANSWERS - correctAnswers:', question.correctAnswers);
                          return null;
                        }
                        
                        console.log('✅ RENDERING JUMBLED SECTIONS');
                        
                        return (
                          <>
                            {/* Jumbled Items (What student sees) */}
                            <div className="mt-4">
                              <h2 className="text-lg font-bold text-gray-900 mb-3">Items to Arrange:</h2>
                              <div className="space-y-2">
                                {(() => {
                                  // Convert jumbledItems from Firebase format if needed
                                  const jumbledItemsRaw = (question as any).jumbledOptions || (question as any).jumbledItems;
                                  const jumbledItemsArray = convertToArray(jumbledItemsRaw);
                                  
                                  const itemsToShow = jumbledItemsArray && jumbledItemsArray.length > 0
                                    ? jumbledItemsArray
                                    : correctAnswersArray ? [...correctAnswersArray].sort(() => Math.random() - 0.5) : [];
                                  
                                  console.log('🎯 Items to show:', itemsToShow);
                                  
                                  return itemsToShow.map((item: string, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-center space-x-2 p-2.5 rounded-lg border bg-purple-50 border-purple-200"
                                    >
                                      <div className="w-6 h-6 flex items-center justify-center text-purple-500">
                                        <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                                      </div>
                                      <span className="text-sm text-gray-700">
                                        {safeRender(item)}
                                      </span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>

                            {/* Correct Sequence (The Answer) */}
                            <div className="mt-4">
                              <h2 className="text-lg font-bold text-gray-900 mb-3">Correct Sequence:</h2>
                              <div className="space-y-2">
                                {correctAnswersArray && correctAnswersArray.map((item: string, seqIndex: number) => (
                                  <div
                                    key={seqIndex}
                                    className="flex items-center space-x-2 p-2.5 rounded-lg border bg-green-50 border-green-300"
                                  >
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-green-500 text-white">
                                      {seqIndex + 1}
                                    </div>
                                    <span className="text-sm text-gray-700">
                                      {safeRender(item)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                        </>
                      )}
                    </>
                  );
                })()}

                {/* Options with Correct Answer - Outside (MCQ ONLY) */}
                {expandedQuestionId === question.id && question.type === QUESTION_TYPES.MCQ && question.options && (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Options with Correct Answer</h2>
                    <div className="space-y-2">
                      {question.options.map((option: string, optIndex: number) => {
                        // Check if this option is correct
                        // Method 1: Index-based (question.correctAnswer)
                        const isCorrectByIndex = question.correctAnswer === optIndex;
                        
                        // Method 2: Text-based (question.correctAnswers array)
                        const isCorrectByText = question.correctAnswers && 
                          Array.isArray(question.correctAnswers) && 
                          question.correctAnswers.some((ans: string) => 
                            ans.trim().toLowerCase() === option.trim().toLowerCase()
                          );
                        
                        const isCorrect = isCorrectByIndex || isCorrectByText;
                        
                        return (
                          <div
                            key={optIndex}
                            className={`flex items-center p-2.5 rounded-lg border ${
                              isCorrect
                                ? 'bg-green-50 border-green-300'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                  isCorrect
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-300 text-gray-700'
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}
                              </div>
                              <span className={`text-sm ${
                                isCorrect
                                  ? 'text-green-900 font-medium'
                                  : 'text-gray-700'
                              }`}>
                                {option}
                              </span>
                            </div>
                            {isCorrect && (
                              <span className="ml-auto text-xs font-semibold text-green-600 flex-shrink-0">✓ Correct Answer</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Chapter Section - Outside Question Details (NON-CODE QUESTIONS) */}
                {expandedQuestionId === question.id && question.type !== QUESTION_TYPES.CODE && question.chapter && (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                    <p className="text-sm text-gray-900">{question.chapter}</p>
                  </div>
                )}

                {/* Hint Section - Outside Question Details (NON-CODE QUESTIONS) */}
                {expandedQuestionId === question.id && question.type !== QUESTION_TYPES.CODE && question.hint && (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Hint</h2>
                    {containsHTML(question.hint) ? (
                      <div 
                        className="text-sm text-gray-700 italic prose prose-sm max-w-none [&_.katex]:text-sm [&_.katex]:inline-block"
                        dangerouslySetInnerHTML={{ 
                          __html: question.hint.replace(
                            /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                            (match: string, latex: string) => {
                              try {
                                const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                return katex.renderToString(decodedLatex, { throwOnError: false, displayMode: false });
                              } catch (e) { return match; }
                            }
                          )
                        }}
                      />
                    ) : (
                      <p className="text-sm text-gray-700 italic">{question.hint}</p>
                    )}
                  </div>
                )}

                {/* Solution Section - Outside Question Details (NON-CODE QUESTIONS) */}
                {expandedQuestionId === question.id && question.type !== QUESTION_TYPES.CODE && question.solution && (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Solution</h2>
                    {(question.type === QUESTION_TYPES.MCQ || question.type === QUESTION_TYPES.JUMBLED || question.type === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.DESCRIPTIVE) ? (
                      // Enhanced solution display for MCQ, jumbled, FITB, and descriptive questions - NO BOX
                      <div>
                          {(() => {
                            // Parse the solution to extract sections
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(question.solution, 'text/html');
                            const elements: React.ReactElement[] = [];
                            let keyCounter = 0;

                            // Process all child nodes
                            Array.from(doc.body.childNodes).forEach((node) => {
                              if (node.nodeType === Node.TEXT_NODE) {
                                const text = node.textContent?.trim();
                                if (text) {
                                  elements.push(
                                    <p key={`text-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                      {text}
                                    </p>
                                  );
                                }
                              } else if (node.nodeType === Node.ELEMENT_NODE) {
                                const element = node as HTMLElement;
                                const tagName = element.tagName.toLowerCase();
                                const content = element.textContent || '';

                                // Handle different HTML tags
                                if (tagName === 'p') {
                                  // Check if it's a special heading-like paragraph
                                  const text = content.trim();
                                  
                                  // Skip "Correct Answer:" heading in any format - it's redundant in solution section
                                  if (text.match(/^Correct Answer:?$/i) || text.match(/^<strong>Correct Answer:?<\/strong>$/i)) {
                                    return; // Skip this heading
                                  }
                                  
                                  // Also skip if the paragraph only contains "Correct Answer:" even with HTML tags
                                  const innerHTML = element.innerHTML?.trim() || '';
                                  if (innerHTML.match(/^<strong>Correct Answer:?<\/strong>$/i) || innerHTML.match(/^Correct Answer:?$/i)) {
                                    return; // Skip this heading
                                  }
                                  
                                  if (text.includes('Correct Sequence:')) {
                                    const innerHTML = element.innerHTML || '';
                                    const hasSpans = innerHTML.includes('<span');
                                    
                                    elements.push(
                                      <h3 
                                        key={`heading-${keyCounter++}`} 
                                        className="text-base font-bold text-gray-900 mb-2"
                                        {...(hasSpans ? { dangerouslySetInnerHTML: { __html: innerHTML } } : { children: text })}
                                      />
                                    );
                                  } else if (text.match(/^(Output:|Why this order:|Steps:|Note:|Important:)/i)) {
                                    const innerHTML = element.innerHTML || '';
                                    const hasSpans = innerHTML.includes('<span');
                                    
                                    elements.push(
                                      <h4 
                                        key={`subheading-${keyCounter++}`} 
                                        className="text-sm font-semibold text-gray-800 mt-3 mb-1"
                                        {...(hasSpans ? { dangerouslySetInnerHTML: { __html: innerHTML } } : { children: text })}
                                      />
                                    );
                                  } else if (text) {
                                    // Check if paragraph contains HTML spans (for highlighting)
                                    const innerHTML = element.innerHTML || '';
                                    const hasSpans = innerHTML.includes('<span');
                                    
                                    if (hasSpans) {
                                      // Preserve HTML for highlighting
                                      elements.push(
                                        <p 
                                          key={`para-${keyCounter++}`} 
                                          className="text-sm text-gray-700 leading-relaxed"
                                          dangerouslySetInnerHTML={{ __html: innerHTML }}
                                        />
                                      );
                                    } else {
                                      // Plain text
                                      elements.push(
                                        <p key={`para-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                          {text}
                                        </p>
                                      );
                                    }
                                  }
                                } else if (tagName === 'pre' || tagName === 'code') {
                                  // Check if this code has yellow highlighting spans (for FITB solutions)
                                  const innerHTML = element.innerHTML || '';
                                  const hasYellowHighlights = innerHTML.includes('bg-yellow') || 
                                                             innerHTML.includes('bg-amber') || 
                                                             innerHTML.includes('bg-green') ||
                                                             innerHTML.includes('background-color');
                                  
                                  if (hasYellowHighlights) {
                                    // Preserve the HTML with yellow highlights - don't use SyntaxHighlighter
                                    const codeId = `code-${question.id}-${keyCounter}`;
                                    elements.push(
                                      <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden bg-gray-900">
                                        {/* Terminal-style header with dots and copy button */}
                                        <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                          </div>
                                          <button
                                            onClick={() => copyToClipboard(element.textContent || '', codeId)}
                                            className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                            title="Copy to clipboard"
                                          >
                                            {copiedCode === codeId ? (
                                              <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                            ) : (
                                              <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                            )}
                                          </button>
                                        </div>
                                        
                                        {/* Code with preserved HTML highlighting */}
                                        <div className="pt-10 pb-4 px-4">
                                          <pre 
                                            className="text-sm font-mono text-gray-100 whitespace-pre-wrap"
                                            style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
                                            dangerouslySetInnerHTML={{ __html: innerHTML }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // Use SyntaxHighlighter for code without highlights
                                    const content = element.textContent || '';
                                    const detectLanguage = (code: string): string => {
                                      if (code.includes('System.out.println') || code.includes('public class') || code.includes('static void')) {
                                        return 'java';
                                      } else if (code.includes('print(') || code.includes('def ') || code.includes('import ')) {
                                        return 'python';
                                      } else if (code.includes('console.log') || code.includes('const ') || code.includes('let ') || code.includes('function')) {
                                        return 'javascript';
                                      } else if (code.includes('#include') || code.includes('cout') || code.includes('cin')) {
                                        return 'cpp';
                                      } else if (code.includes('printf') || code.includes('scanf')) {
                                        return 'c';
                                      }
                                      return 'java'; // Default to Java
                                    };
                                    
                                    const language = detectLanguage(content);
                                    const codeId = `code-${question.id}-${keyCounter}`;
                                    
                                    elements.push(
                                      <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden">
                                        {/* Terminal-style header with dots and copy button */}
                                        <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                          {/* macOS-style dots */}
                                          <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                          </div>
                                          
                                          {/* Copy button */}
                                          <button
                                            onClick={() => copyToClipboard(content, codeId)}
                                            className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                                            title="Copy to clipboard"
                                          >
                                            {copiedCode === codeId ? (
                                              <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                            ) : (
                                              <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                            )}
                                          </button>
                                        </div>
                                        
                                        {/* Code content with top padding for header */}
                                        <div className="pt-10">
                                          <SyntaxHighlighter
                                            language={language}
                                            style={vscDarkPlus}
                                            customStyle={{
                                              margin: 0,
                                              borderRadius: 0,
                                              borderBottomLeftRadius: '0.5rem',
                                              borderBottomRightRadius: '0.5rem',
                                              fontSize: '0.875rem',
                                              padding: '1rem',
                                              paddingTop: '0.5rem'
                                            }}
                                            showLineNumbers={false}
                                          >
                                            {content}
                                          </SyntaxHighlighter>
                                        </div>
                                      </div>
                                    );
                                  }
                                } else if (tagName === 'ul' || tagName === 'ol') {
                                  // Lists - preserve HTML for highlighting in list items
                                  const listItems = Array.from(element.querySelectorAll('li'));
                                  elements.push(
                                    <ul key={`list-${keyCounter++}`} className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-4">
                                      {listItems.map((li, idx) => {
                                        const liInnerHTML = li.innerHTML || '';
                                        const hasSpans = liInnerHTML.includes('<span');
                                        
                                        return hasSpans ? (
                                          <li key={idx} dangerouslySetInnerHTML={{ __html: liInnerHTML }} />
                                        ) : (
                                          <li key={idx}>{li.textContent}</li>
                                        );
                                      })}
                                    </ul>
                                  );
                                } else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
                                  const innerHTML = element.innerHTML || '';
                                  const hasSpans = innerHTML.includes('<span');
                                  
                                  if (hasSpans) {
                                    elements.push(
                                      <h3 
                                        key={`heading-${keyCounter++}`} 
                                        className="text-base font-bold text-gray-900 mb-2"
                                        dangerouslySetInnerHTML={{ __html: innerHTML }}
                                      />
                                    );
                                  } else {
                                    elements.push(
                                      <h3 key={`heading-${keyCounter++}`} className="text-base font-bold text-gray-900 mb-2">
                                        {content}
                                      </h3>
                                    );
                                  }
                                } else {
                                  // Default: treat as paragraph - preserve HTML for highlighting
                                  const innerHTML = element.innerHTML || '';
                                  const hasSpans = innerHTML.includes('<span');
                                  
                                  if (content.trim()) {
                                    if (hasSpans) {
                                      elements.push(
                                        <p 
                                          key={`default-${keyCounter++}`} 
                                          className="text-sm text-gray-700 leading-relaxed"
                                          dangerouslySetInnerHTML={{ __html: innerHTML }}
                                        />
                                      );
                                    } else {
                                      elements.push(
                                        <p key={`default-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                          {content}
                                        </p>
                                      );
                                    }
                                  }
                                }
                              }
                            });

                            return elements.length > 0 ? elements : (
                              <div 
                                className="text-sm text-gray-900 prose prose-sm max-w-none [&_.katex]:text-sm [&_.katex]:inline-block"
                                dangerouslySetInnerHTML={{ 
                                  __html: question.solution.replace(
                                    /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                                    (match: string, latex: string) => {
                                      try {
                                        const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                        return katex.renderToString(decodedLatex, { throwOnError: false, displayMode: false });
                                      } catch (e) { return match; }
                                    }
                                  )
                                }}
                              />
                            );
                          })()}
                      </div>
                    ) : (
                      // Standard solution display for other question types
                      <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <button
                          onClick={() => copyToClipboard(question.solution, `solution-${question.id}`)}
                          className="absolute top-2 right-2 z-10 p-2 rounded-md bg-white hover:bg-gray-100 text-gray-700 transition-all shadow-sm border border-gray-300"
                          title="Copy to clipboard"
                        >
                          {copiedCode === `solution-${question.id}` ? (
                            <FontAwesomeIcon icon={faCheck} className="text-green-600" />
                          ) : (
                            <FontAwesomeIcon icon={faCopy} />
                          )}
                        </button>
                        {containsHTML(question.solution) ? (
                          <div 
                            className="p-4 text-sm text-gray-900 prose prose-sm max-w-none [&_.katex]:text-sm [&_.katex]:inline-block"
                            dangerouslySetInnerHTML={{ 
                              __html: question.solution.replace(
                                /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                                (match: string, latex: string) => {
                                  try {
                                    const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                    return katex.renderToString(decodedLatex, { throwOnError: false, displayMode: false });
                                  } catch (e) { return match; }
                                }
                              )
                            }}
                          />
                        ) : (
                          <div className="p-4 text-sm text-gray-900 whitespace-pre-wrap">
                            {question.solution}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Solution Section - Outside Question Details (CODE ONLY) */}
                {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.solution && (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Solution</h2>
                    {containsHTML(question.solution) ? (
                      // If solution contains HTML (with possible math formulas), render as HTML
                      <div 
                        className="text-sm text-gray-900 prose prose-sm max-w-none [&_.katex]:text-sm [&_.katex]:inline-block p-4 bg-gray-50 rounded-lg"
                        dangerouslySetInnerHTML={{ 
                          __html: question.solution.replace(
                            /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                            (match: string, latex: string) => {
                              try {
                                const decodedLatex = latex.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                                return katex.renderToString(decodedLatex, { throwOnError: false, displayMode: false });
                              } catch (e) { return match; }
                            }
                          )
                        }}
                      />
                    ) : (
                      // If solution is plain code, render with syntax highlighting
                      <div className="relative rounded-lg overflow-hidden">
                        {/* Terminal-style header with dots and copy button */}
                        <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                          {/* macOS-style dots */}
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          </div>
                          
                          {/* Copy button */}
                          <button
                            onClick={() => copyToClipboard(question.solution, `solution-${question.id}`)}
                            className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                            title="Copy to clipboard"
                          >
                            {copiedCode === `solution-${question.id}` ? (
                              <FontAwesomeIcon icon={faCheck} className="text-sm" />
                            ) : (
                              <FontAwesomeIcon icon={faCopy} className="text-sm" />
                            )}
                          </button>
                        </div>
                        
                        {/* Code content with top padding for header */}
                        <div className="pt-10">
                          <SyntaxHighlighter
                            language={question.programmingLanguage?.toLowerCase() || 'python'}
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              borderRadius: 0,
                              borderBottomLeftRadius: '0.5rem',
                              borderBottomRightRadius: '0.5rem',
                              fontSize: '0.875rem',
                              padding: '1rem',
                              paddingTop: '0.5rem'
                            }}
                            showLineNumbers={false}
                          >
                            {question.solution}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Test Cases Section - Outside, Only for Code Questions */}
                {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.testCases && Array.isArray(question.testCases) && question.testCases.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-lg font-bold text-gray-900">Test Cases</h2>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-gray-600">
                          {question.testCases.length} test cases
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                          Total: {question.testCases.reduce((sum: number, tc: any) => sum + (tc.marks || 0), 0).toFixed(1)} marks
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-200">
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">#</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Input</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Expected Output</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Marks</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {question.testCases.map((testCase: any, tcIndex: number) => (
                            <tr key={tcIndex} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white" style={{ background: brandTheme.gradients.primary }}>
                                  {tcIndex + 1}
                                </span>
                              </td>
                                <td className="px-3 py-2">
                                <div className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 whitespace-pre-wrap">
                                  {testCase.input ? testCase.input.replace(/\\n/g, '\n') : 'N/A'}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-mono text-xs bg-green-50 px-2 py-1 rounded border border-green-200 text-green-700 whitespace-pre-wrap">
                                  {testCase.expected_output ? testCase.expected_output.replace(/\\n/g, '\n') : 'N/A'}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
                                  {testCase.marks !== undefined ? testCase.marks.toFixed(1) : '0.0'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Starter Code Template Section - Outside, Only for Code Questions */}
                {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.testStub && (() => {
                  console.log('🔍 Starter Code Section Check:', {
                    questionId: question.id,
                    hasTestStub: !!question.testStub,
                    testStubLength: question.testStub?.length || 0
                  });
                  return true;
                })() && (
                  <div className="mt-3">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Starter Code Template</h2>
                    <div className="relative rounded-lg overflow-hidden">
                      {/* Terminal-style header with dots and copy button */}
                      <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                        {/* macOS-style dots */}
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        
                        {/* Copy button */}
                        <button
                          onClick={() => copyToClipboard(question.testStub, `stub-${question.id}`)}
                          className="p-1.5 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                          title="Copy to clipboard"
                        >
                          {copiedCode === `stub-${question.id}` ? (
                            <FontAwesomeIcon icon={faCheck} className="text-sm" />
                          ) : (
                            <FontAwesomeIcon icon={faCopy} className="text-sm" />
                          )}
                        </button>
                      </div>
                      
                      {/* Code content with top padding for header */}
                      <div className="pt-10">
                        <SyntaxHighlighter
                          language={question.programmingLanguage?.toLowerCase() || 'python'}
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            borderRadius: 0,
                            borderBottomLeftRadius: '0.5rem',
                            borderBottomRightRadius: '0.5rem',
                            fontSize: '0.875rem',
                            padding: '1rem',
                            paddingTop: '0.5rem'
                          }}
                          showLineNumbers={false}
                        >
                          {question.testStub}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
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
                        <FontAwesomeIcon icon={faTrophy} />
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
                      style={{ color: brandTheme.colors.primary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {expandedQuestionId === question.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalQuestions > questionsPerPage && !isLoading && (
          <div className="mt-6 pb-4 flex items-center justify-between border-t border-gray-200 pt-4 px-6">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold">{((currentPage - 1) * questionsPerPage) + 1}</span> to{' '}
              <span className="font-semibold">
                {Math.min(currentPage * questionsPerPage, totalQuestions)}
              </span>{' '}
              of <span className="font-semibold">{totalQuestions}</span> questions
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                    // Scroll to top of question list
                    document.querySelector('.flex-1.flex.flex-col')?.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg transition-all ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-md'
                }`}
                style={currentPage > 1 ? {
                  borderColor: brandTheme.colors.primary + '40'
                } : {}}
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.ceil(totalQuestions / questionsPerPage) }, (_, i) => i + 1)
                  .filter(page => {
                    // Show first page, last page, current page, and pages around current
                    const totalPages = Math.ceil(totalQuestions / questionsPerPage);
                    return (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    );
                  })
                  .map((page, index, array) => {
                    // Add ellipsis
                    const prevPage = array[index - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;

                    return (
                      <div key={page} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => {
                            setCurrentPage(page);
                            document.querySelector('.flex-1.flex.flex-col')?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`min-w-[40px] h-10 rounded-lg font-semibold transition-all ${
                            currentPage === page
                              ? 'text-white shadow-md'
                              : 'text-gray-700 bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                          style={currentPage === page ? {
                            background: brandTheme.gradients.primary
                          } : {}}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                onClick={() => {
                  if (currentPage < Math.ceil(totalQuestions / questionsPerPage)) {
                    setCurrentPage(currentPage + 1);
                    document.querySelector('.flex-1.flex.flex-col')?.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                disabled={currentPage >= Math.ceil(totalQuestions / questionsPerPage)}
                className={`p-2 rounded-lg transition-all ${
                  currentPage >= Math.ceil(totalQuestions / questionsPerPage)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow-md'
                }`}
                style={currentPage < Math.ceil(totalQuestions / questionsPerPage) ? {
                  borderColor: brandTheme.colors.primary + '40'
                } : {}}
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image Carousel Modal */}
      {imageCarouselOpen && carouselImages.length > 0 && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setImageCarouselOpen(false)}
        >
          <div 
            className="relative w-full max-w-5xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setImageCarouselOpen(false)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all z-10"
              title="Close (Esc)"
            >
              <FontAwesomeIcon icon={faXmark} size="lg" />
            </button>

            {/* Image Counter */}
            <div className="absolute -top-12 left-0 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-semibold">
              {currentImageIndex + 1} / {carouselImages.length}
            </div>

            {/* Main Image Container */}
            <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Image */}
              <div className="relative w-full" style={{ minHeight: '400px', maxHeight: '80vh' }}>
                <img
                  src={carouselImages[currentImageIndex]}
                  alt={`Question Image ${currentImageIndex + 1}`}
                  className="w-full h-full object-contain"
                  style={{ maxHeight: '80vh' }}
                />
              </div>

              {/* Navigation Arrows - Only show if more than 1 image */}
              {carouselImages.length > 1 && (
                <>
                  {/* Previous Button */}
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? carouselImages.length - 1 : prev - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
                    title="Previous (←)"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} size="lg" />
                  </button>

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev === carouselImages.length - 1 ? 0 : prev + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-all hover:scale-110"
                    title="Next (→)"
                  >
                    <FontAwesomeIcon icon={faChevronRight} size="lg" />
                  </button>
                </>
              )}

              {/* Thumbnail Strip - Only show if more than 1 image */}
              {carouselImages.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center justify-center space-x-2 overflow-x-auto">
                    {carouselImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === currentImageIndex
                            ? 'border-white scale-110 shadow-lg'
                            : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard Navigation Hint */}
            {carouselImages.length > 1 && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/60 text-xs flex items-center space-x-4">
                <span>← Previous</span>
                <span>•</span>
                <span>Next →</span>
                <span>•</span>
                <span>ESC to close</span>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    
    <style>{`
      .highlight-question {
        animation: highlight-pulse 1s ease-in-out 3;
        border: 2px solid #3b82f6 !important;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2) !important;
        background: rgba(59, 130, 246, 0.05) !important;
      }

      @keyframes highlight-pulse {
        0%, 100% {
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
        }
        50% {
          box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.4);
        }
      }

      /* Hide scrollbar for Chrome, Safari and Opera */
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }

      /* Hide scrollbar for IE, Edge and Firefox */
      .scrollbar-hide {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
      }

      /* Smooth scrolling */
      .scrollbar-hide {
        scroll-behavior: smooth;
      }
    `}</style>
    </>
  );
}
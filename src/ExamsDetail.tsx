// =============================================================================
// ExamsDetail.tsx — extracted verbatim from App.tsx (teacher/admin exam-detail
// render). Lazy-loaded from App via React.lazy to lighten the main bundle.
// The JSX is unchanged; every App local it uses is passed in as a prop.
// =============================================================================
import { useEffect, type ReactElement } from 'react';
import katex from 'katex';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAward, faBookOpen, faCalendar, faChartBar, faCheck, faChevronDown,
  faCircleQuestion, faClipboardList, faClock, faCopy, faFileLines, faGripVertical,
  faImage, faLayerGroup, faStar, faTrophy, faUser, faUserCheck, faUsers, faXmark,
} from '@fortawesome/sharp-light-svg-icons';
import { ACTIVE_ITEMS, EXAM_MODES, QUESTION_TYPES, QUESTION_TYPE_LABELS, EXAM_MODE_LABELS } from './constants';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

void useEffect; void vscDarkPlus; void FontAwesomeIcon; void SyntaxHighlighter;
void faAward; void faBookOpen; void faCalendar; void faChartBar; void faCheck;
void faChevronDown; void faCircleQuestion; void faClipboardList; void faClock;
void faCopy; void faFileLines; void faGripVertical; void faImage; void faLayerGroup;
void faStar; void faTrophy; void faUser; void faUserCheck; void faUsers; void faXmark;
void ACTIVE_ITEMS; void EXAM_MODES; void QUESTION_TYPES; void QUESTION_TYPE_LABELS; void EXAM_MODE_LABELS; void katex; export type _RE = ReactElement;

export default function ExamsDetail({
  selectedExam, brandTheme, expandedQuestionId,
  imageCarouselOpen, currentImageIndex, carouselImages,
  showRestrictionDialog, restrictionMessage,
  safeRender, isExamCompleted, isExamLive, formatDate,
  copyToClipboard, canViewLiveStats,
  setExpandedQuestionId, setIsViewingLiveStats, setIsViewingAttendance,
  setIsLeftCollapsed, setIsMainCollapsed, setShowRestrictionDialog,
  setRestrictionMessage, setImageCarouselOpen, setCurrentImageIndex,
  setCarouselImages, setActiveItem,
  copiedCode, convertToArray, canMarkAttendance,
  setShowStudentPreview, setShowDeleteExamDialog, setSelectedStudentForDetail,
  setIsCreateModalOpen, setExamToDelete, setEditingExam,
}: any) {
  void imageCarouselOpen; void currentImageIndex; void carouselImages;
  void showRestrictionDialog; void restrictionMessage;
  void copyToClipboard; void canViewLiveStats;
  void setShowRestrictionDialog; void setRestrictionMessage;
  void setImageCarouselOpen; void setCurrentImageIndex; void setCarouselImages; void setActiveItem;
  void setIsViewingLiveStats; void setIsViewingAttendance; void setIsLeftCollapsed; void setIsMainCollapsed;
  void setExpandedQuestionId; void expandedQuestionId; void formatDate; void isExamLive; void isExamCompleted;
  void safeRender; void brandTheme; void selectedExam;

  return (
            <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-6 pb-6" style={{ background: '#eef1f6' }}>
              {/* Header - show for all exams in admin view */}
              {(
              <div className="bg-white sticky top-0 z-20 pt-6 pb-4 px-8 pr-12 mb-2 border-b border-gray-100">
               {/* Title Row with 3-dots Menu */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900">{safeRender(selectedExam.title)}</h1>
                    
                    {/* Live Indicator for Online Exams */}
                    {selectedExam.mode === EXAM_MODES.ONLINE && isExamLive(selectedExam.examDate, selectedExam.examTime, selectedExam.duration, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0) && (
                      <div className="flex items-center space-x-2">
                        <div className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </div>
                        <span className="text-sm font-semibold text-green-600">LIVE</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 3-dots Menu */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        // Toggle menu visibility
                        const menu = document.getElementById('exam-menu-dropdown');
                        if (menu) {
                          menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                        }
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                        <circle cx="12" cy="12" r="1" fill="currentColor"/>
                        <circle cx="12" cy="5" r="1" fill="currentColor"/>
                        <circle cx="12" cy="19" r="1" fill="currentColor"/>
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div
                      id="exam-menu-dropdown"
                      style={{ display: 'none' }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                    >
                      {(() => {
                        // Check if there's less than 24 hours until exam starts
                        const now = new Date();
                        const examStartTime = new Date(selectedExam.examDate);
                        
                        if (selectedExam.examTime) {
                          const [hours, minutes] = selectedExam.examTime.split(':').map(Number);
                          examStartTime.setHours(hours, minutes, 0, 0);
                        } else {
                          examStartTime.setHours(0, 0, 0, 0);
                        }
                        
                        // Calculate exam END time (start + duration)
                        const duration = parseInt(selectedExam.duration) || 60;
                        const examEndTime = new Date(examStartTime.getTime() + duration * 60 * 1000);

                        const timeDifference = examStartTime.getTime() - now.getTime();
                        const hoursUntilExam = timeDifference / (1000 * 60 * 60);
                        const isWithin24Hours = hoursUntilExam <= 24 && hoursUntilExam >= 0;

                        // Check exam status
                        const hasExamStarted = now.getTime() > examStartTime.getTime();  // ✅ For delete
                        const hasExamEnded = now.getTime() > examEndTime.getTime();      // ✅ For edit

                        // Separate restrictions for Edit vs Delete
                        const isEditRestricted = hasExamEnded;  // Only block AFTER exam ends
                        const isDeleteRestricted = isWithin24Hours || hasExamStarted;  // ✅ Block from 24h before through end

                        return (
                          <>
                            {/* 1. Student Page - Always first and clickable (Hidden for offline exams) */}
                            {selectedExam.mode !== EXAM_MODES.OFFLINE && (
                              <button
                                onClick={() => {
                                  const menu = document.getElementById('exam-menu-dropdown');
                                  if (menu) menu.style.display = 'none';
                                  setShowStudentPreview(true);
                                  setActiveItem('exams');
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors flex items-center space-x-3 border-b border-gray-200"
                              >
                                <FontAwesomeIcon icon={faClipboardList} className="text-purple-600" />
                                <span className="text-sm font-medium text-gray-900">Student Page</span>
                              </button>
                            )}

                            {/* 2. Edit - Show dialog if restricted */}
                            <button
                              onClick={() => {
                                
                                const menu = document.getElementById('exam-menu-dropdown');
                                if (menu) menu.style.display = 'none';
                                
                                if (isEditRestricted) {
                                  // Format exam date for display
                                  const examDateFormatted = new Date(selectedExam.examDate).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  });
                                  
                                  setRestrictionMessage({
                                    title: 'Cannot Edit Exam',
                                    message: 'Editing is not allowed after the exam has passed. This ensures exam integrity and prevents changes that could affect completed student submissions.',
                                    icon: '🔒',
                                    examDate: examDateFormatted,
                                    examTime: selectedExam.examTime,
                                    hoursRemaining: hasExamEnded ? 0 : Math.floor(hoursUntilExam)
                                  });
                                  setShowRestrictionDialog(true);
                                } else {
                                  setEditingExam(selectedExam);
                                  setIsCreateModalOpen(true);
                                }
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
                            >
                              <FontAwesomeIcon icon={faFileLines} className={isEditRestricted ? 'text-gray-400' : 'text-blue-600'} />
                              <span className={`text-sm font-medium ${isEditRestricted ? 'text-gray-500' : 'text-gray-900'}`}>
                                Edit
                              </span>
                            </button>

                            {/* 3. Delete - Show dialog if restricted */}
                            <button
                              onClick={() => {
                                const menu = document.getElementById('exam-menu-dropdown');
                                if (menu) menu.style.display = 'none';
                                
                                if (isDeleteRestricted) {
                                  // Format exam date for display
                                  const examDateFormatted = new Date(selectedExam.examDate).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  });
                                  
                                  setRestrictionMessage({
                                    title: 'Cannot Delete Exam',
                                    message: hasExamEnded 
                                    ? 'Deletion is not allowed after the exam has passed. This protects historical records, maintains audit trails, and ensures data integrity for all stakeholders.'
                                    : hasExamStarted
                                      ? 'Deletion is not allowed while the exam is in progress. This protects the integrity of the ongoing examination and prevents disruption to students currently taking the exam.'
                                      : 'Deletion is not allowed within 24 hours of the exam start time. This protects student preparation, maintains data integrity, and ensures that last-minute changes don\'t disrupt the examination process.',
                                    icon: '🛡️',
                                    examDate: examDateFormatted,
                                    examTime: selectedExam.examTime,
                                    hoursRemaining: hasExamEnded ? 0 : Math.floor(hoursUntilExam)
                                  });
                                  setShowRestrictionDialog(true);
                                } else {
                                  setExamToDelete(selectedExam);
                                  setShowDeleteExamDialog(true);
                                }
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDeleteRestricted ? 'text-gray-400' : 'text-red-600'}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span className={`text-sm font-medium ${isDeleteRestricted ? 'text-gray-500' : 'text-gray-900'}`}>
                                Delete
                              </span>
                            </button>

                            {/* 4. Attendance */}
                            <button
                              onClick={() => {
                                const menu = document.getElementById('exam-menu-dropdown');
                                if (menu) menu.style.display = 'none';
                                setIsLeftCollapsed(true);
                                setIsMainCollapsed(true);
                                setIsViewingAttendance(true);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
                            >
                              <FontAwesomeIcon icon={faUserCheck} className={
                                canMarkAttendance(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration)
                                  ? 'text-green-600'
                                  : 'text-gray-400'
                              } />
                              <span className={`text-sm font-medium ${
                                canMarkAttendance(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration)
                                  ? 'text-gray-900'
                                  : 'text-gray-500'
                              }`}>
                                Attendance
                              </span>
                            </button>

                            {/* 5. Live Stats - Show dialog if restricted (Hidden for offline exams) */}
                            {selectedExam.mode !== EXAM_MODES.OFFLINE && (
                              <button
                                onClick={() => {
                                  const menu = document.getElementById('exam-menu-dropdown');
                                  if (menu) menu.style.display = 'none';
                                  
                                  const canView = canViewLiveStats(selectedExam.examDate, selectedExam.examTime || '');
                                  if (canView) {
                                    setIsViewingLiveStats(true);
                                    setIsLeftCollapsed(true);
                                    setIsMainCollapsed(true);
                                  } else {
                                    setRestrictionMessage({
                                      title: 'Live Stats Not Available Yet',
                                      message: 'Live statistics will be enabled 30 minutes before the exam starts and will remain accessible indefinitely. This allows you to monitor exam progress in real-time once the exam window opens.',
                                      icon: '📊'
                                    });
                                    setShowRestrictionDialog(true);
                                  }
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
                              >
                                <FontAwesomeIcon icon={faChartBar} className={
                                  canViewLiveStats(selectedExam.examDate, selectedExam.examTime || '')
                                    ? 'text-blue-600'
                                    : 'text-gray-400'
                                } />
                                <span className={`text-sm font-medium ${
                                  canViewLiveStats(selectedExam.examDate, selectedExam.examTime || '')
                                    ? 'text-gray-900'
                                    : 'text-gray-500'
                                }`}>
                                  Live Stats
                                </span>
                              </button>
                            )}

                            {/* 6. View Result - Show dialog if restricted */}
                            <button
                              onClick={() => {
                                const menu = document.getElementById('exam-menu-dropdown');
                                if (menu) menu.style.display = 'none';
                                
                                const isCompleted = isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0);
                                if (isCompleted) {
                                  // Navigate to Results section and ensure exam stays selected
                                  setActiveItem(ACTIVE_ITEMS.RESULTS);
                                  // Reset other view states
                                  setIsViewingLiveStats(false);
                                  setIsViewingAttendance(false);
                                  setSelectedStudentForDetail(null);
                                } else {
                                  setRestrictionMessage({
                                    title: 'Results Not Available Yet',
                                    message: 'Exam results will be available only after the exam has completely ended. This ensures all students have completed the exam before results are accessible.',
                                    icon: '🏆'
                                  });
                                  setShowRestrictionDialog(true);
                                }
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors flex items-center space-x-3 cursor-pointer"
                            >
                              <FontAwesomeIcon icon={faTrophy} className={isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0) ? 'text-green-600' : 'text-gray-400'} />
                              <span className={`text-sm font-medium ${isExamCompleted(selectedExam.examDate, selectedExam.examTime || '', selectedExam.duration, selectedExam.status, selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0) ? 'text-gray-900' : 'text-gray-500'}`}>
                                View Result
                              </span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Created By Row */}
                {(
                <div className="mb-3">
                  <p className="text-[16px] font-medium text-gray-500">
                    Created By - {((selectedExam.createdByName || selectedExam.createdBy || '') as string).split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}, {((selectedExam.createdByRole || '') as string).split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
                  </p>
                </div>
                )}
                
                {/* Metadata Row */}
                {(
                <div className="flex items-center flex-wrap gap-3 text-xs text-gray-700">
                  {/* Student Count */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faUsers} className="mr-1.5" />
                    {safeRender(selectedExam.totalStudents || 0)} Students
                  </span>
                  
                  {/* Exam Type */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faClipboardList} className="mr-1.5" />
                    {safeRender(selectedExam.type)}
                  </span>
                  
                  {/* Mode */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faCalendar} className="mr-1.5" />
                    {EXAM_MODE_LABELS[selectedExam.mode as keyof typeof EXAM_MODE_LABELS] || safeRender(selectedExam.mode)}
                  </span>
                  
                  {/* Status - Calculate real-time */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faTrophy} className="mr-1.5" />
                    {(() => {
                      const examIsLive = isExamLive(
                        selectedExam.examDate, 
                        selectedExam.examTime, 
                        selectedExam.duration,
                        selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0
                      );
                      const examIsCompleted = isExamCompleted(
                        selectedExam.examDate, 
                        selectedExam.examTime, 
                        selectedExam.duration, 
                        selectedExam.status,
                        selectedExam.personalityAssessment ? (selectedExam.likertDuration || 0) : 0
                      );
                      
                      if (examIsCompleted) return 'Completed';
                      if (examIsLive) return 'Live';
                      return 'Upcoming';
                    })()}
                  </span>
                  
                  {/* Exam ID */}
                  <span className="flex items-center">
                    <FontAwesomeIcon icon={faFileLines} className="mr-1.5" />
                    {safeRender(selectedExam.id)}
                  </span>
                </div>
                )}
              </div>
              )}

              

              {/* Question Paper / Questions List Section */}
              {selectedExam.mode === EXAM_MODES.OFFLINE ? (
                // Offline Exam - Show Scanned Images
                <div className="bg-white p-5 mb-6 mx-6 border border-gray-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                     <FontAwesomeIcon icon={faLayerGroup} className="text-gray-600" />
                    <span>Question Paper Images</span>
                    <span className="ml-auto text-xs font-medium text-gray-500">
                      {selectedExam.questionPaperImages?.length || 0} Pages
                    </span>
                  </h3>
                  {selectedExam.questionPaperImages && selectedExam.questionPaperImages.length > 0 ? (
                      <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <div className="flex flex-nowrap space-x-3" style={{ minWidth: 'max-content' }}>
                        {selectedExam.questionPaperImages.map((imageUrl: string, index: number) => (
                          <div 
                            key={index} 
                            className="flex-shrink-0 relative group cursor-pointer"
                            onClick={() => {
                              setCarouselImages(selectedExam.questionPaperImages || []);
                              setCurrentImageIndex(index);
                              setImageCarouselOpen(true);
                            }}
                          >
                            <div 
                              className="relative w-32 h-44 rounded-lg overflow-hidden border border-gray-200 transition-all shadow-sm hover:shadow-lg"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = brandTheme.colors.primary;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              <img 
                                src={imageUrl} 
                                alt={`Page ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 group-hover:opacity-90 transition-opacity" />
                              <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
                                <span className="text-xs font-semibold text-white bg-black/50 px-2 py-1 rounded">
                                  Page {index + 1}
                                </span>
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-white/90 rounded-full p-2">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: brandTheme.colors.primary }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon icon={faFileLines} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">No Images Uploaded</p>
                          <p className="text-xs text-gray-500">Upload scanned pages</p>
                        </div>
                      </div>
                      <button 
                        className="text-xs font-medium px-3 py-1.5 bg-white rounded-md transition-colors border"
                        style={{ 
                          color: brandTheme.colors.primary,
                          borderColor: `${brandTheme.colors.primary}33`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Upload
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Online Exam - Show Questions List
                <>
                  {/* Personality Assessment (Likert) Section */}
                  {selectedExam.personalityAssessment && selectedExam.likertQuestions && selectedExam.likertQuestions.length > 0 && (
                    <div className="bg-white p-2 mb-4 px-6">
                      <div 
                        className="cursor-pointer select-none"
                        onClick={() => {
                          const el = document.getElementById('likert-section-collapse');
                          if (el) el.classList.toggle('hidden');
                          const icon = document.getElementById('likert-chevron');
                          if (icon) icon.classList.toggle('rotate-180');
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
                            <FontAwesomeIcon icon={faChartBar} className="text-purple-600" />
                            <span>{(() => { const _hq = (selectedExam.questionsList?.length || 0) > 0; const _hp = !!((selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0); return (_hq || _hp) ? 'Section A — ' : ''; })()}Personality Assessment</span>
                          </h3>
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full flex items-center space-x-1.5">
                              <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                              <span>{selectedExam.likertDuration || 10} min</span>
                            </span>
                            <FontAwesomeIcon 
                              id="likert-chevron"
                              icon={faChevronDown} 
                              className="text-gray-400 text-sm transition-transform duration-200" 
                            />
                          </div>
                        </div>
                        <div className="text-xs font-medium text-gray-500">
                          Total Questions: {selectedExam.likertQuestions.length} • Big-8 personality traits{((selectedExam.questionsList?.length || 0) > 0 || ((selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0)) ? ' • Completed before the main exam' : ''}
                        </div>
                      </div>

                      <div id="likert-section-collapse" className="">
                        <div className="space-y-4 mt-3">
                          {selectedExam.likertQuestions.map((q: any, idx: number) => {
                            const isLikertExpanded = expandedQuestionId === `likert-${q.id || idx}`;
                            return (
                            <div 
                              key={q.id || idx}
                              className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-all duration-200"
                              onMouseEnter={(e: any) => {
                                e.currentTarget.style.borderColor = brandTheme.colors.primary;
                              }}
                              onMouseLeave={(e: any) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              {/* Question Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                                    style={{ background: brandTheme.gradients.primary }}
                                  >
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 mr-2">
                                      LIKERT
                                    </span>
                                    {q.board && (
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 mr-2">
                                        {q.board.toString().toUpperCase()}
                                      </span>
                                    )}
                                    {q.complexity && (
                                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                                        q.complexity === 'easy' ? 'bg-pink-100 text-pink-700' :
                                        q.complexity === 'medium' ? 'bg-green-100 text-green-700' :
                                        'bg-cyan-100 text-cyan-700'
                                      }`}>
                                        {q.complexity.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Question Text */}
                              <div className="text-sm text-gray-800 mb-3 leading-relaxed">
                                {q.questionText || q.question_text}
                              </div>

                              {/* Expanded Likert Detail */}
                              {isLikertExpanded && (
                                <div className="mt-3 mb-3 space-y-4">
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trait</span>
                                      <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                                        {q.likertTrait || q.chapter || '—'}
                                      </span>
                                    </div>
                                    {q.likertDirection && (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Direction</span>
                                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                          q.likertDirection === 'positive' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                          {q.likertDirection === 'positive' ? '↑ Positive' : '↓ Reverse'}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <h4 className="text-base font-semibold text-gray-900 mb-2">Likert Scale</h4>
                                    <div className="grid grid-cols-5 gap-2">
                                      {(q.options || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']).map((option: string, optIdx: number) => {
                                        const score = q.correctAnswers?.[optIdx];
                                        const isHighest = score && Number(score) === 5;
                                        const isLowest = score && Number(score) === 1;
                                        return (
                                          <div 
                                            key={optIdx}
                                            className={`rounded-xl p-2.5 text-center border-2 ${
                                              isHighest ? 'border-green-300 bg-green-50' :
                                              isLowest ? 'border-red-200 bg-red-50' :
                                              'border-gray-200 bg-gray-50'
                                            }`}
                                          >
                                            <div className={`text-xl font-bold mb-0.5 ${
                                              isHighest ? 'text-green-600' :
                                              isLowest ? 'text-red-500' :
                                              'text-gray-500'
                                            }`}>
                                              {score ?? (optIdx + 1)}
                                            </div>
                                            <div className="text-[9px] font-medium text-gray-600 leading-tight">{option}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {q.correctAnswers && (
                                      <p className="text-[10px] text-gray-400 mt-1.5 mb-2 text-center">
                                        Score mapping: {q.correctAnswers.join(' → ')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Footer */}
                              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  {/* Source Label */}
                                  <div className="flex items-center space-x-1">
                                    {q.source === 'custom' ? (
                                      <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                                        <FontAwesomeIcon icon={faLayerGroup} />
                                        <span className="font-semibold">Custom</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                                        <FontAwesomeIcon icon={faBookOpen} />
                                        <span className="font-semibold">Question Bank</span>
                                      </div>
                                    )}
                                  </div>
                                  {q.createdByName && (
                                    <div className="flex items-center space-x-1">
                                      <FontAwesomeIcon icon={faUser} />
                                      <span>Created by: {q.createdByName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</span>
                                    </div>
                                  )}
                                  {(() => {
                                    const qCreatedAt = q.createdAt || selectedExam.createdAt;
                                    const formatted = qCreatedAt ? formatDate(qCreatedAt) : '';
                                    return formatted ? (
                                    <div className="flex items-center space-x-1">
                                      <FontAwesomeIcon icon={faCalendar} />
                                      <span>{formatted}</span>
                                    </div>
                                    ) : null;
                                  })()}
                                </div>

                                <div className="flex items-center space-x-3">
                                  {q.source === 'custom' || q.isProprietaryQuestion ? (
                                    <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                                      <FontAwesomeIcon icon={faTrophy} />
                                      <span className="text-xs font-semibold">Private</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                                        <path d="M2 12h20"/>
                                      </svg>
                                      <span className="text-xs font-semibold">Public</span>
                                    </div>
                                  )}
                                  
                                  <button
                                    onClick={() => setExpandedQuestionId(isLikertExpanded ? null : `likert-${q.id || idx}`)}
                                    className="text-xs font-bold px-3 py-1.5 rounded-md transition-colors text-blue-600 hover:bg-blue-50"
                                  >
                                    {isLikertExpanded ? 'Hide Details' : 'View Details'}
                                  </button>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Questions List - shown only when questionsList has items */}
                  {(selectedExam.questionsList?.length || 0) > 0 && (
                  <div className="bg-white p-2 mb-6 px-6">
                  <div 
                    className="mb-4 cursor-pointer select-none"
                    onClick={() => {
                      const el = document.getElementById('questions-section-collapse');
                      if (el) el.classList.toggle('hidden');
                      const icon = document.getElementById('questions-chevron');
                      if (icon) icon.classList.toggle('rotate-180');
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-semibold text-gray-900 flex items-center space-x-2">
                      <FontAwesomeIcon icon={faClipboardList} className="text-gray-600" />
                      <span>{(() => { const _hl = !!(selectedExam.personalityAssessment && (selectedExam.likertQuestions?.length || 0) > 0); const _hp = !!((selectedExam as any).questionPool?.length > 0 && (selectedExam as any).pickRandomCount > 0); if ([_hl, true, _hp].filter(Boolean).length < 2) return ''; return _hl ? 'Section B — ' : 'Section A — '; })()}Questions List</span>
                    </h3>
                    <FontAwesomeIcon 
                      id="questions-chevron"
                      icon={faChevronDown} 
                      className="text-gray-400 text-sm transition-transform duration-200" 
                    />
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                      {(() => {
                        if (!selectedExam.questionsList || selectedExam.questionsList.length === 0) {
                          return <span>Total Questions: {selectedExam.questionsList?.length || 0} • Max Marks: {safeRender(selectedExam.maxMarks)}</span>;
                        }
                        
                        const mcqCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.MCQ).length;
                        const fitbCount = selectedExam.questionsList.filter((q: any) => {
                          const typeStr = (q.type || '').toString().toLowerCase().replace(/\s+/g, '');
                          const hasBlanks = q.blanks && Array.isArray(q.blanks) && q.blanks.length > 0;
                          return hasBlanks || typeStr === QUESTION_TYPES.FITB || q.type === QUESTION_TYPES.FITB;
                        }).length;
                        const descriptiveCount = selectedExam.questionsList.filter((q: any) => {
                          const hasBlanks = q.blanks && Array.isArray(q.blanks) && q.blanks.length > 0;
                          return q.type === QUESTION_TYPES.DESCRIPTIVE && !hasBlanks;  // Don't count FITB questions stored as descriptive
                        }).length;
                        const jumbledCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.JUMBLED).length;
                        const codeCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.CODE).length;
                        const sqlCount = selectedExam.questionsList.filter((q: any) => q.type === QUESTION_TYPES.SQL).length;
                        
                        const parts = [
                          `Total Questions: ${selectedExam.questionsList.length}`,
                          `Max Marks: ${safeRender(selectedExam.maxMarks)}`
                        ];
                        
                        if (mcqCount > 0) parts.push(`MCQ: ${mcqCount}`);
                        if (fitbCount > 0) parts.push(`FITB: ${fitbCount}`);
                        if (descriptiveCount > 0) parts.push(`Descriptive: ${descriptiveCount}`);
                        if (jumbledCount > 0) parts.push(`Jumbled: ${jumbledCount}`);
                        if (codeCount > 0) parts.push(`Code: ${codeCount}`);
                        if (sqlCount > 0) parts.push(`SQL: ${sqlCount}`);
                        
                        return <span>{parts.join(' • ')}</span>;
                      })()}
                    </div>
                  </div>
                  
                  <div id="questions-section-collapse">
                  {selectedExam.questionsList && selectedExam.questionsList.length > 0 ? (
                   <div 
                      className="space-y-4"
                    >
                      {selectedExam.questionsList.map((question: any, index: number) => (
                        <div 
                          key={question.id} 
                          className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-all duration-200"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = brandTheme.colors.primary;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          {/* Question Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                                style={{ background: brandTheme.gradients.primary }}
                              >
                                {index + 1}
                              </div>
<div>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 mr-2">
                                  {(() => {
                                    const typeStr = (question.type || '').toString().toLowerCase().replace(/\s+/g, '');
                                    // Check ONLY for blanks array (not correctAnswers, as MCQ uses that too!)
                                    const hasBlanks = (question as any).blanks && Array.isArray((question as any).blanks) && (question as any).blanks.length > 0;
                                    
                                    // Debug logging - check browser console for actual type value
                                    if (hasBlanks || question.type?.toString().toLowerCase().includes('fill')) {
                                      // console.log('🔍 FITB Question Debug:', {
                                        // originalType: question.type,
                                        // typeStr: typeStr,
                                        // hasBlanks: (question as any).blanks?.length || 0,
                                        // hasCorrectAnswers: question.correctAnswers?.length || 0,
                                        // questionTitle: question.title?.substring(0, 50),
                                        // detectedAs: hasBlanks ? 'FITB (by blanks array)' : 'checking type field...'
                                      // });
                                    }
                                    
                                    if (question.type === QUESTION_TYPES.MCQ) return QUESTION_TYPE_LABELS[QUESTION_TYPES.MCQ];
                                    // PRIORITY: Check blanks array first, then type
                                    if (hasBlanks || typeStr === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.FITB) return QUESTION_TYPE_LABELS[QUESTION_TYPES.FITB];
                                    if (question.type === QUESTION_TYPES.JUMBLED) return QUESTION_TYPE_LABELS[QUESTION_TYPES.JUMBLED];
                                    if (question.type === QUESTION_TYPES.CODE) return QUESTION_TYPE_LABELS[QUESTION_TYPES.CODE];
                                    if (question.type === QUESTION_TYPES.SQL) return QUESTION_TYPE_LABELS[QUESTION_TYPES.SQL];
                                    return QUESTION_TYPE_LABELS[QUESTION_TYPES.DESCRIPTIVE];
                                  })()}
                                </span>
                                {question.board && (
                                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 mr-2">
                                    {safeRender(question.board).toUpperCase()}
                                  </span>
                                )}
                                {question.complexity && (
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                                    question.complexity === 'easy' ? 'bg-pink-100 text-pink-700' :
                                    question.complexity === 'medium' ? 'bg-green-100 text-green-700' :
                                    'bg-cyan-100 text-cyan-700'
                                  }`}>
                                    {typeof question.complexity === 'string' ? question.complexity.toUpperCase() : safeRender(question.complexity)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1">
                              {/* Image Gallery Icon - Show if question has images */}
                              {question.imageUrls && Array.isArray(question.imageUrls) && question.imageUrls.length > 0 && (
                                <button
                                  onClick={() => {
                                    const images = question.imageUrls || [];
                                    // console.log('🖼️ Opening carousel with images:', images);
                                    setCarouselImages(images);
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
                                <span className="text-sm font-bold text-gray-900">{safeRender(question.marks)}</span>
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
                                  // First, render math formulas before processing anything else
                                  html = html.replace(
                                    /<span[^>]*data-latex=["']([^"']*)["'][^>]*>.*?<\/span>/g,
                                    (match, latex) => {
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
                                  
                                  // Split by code tags (original logic)
                                  const parts = html.split(/(<code>.*?<\/code>)/gs);
                                  
                                  return parts.map((part, index) => {
                                    // Check if this is a code block
                                    const codeMatch = part.match(/<code>(.*?)<\/code>/s);
                                    
                                    if (codeMatch) {
                                      const codeContent = codeMatch[1];
                                      const codeId = `code-${question.id}-${index}`;
                                      
                                      // Determine programming language
                                      const detectLanguage = (code: string): string => {
                                        // If it's a code question, use its language
                                        if ((question as any).programmingLanguage) {
                                          return (question as any).programmingLanguage.toLowerCase();
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
                                        <div key={index} className="relative rounded-lg overflow-hidden isolate">
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
                                          [&_.katex]:text-sm [&_.katex]:inline-block
                                          [&>pre:empty]:hidden [&>pre:empty]:opacity-0 [&>pre:empty]:h-0 [&>pre:empty]:m-0 [&>pre:empty]:p-0"
                                        dangerouslySetInnerHTML={{ __html: part }}
                                      />
                                    );
                                  });
                                };
                                
                                return processHTML(question.questionText);
                              })()}
                            </div>
                          </div>

                          {/* MCQ Options - Simple view without correct answer when collapsed */}
                          {question.type === QUESTION_TYPES.MCQ && question.options && question.options.length > 0 && expandedQuestionId !== question.id && (
                            <div className="mt-3 space-y-2">
                              {question.options.map((option: string, optIndex: number) => (
                                <div
                                  key={optIndex}
                                  className="flex items-center space-x-2 p-2.5 rounded-lg border bg-gray-50 border-gray-200"
                                >
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-300 text-gray-700">
                                    {String.fromCharCode(65 + optIndex)}
                                  </div>
                                  <div 
                                    className="text-sm text-gray-700 flex-1 prose prose-sm max-w-none
                                      [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                      [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                      [&_strong]:font-semibold"
                                    dangerouslySetInnerHTML={{ __html: option }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Jumbled Question Items - Simple display with grip dots (NO HEADING in collapsed view) */}
                         {question.type === QUESTION_TYPES.JUMBLED && expandedQuestionId !== question.id && (
                          <div className="mt-3 space-y-2">
                            {(() => {
                              // Get jumbledItems if they exist (pre-shuffled)
                              const jumbledItemsRaw = (question as any).jumbledItems;
                              const jumbledItems = convertToArray(jumbledItemsRaw);
                              
                              // Convert correctAnswers as well
                              const correctAnswers = convertToArray(question.correctAnswers);
                              
                              // If no pre-shuffled items, use correctAnswers (shuffled)
                              const itemsToShow = jumbledItems && jumbledItems.length > 0
                                ? jumbledItems
                                : correctAnswers
                                ? [...correctAnswers].sort(() => Math.random() - 0.5)
                                : [];
                                
                                return itemsToShow.length > 0 ? itemsToShow.map((item: string, itemIndex: number) => (
                                  <div
                                    key={itemIndex}
                                    className="flex items-center space-x-2 p-2.5 rounded-lg border bg-purple-50 border-purple-200"
                                  >
                                    <div className="w-6 h-6 flex items-center justify-center text-purple-500">
                                      <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                                    </div>
                                    <div 
                                      className="text-sm text-gray-700 flex-1 prose prose-sm max-w-none
                                        [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                        [&_code]:bg-purple-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                        [&_strong]:font-semibold"
                                      dangerouslySetInnerHTML={{ __html: item }}
                                    />
                                  </div>
                                )) : null;
                              })()}
                            </div>
                          )}

                          {/* FITB - No special display in collapsed view, just the question text */}
                          {/* Filled answers will be shown in expanded "View Details" section */}

                                                   {/* FITB - No special display in collapsed view, just the question text */}
                          {/* Filled answers will be shown in expanded section */}

                          {/* ===== CODE QUESTIONS - Chapter Section (shown first for code) ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && 'chapter' in question && question.chapter && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                              <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                            </div>
                          )}

                          {/* ===== CODE QUESTIONS - Solution Hint ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && question.hint && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Solution Hint</h2>
                              <div 
                                className="text-sm text-gray-700 italic prose prose-sm max-w-none
                                  [&>p]:text-sm [&>p]:text-gray-700 [&>p]:mb-1
                                  [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                  [&_strong]:font-semibold"
                                dangerouslySetInnerHTML={{ __html: question.hint }}
                              />
                            </div>
                          )}

                          {/* ===== MCQ - Options with Correct Answer ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.MCQ && question.options && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Options with Correct Answer</h2>
                              <div className="space-y-2">
                                {question.options.map((option: string, optIndex: number) => {
                                  // Check if this option is correct
                                  // Method 1: Index-based (question.correctAnswer)
                                  const isCorrectByIndex = (question as any).correctAnswer === optIndex;
                                  
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

                          {/* ===== FITB - Correct Answers ===== */}
                          {expandedQuestionId === question.id && (() => {
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

                          {/* ===== JUMBLED - Items to Arrange & Correct Sequence (Independent Headings) ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.JUMBLED && (() => {
                            // Convert correctAnswers from Firebase format if needed
                            const correctAnswersArray = convertToArray(question.correctAnswers);
                            const hasCorrectAnswers = correctAnswersArray && correctAnswersArray.length > 0;
                            
                            if (!hasCorrectAnswers) return null;
                            
                            return (
                              <>
                                {/* Jumbled Items (What student sees) */}
                                <div className="mt-4">
                                  <h2 className="text-lg font-bold text-gray-900 mb-3">Items to Arrange:</h2>
                                  <div className="space-y-2">
                                    {(() => {
                                      const jumbledItemsRaw = (question as any).jumbledItems;
                                      const jumbledItemsArray = convertToArray(jumbledItemsRaw);
                                      
                                      const itemsToShow = jumbledItemsArray && jumbledItemsArray.length > 0
                                        ? jumbledItemsArray
                                        : correctAnswersArray ? [...correctAnswersArray].sort(() => Math.random() - 0.5) : [];
                                      
                                      return itemsToShow.map((item: string, idx: number) => (
                                        <div
                                          key={idx}
                                          className="flex items-center space-x-2 p-2.5 rounded-lg border bg-purple-50 border-purple-200"
                                        >
                                          <div className="w-6 h-6 flex items-center justify-center text-purple-500">
                                            <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                                          </div>
                                          <div 
                                            className="text-sm text-gray-700 flex-1 prose prose-sm max-w-none
                                              [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                              [&_code]:bg-purple-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                              [&_strong]:font-semibold"
                                            dangerouslySetInnerHTML={{ __html: item }}
                                          />
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </div>

                                {/* Correct Sequence (The Answer) */}
                                <div className="mt-4">
                                  <h2 className="text-lg font-bold text-gray-900 mb-3">Correct Sequence:</h2>
                                  <div className="space-y-2">
                                    {correctAnswersArray.map((item: string, seqIndex: number) => (
                                      <div
                                        key={seqIndex}
                                        className="flex items-center space-x-2 p-2.5 rounded-lg border bg-green-50 border-green-300"
                                      >
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold bg-green-500 text-white">
                                          {seqIndex + 1}
                                        </div>
                                        <div 
                                          className="text-sm text-gray-700 flex-1 prose prose-sm max-w-none
                                            [&>p]:inline [&>p]:text-sm [&>p]:text-gray-700
                                            [&_code]:bg-green-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                            [&_strong]:font-semibold"
                                          dangerouslySetInnerHTML={{ __html: item }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            );
                          })()}

                          {/* ===== LIKERT QUESTIONS - Detail ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.LIKERT && (
                            <div className="mt-4 space-y-4">
                              {/* Trait & Direction */}
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trait</span>
                                  <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                                    {(question as any).likertTrait || (question as any).chapter || '—'}
                                  </span>
                                </div>
                                {(question as any).likertDirection && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Direction</span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                      (question as any).likertDirection === 'positive' 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {(question as any).likertDirection === 'positive' ? '↑ Positive' : '↓ Reverse'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Likert Scale Options with Scoring */}
                              <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3">Likert Scale</h2>
                                <div className="grid grid-cols-5 gap-2">
                                  {((question as any).options || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']).map((option: string, idx: number) => {
                                    const score = (question as any).correctAnswers?.[idx];
                                    const isHighest = score && Number(score) === 5;
                                    const isLowest = score && Number(score) === 1;
                                    return (
                                      <div 
                                        key={idx}
                                        className={`rounded-xl p-3 text-center border-2 transition-all ${
                                          isHighest ? 'border-green-300 bg-green-50' :
                                          isLowest ? 'border-red-200 bg-red-50' :
                                          'border-gray-200 bg-gray-50'
                                        }`}
                                      >
                                        <div className={`text-2xl font-bold mb-1 ${
                                          isHighest ? 'text-green-600' :
                                          isLowest ? 'text-red-500' :
                                          'text-gray-500'
                                        }`}>
                                          {score ?? (idx + 1)}
                                        </div>
                                        <div className="text-[10px] font-medium text-gray-600 leading-tight">{option}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {(question as any).correctAnswers && (
                                  <p className="text-xs text-gray-400 mt-2 mb-4 text-center">
                                    Score mapping: {(question as any).correctAnswers.join(' → ')}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ===== NON-CODE/SQL QUESTIONS - Chapter ===== */}
                          {expandedQuestionId === question.id && question.type !== 'code' && question.type !== QUESTION_TYPES.SQL && question.type !== QUESTION_TYPES.LIKERT && 'chapter' in question && question.chapter && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                              <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                            </div>
                          )}

                          {/* ===== NON-CODE/SQL QUESTIONS - Hint ===== */}
                          {expandedQuestionId === question.id && question.type !== 'code' && question.type !== QUESTION_TYPES.SQL && question.hint && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Hint</h2>
                              <div 
                                className="text-sm text-gray-700 italic prose prose-sm max-w-none
                                  [&>p]:text-sm [&>p]:text-gray-700 [&>p]:mb-1
                                  [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                                  [&_strong]:font-semibold"
                                dangerouslySetInnerHTML={{ __html: question.hint }}
                              />
                            </div>
                          )}

                          {/* ===== NON-CODE/SQL QUESTIONS - Solution ===== */}
                          {expandedQuestionId === question.id && question.type !== 'code' && question.type !== QUESTION_TYPES.SQL && question.solution && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Solution</h2>
                              {(question.type === QUESTION_TYPES.MCQ || question.type === QUESTION_TYPES.JUMBLED || question.type === QUESTION_TYPES.FITB || question.type === QUESTION_TYPES.DESCRIPTIVE) ? (
                                // Enhanced solution display for MCQ, jumbled, FITB, and descriptive questions
                                <div>
                                    {(() => {
                                      // Parse the solution to extract sections
                                      const parser = new DOMParser();
                                      const doc = parser.parseFromString(question.solution, 'text/html');
                                      const elements: ReactElement[] = [];
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
                                            
                                            // Skip "Correct Answer:" heading - it's redundant in solution section
                                            if (text.match(/^Correct Answer:?$/i) || text.match(/^<strong>Correct Answer:?<\/strong>$/i)) {
                                              return;
                                            }
                                            
                                            const innerHTML = element.innerHTML?.trim() || '';
                                            if (innerHTML.match(/^<strong>Correct Answer:?<\/strong>$/i) || innerHTML.match(/^Correct Answer:?$/i)) {
                                              return;
                                            }
                                            
                                            if (text.includes('Correct Sequence:')) {
                                              const hasSpans = innerHTML.includes('<span');
                                              elements.push(
                                                <h3 
                                                  key={`heading-${keyCounter++}`} 
                                                  className="text-base font-bold text-gray-900 mb-2"
                                                  {...(hasSpans ? { dangerouslySetInnerHTML: { __html: innerHTML } } : { children: text })}
                                                />
                                              );
                                            } else if (text.match(/^(Output:|Why this order:|Steps:|Note:|Important:)/i)) {
                                              const hasSpans = innerHTML.includes('<span');
                                              elements.push(
                                                <h4 
                                                  key={`subheading-${keyCounter++}`} 
                                                  className="text-sm font-semibold text-gray-800 mt-3 mb-1"
                                                  {...(hasSpans ? { dangerouslySetInnerHTML: { __html: innerHTML } } : { children: text })}
                                                />
                                              );
                                            } else if (text) {
                                              const hasSpans = innerHTML.includes('<span');
                                              
                                              if (hasSpans) {
                                                elements.push(
                                                  <p 
                                                    key={`para-${keyCounter++}`} 
                                                    className="text-sm text-gray-700 leading-relaxed"
                                                    dangerouslySetInnerHTML={{ __html: innerHTML }}
                                                  />
                                                );
                                              } else {
                                                elements.push(
                                                  <p key={`para-${keyCounter++}`} className="text-sm text-gray-700 leading-relaxed">
                                                    {text}
                                                  </p>
                                                );
                                              }
                                            }
                                          } else if (tagName === 'pre' || tagName === 'code') {
                                            // Check if this code has highlighting spans
                                            const innerHTML = element.innerHTML || '';
                                            const hasHighlights = innerHTML.includes('bg-yellow') || 
                                                                   innerHTML.includes('bg-amber') || 
                                                                   innerHTML.includes('bg-green') ||
                                                                   innerHTML.includes('background-color');
                                            
                                            if (hasHighlights) {
                                              // Preserve the HTML with highlights
                                              const codeId = `code-${question.id}-${keyCounter}`;
                                              elements.push(
                                                <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden bg-gray-900 isolate">
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
                                              const codeContent = element.textContent || '';
                                              const detectLanguage = (code: string): string => {
                                                // Priority 1: Use question's programming language if available
                                                if (question.programmingLanguage) {
                                                  return question.programmingLanguage.toLowerCase();
                                                }
                                                
                                                // Priority 2: Auto-detect based on code patterns
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
                                                return 'java';
                                              };
                                              
                                              const language = detectLanguage(codeContent);
                                              const codeId = `code-${question.id}-${keyCounter}`;
                                              
                                              elements.push(
                                                <div key={`code-${keyCounter++}`} className="relative rounded-lg overflow-hidden isolate">
                                                  <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-3 rounded-t-lg">
                                                    <div className="flex items-center space-x-2">
                                                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                    </div>
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
                                          } else if (tagName === 'ul' || tagName === 'ol') {
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
                                            // Default: treat as paragraph
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
                                          className="text-sm text-gray-900 prose prose-sm max-w-none"
                                          dangerouslySetInnerHTML={{ __html: question.solution }}
                                        />
                                      );
                                    })()}
                                </div>
                              ) : (
                                // Standard solution display for other question types (fallback)
                                <div 
                                  className="prose prose-sm max-w-none
                                    [&>h1]:text-xl [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-2 [&>h1]:mt-1
                                    [&>h2]:text-lg [&>h2]:font-bold [&>h2]:text-gray-900 [&>h2]:mb-2 [&>h2]:mt-1
                                    [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-gray-800 [&>h3]:mb-1
                                    [&>p]:text-sm [&>p]:text-gray-800 [&>p]:mb-2 [&>p]:leading-relaxed
                                    [&_strong]:font-bold [&_strong]:text-gray-900
                                    [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-gray-800
                                    [&_br]:block [&_br]:mb-2
                                    [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2
                                    [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2
                                    [&_li]:mb-1"
                                  dangerouslySetInnerHTML={{ __html: question.solution }}
                                />
                              )}
                            </div>
                          )}

                          {/* ===== CODE QUESTIONS - Test Cases ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && 
                           (question as any).testCases && Array.isArray((question as any).testCases) && (question as any).testCases.length > 0 && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-bold text-gray-900">Test Cases</h2>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-medium text-gray-600">
                                    {(question as any).testCases.length} test cases
                                  </span>
                                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                                    Total: {(question as any).testCases.reduce((sum: number, tc: any) => sum + (Number(tc.marks) || 0), 0).toFixed(1)} marks
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
                                    {(question as any).testCases.map((testCase: any, tcIndex: number) => {
                                      const formatTcValue = (val: any): string => {
                                        if (val == null) return 'N/A';
                                        if (typeof val === 'string') return val.replace(/\\n/g, '\n');
                                        if (typeof val === 'number' || typeof val === 'boolean') return String(val);
                                        if (Array.isArray(val)) return val.join('\n');
                                        if (typeof val === 'object') return JSON.stringify(val, null, 2);
                                        return String(val);
                                      };
                                      return (
                                      <tr key={tcIndex} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-center">
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white bg-blue-500">
                                            {tcIndex + 1}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 whitespace-pre-wrap">
                                            {formatTcValue(testCase.input)}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="font-mono text-xs bg-green-50 px-2 py-1 rounded border border-green-200 text-green-700 whitespace-pre-wrap">
                                            {formatTcValue(testCase.expected_output)}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
                                            {testCase.marks != null && !isNaN(Number(testCase.marks)) ? Number(testCase.marks).toFixed(1) : '0.0'}
                                          </span>
                                        </td>
                                      </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* ===== CODE QUESTIONS - Starter Code Template ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.CODE && ((question as any).testStub || (question as any).test_stub) && (
                            <div className="mt-3">
                              <h2 className="text-lg font-bold text-gray-900 mb-2">Starter Code Template</h2>
                              <div className="relative rounded-lg overflow-hidden isolate">
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
                                    onClick={() => copyToClipboard((question as any).testStub || (question as any).test_stub, `stub-${question.id}`)}
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
                                    language={(question as any).programmingLanguage?.toLowerCase() || 'python'}
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
                                    {(question as any).testStub || (question as any).test_stub}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            </div>
                          )}


                          {/* ===== SQL QUESTIONS - Schema & Test Cases ===== */}
                          {expandedQuestionId === question.id && question.type === QUESTION_TYPES.SQL && (() => {
                            const sqlSchema = (question as any).sqlSchema || [];
                            const sqlTestCases = ((question as any).sqlTestCases || []).map((tc: any) => ({
                              ...tc,
                              table_data: typeof tc.table_data === 'string' ? JSON.parse(tc.table_data || '{}') : (tc.table_data || {}),
                              expected_output: typeof tc.expected_output === 'string' ? JSON.parse(tc.expected_output || '{"columns":[],"rows":[]}') : (tc.expected_output || { columns: [], rows: [] })
                            }));
                            return (
                              <div className="mt-3 space-y-4">
                                {/* Schema Tables */}
                                {sqlSchema.length > 0 && (
                                  <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-2">Table Schema</h2>
                                    <div className="space-y-3">
                                      {sqlSchema.map((table: any, tIdx: number) => (
                                        <div key={tIdx} className="border border-green-200 rounded-lg overflow-hidden">
                                          <div className="px-3 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
                                            <span className="text-sm font-bold text-green-700">{table.table_name || `Table ${tIdx + 1}`}</span>
                                            {table.primary_key && <span className="text-xs text-gray-500">PK: <span className="font-mono font-semibold">{table.primary_key}</span></span>}
                                          </div>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="bg-gray-50 border-b">
                                                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Column</th>
                                                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Type</th>
                                                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Description</th>
                                                  <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Constraints</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(table.columns || []).filter((c: any) => c.name).map((col: any, cIdx: number) => (
                                                  <tr key={cIdx} className={cIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                                    <td className="px-3 py-1.5 font-mono font-semibold text-gray-900">{col.name}</td>
                                                    <td className="px-3 py-1.5 font-mono text-blue-600 uppercase">{col.type}</td>
                                                    <td className="px-3 py-1.5 text-gray-600">{col.description || '—'}</td>
                                                    <td className="px-3 py-1.5 text-gray-600">{col.constraints || '—'}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                          {table.note && <div className="px-3 py-1.5 bg-gray-50 border-t text-xs text-gray-500 italic">{table.note}</div>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* SQL Test Cases */}
                                {sqlTestCases.length > 0 && (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h2 className="text-lg font-bold text-gray-900">Test Cases</h2>
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                                        Total: {sqlTestCases.reduce((sum: number, tc: any) => sum + (tc.marks || 0), 0).toFixed(1)} marks
                                      </span>
                                    </div>
                                    <div className="space-y-3">
                                      {sqlTestCases.map((tc: any, tcIdx: number) => (
                                        <div key={tcIdx} className="border border-amber-200 rounded-lg overflow-hidden">
                                          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                                            <span className="text-sm font-bold text-amber-700">{tc.title || `Test Case ${tcIdx + 1}`}</span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white">{(tc.marks || 0).toFixed(1)} marks</span>
                                          </div>
                                          <div className="p-3 space-y-3">
                                            {/* Input Tables */}
                                            {Object.entries(tc.table_data || {}).map(([tableName, rows]: [string, any]) => {
                                              const schemaColumns = (sqlSchema.find((t: any) => t.table_name === tableName)?.columns || []).filter((c: any) => c.name).map((c: any) => c.name);
                                              const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
                                              const isHeaderRow = schemaColumns.length > 0 && firstRow.length === schemaColumns.length && firstRow.every((cell: string, i: number) => cell === schemaColumns[i]);
                                              const dataRows = isHeaderRow ? (rows as string[][]).slice(1) : (rows as string[][]);
                                              return (
                                              <div key={tableName} className="border border-blue-100 rounded overflow-hidden">
                                                <div className="px-2 py-1 bg-blue-50 border-b border-blue-100">
                                                  <span className="text-[10px] font-bold text-blue-600">📥 Input: {tableName}</span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-xs">
                                                    <thead><tr className="bg-gray-50">{schemaColumns.map((colName: string, ci: number) => (<th key={ci} className="px-2 py-1 text-left font-semibold text-gray-600 border-b">{colName}</th>))}</tr></thead>
                                                    <tbody>{dataRows.map((row: string[], rIdx: number) => (<tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>{row.map((cell: string, ci: number) => (<td key={ci} className="px-2 py-1 font-mono border-b border-gray-100">{cell}</td>))}</tr>))}</tbody>
                                                  </table>
                                                </div>
                                              </div>
                                              );
                                            })}
                                            {/* Expected Output */}
                                            {tc.expected_output && tc.expected_output.columns?.length > 0 && (
                                              <div className="border border-green-200 rounded overflow-hidden">
                                                <div className="px-2 py-1 bg-green-50 border-b border-green-100">
                                                  <span className="text-[10px] font-bold text-green-600">📤 Expected Output</span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                  <table className="w-full text-xs">
                                                    <thead><tr className="bg-green-50/50">{tc.expected_output.columns.map((col: string, ci: number) => (<th key={ci} className="px-2 py-1 text-left font-semibold text-green-700 border-b">{col}</th>))}</tr></thead>
                                                    <tbody>{(tc.expected_output.rows || []).map((row: string[], rIdx: number) => (<tr key={rIdx}>{row.map((cell: string, ci: number) => (<td key={ci} className="px-2 py-1 font-mono border-b border-gray-100">{cell}</td>))}</tr>))}</tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Chapter for SQL */}
                                {(question as any).chapter && (
                                  <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-2">Chapter</h2>
                                    <p className="text-sm text-gray-900">{(question as any).chapter}</p>
                                  </div>
                                )}

                                {/* Hint for SQL */}
                                {question.hint && (
                                  <div>
                                    <h2 className="text-lg font-bold text-gray-900 mb-2">Hint</h2>
                                    <div 
                                      className="text-sm text-gray-700 italic prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: question.hint }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })()}


                          
                          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              {/* Source Label */}
                              <div className="flex items-center space-x-1">
                                {(question as any).source === 'custom' ? (
                                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                    <span className="font-semibold">Custom</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                                    <FontAwesomeIcon icon={faBookOpen} />
                                    <span className="font-semibold">Question Bank</span>
                                  </div>
                                )}
                              </div>
                              {(question as any).createdByName && (
                                <div className="flex items-center space-x-1">
                                  <FontAwesomeIcon icon={faUser} />
                                  <span>Created by: {(question as any).createdByName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</span>
                                </div>
                              )}
                              {(() => {
                                const qCreatedAt = question.createdAt || (question as any).createdAt || selectedExam.createdAt;
                                const formatted = qCreatedAt ? formatDate(qCreatedAt) : '';
                                return formatted ? (
                                <div className="flex items-center space-x-1">
                                  <FontAwesomeIcon icon={faCalendar} />
                                  <span>{formatted}</span>
                                </div>
                                ) : null;
                              })()}
                            </div>

                            <div className="flex items-center space-x-3">
                              {(question as any).source === 'custom' || question.isProprietaryQuestion ? (
                                <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                                  <FontAwesomeIcon icon={faTrophy} />
                                  <span className="text-xs font-semibold">Private</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-green-100 text-green-700">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                                    <path d="M2 12h20"/>
                                  </svg>
                                  <span className="text-xs font-semibold">Public</span>
                                </div>
                              )}
                              
                              <button
                                onClick={() => setExpandedQuestionId(expandedQuestionId === question.id ? null : question.id)}
                                className="text-xs font-bold px-3 py-1.5 rounded-md transition-colors text-blue-600 hover:bg-blue-50"
                              >
                                {expandedQuestionId === question.id ? 'Hide Details' : 'View Details'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon icon={faClipboardList} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">No Questions Added</p>
                          <p className="text-xs text-gray-500">Add questions from question bank</p>
                        </div>
                      </div>
                      <button 
                        className="text-xs font-medium px-3 py-1.5 bg-white rounded-md transition-colors border"
                        style={{ 
                          color: brandTheme.colors.primary,
                          borderColor: `${brandTheme.colors.primary}33`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${brandTheme.colors.primary}10`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        Add Questions
                      </button>
                    </div>
                  )}
                  </div>
                </div>
                )}

                {/* Question Pool Section */}
                {selectedExam.questionPool && Array.isArray(selectedExam.questionPool) && selectedExam.questionPool.length > 0 && selectedExam.pickRandomCount && selectedExam.pickRandomCount > 0 ? (
                  <div className="bg-white p-5 mb-6 rounded-xl border-2 border-purple-200 shadow-md">
                    <div 
                      className="cursor-pointer select-none"
                      onClick={() => {
                        const el = document.getElementById('pool-section-collapse');
                        if (el) el.classList.toggle('hidden');
                        const icon = document.getElementById('pool-chevron');
                        if (icon) icon.classList.toggle('rotate-180');
                      }}
                    >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-md">
                          <FontAwesomeIcon icon={faLayerGroup} className="text-white text-lg" />
                        </div>
                        <span>{(() => { const _hl = !!(selectedExam.personalityAssessment && (selectedExam.likertQuestions?.length || 0) > 0); const _hq = (selectedExam.questionsList?.length || 0) > 0; if ([_hl, _hq, true].filter(Boolean).length < 2) return ''; if (_hl && _hq) return 'Section C — '; if (_hl || _hq) return 'Section B — '; return 'Section A — '; })()}Question Pool</span>
                      </h3>
                      <div className="flex items-center space-x-3">
                      <div className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
                        Random Selection
                      </div>
                      <FontAwesomeIcon 
                        id="pool-chevron"
                        icon={faChevronDown} 
                        className="text-gray-400 text-sm transition-transform duration-200" 
                      />
                      </div>
                    </div>
                    </div>

                    <div id="pool-section-collapse">

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Total Questions in Pool */}
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border-2 border-blue-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                            <FontAwesomeIcon icon={faCircleQuestion} className="text-white text-sm" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Pool Size</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">
                          {selectedExam.questionPool.length}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Total Questions</p>
                      </div>

                      {/* Random Count */}
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-gray-600">Random Pick</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-700">
                          {selectedExam.pickRandomCount || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Per Student</p>
                      </div>

                      {/* Marks Per Question */}
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border-2 border-orange-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                            <FontAwesomeIcon icon={faStar} className="text-white text-sm" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Marks/Question</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-700">
                          {selectedExam.poolQuestionMarks || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Each Question</p>
                      </div>

                      {/* Total Marks */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                            <FontAwesomeIcon icon={faAward} className="text-white text-sm" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Total Marks</span>
                        </div>
                        <p className="text-2xl font-bold text-green-700">
                          {(selectedExam.pickRandomCount || 0) * (selectedExam.poolQuestionMarks || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Maximum Score</p>
                      </div>
                    </div>

                    {/* Pool Question Categories */}
                    <div className="mt-4 pt-4 border-t border-purple-100">
                      <p className="text-xs font-semibold text-gray-700 mb-3">Question Categories in Pool:</p>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          // Get unique categories/boards from questionPool
                          const categories = new Map<string, number>();
                          selectedExam.questionPool.forEach((q: any) => {
                            const category = q.board || q.category || q.chapter || 'General';
                            categories.set(category, (categories.get(category) || 0) + 1);
                          });
                          
                          return Array.from(categories.entries()).map(([category, count], index) => (
                            <div key={index} className="px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                                {count}
                              </div>
                              <span className="text-sm font-semibold text-gray-900">{category}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Info Note */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-start space-x-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        <strong>Random Selection:</strong> Each student will receive a unique set of {selectedExam.pickRandomCount || 0} questions randomly selected from a pool of {selectedExam.questionPool.length} questions, with each question worth {selectedExam.poolQuestionMarks || 0} marks. This ensures fair and varied assessment.
                      </p>
                    </div>
                    </div>
                  </div>
                ) : null}

                </>
              )}

            </div>
  );
}

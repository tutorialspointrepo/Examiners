import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faChevronDown, faBullhorn } from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { NOTICE_PRIORITY, NOTICE_CATEGORY, USER_TYPES, FILTER_VALUES } from './constants';

interface NoticeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (noticeData: {
    title: string;
    content: string;
    priority: typeof NOTICE_PRIORITY.LOW | typeof NOTICE_PRIORITY.MEDIUM | typeof NOTICE_PRIORITY.HIGH;
    category: typeof NOTICE_CATEGORY.GENERAL | typeof NOTICE_CATEGORY.ACADEMIC | typeof NOTICE_CATEGORY.ADMINISTRATIVE | typeof NOTICE_CATEGORY.EVENT;
    targetAudience: typeof FILTER_VALUES.ALL | typeof USER_TYPES.SYSTEM_ADMIN | typeof USER_TYPES.ADMIN | typeof USER_TYPES.PRINCIPAL | typeof USER_TYPES.DEAN | typeof USER_TYPES.TEACHER | typeof USER_TYPES.STUDENT;
    expiryDate: string;
  }) => Promise<void>;
  currentUserName: string;
  currentUserRole: string;
  isSubmitting: boolean;
}

const priorityOptions = [
  { value: NOTICE_PRIORITY.LOW, label: 'Low', emoji: '🟢' },
  { value: NOTICE_PRIORITY.MEDIUM, label: 'Medium', emoji: '🟡' },
  { value: NOTICE_PRIORITY.HIGH, label: 'High', emoji: '🔴' }
];

const categoryOptions = [
  { value: NOTICE_CATEGORY.GENERAL, label: 'General', emoji: '📢' },
  { value: NOTICE_CATEGORY.ACADEMIC, label: 'Academic', emoji: '📚' },
  { value: NOTICE_CATEGORY.ADMINISTRATIVE, label: 'Administrative', emoji: '📋' },
  { value: NOTICE_CATEGORY.EVENT, label: 'Event', emoji: '🎉' }
];

const audienceOptions = [
  { value: FILTER_VALUES.ALL, label: 'All Audiences', emoji: '👥' },
  { value: USER_TYPES.SYSTEM_ADMIN, label: 'System Admins', emoji: '⚙️' },
  { value: USER_TYPES.ADMIN, label: 'College Admins', emoji: '👔' },
  { value: USER_TYPES.PRINCIPAL, label: 'Principals', emoji: '🎓' },
  { value: USER_TYPES.DEAN, label: 'Deans', emoji: '📚' },
  { value: USER_TYPES.TEACHER, label: 'Teachers', emoji: '👨‍🏫' },
  { value: USER_TYPES.STUDENT, label: 'Students', emoji: '🎒' }
];

export default function NoticeDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  currentUserName, 
  currentUserRole,
  isSubmitting 
}: NoticeDialogProps) {
  const brand = useBrand();
  
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticePriority, setNoticePriority] = useState<typeof NOTICE_PRIORITY.LOW | typeof NOTICE_PRIORITY.MEDIUM | typeof NOTICE_PRIORITY.HIGH>(NOTICE_PRIORITY.MEDIUM);
  const [noticeCategory, setNoticeCategory] = useState<typeof NOTICE_CATEGORY.GENERAL | typeof NOTICE_CATEGORY.ACADEMIC | typeof NOTICE_CATEGORY.ADMINISTRATIVE | typeof NOTICE_CATEGORY.EVENT>(NOTICE_CATEGORY.GENERAL);
  const [noticeTargetAudience, setNoticeTargetAudience] = useState<typeof FILTER_VALUES.ALL | typeof USER_TYPES.SYSTEM_ADMIN | typeof USER_TYPES.ADMIN | typeof USER_TYPES.PRINCIPAL | typeof USER_TYPES.DEAN | typeof USER_TYPES.TEACHER | typeof USER_TYPES.STUDENT>(FILTER_VALUES.ALL);
  const [noticeExpiryDate, setNoticeExpiryDate] = useState('');
  const [showDialogElement, setShowDialogElement] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Animation effect
  useEffect(() => {
    if (isOpen) {
      setShowDialogElement(true);
      const timer = setTimeout(() => {
        const dialogElement = document.getElementById('notice-dialog');
        if (dialogElement) {
          dialogElement.classList.remove('translate-x-full');
          dialogElement.classList.add('translate-x-0');
        }
        const backdropElement = document.getElementById('notice-backdrop');
        if (backdropElement) {
          backdropElement.classList.remove('opacity-0');
          backdropElement.classList.add('opacity-100');
        }
      }, 10);
      return () => clearTimeout(timer);
    } else {
      const dialogElement = document.getElementById('notice-dialog');
      const backdropElement = document.getElementById('notice-backdrop');
      if (dialogElement && backdropElement) {
        dialogElement.classList.remove('translate-x-0');
        dialogElement.classList.add('translate-x-full');
        backdropElement.classList.remove('opacity-100');
        backdropElement.classList.add('opacity-0');
        setTimeout(() => {
          setShowDialogElement(false);
          // Reset form
          setNoticeTitle('');
          setNoticeContent('');
          setNoticePriority(NOTICE_PRIORITY.MEDIUM);
          setNoticeCategory(NOTICE_CATEGORY.GENERAL);
          setNoticeTargetAudience(FILTER_VALUES.ALL);
          setNoticeExpiryDate('');
        }, 500);
      }
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      return;
    }

    await onSubmit({
      title: noticeTitle,
      content: noticeContent,
      priority: noticePriority,
      category: noticeCategory,
      targetAudience: noticeTargetAudience,
      expiryDate: noticeExpiryDate
    });
  };

  if (!showDialogElement) return null;

  const selectedPriority = priorityOptions.find(p => p.value === noticePriority);
  const selectedCategory = categoryOptions.find(c => c.value === noticeCategory);
  const selectedAudience = audienceOptions.find(a => a.value === noticeTargetAudience);

  return (
    <>
      {/* Backdrop */}
      <div 
        id="notice-backdrop"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-500 opacity-0"
        onClick={onClose}
      />

      {/* Dialog - Slides in from right with margin and rounded corners */}
      <div 
        id="notice-dialog"
        className="fixed right-2 top-2 bottom-2 z-50 w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl transition-transform duration-500 ease-out overflow-hidden translate-x-full rounded-2xl"
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div 
            className="px-5 py-3 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
            style={{ 
              background: brand.gradients.primary
            }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <FontAwesomeIcon icon={faBullhorn} style={{ fontSize: '20px' }} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create Campus Notice</h2>
                <p className="text-xs text-white/80">Share important updates with everyone</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: '18px' }} className="text-white" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <form onSubmit={handleSubmit}>
              {/* Notice Title */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Notice Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="Enter a clear and concise title"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none transition-all text-sm"
                  onFocus={(e) => e.target.style.borderColor = brand.colors.primary}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  maxLength={100}
                  required
                />
              </div>

              {/* Notice Content */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Notice Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  placeholder="Write your notice content here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none transition-all resize-none text-sm"
                  onFocus={(e) => e.target.style.borderColor = brand.colors.primary}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  rows={6}
                  maxLength={1000}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{noticeContent.length}/1000 characters</p>
              </div>

              {/* Priority Level and Category - Side by Side */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Priority Level */}
                <div className="dropdown-container">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Priority Level <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm hover:border-gray-400 bg-white"
                    >
                      <span className="text-gray-900 flex items-center space-x-2">
                        <span>{selectedPriority?.emoji}</span>
                        <span>{selectedPriority?.label}</span>
                      </span>
                      <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className="text-gray-500" />
                    </button>
                    {openDropdown === 'priority' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                        {priorityOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setNoticePriority(option.value as any);
                              setOpenDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm flex items-center space-x-2"
                          >
                            <span>{option.emoji}</span>
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="dropdown-container">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm hover:border-gray-400 bg-white"
                    >
                      <span className="text-gray-900 flex items-center space-x-2">
                        <span>{selectedCategory?.emoji}</span>
                        <span>{selectedCategory?.label}</span>
                      </span>
                      <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className="text-gray-500" />
                    </button>
                    {openDropdown === 'category' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                        {categoryOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setNoticeCategory(option.value as any);
                              setOpenDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm flex items-center space-x-2"
                          >
                            <span>{option.emoji}</span>
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Target Audience */}
              <div className="mb-6">
                <div className="dropdown-container">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Target Audience <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'audience' ? null : 'audience')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left font-medium transition-all flex items-center justify-between text-sm hover:border-gray-400 bg-white"
                    >
                      <span className="text-gray-900 flex items-center space-x-2">
                        <span>{selectedAudience?.emoji}</span>
                        <span>{selectedAudience?.label}</span>
                      </span>
                      <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: '16px' }} className="text-gray-500" />
                    </button>
                    {openDropdown === 'audience' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                        {audienceOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setNoticeTargetAudience(option.value as any);
                              setOpenDropdown(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors font-medium text-gray-900 text-sm flex items-center space-x-2"
                          >
                            <span>{option.emoji}</span>
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Expiry Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={noticeExpiryDate}
                  onChange={(e) => setNoticeExpiryDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none transition-all text-sm"
                  onFocus={(e) => e.target.style.borderColor = brand.colors.primary}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for permanent notice</p>
              </div>
            </form>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
            <div className="text-xs text-gray-500">
              Posted by <span className="font-medium text-gray-700">{currentUserName}</span> • {currentUserRole}
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || !noticeTitle.trim() || !noticeContent.trim()}
                className="px-5 py-2.5 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm"
                style={{ background: brand.gradients.primary }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faBullhorn} style={{ fontSize: '16px' }} />
                    <span>Create Notice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
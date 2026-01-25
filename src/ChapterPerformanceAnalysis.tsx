/**
 * ChapterPerformanceAnalysis Component
 * 
 * A beautiful, reusable component for displaying chapter-wise performance
 * Can be integrated into any student exam detail page
 * 
 * Props:
 * - performanceByChapter: Object with chapter names as keys and performance data as values
 * - brandTheme: Theme object containing colors
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBook,
  faTrophy,
  faPercentage,
  faQuestionCircle,
  faChartLine
} from '@fortawesome/sharp-light-svg-icons';

interface ChapterPerformance {
  attempted: number;
  maxScore: number;
  score: number;
}

interface ChapterPerformanceAnalysisProps {
  performanceByChapter: Record<string, ChapterPerformance>;
  brandTheme: {
    colors: {
      primary: string;
    };
  };
}

const ChapterPerformanceAnalysis: React.FC<ChapterPerformanceAnalysisProps> = ({ 
  performanceByChapter, 
  brandTheme 
}) => {
  // Helper function to get performance grade
  const getPerformanceGrade = (percentage: number): { grade: string; color: string; bgColor: string } => {
    if (percentage >= 90) return { grade: 'A+', color: '#10b981', bgColor: '#d1fae5' };
    if (percentage >= 80) return { grade: 'A', color: '#22c55e', bgColor: '#dcfce7' };
    if (percentage >= 70) return { grade: 'B+', color: '#84cc16', bgColor: '#ecfccb' };
    if (percentage >= 60) return { grade: 'B', color: '#eab308', bgColor: '#fef9c3' };
    if (percentage >= 50) return { grade: 'C', color: '#f59e0b', bgColor: '#fed7aa' };
    if (percentage >= 40) return { grade: 'D', color: '#f97316', bgColor: '#fed7aa' };
    return { grade: 'F', color: '#ef4444', bgColor: '#fecaca' };
  };

  if (!performanceByChapter) {
    return null;
  }

  const chapters = Object.entries(performanceByChapter) as [string, ChapterPerformance][];
  
  if (chapters.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div 
          className="px-6 py-5 border-b border-gray-100"
          style={{ 
            background: `linear-gradient(135deg, ${brandTheme.colors.primary}05 0%, ${brandTheme.colors.primary}02 100%)`
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                style={{ 
                  backgroundColor: `${brandTheme.colors.primary}15`,
                  border: `2px solid ${brandTheme.colors.primary}30`
                }}
              >
                <FontAwesomeIcon 
                  icon={faBook} 
                  className="text-xl" 
                  style={{ color: brandTheme.colors.primary }} 
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Chapter-wise Performance</h3>
                <p className="text-sm text-gray-600 mt-0.5">
                  Detailed analysis across {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brandTheme.colors.primary }}></div>
                <span className="text-gray-600">Score</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <span className="text-gray-600">Maximum</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter Cards Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chapters.map(([chapterName, performance], index) => {
              const percentage = performance.maxScore > 0 
                ? Math.round((performance.score / performance.maxScore) * 100)
                : 0;
              const gradeInfo = getPerformanceGrade(percentage);

              return (
                <div
                  key={chapterName}
                  className="group relative bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-300"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animation: 'fadeInUp 0.5s ease-out forwards',
                    opacity: 0
                  }}
                >
                  {/* Chapter Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-3">
                      <h4 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-gray-700 transition-colors">
                        {chapterName}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {performance.attempted} {performance.attempted === 1 ? 'question' : 'questions'} attempted
                      </p>
                    </div>
                    
                    {/* Grade Badge */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0"
                      style={{ 
                        backgroundColor: gradeInfo.bgColor,
                        color: gradeInfo.color,
                        border: `2px solid ${gradeInfo.color}30`
                      }}
                    >
                      {gradeInfo.grade}
                    </div>
                  </div>

                  {/* Score Display */}
                  <div className="mb-4">
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-bold text-gray-900">
                          {performance.score}
                        </span>
                        <span className="text-sm text-gray-500">/ {performance.maxScore}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-gray-100">
                        <FontAwesomeIcon icon={faPercentage} className="text-xs text-gray-600" />
                        <span className="text-sm font-semibold" style={{ color: gradeInfo.color }}>
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${percentage}%`,
                          background: `linear-gradient(90deg, ${gradeInfo.color} 0%, ${gradeInfo.color}cc 100%)`,
                          boxShadow: `0 0 8px ${gradeInfo.color}40`
                        }}
                      />
                    </div>
                  </div>



                  {/* Hover Effect Overlay */}
                  <div 
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, ${brandTheme.colors.primary}03 0%, transparent 100%)`
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Overall Summary */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Chapters */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <FontAwesomeIcon icon={faBook} className="text-blue-600 text-lg" />
                  <span className="text-xs font-medium text-blue-700 bg-blue-200 px-2 py-0.5 rounded-full">
                    Total
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{chapters.length}</p>
                <p className="text-xs text-blue-700 mt-1">Chapters</p>
              </div>

              {/* Total Questions */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <FontAwesomeIcon icon={faQuestionCircle} className="text-purple-600 text-lg" />
                  <span className="text-xs font-medium text-purple-700 bg-purple-200 px-2 py-0.5 rounded-full">
                    Attempted
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {chapters.reduce((sum, [, perf]) => sum + perf.attempted, 0)}
                </p>
                <p className="text-xs text-purple-700 mt-1">Questions</p>
              </div>

              {/* Total Score */}
              <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <FontAwesomeIcon icon={faTrophy} className="text-green-600 text-lg" />
                  <span className="text-xs font-medium text-green-700 bg-green-200 px-2 py-0.5 rounded-full">
                    Earned
                  </span>
                </div>
                <p className="text-2xl font-bold text-green-900">
                  {chapters.reduce((sum, [, perf]) => sum + perf.score, 0)}
                </p>
                <p className="text-xs text-green-700 mt-1">Total Points</p>
              </div>

              {/* Average Performance */}
              <div 
                className="rounded-lg p-4 border"
                style={{
                  background: `linear-gradient(135deg, ${brandTheme.colors.primary}10 0%, ${brandTheme.colors.primary}05 100%)`,
                  borderColor: `${brandTheme.colors.primary}30`
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <FontAwesomeIcon 
                    icon={faChartLine} 
                    className="text-lg" 
                    style={{ color: brandTheme.colors.primary }}
                  />
                  <span 
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ 
                      color: brandTheme.colors.primary,
                      backgroundColor: `${brandTheme.colors.primary}20`
                    }}
                  >
                    Average
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: brandTheme.colors.primary }}>
                  {Math.round(
                    chapters.reduce((sum, [, perf]) => {
                      const pct = perf.maxScore > 0 ? (perf.score / perf.maxScore) * 100 : 0;
                      return sum + pct;
                    }, 0) / chapters.length
                  )}%
                </p>
                <p className="text-xs mt-1" style={{ color: `${brandTheme.colors.primary}cc` }}>
                  Performance
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ChapterPerformanceAnalysis;
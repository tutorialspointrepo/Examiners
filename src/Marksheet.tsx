import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faIdCard,
  faBuilding,
  faCalendar,
  faClock,
  faGraduationCap,
  faFileLines,
  faCirclePlay,
  faPrint,
  faXmark,
  faScroll,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';

interface MarksheetProps {
  isOpen: boolean;
  onClose: () => void;
  course: {
    id: string;
    courseId?: string;
    name: string;
    lectures: number;
    quizzes: number;
    exercises: number;
    duration: string;
    category?: string;
    enrollmentId?: string;
    instructor?: string;
  };
  currentUser: any;
  selectedCollege: any;
  brandTheme: {
    colors: { primary: string; secondary: string };
    gradients: { primary: string };
    collegeName?: string;
  };
}

interface MarksheetData {
  studentName: string;
  rollNo: string;
  courseName: string;
  className: string;
  duration: string;
  issueDate: string;
  institution: string;
  instituteLogo: string;
  courseTrainer: string;
  totalTextLectures: number;
  completedTextLectures: number;
  totalVideoLectures: number;
  completedVideoLectures: number;
  totalLectures: number;
  completedLectures: number;
  totalQuizzes: number;
  quizMaxMarks: number;
  quizMarksObtained: number;
  totalExercises: number;
  exerciseMaxMarks: number;
  exerciseMarksObtained: number;
  totalTimeSeconds: number;
  textTimeSeconds: number;
  videoTimeSeconds: number;
  grandTotal: number;
  grandMax: number;
  overallPercentage: number;
  grade: string;
  isSpecimen: boolean;
}function computeGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const Marksheet: React.FC<MarksheetProps> = ({ isOpen, onClose, course, currentUser, selectedCollege, brandTheme }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MarksheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !currentUser?.userId) return;

    const fetchMarksheetData = async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = currentUser.userId;
        const numericCourseId = course.courseId ? Number(course.courseId) : null;

        // Resolve course slug - course.id may be numeric courseId for student enrollments
        let courseSlug = course.id;
        const isNumericId = /^\d+$/.test(String(course.id));
        
        if (isNumericId) {
          try {
            const courses = await firebaseService.getCoursesByCourseId([Number(course.id)]);
            if (courses.length > 0 && courses[0]?.slug) {
              courseSlug = courses[0].slug;
            }
          } catch (e) {
            console.warn('Could not resolve slug from courseId:', e);
          }
        }

        // 1. Fetch enrollment from course_enrollments
        let enrollment: any = null;
        if (numericCourseId) {
          enrollment = await firebaseService.getEnrollment(numericCourseId, userId);
        }
        if (!enrollment) {
          enrollment = await firebaseService.getEnrollment(courseSlug, userId);
        }
        if (!enrollment) {
          throw new Error('Enrollment not found for this course');
        }

        const enrollmentId = enrollment.id;
        const progress = enrollment.progress || {};
        const completedLectureIds = (progress.completedLectures || []).map((id: any) => String(id));
        const completedSet = new Set(completedLectureIds);
        const lecturesMap: Record<string, any> = progress.lectures || {};

        // Fetch institute logo from raw college doc
        let instituteLogo = '';
        try {
          const collegeId = selectedCollege?.id || currentUser?.collegeId || '';
          if (collegeId) {
            const rawCollege = await firebaseService.getCollegeRawData(collegeId);
            instituteLogo = rawCollege?.instituteLogo || '';
          }
        } catch (e) {
          console.warn('Could not fetch institute logo:', e);
        }

        // 2. Fetch curriculum for total text/video counts
        // Also fetch course doc for courseAuthor
        // Source: courses/{courseSlug}/curriculum -> chapters[].lectures[].lectureType
        const curriculum = await firebaseService.getCourseCurriculum(courseSlug);
        
        // Fetch courseAuthor from main course doc
        let courseTrainer = course.instructor || '';
        if (!courseTrainer) {
          try {
            const courseDoc = await firebaseService.getCourseBySlug(courseSlug);
            courseTrainer = courseDoc?.courseAuthor || '';
          } catch (e) {
            console.warn('Could not fetch course doc for author:', e);
          }
        }
        
        let totalText = 0, totalVideo = 0;
        const lectureTypeMap: Record<string, string> = {};
        
        curriculum.forEach((unit: any) => {
          (unit.chapters || []).forEach((chapter: any) => {
            (chapter.lectures || []).forEach((lecture: any) => {
              const type = lecture.lectureType || 'text';
              const lid = String(lecture.lectureId);
              lectureTypeMap[lid] = type;
              if (type === 'video') totalVideo++;
              else if (type === 'text') totalText++;
            });
          });
        });

        // 3. Completed text/video by cross-referencing completedLectures with curriculum lectureType
        let completedText = 0, completedVideo = 0;
        completedSet.forEach(lid => {
          const type = lectureTypeMap[lid as string];
          if (type === 'video') completedVideo++;
          else if (type === 'text') completedText++;
        });

        // 4. Time by type from progress.lectures.{id}.timeSpent (seconds) grouped by .type
        let textTimeSeconds = 0, videoTimeSeconds = 0;
        Object.entries(lecturesMap).forEach(([, ldata]: [string, any]) => {
          const ts = ldata.timeSpent || 0;
          if (ldata.type === 'video') videoTimeSeconds += ts;
          else if (ldata.type === 'text') textTimeSeconds += ts;
        });
        const totalTimeSeconds = progress.totalTimeSpent || (textTimeSeconds + videoTimeSeconds);

        // 5. Quiz marks from progress.quizResults.{id} -> .score (obtained), .totalQuestions (max)
        const quizResults: Record<string, any> = progress.quizResults || {};
        let quizMarksObtained = 0, quizMaxMarks = 0, totalQuizzesAttempted = 0;
        Object.values(quizResults).forEach((qr: any) => {
          quizMarksObtained += qr.score || 0;
          quizMaxMarks += qr.totalQuestions || 0;
          totalQuizzesAttempted++;
        });

        // 6. Exercise marks from course_enrollments/{id}/exerciseSubmissions
        // Doc ID: {lectureId}_{attemptNumber}, fields: evaluation.score (out of 100), status="evaluated"
        // Take best score per unique exercise (lectureId_exerciseId)
        const exerciseSubmissions = await firebaseService.getAllExerciseSubmissions(enrollmentId);
        
        const bestScorePerExercise: Record<string, number> = {};
        exerciseSubmissions.forEach((sub: any) => {
          if (sub.status === 'evaluated' && sub.evaluation?.score !== undefined) {
            const key = `${sub.lectureId}_${sub.exerciseId}`;
            const score = sub.evaluation.score;
            if (!bestScorePerExercise[key] || score > bestScorePerExercise[key]) {
              bestScorePerExercise[key] = score;
            }
          }
        });
        
        const exerciseKeys = Object.keys(bestScorePerExercise);
        const exerciseMarksObtained = exerciseKeys.reduce((sum, k) => sum + bestScorePerExercise[k], 0);
        const exerciseMaxMarks = exerciseKeys.length * 100;

        // 7. Compute totals
        const totalLectures = totalText + totalVideo;
        const completedLectures = completedText + completedVideo;
        const lectureMarks = completedLectures;
        const lectureMaxMarks = totalLectures;

        const grandTotal = lectureMarks + quizMarksObtained + exerciseMarksObtained;
        const grandMax = lectureMaxMarks + quizMaxMarks + exerciseMaxMarks;
        const overallPct = grandMax > 0 ? (grandTotal / grandMax) * 100 : 0;

        // Check if certificate has been issued (course fully completed)
        const isSpecimen = !enrollment.certificateIssued || !enrollment.certificateId;

        // Use completedAt from enrollment as issue date if available
        let dateStr: string;
        if (!isSpecimen && enrollment.completedAt) {
          const completedDate = enrollment.completedAt.toDate ? enrollment.completedAt.toDate() : new Date(enrollment.completedAt);
          dateStr = completedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } else {
          dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        setData({
          studentName: currentUser.fullName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Student',
          rollNo: currentUser.studentRoll || '',
          courseName: course.name,
          className: currentUser.studentClass || currentUser.classId || '',
          duration: course.duration,
          issueDate: dateStr,
          institution: selectedCollege?.name || selectedCollege?.collegeName || brandTheme.collegeName || 'Institution',
          instituteLogo,
          courseTrainer,
          totalTextLectures: totalText,
          completedTextLectures: completedText,
          totalVideoLectures: totalVideo,
          completedVideoLectures: completedVideo,
          totalLectures,
          completedLectures,
          totalQuizzes: totalQuizzesAttempted,
          quizMaxMarks,
          quizMarksObtained,
          totalExercises: exerciseKeys.length,
          exerciseMaxMarks,
          exerciseMarksObtained,
          totalTimeSeconds,
          textTimeSeconds,
          videoTimeSeconds,
          grandTotal,
          grandMax,
          overallPercentage: Math.round(overallPct * 10) / 10,
          grade: computeGrade(overallPct),
          isSpecimen,
        });
      } catch (err: any) {
        console.error('Failed to fetch marksheet data:', err);
        setError(err.message || 'Failed to generate marksheet');
      } finally {
        setLoading(false);
      }
    };

    fetchMarksheetData();
  }, [isOpen, currentUser, selectedCollege, course]);

  const handlePrint = () => {
    if (!printRef.current) return;
    
    // Inject print-only styles
    const styleId = 'marksheet-print-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
        body > *:not(#marksheet-print-container) { display: none !important; height: 0 !important; overflow: hidden !important; }
        #marksheet-print-container {
          display: block !important;
          position: static !important;
          width: 100%;
          margin: 0;
          padding: 0;
          font-family: 'DM Sans', sans-serif;
          zoom: 0.92;
        }
        #marksheet-print-container * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        #marksheet-print-container svg { display: inline-block; width: 1em; height: 1em; vertical-align: middle; }
        @page { margin: 4mm; size: A4; }
      }
      #marksheet-print-container { display: none; }
    `;

    // Create print container with marksheet content
    let container = document.getElementById('marksheet-print-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'marksheet-print-container';
      document.body.appendChild(container);
    }
    container.innerHTML = printRef.current.innerHTML;

    // Print and cleanup
    setTimeout(() => {
      window.print();
      // Cleanup after print dialog closes
      setTimeout(() => {
        if (container) container.innerHTML = '';
      }, 500);
    }, 100);
  };

  if (!isOpen) return null;

  const quizPct = data && data.quizMaxMarks > 0 ? ((data.quizMarksObtained / data.quizMaxMarks) * 100).toFixed(1) : '0.0';
  const exercisePct = data && data.exerciseMaxMarks > 0 ? ((data.exerciseMarksObtained / data.exerciseMaxMarks) * 100).toFixed(1) : '0.0';
  const assessmentTotal = (data?.quizMaxMarks || 0) + (data?.exerciseMaxMarks || 0);
  const assessmentObtained = (data?.quizMarksObtained || 0) + (data?.exerciseMarksObtained || 0);
  const assessmentPct = assessmentTotal > 0 ? ((assessmentObtained / assessmentTotal) * 100).toFixed(1) : '0.0';

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "'Crimson Pro', serif", fontSize: 14, color: '#1a365d',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2,
    margin: '18px 0 8px', paddingBottom: 4, borderBottom: '1px solid #e8e0cc',
  };
  const thStyle = (isFirst: boolean): React.CSSProperties => ({
    background: '#1a365d', color: '#fff', padding: '8px 12px',
    textAlign: isFirst ? 'left' : 'center', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
  });
  const tdStyle = (isFirst?: boolean): React.CSSProperties => ({
    padding: '8px 12px', borderBottom: '1px solid #ede8da',
    textAlign: isFirst ? 'left' : 'center',
  });
  const totalTdStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#f0ece4', fontWeight: 700,
    color: '#1a365d', borderTop: '2px solid #c4b896',
  };

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 10000 }} onClick={onClose} />
      <div style={{ position: 'fixed', inset: 16, zIndex: 10001, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 0' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 860 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 8px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon={faScroll} /> Marksheet
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={handlePrint} disabled={loading || !data || data?.isSpecimen}
                style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#fff', color: '#374151', border: 'none', cursor: 'pointer', opacity: loading || !data || data?.isSpecimen ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FontAwesomeIcon icon={faPrint} /> Print / Download
              </button>
              <button onClick={onClose}
                style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ background: '#fff', borderRadius: 8, padding: 80, textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '2px solid #d1d5db', borderTopColor: '#4f46e5', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#6b7280', fontSize: 14 }}>Generating marksheet...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : error ? (
            <div style={{ background: '#fff', borderRadius: 8, padding: 80, textAlign: 'center' }}>
              <p style={{ color: '#ef4444', fontSize: 14 }}>❌ {error}</p>
            </div>
          ) : data && (
            <div ref={printRef}>
              <div style={{
                width: '100%', maxWidth: 800, margin: '0 auto',
                background: '#fffef9', padding: 32, position: 'relative',
                boxShadow: '0 4px 40px rgba(0,0,0,.08)', borderRadius: 4,
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#2d3748',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 8, border: '1px solid #c4b896', pointerEvents: 'none' }} />
                
                {['tl','tr','bl','br'].map(pos => (
                  <div key={pos} style={{
                    position: 'absolute', width: 40, height: 40,
                    ...(pos.includes('t') ? { top: 14 } : { bottom: 14 }),
                    ...(pos.includes('l') ? { left: 14 } : { right: 14 }),
                    transform: pos === 'tr' ? 'scaleX(-1)' : pos === 'bl' ? 'scaleY(-1)' : pos === 'br' ? 'scale(-1)' : 'none',
                  }}>
                    <svg viewBox="0 0 40 40" style={{ width: '100%', height: '100%' }}>
                      <path d="M0 40V0h40" fill="none" stroke="#c4b896" strokeWidth="1.5" />
                      <path d="M0 30V0h30" fill="none" stroke="#c4b896" strokeWidth="1" opacity=".5" />
                    </svg>
                  </div>
                ))}

                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-30deg)',
                  fontFamily: "'Crimson Pro', serif", fontSize: 80, color: data.isSpecimen ? 'rgba(220,38,38,0.08)' : 'rgba(26,54,93,.03)',
                  fontWeight: 700, textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap',
                }}>{data.isSpecimen ? 'SPECIMEN' : 'EXAMINERS'}</div>

                {/* Specimen overlay banner */}
                {data.isSpecimen && (
                  <div style={{
                    position: 'absolute', top: 18, right: -34, zIndex: 2,
                    background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700,
                    letterSpacing: 2, textTransform: 'uppercase', padding: '5px 40px',
                    transform: 'rotate(45deg)', transformOrigin: 'center',
                    boxShadow: '0 2px 8px rgba(220,38,38,0.3)',
                  }}>SPECIMEN</div>
                )}

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  {data.instituteLogo ? (
                    <img src={data.instituteLogo} alt={data.institution}
                      style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 10px', display: 'block' }}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div style={{
                      width: 64, height: 64, borderRadius: 16,
                      background: `linear-gradient(135deg, #c4b896, ${brandTheme.colors.secondary || brandTheme.colors.primary})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px', color: '#fff', fontSize: 28, fontWeight: 700,
                      fontFamily: "'Crimson Pro', serif",
                    }}>{data.institution.charAt(0)}</div>
                  )}
                  <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 22, color: '#1a365d', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {data.institution}
                  </div>
                  <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 15, color: '#8b7e5a', marginTop: 6, letterSpacing: 4, textTransform: 'uppercase' }}>
                    Academic Marksheet
                  </div>
                  <div style={{ width: 120, height: 2, background: 'linear-gradient(90deg, transparent, #c4b896, transparent)', margin: '10px auto' }} />
                </div>

                {/* Course Name - outside box */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 17, color: '#1a365d', fontWeight: 600 }}>
                    {data.courseName}
                  </div>
                </div>

                {/* Student Info */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 40px',
                  marginBottom: 20, padding: '14px 20px', background: '#faf8f2',
                  border: '1px solid #e8e0cc', borderRadius: 8,
                }}>
                  {([
                    [faUser, 'Student Name', data.studentName],
                    [faIdCard, 'Roll No.', data.rollNo || '—'],
                    [faBuilding, 'Class', data.className || '—'],
                    [faGraduationCap, 'Course Trainer', data.courseTrainer || '—'],
                    [faClock, 'Duration', data.duration],
                    [faCalendar, 'Issue Date', data.issueDate],
                  ] as [any, string, string][]).map(([icon, label, value]) => (
                    <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <FontAwesomeIcon icon={icon} style={{ fontSize: 11, color: '#8b7e5a', width: 14 }} />
                      <span style={{ fontSize: 11, color: '#8b7e5a', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
                      <span style={{ fontSize: 13, color: '#1a365d', fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Lecture Completion */}
                <div style={sectionTitleStyle}>Lecture Completion</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>
                    {['Category', 'Type', 'Total', 'Completed', 'Marks (1/lecture)'].map((h, i) => (
                      <th key={h} style={thStyle(i === 0)}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    <tr>
                      <td style={tdStyle(true)}>Text Lectures</td>
                      <td style={tdStyle()}><FontAwesomeIcon icon={faFileLines} style={{ color: '#6366f1', marginRight: 4 }} /> Text</td>
                      <td style={tdStyle()}>{data.totalTextLectures}</td>
                      <td style={tdStyle()}>{data.completedTextLectures}</td>
                      <td style={{ ...tdStyle(), fontWeight: 700 }}>{data.completedTextLectures}</td>
                    </tr>
                    <tr style={{ background: '#faf8f2' }}>
                      <td style={tdStyle(true)}>Video Lectures</td>
                      <td style={tdStyle()}><FontAwesomeIcon icon={faCirclePlay} style={{ color: '#059669', marginRight: 4 }} /> Video</td>
                      <td style={tdStyle()}>{data.totalVideoLectures}</td>
                      <td style={tdStyle()}>{data.completedVideoLectures}</td>
                      <td style={{ ...tdStyle(), fontWeight: 700 }}>{data.completedVideoLectures}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ ...totalTdStyle, textAlign: 'left' }}>Total Lecture Marks</td>
                      <td style={totalTdStyle} /><td style={totalTdStyle} />
                      <td style={{ ...totalTdStyle, textAlign: 'center', fontSize: 14 }}>{data.completedLectures} / {data.totalLectures}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Assessment Performance */}
                <div style={sectionTitleStyle}>Assessment Performance</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>
                    {['Assessment Type', 'Attempted', 'Max Marks', 'Obtained', 'Percentage'].map((h, i) => (
                      <th key={h} style={thStyle(i === 0)}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    <tr>
                      <td style={tdStyle(true)}>Quizzes</td>
                      <td style={tdStyle()}>{data.totalQuizzes}</td>
                      <td style={tdStyle()}>{data.quizMaxMarks}</td>
                      <td style={tdStyle()}>{data.quizMarksObtained}</td>
                      <td style={{ ...tdStyle(), fontWeight: 700 }}>{quizPct}%</td>
                    </tr>
                    <tr style={{ background: '#faf8f2' }}>
                      <td style={tdStyle(true)}>Exercises</td>
                      <td style={tdStyle()}>{data.totalExercises}</td>
                      <td style={tdStyle()}>{data.exerciseMaxMarks}</td>
                      <td style={tdStyle()}>{data.exerciseMarksObtained}</td>
                      <td style={{ ...tdStyle(), fontWeight: 700 }}>{exercisePct}%</td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ ...totalTdStyle, textAlign: 'left' }}>Total Assessment Marks</td>
                      <td style={{ ...totalTdStyle, textAlign: 'center', fontSize: 14 }}>{assessmentTotal}</td>
                      <td style={{ ...totalTdStyle, textAlign: 'center', fontSize: 14 }}>{assessmentObtained}</td>
                      <td style={{ ...totalTdStyle, textAlign: 'center', fontSize: 14 }}>{assessmentPct}%</td>
                    </tr>
                  </tbody>
                </table>

                {/* Performance Summary */}
                <div style={sectionTitleStyle}>Performance Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '16px 0' }}>
                  {[
                    { value: String(data.completedLectures), label: 'Lecture Marks' },
                    { value: String(assessmentObtained), label: 'Assessment Marks' },
                    { value: String(data.grandTotal), label: `Grand Total (/ ${data.grandMax})` },
                    { value: `${data.overallPercentage}%`, label: 'Overall Percentage' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center', padding: '12px 10px', border: '1px solid #e8e0cc', borderRadius: 8, background: '#faf8f2' }}>
                      <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 24, fontWeight: 700, color: '#1a365d' }}>{item.value}</div>
                      <div style={{ fontSize: 10, color: '#8b7e5a', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4, fontWeight: 600 }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Learning Hours & Grade */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#8b7e5a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Learning Hours</div>
                    <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 32, fontWeight: 700, color: '#1a365d' }}>{formatTime(data.totalTimeSeconds)}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      <FontAwesomeIcon icon={faFileLines} style={{ color: '#6366f1', marginRight: 3 }} /> Text: {formatTime(data.textTimeSeconds)}
                      &nbsp;&nbsp;·&nbsp;&nbsp;
                      <FontAwesomeIcon icon={faCirclePlay} style={{ color: '#059669', marginRight: 3 }} /> Video: {formatTime(data.videoTimeSeconds)}
                    </div>
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 24px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #1a365d, #2d4a7a)', color: '#fff',
                    fontFamily: "'Crimson Pro', serif",
                  }}>
                    <div>
                      <div style={{ fontSize: 11, opacity: .7, textTransform: 'uppercase', letterSpacing: 1 }}>Grade Awarded</div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{data.grade}</div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #e8e0cc', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#666' }}>Generated on: {data.issueDate}, @ Examiners</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                    Grading Scale — A+: ≥90% &nbsp;·&nbsp; A: ≥80% &nbsp;·&nbsp; B+: ≥70% &nbsp;·&nbsp; B: ≥60% &nbsp;·&nbsp; C: ≥50% &nbsp;·&nbsp; D: ≥40% &nbsp;·&nbsp; F: &lt;40%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default Marksheet;
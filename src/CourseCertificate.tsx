import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPrint,
  faXmark,
  faCertificate,
} from '@fortawesome/sharp-light-svg-icons';
import { firebaseService } from './services/firebase_service';

interface CourseCertificateProps {
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

interface CertificateData {
  studentName: string;
  rollNo: string;
  courseName: string;
  className: string;
  duration: string;
  issueDate: string;
  institution: string;
  instituteLogo: string;
  courseTrainer: string;
  totalLectures: number;
  completedLectures: number;
  totalQuizzes: number;
  quizMaxMarks: number;
  quizMarksObtained: number;
  totalExercises: number;
  exerciseMaxMarks: number;
  exerciseMarksObtained: number;
  totalTimeSeconds: number;
  grandTotal: number;
  grandMax: number;
  overallPercentage: number;
  grade: string;
  certificateId: string;
  isSpecimen: boolean;
}

function computeGrade(pct: number): string {
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

const CourseCertificate: React.FC<CourseCertificateProps> = ({ isOpen, onClose, course, currentUser, selectedCollege, brandTheme }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CertificateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !currentUser?.userId) return;

    const fetchCertificateData = async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = currentUser.userId;
        const numericCourseId = course.courseId ? Number(course.courseId) : null;

        // Resolve course slug
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

        // Fetch enrollment
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

        // Fetch institute logo
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

        // Fetch curriculum
        const curriculum = await firebaseService.getCourseCurriculum(courseSlug);

        // Fetch courseAuthor
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

        let completedText = 0, completedVideo = 0;
        completedSet.forEach(lid => {
          const type = lectureTypeMap[lid as string];
          if (type === 'video') completedVideo++;
          else if (type === 'text') completedText++;
        });

        // Total time
        let textTimeSeconds = 0, videoTimeSeconds = 0;
        Object.entries(lecturesMap).forEach(([, ldata]: [string, any]) => {
          const ts = ldata.timeSpent || 0;
          if (ldata.type === 'video') videoTimeSeconds += ts;
          else if (ldata.type === 'text') textTimeSeconds += ts;
        });
        const totalTimeSeconds = progress.totalTimeSpent || (textTimeSeconds + videoTimeSeconds);

        // Quiz marks
        const quizResults: Record<string, any> = progress.quizResults || {};
        let quizMarksObtained = 0, quizMaxMarks = 0, totalQuizzesAttempted = 0;
        Object.values(quizResults).forEach((qr: any) => {
          quizMarksObtained += qr.score || 0;
          quizMaxMarks += qr.totalQuestions || 0;
          totalQuizzesAttempted++;
        });

        // Exercise marks
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

        // Compute totals
        const totalLectures = totalText + totalVideo;
        const completedLectures = completedText + completedVideo;
        const lectureMarks = completedLectures;
        const lectureMaxMarks = totalLectures;

        const grandTotal = lectureMarks + quizMarksObtained + exerciseMarksObtained;
        const grandMax = lectureMaxMarks + quizMaxMarks + exerciseMaxMarks;
        const overallPct = grandMax > 0 ? (grandTotal / grandMax) * 100 : 0;

        // Check if certificate has been officially issued
        const isSpecimen = !enrollment.certificateIssued || !enrollment.certificateId;
        const certificateId = enrollment.certificateId || 'SPECIMEN';

        // Use completedAt from enrollment as issue date, or today for specimen
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
          totalLectures,
          completedLectures,
          totalQuizzes: totalQuizzesAttempted,
          quizMaxMarks,
          quizMarksObtained,
          totalExercises: exerciseKeys.length,
          exerciseMaxMarks,
          exerciseMarksObtained,
          totalTimeSeconds,
          grandTotal,
          grandMax,
          overallPercentage: Math.round(overallPct * 10) / 10,
          grade: computeGrade(overallPct),
          certificateId,
          isSpecimen,
        });
      } catch (err: any) {
        console.error('Failed to fetch certificate data:', err);
        setError(err.message || 'Failed to generate certificate');
      } finally {
        setLoading(false);
      }
    };

    fetchCertificateData();
  }, [isOpen, currentUser, selectedCollege, course]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const styleId = 'certificate-print-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
        body > *:not(#certificate-print-container) { display: none !important; height: 0 !important; overflow: hidden !important; }
        #certificate-print-container {
          display: block !important;
          position: static !important;
          width: 100%;
          margin: 0;
          padding: 0;
          font-family: 'DM Sans', sans-serif;
          zoom: 0.88;
        }
        #certificate-print-container * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        #certificate-print-container svg { display: inline-block; width: 1em; height: 1em; vertical-align: middle; }
        @page { margin: 4mm; size: A4 landscape; }
      }
      #certificate-print-container { display: none; }
    `;

    let container = document.getElementById('certificate-print-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'certificate-print-container';
      document.body.appendChild(container);
    }
    container.innerHTML = printRef.current.innerHTML;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (container) container.innerHTML = '';
      }, 500);
    }, 100);
  };

  if (!isOpen) return null;

  // Colors — matching Marksheet palette
  const navy = '#1a365d';        // primary headings, names, values
  const oliveGold = '#8b7e5a';   // labels, subtitles
  const gold = '#c4b896';        // borders, accents, dividers
  const goldDark = '#b8973a';    // star, ornament fills
  const cream = '#fffef8';       // background
  const creamDark = '#faf8f2';   // grade badge bg
  const bodyText = '#2d3748';    // body paragraph text
  const muted = '#666';          // footer text
  const mutedLight = '#999';     // grading scale, subtle text

  const verificationUrl = data ? `https://www.examiners.app/verify/${data.certificateId}` : '';

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 10000 }} onClick={onClose} />
      <div style={{ position: 'fixed', inset: 16, zIndex: 10001, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 0' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 8px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon={faCertificate} /> Course Certificate
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
              <p style={{ color: '#6b7280', fontSize: 14 }}>Generating certificate...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : error ? (
            <div style={{ background: '#fff', borderRadius: 8, padding: 80, textAlign: 'center' }}>
              <p style={{ color: '#ef4444', fontSize: 14 }}>❌ {error}</p>
            </div>
          ) : data && (
            <div ref={printRef}>
              <div style={{
                width: '100%', maxWidth: 840, margin: '0 auto',
                background: cream, padding: 36, position: 'relative',
                boxShadow: '0 4px 40px rgba(0,0,0,.08)', borderRadius: 4,
                fontFamily: "'DM Sans', sans-serif", color: bodyText,
                overflow: 'hidden',
              }}>
                {/* Double border */}
                <div style={{ position: 'absolute', inset: 10, border: `2px solid ${gold}`, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', inset: 16, border: `1px solid ${gold}`, opacity: 0.5, pointerEvents: 'none' }} />

                {/* Corner ornaments */}
                {['tl','tr','bl','br'].map(pos => (
                  <div key={pos} style={{
                    position: 'absolute', width: 40, height: 40,
                    ...(pos.includes('t') ? { top: 20 } : { bottom: 20 }),
                    ...(pos.includes('l') ? { left: 20 } : { right: 20 }),
                    transform: pos === 'tr' ? 'scaleX(-1)' : pos === 'bl' ? 'scaleY(-1)' : pos === 'br' ? 'scale(-1)' : 'none',
                  }}>
                    <svg viewBox="0 0 40 40" style={{ width: '100%', height: '100%' }}>
                      <path d="M0 40V0h40" fill="none" stroke={gold} strokeWidth="1.5" />
                      <path d="M0 30V0h30" fill="none" stroke={gold} strokeWidth="1" opacity=".5" />
                      <circle cx="3" cy="3" r="2.5" fill={goldDark} />
                    </svg>
                  </div>
                ))}

                {/* Watermark */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-25deg)',
                  fontSize: 90, fontWeight: 700, color: data.isSpecimen ? 'rgba(220,38,38,0.08)' : 'rgba(26,54,93,0.03)',
                  letterSpacing: 12, textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap',
                  fontFamily: "'Georgia', serif",
                }}>{ data.isSpecimen ? 'SPECIMEN' : 'EXAMINERS' }</div>

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

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>

                  {/* Institute logo + name */}
                  {data.instituteLogo ? (
                    <img src={data.instituteLogo} alt={data.institution}
                      style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 10px', display: 'block', borderRadius: 12 }}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div style={{
                      width: 56, height: 56, borderRadius: 14,
                      background: `linear-gradient(135deg, ${gold}, ${goldDark})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 10px', color: '#fff', fontSize: 26, fontWeight: 700,
                      fontFamily: "'Georgia', serif",
                    }}>{data.institution.charAt(0)}</div>
                  )}
                  <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 22, color: navy, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                    {data.institution}
                  </div>

                  {/* Divider with diamond */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '12px 0' }}>
                    <div style={{ width: 80, height: 1, background: `linear-gradient(90deg, transparent, ${gold})` }} />
                    <svg width="20" height="20" viewBox="0 0 20 20"><polygon points="10,0 20,10 10,20 0,10" fill="none" stroke={gold} strokeWidth="1.5" /></svg>
                    <div style={{ width: 80, height: 1, background: `linear-gradient(90deg, ${gold}, transparent)` }} />
                  </div>

                  {/* Title */}
                  <div style={{
                    fontFamily: "'Crimson Pro', serif", fontSize: 34, fontWeight: 700, letterSpacing: 8,
                    textTransform: 'uppercase', marginBottom: 4, color: navy,
                  }}>Certificate</div>
                  <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 15, color: oliveGold, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 26 }}>
                    of Course Completion
                  </div>

                  {/* Recipient */}
                  <div style={{ fontSize: 12, color: oliveGold, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
                    This is proudly presented to
                  </div>
                  <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 40, fontStyle: 'italic', fontWeight: 700, color: navy, marginBottom: 4 }}>
                    {data.studentName}
                  </div>
                  <div style={{ width: 200, height: 1, background: gold, margin: '0 auto 22px' }} />

                  {/* Body text */}
                  <div style={{ fontSize: 14, color: bodyText, lineHeight: 1.9, maxWidth: 560, margin: '0 auto 24px' }}>
                    For successfully completing the course <strong style={{ color: navy }}>{data.courseName}</strong>{' '}
                    with a grade of <strong style={{ color: oliveGold }}>{data.grade} ({data.overallPercentage}%)</strong>,{' '}
                    having completed {data.completedLectures} of {data.totalLectures} lectures and devoted {formatTime(data.totalTimeSeconds)} of learning.
                  </div>

                  {/* Grade badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 14,
                    padding: '10px 32px', border: `1px solid ${gold}`, borderRadius: 50,
                    background: creamDark, marginBottom: 24,
                  }}>
                    <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: oliveGold }}>Final Grade</span>
                    <span style={{ fontFamily: "'Crimson Pro', serif", fontSize: 28, fontWeight: 700, color: navy }}>{data.grade}</span>
                    <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: oliveGold }}>{data.overallPercentage}%</span>
                  </div>

                  {/* Signatures row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '20px 20px 0', padding: '0 10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, color: navy, fontWeight: 600, marginBottom: 4 }}>{data.issueDate}</div>
                      <div style={{ width: 120, height: 1, background: gold, margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 10, color: oliveGold, letterSpacing: 2, textTransform: 'uppercase' }}>Date</div>
                    </div>
                    {/* Seal */}
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%', border: `2px solid ${gold}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      background: `radial-gradient(circle, ${cream} 60%, #f5efd6)`,
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill={goldDark} /></svg>
                      <span style={{ fontSize: 8, color: oliveGold, letterSpacing: 1, marginTop: 2 }}>VERIFIED</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, color: navy, fontWeight: 600, marginBottom: 4 }}>{data.courseTrainer || 'Instructor'}</div>
                      <div style={{ width: 120, height: 1, background: gold, margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 10, color: oliveGold, letterSpacing: 2, textTransform: 'uppercase' }}>Instructor</div>
                    </div>
                  </div>

                  {/* Certificate ID & Verification + Grade Scale */}
                  <div style={{ marginTop: 24, paddingTop: 14, borderTop: `1px solid ${gold}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: oliveGold, marginBottom: 2 }}>Certificate ID</div>
                        <div style={{ fontSize: 12, color: navy, fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>{data.certificateId}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: oliveGold, marginBottom: 2 }}>Verify at</div>
                        <div style={{ fontSize: 11, color: navy, fontWeight: 500, letterSpacing: 0.5 }}>{verificationUrl}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: mutedLight, marginTop: 10, letterSpacing: 0.3 }}>
                      Grading — A+: ≥90% &nbsp;·&nbsp; A: ≥80% &nbsp;·&nbsp; B+: ≥70% &nbsp;·&nbsp; B: ≥60% &nbsp;·&nbsp; C: ≥50% &nbsp;·&nbsp; D: ≥40% &nbsp;·&nbsp; F: &lt;40%
                    </div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
                      Generated on: {data.issueDate} · @ Examiners
                    </div>
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

export default CourseCertificate;
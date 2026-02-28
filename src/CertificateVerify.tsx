import React, { useState, useEffect } from 'react';
import { firebaseService } from './services/firebase_service';

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

interface CertDisplayData {
  studentName: string;
  courseName: string;
  institution: string;
  instituteLogo: string;
  courseTrainer: string;
  certificateId: string;
  issueDate: string;
  grade: string;
  percentage: number;
  completedLectures: number;
  totalLectures: number;
  totalTime: string;
}

const CertificateVerify: React.FC = () => {
  const [certificateId, setCertificateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [certData, setCertData] = useState<CertDisplayData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);

  // Check if certificate ID is in the URL path
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/verify\/(.+)/);
    if (match && match[1]) {
      const id = decodeURIComponent(match[1]);
      setCertificateId(id);
      handleVerify(id);
    }
  }, []);

  const handleVerify = async (id?: string) => {
    const searchId = (id || certificateId).trim();
    if (!searchId) return;

    setLoading(true);
    setSearched(true);
    setCertData(null);
    setNotFound(false);

    try {
      if (!firebaseService.isInitialized()) {
        throw new Error('Firebase not initialized');
      }
      const data = await firebaseService.verifyCertificate(searchId);

      if (data) {
        let issueDate = '';
        if (data.completedAt) {
          const d = data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
          issueDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        const progress = data.progress || {};
        const completedLectures = (progress.completedLectures || []).length;
        const totalTimeSeconds = progress.totalTimeSpent || 0;

        // Calculate grade from progress
        const quizResults = progress.quizResults || {};
        let quizObtained = 0, quizMax = 0;
        Object.values(quizResults).forEach((qr: any) => {
          quizObtained += qr.score || 0;
          quizMax += qr.totalQuestions || 0;
        });
        const lectureMarks = completedLectures;
        const grandTotal = lectureMarks + quizObtained;
        const grandMax = completedLectures + quizMax;
        const pct = grandMax > 0 ? (grandTotal / grandMax) * 100 : 0;

        setCertData({
          studentName: data.studentName || 'N/A',
          courseName: data.courseName || 'N/A',
          institution: data.collegeName || 'N/A',
          instituteLogo: data.instituteLogo || '',
          courseTrainer: data.courseAuthor || '',
          certificateId: data.certificateId,
          issueDate,
          grade: computeGrade(pct),
          percentage: Math.round(pct * 10) / 10,
          completedLectures,
          totalLectures: completedLectures,
          totalTime: formatTime(totalTimeSeconds),
        });
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error('Verification error:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerify();
  };

  // Colors matching certificate
  const navy = '#1a365d';
  const oliveGold = '#8b7e5a';
  const gold = '#c4b896';
  const goldDark = '#b8973a';
  const cream = '#fffef8';
  const creamDark = '#faf8f2';
  const bodyText = '#2d3748';
  const muted = '#666';
  const mutedLight = '#999';

  return (
    <>
      <style>{`html, body, #root { height: auto !important; min-height: 100vh; overflow: auto !important; margin: 0; padding: 0; }`}</style>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8f6f0 0%, #eee8d5 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        fontFamily: "'DM Sans', sans-serif",
        padding: '40px 20px',
      }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          fontFamily: "'Crimson Pro', Georgia, serif", fontSize: 28, fontWeight: 700,
          color: navy, letterSpacing: 2, marginBottom: 6,
        }}><a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>EXAMINERS</a></div>
        <div style={{ fontSize: 13, color: oliveGold, letterSpacing: 4, textTransform: 'uppercase' }}>
          Certificate Verification Portal
        </div>
        <div style={{ width: 60, height: 2, background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, margin: '12px auto 0' }} />
      </div>

      {/* Search Card */}
      <div style={{
        width: '100%', maxWidth: 860, background: cream, borderRadius: 12,
        padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        border: `1px solid ${gold}`,
      }}>
        <div style={{ fontSize: 14, color: navy, fontWeight: 600, marginBottom: 12 }}>
          Enter Certificate ID
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            value={certificateId}
            onChange={(e) => setCertificateId(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. TPX-21237-QYf1-nhQ0"
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 8, fontSize: 14,
              border: `1px solid ${gold}`, background: '#fff', color: navy,
              outline: 'none', fontFamily: 'monospace', letterSpacing: 0.5,
            }}
          />
          <button
            onClick={() => handleVerify()}
            disabled={loading || !certificateId.trim()}
            style={{
              padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: navy, color: '#fff', border: 'none', cursor: 'pointer',
              opacity: loading || !certificateId.trim() ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${gold}`, borderTopColor: navy, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: oliveGold, fontSize: 14 }}>Verifying certificate...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Not Found */}
      {searched && !loading && notFound && (
        <div style={{
          width: '100%', maxWidth: 860, marginTop: 24, borderRadius: 12,
          overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          border: '1px solid #fca5a5', background: cream,
        }}>
          <div style={{
            padding: '16px 24px', background: '#fef2f2',
            borderBottom: '1px solid #fca5a5',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16, fontWeight: 700,
            }}>✕</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>Certificate Not Found</div>
              <div style={{ fontSize: 12, color: '#ef4444' }}>No valid certificate exists with this ID</div>
            </div>
          </div>
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
              Please double-check the certificate ID and try again. If you believe this is an error, contact the issuing institution.
            </p>
          </div>
        </div>
      )}

      {/* Valid — Show Full Certificate */}
      {searched && !loading && certData && (
        <div style={{ width: '100%', maxWidth: 860, marginTop: 24 }}>
          {/* Verified badge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginBottom: 16, padding: '10px 20px', background: '#f0fdf4',
            borderRadius: 10, border: '1px solid #bbf7d0', width: '100%', maxWidth: 840, margin: '0 auto 16px',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', background: '#22c55e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 13, fontWeight: 700,
            }}>✓</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>Certificate Verified — This certificate is authentic and valid</span>
          </div>

          {/* ===== Actual Certificate ===== */}
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
            {(['tl','tr','bl','br'] as const).map(pos => (
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
              fontSize: 90, fontWeight: 700, color: 'rgba(26,54,93,0.03)',
              letterSpacing: 12, textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap',
              fontFamily: "'Georgia', serif",
            }}>EXAMINERS</div>

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>

              {/* Institute logo + name */}
              {certData.instituteLogo ? (
                <img src={certData.instituteLogo} alt={certData.institution}
                  style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 10px', display: 'block', borderRadius: 12 }}
                />
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: `linear-gradient(135deg, ${gold}, ${goldDark})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 10px', color: '#fff', fontSize: 26, fontWeight: 700,
                  fontFamily: "'Georgia', serif",
                }}>{certData.institution.charAt(0)}</div>
              )}
              <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: 22, color: navy, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                {certData.institution}
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
                {certData.studentName}
              </div>
              <div style={{ width: 200, height: 1, background: gold, margin: '0 auto 22px' }} />

              {/* Body text */}
              <div style={{ fontSize: 14, color: bodyText, lineHeight: 1.9, maxWidth: 560, margin: '0 auto 24px' }}>
                For successfully completing the course <strong style={{ color: navy }}>{certData.courseName}</strong>{' '}
                with a grade of <strong style={{ color: oliveGold }}>{certData.grade} ({certData.percentage}%)</strong>,{' '}
                having completed {certData.completedLectures} of {certData.totalLectures} lectures and devoted {certData.totalTime} of learning.
              </div>

              {/* Grade badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 14,
                padding: '10px 32px', border: `1px solid ${gold}`, borderRadius: 50,
                background: creamDark, marginBottom: 24,
              }}>
                <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: oliveGold }}>Final Grade</span>
                <span style={{ fontFamily: "'Crimson Pro', serif", fontSize: 28, fontWeight: 700, color: navy }}>{certData.grade}</span>
                <span style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: oliveGold }}>{certData.percentage}%</span>
              </div>

              {/* Signatures row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '20px 20px 0', padding: '0 10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: navy, fontWeight: 600, marginBottom: 4 }}>{certData.issueDate}</div>
                  <div style={{ width: 120, height: 1, background: gold, margin: '0 auto 4px' }} />
                  <div style={{ fontSize: 10, color: oliveGold, letterSpacing: 2, textTransform: 'uppercase' }}>Date</div>
                </div>
                {/* Seal */}
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', border: `2px solid ${gold}`,
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
                  background: `radial-gradient(circle, ${cream} 60%, #f5efd6)`,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill={goldDark} /></svg>
                  <span style={{ fontSize: 8, color: oliveGold, letterSpacing: 1, marginTop: 2 }}>VERIFIED</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: navy, fontWeight: 600, marginBottom: 4 }}>{certData.courseTrainer || 'Instructor'}</div>
                  <div style={{ width: 120, height: 1, background: gold, margin: '0 auto 4px' }} />
                  <div style={{ fontSize: 10, color: oliveGold, letterSpacing: 2, textTransform: 'uppercase' }}>Instructor</div>
                </div>
              </div>

              {/* Certificate ID & Verification + Grade Scale */}
              <div style={{ marginTop: 24, paddingTop: 14, borderTop: `1px solid ${gold}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: oliveGold, marginBottom: 2 }}>Certificate ID</div>
                    <div style={{ fontSize: 12, color: navy, fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>{certData.certificateId}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: oliveGold, marginBottom: 2 }}>Verify at</div>
                    <div style={{ fontSize: 11, color: navy, fontWeight: 500, letterSpacing: 0.5 }}>https://www.examiners.app/verify/{certData.certificateId}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: mutedLight, marginTop: 10, letterSpacing: 0.3 }}>
                  Grading — A+: ≥90% &nbsp;·&nbsp; A: ≥80% &nbsp;·&nbsp; B+: ≥70% &nbsp;·&nbsp; B: ≥60% &nbsp;·&nbsp; C: ≥50% &nbsp;·&nbsp; D: ≥40% &nbsp;·&nbsp; F: &lt;40%
                </div>
                <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
                  Generated on: {certData.issueDate} · @ Examiners
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, textAlign: 'center', fontSize: 11, color: mutedLight }}>
        © {new Date().getFullYear()} Examiners · Certificate Verification Portal
      </div>
    </div>
    </>
  );
};

export default CertificateVerify;
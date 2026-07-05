import React from 'react';

// ─── Shared sample data ───────────────────────────────────────────────────────
const S = {
  name:     'Alex Johnson',
  title:    'Senior Product Manager',
  email:    'alex.j@example.com',
  phone:    '+1 (555) 234-5678',
  location: 'San Francisco, CA',
  linkedin: 'linkedin.com/in/alexj',
  summary:  'Results-driven professional with 8+ years delivering innovative solutions and leading cross-functional teams to exceed targets.',
  company:  'TechCorp Inc.',
  position: 'Senior Product Manager',
  dates:    'Jan 2020 – Present',
  degree:   'B.S. Computer Science',
  school:   'Stanford University',
  skills:   ['Product Strategy', 'Data Analysis', 'Agile/Scrum', 'SQL', 'Python'],
  soft:     ['Leadership', 'Communication', 'Problem Solving'],
  certs:    ['PMP Certified', 'AWS Solutions Architect'],
  bullets:  [
    'Led cross-functional team of 12 to launch 3 major product features',
    'Defined product roadmap aligned with $50M annual revenue targets',
  ],
};

// ─── Tiny shared helpers ──────────────────────────────────────────────────────
const Tag = ({ label, bg, color }: { label: string; bg: string; color: string }) => (
  <span style={{ display: 'inline-block', background: bg, color, padding: '2px 8px', borderRadius: '14px', fontSize: '10px', fontWeight: 500, margin: '2px' }}>{label}</span>
);

const SHdr = ({ title, color, weight = 700, extra = {} }: { title: string; color: string; weight?: number; extra?: React.CSSProperties }) => (
  <div style={{ color, fontSize: '11px', fontWeight: weight, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '7px', ...extra }}>{title}</div>
);

const SHdrLeft = ({ title, color }: { title: string; color: string }) => (
  <div style={{ color, fontSize: '11px', fontWeight: 700, borderLeft: `4px solid ${color}`, paddingLeft: '7px', marginBottom: '7px' }}>{title}</div>
);

const ExpBlock = ({ color, position, company, dates, bullet }: { color: string; position: string; company: string; dates: string; bullet: string }) => (
  <div style={{ marginBottom: '8px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#1f2937' }}>{position}</span>
      <span style={{ fontSize: '10px', color: '#6b7280' }}>{dates}</span>
    </div>
    <div style={{ color, fontSize: '10px', fontWeight: 500, margin: '1px 0' }}>{company}</div>
    <div style={{ color: '#4b5563', fontSize: '10px' }}>• {bullet}</div>
  </div>
);

const EduBlock = ({ color, degree, school, dates }: { color: string; degree: string; school: string; dates: string }) => (
  <div style={{ marginBottom: '7px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#1f2937' }}>{degree}</span>
      <span style={{ fontSize: '10px', color: '#6b7280' }}>{dates}</span>
    </div>
    <div style={{ color, fontSize: '10px', fontWeight: 500 }}>{school}</div>
  </div>
);

const ProfileCircle = ({ size = 44, border = 'white' }: { size?: number; border?: string }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', border: `3px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <span style={{ fontSize: Math.floor(size * 0.4), color: 'rgba(255,255,255,0.8)' }}>👤</span>
  </div>
);

// ─── 1. MODERN ────────────────────────────────────────────────────────────────
// PHP: border-bottom:3px solid primary | plain white bg | sectionHdr with border-bottom
// Default color: blue → #4f87c7
export const ModernTemplatePreview: React.FC = () => {
  const primary = '#4f87c7';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', padding: '18px', fontSize: '12px' }}>
      {/* Header */}
      <div style={{ borderBottom: `3px solid ${primary}`, paddingBottom: '12px', marginBottom: '14px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>{S.name}</div>
        <div style={{ color: primary, fontSize: '12px', fontWeight: 600, margin: '3px 0' }}>{S.title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
          <span>✉ {S.email}</span>
          <span>📞 {S.phone}</span>
          <span>📍 {S.location}</span>
        </div>
      </div>
      {/* Summary */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Professional Summary</div>
        <div style={{ color: '#4b5563', fontSize: '10px', lineHeight: 1.5 }}>{S.summary}</div>
      </div>
      {/* Experience */}
      <div style={{ marginBottom: '12px' }}>
        <SHdr title="Experience" color={primary} />
        <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
      </div>
      {/* Skills */}
      <div>
        <SHdr title="Skills" color={primary} />
        <div style={{ marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#374151' }}>Technical Skills</span>
          <div style={{ marginTop: '3px' }}>{S.skills.slice(0, 4).map(s => <Tag key={s} label={s} bg="#dbeafe" color="#1e40af" />)}</div>
        </div>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#374151' }}>Soft Skills</span>
          <div style={{ marginTop: '3px' }}>{S.soft.map(s => <Tag key={s} label={s} bg="#f0fdf4" color="#166534" />)}</div>
        </div>
      </div>
    </div>
  );
};

// ─── 2. PROFESSIONAL BLUE ─────────────────────────────────────────────────────
// PHP: linear-gradient header | 1fr 2fr grid | accent sidebar | profilePic
// Default color: blue → #4f87c7
export const ProfessionalBlueTemplatePreview: React.FC = () => {
  const primary = '#4f87c7'; const secondary = '#6ba3d6'; const accent = '#dbeafe';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px', overflow: 'hidden' }}>
      {/* Gradient header */}
      <div style={{ background: `linear-gradient(135deg,${primary} 0%,${secondary} 100%)`, padding: '16px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ProfileCircle size={44} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{S.name}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', marginTop: '2px' }}>{S.title}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.9)' }}>
          <span>📞 {S.phone}</span>
          <span>✉ {S.email}</span>
          <span>📍 {S.location}</span>
        </div>
      </div>
      {/* 1fr 2fr grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
        {/* Sidebar */}
        <div style={{ background: accent, padding: '12px', borderRight: `1px solid #bfdbfe` }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: primary, fontSize: '10px', fontWeight: 700, paddingBottom: '2px', marginBottom: '5px' }}>About Me</div>
            <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.5 }}>{S.summary.slice(0, 80)}…</div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ color: primary, fontSize: '10px', fontWeight: 700, paddingBottom: '2px', marginBottom: '5px' }}>Education</div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937' }}>{S.degree}</div>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>{S.school}</div>
          </div>
          <div>
            <div style={{ color: primary, fontSize: '10px', fontWeight: 700, paddingBottom: '2px', marginBottom: '5px' }}>Expertise</div>
            {S.skills.slice(0, 3).map(s => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#374151', marginBottom: '3px' }}>
                <span>{s}</span><span style={{ color: primary }}>●●●●○</span>
              </div>
            ))}
          </div>
        </div>
        {/* Main */}
        <div style={{ padding: '12px' }}>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, paddingBottom: '2px', marginBottom: '8px' }}>Work Experience</div>
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
          <ExpBlock color={primary} position="Product Manager" company="StartupXYZ" dates="2017–2020" bullet={S.bullets[1]} />
        </div>
      </div>
    </div>
  );
};

// ─── 3. CREATIVE ─────────────────────────────────────────────────────────────
// PHP: colored full-bleed header + overflow:hidden circle decoration + profilePic
//      accent left-border summary | uppercase section titles
// Default color: orange → #f97316
export const CreativeTemplatePreview: React.FC = () => {
  const primary = '#f97316'; const accent = '#fff7ed';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px' }}>
      {/* Full-bleed colored header */}
      <div style={{ background: primary, padding: '18px', color: 'white', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -16, right: -16, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ProfileCircle size={44} />
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>{S.name}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>{S.title}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.9)', flexWrap: 'wrap' }}>
          <span>✉ {S.email}</span>
          <span>📍 {S.location}</span>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        {/* Accent left-border summary */}
        <div style={{ background: accent, borderLeft: `4px solid ${primary}`, borderRadius: '0 8px 8px 0', padding: '10px', marginBottom: '12px' }}>
          <div style={{ color: '#4b5563', fontSize: '10px', lineHeight: 1.5 }}>{S.summary}</div>
        </div>
        {/* Experience */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Experience</div>
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
        </div>
        {/* 2-col Education + Skills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Education</div>
            <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
          </div>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Skills</div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#374151', marginBottom: '3px' }}>Technical</div>
            <div>{S.skills.slice(0, 3).map(s => <Tag key={s} label={s} bg={accent} color={primary} />)}</div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#374151', margin: '4px 0 3px' }}>Soft Skills</div>
            <div>{S.soft.slice(0, 2).map(s => <Tag key={s} label={s} bg="#f0fdf4" color="#166534" />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 4. EXECUTIVE ────────────────────────────────────────────────────────────
// PHP: Times New Roman | centered header | border-bottom:3px double | pipe-separated contacts
//      ALL-CAPS section titles | border-bottom:1px solid #d1d5db
// Default color: gray → #6b7280
export const ExecutiveTemplatePreview: React.FC = () => {
  const text = '#1f2937'; const primary = '#6b7280';
  return (
    <div style={{ fontFamily: "'Times New Roman', serif", background: 'white', padding: '20px', fontSize: '12px' }}>
      {/* Centered header with double border */}
      <div style={{ textAlign: 'center', paddingBottom: '14px', marginBottom: '16px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: text }}>{S.name}</div>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', margin: '4px 0 8px' }}>{S.title}</div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '10px', color: '#4b5563' }}>
          <span>{S.email}</span><span>|</span><span>{S.phone}</span><span>|</span><span>{S.location}</span>
        </div>
      </div>
      {/* EXECUTIVE SUMMARY */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: text, fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>EXECUTIVE SUMMARY</div>
        <div style={{ color: '#374151', fontSize: '11px', lineHeight: 1.6, textAlign: 'justify' }}>{S.summary}</div>
      </div>
      {/* PROFESSIONAL EXPERIENCE */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: text, fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>PROFESSIONAL EXPERIENCE</div>
        <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
      </div>
      {/* CORE COMPETENCIES */}
      <div>
        <div style={{ color: text, fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>CORE COMPETENCIES</div>
        <div>{[...S.skills, ...S.soft].map(s => <Tag key={s} label={s} bg="#f3f4f6" color="#374151" />)}</div>
      </div>
    </div>
  );
};

// ─── 5. MINIMAL ───────────────────────────────────────────────────────────────
// PHP: Georgia serif | border-bottom:1px header | dot-separated contacts (plain string)
//      plain uppercase section titles (no border) | skills as plain comma text
// Default color: green → #22c55e
export const MinimalTemplatePreview: React.FC = () => {
  const primary = '#22c55e'; const text = '#1f2937';
  return (
    <div style={{ fontFamily: 'Georgia, serif', background: 'white', padding: '20px', fontSize: '12px' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '14px', marginBottom: '16px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: text }}>{S.name}</div>
        <div style={{ color: primary, fontSize: '12px', margin: '3px 0 8px' }}>{S.title}</div>
        <div style={{ fontSize: '10px', color: '#6b7280' }}>{S.email} · {S.phone} · {S.location}</div>
      </div>
      {/* Summary — no heading, plain paragraph */}
      <div style={{ color: '#374151', fontSize: '11px', lineHeight: 1.7, textAlign: 'justify', marginBottom: '14px' }}>{S.summary}</div>
      {/* Experience */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: text, fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Experience</div>
        <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
      </div>
      {/* Skills as plain text */}
      <div>
        <div style={{ color: text, fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Skills</div>
        <div style={{ fontSize: '11px', color: '#374151', lineHeight: 1.8 }}>
          <div><strong>Technical:</strong> {S.skills.join(', ')}</div>
          <div><strong>Soft Skills:</strong> {S.soft.join(', ')}</div>
        </div>
      </div>
    </div>
  );
};

// ─── 6. ACADEMIC ─────────────────────────────────────────────────────────────
// PHP: centered header on lightAccent bg | border-bottom:3px solid primary
//      section headers with border-left:4px solid primary + padding-left
//      section order: summary → education → experience → projects → skills
// Default color: purple → #a855f7
export const AcademicTemplatePreview: React.FC = () => {
  const primary = '#a855f7'; const lightAccent = '#faf5ff'; const accent = '#f5f3ff';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px' }}>
      {/* Centered lightAccent header */}
      <div style={{ textAlign: 'center', background: lightAccent, padding: '18px', marginBottom: '14px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>{S.name}</div>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 600, margin: '3px 0 8px' }}>{S.title}</div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: '#4b5563' }}>
          <span>✉ {S.email}</span><span>📞 {S.phone}</span><span>📍 {S.location}</span>
        </div>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        {/* Research Interests — left-border */}
        <div style={{ marginBottom: '12px' }}>
          <SHdrLeft title="Research Interests / Profile" color={primary} />
          <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.6 }}>{S.summary}</div>
        </div>
        {/* Education */}
        <div style={{ marginBottom: '12px' }}>
          <SHdrLeft title="Education" color={primary} />
          <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
        </div>
        {/* Professional Experience */}
        <div style={{ marginBottom: '12px' }}>
          <SHdrLeft title="Professional Experience" color={primary} />
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
        </div>
        {/* Skills & Expertise */}
        <div>
          <SHdrLeft title="Skills & Expertise" color={primary} />
          <div>{[...S.skills, ...S.soft].map(s => <Tag key={s} label={s} bg={accent} color="#7e22ce" />)}</div>
        </div>
      </div>
    </div>
  );
};

// ─── 7. BOLD ─────────────────────────────────────────────────────────────────
// PHP: colored full-bleed header | font-weight:900 uppercase h1 34px
//      accent box with 2px solid border for summary
//      section headers: border-bottom:3px solid, font-weight:900, uppercase
//      2-col education+skills grid
// Default color: red → #ef4444
export const BoldTemplatePreview: React.FC = () => {
  const primary = '#ef4444'; const accent = '#fef2f2';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px' }}>
      {/* Full-bleed bold header */}
      <div style={{ background: primary, padding: '20px', color: 'white' }}>
        <div style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px' }}>{S.name}</div>
        <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.85)', margin: '3px 0 10px' }}>{S.title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.9)' }}>
          <span>✉ {S.email}</span><span>📍 {S.location}</span>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        {/* Accent bordered summary box */}
        <div style={{ background: accent, border: `2px solid ${primary}`, borderRadius: '4px', padding: '10px', marginBottom: '12px' }}>
          <div style={{ color: '#4b5563', fontSize: '10px', lineHeight: 1.5 }}>{S.summary}</div>
        </div>
        {/* EXPERIENCE */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '7px' }}>EXPERIENCE</div>
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
        </div>
        {/* 2-col Education + Skills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '7px' }}>EDUCATION</div>
            <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
          </div>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '7px' }}>SKILLS</div>
            <div>{S.skills.map(s => <Tag key={s} label={s} bg={accent} color={primary} />)}</div>
            <div style={{ marginTop: '4px' }}>{S.soft.map(s => <Tag key={s} label={s} bg="#f3f4f6" color="#374151" />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 8. ELEGANT ──────────────────────────────────────────────────────────────
// PHP: Palatino serif | centered header | 80px wide 2px decorative line above name
//      border-bottom:2px solid primary | italic title | bullet-dot contacts
//      italic summary centered | section titles centered with top+bottom 1px accent borders
// Default color: indigo → #6366f1
export const ElegantTemplatePreview: React.FC = () => {
  const primary = '#6366f1'; const accent = '#eef2ff';
  return (
    <div style={{ fontFamily: 'Palatino, "Book Antiqua", Georgia, serif', background: 'white', padding: '20px', fontSize: '12px' }}>
      {/* Centered header */}
      <div style={{ textAlign: 'center', paddingBottom: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'inline-block', width: '60px', height: '2px', background: primary, marginBottom: '8px' }} />
        <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#1f2937' }}>{S.name}</div>
        <div style={{ color: primary, fontSize: '12px', fontStyle: 'italic', margin: '4px 0 10px' }}>{S.title}</div>
        <div style={{ fontSize: '10px', color: '#6b7280' }}>{S.email}  •  {S.phone}  •  {S.location}</div>
      </div>
      {/* Italic centered summary */}
      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
        <div style={{ color: '#374151', fontSize: '11px', lineHeight: 1.8, fontStyle: 'italic' }}>{S.summary}</div>
      </div>
      {/* Experience — centered title with top+bottom accent borders */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center', borderTop: `1px solid ${accent}`, padding: '4px 0', marginBottom: '8px' }}>Professional Experience</div>
        <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
      </div>
      {/* 2-col Education + Skills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '7px' }}>Education</div>
          <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
        </div>
        <div>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '7px' }}>Skills</div>
          <div>{S.skills.slice(0, 3).map(s => <Tag key={s} label={s} bg={accent} color="#4338ca" />)}</div>
        </div>
      </div>
    </div>
  );
};

// ─── 9. TECH ─────────────────────────────────────────────────────────────────
// PHP: dark bg #0f172a | Courier New | gradient header + profilePic + "Available for Opportunities" badge
//      1fr 2fr grid | left sidebar #1e293b | dark tech-stack tags | experience in right col
// Default color: cyan → #06b6d4
export const TechTemplatePreview: React.FC = () => {
  const primary = '#06b6d4'; const secondary = '#0891b2';
  return (
    <div style={{ fontFamily: "'Courier New', monospace", background: '#0f172a', color: '#e2e8f0', fontSize: '12px' }}>
      {/* Gradient header */}
      <div style={{ background: `linear-gradient(135deg,${primary} 0%,${secondary} 100%)`, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ProfileCircle size={44} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>{S.name}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', margin: '2px 0 6px' }}>{S.title}</div>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '9px', border: '1px solid rgba(255,255,255,0.3)' }}>Available for Opportunities</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.85)', flexWrap: 'wrap' }}>
          <span>✉ {S.email}</span><span>📍 {S.location}</span>
        </div>
      </div>
      {/* 1fr 2fr dark grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
        {/* Dark sidebar */}
        <div style={{ background: '#1e293b', padding: '14px', borderRight: '1px solid #334155' }}>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>About</div>
          <div style={{ color: '#94a3b8', fontSize: '10px', lineHeight: 1.5, marginBottom: '12px' }}>{S.summary.slice(0, 70)}…</div>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Tech Stack</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {S.skills.map(s => (
              <span key={s} style={{ background: '#0f172a', color: primary, padding: '2px 6px', borderRadius: '4px', fontSize: '9px', border: `1px solid ${secondary}` }}>{s}</span>
            ))}
          </div>
        </div>
        {/* Main dark area */}
        <div style={{ padding: '14px' }}>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Experience</div>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>{S.position}</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>{S.dates}</span>
            </div>
            <div style={{ color: primary, fontSize: '10px', margin: '2px 0' }}>{S.company}</div>
            <ul style={{ margin: '4px 0 0 12px', padding: 0, color: '#94a3b8', fontSize: '10px' }}>
              {S.bullets.map((b, i) => <li key={i} style={{ marginBottom: '2px' }}>{b}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 10. STARTUP ─────────────────────────────────────────────────────────────
// PHP: border:3px solid primary box header | floating badge "⚡ Builder • Creator • Innovator"
//      profilePic inside border box | accent summary box (rounded, no border)
//      uppercase bold section headers (no border-bottom)
// Default color: orange → #f97316
export const StartupTemplatePreview: React.FC = () => {
  const primary = '#f97316'; const accent = '#fff7ed';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', padding: '16px', fontSize: '12px' }}>
      {/* Border box with floating badge */}
      <div style={{ border: `3px solid ${primary}`, padding: '16px', marginBottom: '14px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -11, left: 16, background: primary, color: 'white', padding: '3px 10px', borderRadius: '12px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>⚡ Builder • Creator • Innovator</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ProfileCircle size={44} border={primary} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937' }}>{S.name}</div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 600, margin: '2px 0 8px' }}>{S.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '10px', color: '#4b5563' }}>
              <span>✉ {S.email}</span><span>📍 {S.location}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Rounded accent summary */}
      <div style={{ background: accent, borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
        <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.5 }}>{S.summary}</div>
      </div>
      {/* Experience */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Experience</div>
        <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
      </div>
      {/* 2-col Education + Skills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Education</div>
          <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
        </div>
        <div>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Skills</div>
          <div>{S.skills.slice(0, 3).map(s => <Tag key={s} label={s} bg={accent} color={primary} />)}</div>
        </div>
      </div>
    </div>
  );
};

// ─── 11. CONSULTING ──────────────────────────────────────────────────────────
// PHP: colored full-bleed header | 2-col contact grid in header
//      inner padded body | section titles: border-bottom:2px solid primary
//      "Executive Summary" | "Professional Experience" | "Core Competencies"
// Default color: teal → #14b8a6
export const ConsultingTemplatePreview: React.FC = () => {
  const primary = '#14b8a6'; const accent = '#ccfbf1';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px' }}>
      {/* Full-bleed colored header */}
      <div style={{ background: primary, color: 'white', padding: '18px 20px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>{S.name}</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', margin: '3px 0 12px' }}>{S.title}</div>
        {/* 2-col contact grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.85)' }}>
          <div>
            <div style={{ marginBottom: '3px' }}>✉ {S.email}</div>
            <div>📞 {S.phone}</div>
          </div>
          <div>
            <div style={{ marginBottom: '3px' }}>📍 {S.location}</div>
            <div>🔗 {S.linkedin}</div>
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        {/* Executive Summary */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Executive Summary</div>
          <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.6, textAlign: 'justify' }}>{S.summary}</div>
        </div>
        {/* Professional Experience */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Professional Experience</div>
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
        </div>
        {/* 2-col Education + Core Competencies */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Education</div>
            <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
          </div>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Core Competencies</div>
            <div>{S.skills.slice(0, 3).map(s => <Tag key={s} label={s} bg={accent} color="#0f766e" />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 12. MEDICAL ─────────────────────────────────────────────────────────────
// PHP: centered header with ⚕️ emoji (28px) | border-bottom:3px solid primary
//      "Dr. " prefix on name | section order: clinical profile → medical education → clinical experience → clinical skills → certifications
//      section titles: border-bottom:2px solid primary
// Default color: emerald → #10b981
export const MedicalTemplatePreview: React.FC = () => {
  const primary = '#10b981'; const accent = '#d1fae5';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', padding: '16px', fontSize: '12px' }}>
      {/* Centered header with ⚕️ */}
      <div style={{ textAlign: 'center', paddingBottom: '14px', marginBottom: '14px' }}>
        <div style={{ fontSize: '22px', marginBottom: '5px' }}>⚕️</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>Dr. {S.name}</div>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 600, margin: '3px 0 8px' }}>{S.title}</div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: '#4b5563' }}>
          <span>✉ {S.email}</span><span>📞 {S.phone}</span><span>📍 {S.location}</span>
        </div>
      </div>
      {/* Clinical Profile */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Clinical Profile</div>
        <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.6, textAlign: 'justify' }}>{S.summary}</div>
      </div>
      {/* Medical Education */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Medical Education</div>
        <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
      </div>
      {/* Clinical Experience */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Clinical Experience</div>
        <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
      </div>
      {/* Clinical Skills */}
      <div>
        <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Clinical Skills</div>
        <div>{S.skills.map(s => <Tag key={s} label={s} bg={accent} color="#065f46" />)}</div>
      </div>
    </div>
  );
};

// ─── 13. FINANCE ─────────────────────────────────────────────────────────────
// PHP: outer border:1px solid #d1d5db | colored full-bleed header with text-transform:uppercase
//      letter-spacing:2px on name | ALL-CAPS section headers (letter-spacing:2px) with border-bottom:2px
//      "EXECUTIVE PROFILE" | "PROFESSIONAL EXPERIENCE" | 2-col EDUCATION + KEY SKILLS grid
// Default color: blue → #4f87c7
export const FinanceTemplatePreview: React.FC = () => {
  const primary = '#4f87c7'; const accent = '#dbeafe';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px', border: '1px solid #d1d5db' }}>
      {/* Full-bleed uppercase header */}
      <div style={{ background: primary, color: 'white', padding: '18px', textTransform: 'uppercase' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '2px' }}>{S.name}</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', letterSpacing: '2px', margin: '3px 0 10px' }}>{S.title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.9)', textTransform: 'none' }}>
          <span>✉ {S.email}</span><span>📞 {S.phone}</span><span>📍 {S.location}</span>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        {/* EXECUTIVE PROFILE */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>EXECUTIVE PROFILE</div>
          <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.6, textAlign: 'justify' }}>{S.summary}</div>
        </div>
        {/* PROFESSIONAL EXPERIENCE */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>PROFESSIONAL EXPERIENCE</div>
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
        </div>
        {/* 2-col EDUCATION + KEY SKILLS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ color: primary, fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>EDUCATION</div>
            <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
          </div>
          <div>
            <div style={{ color: primary, fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>KEY SKILLS</div>
            <div>{S.skills.slice(0, 3).map(s => <Tag key={s} label={s} bg={accent} color="#1e40af" />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 14. MARKETING ───────────────────────────────────────────────────────────
// PHP: linear-gradient(135deg) centered header | profilePic | 📈 emoji before title
//      accent rounded summary box (no border) | "Experience & Impact" | "Skills & Tools"
//      "Campaigns & Projects"
// Default color: orange → #f97316
export const MarketingTemplatePreview: React.FC = () => {
  const primary = '#f97316'; const secondary = '#ea580c'; const accent = '#fff7ed';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px' }}>
      {/* Centered gradient header with profilePic */}
      <div style={{ background: `linear-gradient(135deg,${primary} 0%,${secondary} 50%,${primary} 100%)`, padding: '20px', color: 'white', textAlign: 'center' }}>
        <ProfileCircle size={50} />
        <div style={{ fontSize: '18px', fontWeight: 800, margin: '8px 0 3px' }}>{S.name}</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', marginBottom: '10px' }}>📈 {S.title}</div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.85)' }}>
          <span>✉ {S.email}</span><span>📍 {S.location}</span>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        {/* Accent rounded summary */}
        <div style={{ background: accent, borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
          <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.5 }}>{S.summary}</div>
        </div>
        {/* Experience & Impact */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Experience & Impact</div>
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
        </div>
        {/* 2-col Education + Skills & Tools */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Education</div>
            <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
          </div>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Skills & Tools</div>
            <div>{S.skills.slice(0, 3).map(s => <Tag key={s} label={s} bg={accent} color={primary} />)}</div>
            <div style={{ marginTop: '3px' }}>{S.soft.slice(0, 2).map(s => <Tag key={s} label={s} bg="#fef3c7" color="#92400e" />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 15. DATA ────────────────────────────────────────────────────────────────
// PHP: outer border:2px solid primary | colored full-bleed header + profilePic + 📊 emoji
//      1fr 2fr grid | left sidebar on lightAccent bg, border-right:2px solid primary
//      sidebar: Profile, Technical Skills (tags), Education
//      right col: Experience, Data Projects, Certifications (uppercase hdrs with border-bottom)
// Default color: violet → #a855f7
export const DataTemplatePreview: React.FC = () => {
  const primary = '#a855f7'; const accent = '#f5f3ff'; const lightAccent = '#faf5ff';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px', border: `2px solid ${primary}` }}>
      {/* Full-bleed colored header */}
      <div style={{ background: primary, color: 'white', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ProfileCircle size={44} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{S.name}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', margin: '2px 0 4px' }}>📊 {S.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.85)' }}>
              <span>✉ {S.email}</span><span>📍 {S.location}</span>
            </div>
          </div>
        </div>
      </div>
      {/* 1fr 2fr grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
        {/* Sidebar */}
        <div style={{ background: lightAccent, padding: '12px', borderRight: `2px solid ${primary}` }}>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>Profile</div>
          <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.5, marginBottom: '10px' }}>{S.summary.slice(0, 70)}…</div>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>Technical Skills</div>
          <div style={{ marginBottom: '10px' }}>{S.skills.map(s => <Tag key={s} label={s} bg={accent} color="#7e22ce" />)}</div>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '5px' }}>Education</div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#1f2937' }}>{S.degree}</div>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>{S.school}</div>
        </div>
        {/* Main */}
        <div style={{ padding: '12px' }}>
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '7px' }}>Experience</div>
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
          <div style={{ color: primary, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', margin: '10px 0 7px' }}>Data Projects</div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#1f2937', marginBottom: '2px' }}>Churn Prediction Model</div>
          <div style={{ fontSize: '10px', color: '#4b5563' }}>Built ML pipeline reducing churn by 18%.</div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}><strong>Tech:</strong> Python, scikit-learn, Spark</div>
        </div>
      </div>
    </div>
  );
};

// ─── 16. NONPROFIT ───────────────────────────────────────────────────────────
// PHP: colored full-bleed centered header | 🤝 emoji (28px) | centered contacts
//      accent left-border summary (border-left:4px solid primary, border-radius:0 8px 8px 0)
//      "Service Experience" | "Community Projects" | "Impact & Recognition"
// Default color: pink → #ec4899
export const NonprofitTemplatePreview: React.FC = () => {
  const primary = '#ec4899'; const accent = '#fdf2f8';
  return (
    <div style={{ fontFamily: 'sans-serif', background: 'white', fontSize: '12px' }}>
      {/* Full-bleed centered colored header */}
      <div style={{ background: primary, color: 'white', padding: '18px', textAlign: 'center' }}>
        <div style={{ fontSize: '22px', marginBottom: '5px' }}>🤝</div>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>{S.name}</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', margin: '3px 0 10px' }}>{S.title}</div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.85)' }}>
          <span>✉ {S.email}</span><span>📞 {S.phone}</span><span>📍 {S.location}</span>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        {/* Left-border accent summary */}
        <div style={{ background: accent, borderLeft: `4px solid ${primary}`, borderRadius: '0 8px 8px 0', padding: '10px', marginBottom: '12px' }}>
          <div style={{ color: '#374151', fontSize: '10px', lineHeight: 1.5 }}>{S.summary}</div>
        </div>
        {/* Service Experience */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Service Experience</div>
          <ExpBlock color={primary} position={S.position} company={S.company} dates={S.dates} bullet={S.bullets[0]} />
        </div>
        {/* 2-col Education + Skills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Education</div>
            <EduBlock color={primary} degree={S.degree} school={S.school} dates="2012–2016" />
          </div>
          <div>
            <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Skills</div>
            <div>{S.skills.slice(0, 3).map(s => <Tag key={s} label={s} bg={accent} color="#9d174d" />)}</div>
            <div style={{ marginTop: '3px' }}>{S.soft.slice(0, 2).map(s => <Tag key={s} label={s} bg="#fdf2f8" color="#9d174d" />)}</div>
          </div>
        </div>
        {/* Community Projects */}
        <div>
          <div style={{ color: primary, fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>Community Projects</div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#1f2937', marginBottom: '2px' }}>Food Security Initiative</div>
          <div style={{ fontSize: '10px', color: '#4b5563' }}>Coordinated volunteer network serving 2,000+ families monthly.</div>
        </div>
      </div>
    </div>
  );
};
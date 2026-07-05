import React from 'react';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope,
  faPhone,
  faLocationDot,
  faUser,
  faGraduationCap,
  faStar,
  faDesktop,
  faBolt,
  faGlobe,
  faExternalLink,
  faBriefcase,
  faAward,
  faFileText,
  faCode
} from '@fortawesome/sharp-light-svg-icons';
import { faLinkedin } from '@fortawesome/free-brands-svg-icons';

// Interfaces
interface Experience {
  id: string;
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string[];
  type?: string;
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  achievements: string[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  link?: string;
  github?: string;
}

interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  summary: string;
  profilePicture?: string;
  title?: string;
}

interface DisplayData {
  personalInfo: PersonalInfo;
  experiences: Experience[];
  education: Education[];
  skills: {
    technical: string[];
    soft: string[];
    languages: string[];
  };
  projects: Project[];
  certifications: string[];
  achievements: string[];
}

interface TemplateProps {
  displayData: DisplayData;
  cleanUrl: (url: string) => string;
  mode?: 'preview' | 'pdf';
}

// Standalone summary renderer — splits on newlines AND bullet characters
const renderSummary = (text: string, style: React.CSSProperties = {}): React.ReactNode => {
  const lines = text.split(/\n|(?=•)/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return <p style={{ margin: 0, lineHeight: '1.6', ...style }}>{text}</p>;
  }
  return (
    <div style={{ lineHeight: '1.6', margin: 0, ...style }}>
      {lines.map((line, i) => (
        <p key={i} style={{ margin: '0 0 4px 0' }}>{line}</p>
      ))}
    </div>
  );
};

// FontAwesome Icon component for all templates
const FAIcon = ({ iconName, size = 16, color = "currentColor" }: { iconName: string; size?: number; color?: string }) => {
  const getIcon = () => {
    switch (iconName) {
      case 'Phone': return faPhone;
      case 'Mail': return faEnvelope;
      case 'MapPin': return faLocationDot;
      case 'Linkedin': return faLinkedin;
      case 'Github': return faCode;
      case 'Globe': return faGlobe;
      case 'User': return faUser;
      case 'GraduationCap': return faGraduationCap;
      case 'Star': return faStar;
      case 'Monitor': return faDesktop;
      case 'Zap': return faBolt;
      case 'ExternalLink': return faExternalLink;
      case 'Briefcase': return faBriefcase;
      case 'Award': return faAward;
      case 'FileText': return faFileText;
      case 'Code': return faCode;
      default: return faUser;
    }
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${size}px`,
      height: `${size}px`,
      marginRight: '8px',
      verticalAlign: 'middle'
    }}>
      <FontAwesomeIcon 
        icon={getIcon()} 
        style={{ 
          fontSize: `${size}px`, 
          color: color,
          width: `${size}px`,
          height: `${size}px`
        }} 
      />
    </span>
  );
};


// Date formatter helper
const fmtDate = (d: string): string => {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (months[parseInt(m, 10) - 1] || m) + ' ' + y;
};


// ============================================================
// SHARED HELPERS
// ============================================================

const skillPills = (skills: string[], bg: string, color: string) => (
  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px' }}>
    {skills.map((s: string, i: number) => (
      <span key={i} style={{ background: bg, color, padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '500' }}>{s}</span>
    ))}
  </div>
);

// ============================================================
// 1. MODERN TEMPLATE
// ============================================================
export const renderModernTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#3b82f6', secondary: '#1e40af', accent: '#dbeafe', text: '#1f2937', lightAccent: '#e5e7eb' };
  const p = displayData.personalInfo;
  const secHdr = (title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <h2 style={{ color: t.primary, fontSize: '14px', margin: 0, fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px', whiteSpace: 'nowrap' as const }}>{title}</h2>

    </div>
  );
  return (
    <div className="modern-template" style={{ width: '100%', background: 'white', padding: '32px 36px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '14px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ borderBottom: `3px solid ${t.primary}`, paddingBottom: '18px', marginBottom: '22px' }}>
        <h1 style={{ color: t.text, margin: 0, fontSize: '26px', fontWeight: '700' }}>{p.fullName}</h1>
        <p style={{ color: t.primary, margin: '6px 0 0', fontSize: '15px', fontWeight: '600' }}>{p.title}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '14px', marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={13} color="#6b7280" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={13} color="#6b7280" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={13} color="#6b7280" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={13} color="#6b7280" />{cleanUrl(p.linkedin)}</span>}
          {p.website && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Globe" size={13} color="#6b7280" />{cleanUrl(p.website)}</span>}
        </div>
      </div>
      {p.summary && <div style={{ marginBottom: '22px' }}>{secHdr('Professional Summary')}{renderSummary(p.summary, { color: '#4b5563', fontSize: '13px', lineHeight: '1.6', textAlign: 'justify' as const, margin: 0 })}</div>}
      {displayData.experiences.length > 0 && <div style={{ marginBottom: '22px' }}>{secHdr('Experience')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '12px' }}>• {d}</p>)}</div>))}</div>}
      {displayData.education.length > 0 && <div style={{ marginBottom: '22px' }}>{secHdr('Education')}{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 0', fontSize: '12px' }}>{edu.institution}{edu.location ? ` • ${edu.location}` : ''}{edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div style={{ marginBottom: '22px' }}>{secHdr('Skills')}{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '10px' }}><strong style={{ fontSize: '13px', color: '#374151' }}>Technical Skills</strong><div style={{ marginTop: '5px' }}>{skillPills(displayData.skills.technical, t.accent, t.secondary)}</div></div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '10px' }}><strong style={{ fontSize: '13px', color: '#374151' }}>Soft Skills</strong><div style={{ marginTop: '5px' }}>{skillPills(displayData.skills.soft, '#f0fdf4', '#166534')}</div></div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '13px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '5px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
      {displayData.projects.length > 0 && <div style={{ marginBottom: '22px' }}>{secHdr('Projects')}{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}{proj.technologies?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '3px' }}>{proj.technologies.map((tech: string, i: number) => <span key={i} style={{ background: t.accent, color: t.primary, padding: '1px 8px', borderRadius: '8px', fontSize: '11px' }}>{tech}</span>)}</div>}</div>))}</div>}
      {displayData.certifications.length > 0 && <div style={{ marginBottom: '22px' }}>{secHdr('Certifications')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
    </div>
  );
};

// ============================================================
// 2. PROFESSIONAL BLUE TEMPLATE
// ============================================================
export const renderProfessionalBlueTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#1d4ed8', secondary: '#3b82f6', accent: '#eff6ff', text: '#1f2937', lightAccent: '#dbeafe' };
  const p = displayData.personalInfo;
  const profilePic = p.profilePicture ? (
    <img src={p.profilePicture} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' as const, border: '2px solid rgba(255,255,255,0.5)' }} />
  ) : null;
  const sHdr = (title: string, size = '14px') => <h3 style={{ color: t.primary, fontSize: size, margin: '0 0 10px', fontWeight: '700' }}>{title}</h3>;
  return (
    <div className="professionalBlue-template" style={{ width: '100%', background: 'white', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '14px', lineHeight: '1.4', color: '#000', minHeight: '297mm' }}>
      <div style={{ background: `linear-gradient(135deg,${t.primary} 0%,${t.secondary} 100%)`, padding: '20px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' as const }}>
          {profilePic}
          <div><h1 style={{ color: 'white', margin: 0, fontSize: '26px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{p.fullName}</h1><p style={{ color: 'rgba(255,255,255,0.9)', margin: '5px 0 0', fontSize: '15px' }}>{p.title}</p></div>
        </div>
        <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap' as const, gap: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={14} color="rgba(255,255,255,0.9)" />{p.phone}</span>}
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={14} color="rgba(255,255,255,0.9)" />{p.email}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={14} color="rgba(255,255,255,0.9)" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={14} color="rgba(255,255,255,0.9)" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
        <div style={{ background: t.accent, padding: '22px 18px', borderRight: `1px solid ${t.lightAccent}` }}>
          {p.summary && <div style={{ marginBottom: '22px' }}>{sHdr('About Me')}{renderSummary(p.summary, { color: '#374151', fontSize: '12px', lineHeight: '1.6', margin: 0, textAlign: 'justify' as const })}</div>}
          {displayData.education.length > 0 && <div style={{ marginBottom: '22px' }}>{sHdr('Education')}{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><h4 style={{ color: t.text, fontSize: '13px', margin: '0 0 2px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</h4><p style={{ color: '#6b7280', fontSize: '11px', margin: 0 }}>{edu.institution}</p><p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}{edu.gpa ? ` • ${edu.gpa}` : ''}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0) && <div style={{ marginBottom: '22px' }}>{sHdr('Expertise')}{displayData.skills.technical.slice(0,10).map((s: string, i: number) => (<div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#374151' }}><span>{s}</span><span style={{ color: t.primary }}>●●●●○</span></div>))}</div>}
          {(displayData.skills.languages||[]).length > 0 && <div>{sHdr('Languages')}{(displayData.skills.languages||[]).map((l: string, i: number) => <p key={i} style={{ fontSize: '12px', color: '#374151', margin: '0 0 4px' }}>{l}</p>)}</div>}
        </div>
        <div style={{ padding: '22px 20px' }}>
          {displayData.experiences.length > 0 && <div style={{ marginBottom: '22px' }}><h3 style={{ color: t.primary, fontSize: '15px', margin: '0 0 12px', fontWeight: '700' }}>Work Experience</h3>{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '16px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '11px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
          {displayData.projects.length > 0 && <div style={{ marginBottom: '22px' }}><h3 style={{ color: t.primary, fontSize: '15px', margin: '0 0 12px', fontWeight: '700' }}>Projects</h3>{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}</div>))}</div>}
          {displayData.certifications.length > 0 && <div style={{ marginBottom: '22px' }}><h3 style={{ color: t.primary, fontSize: '15px', margin: '0 0 12px', fontWeight: '700' }}>Certifications</h3>{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
          
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 3. CREATIVE TEMPLATE
// ============================================================
export const renderCreativeTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#f97316', secondary: '#ea580c', accent: '#fff7ed', text: '#1f2937', lightAccent: '#fed7aa' };
  const p = displayData.personalInfo;
  const profilePic = p.profilePicture ? (
    <img src={p.profilePicture} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' as const, border: '2px solid rgba(255,255,255,0.5)' }} />
  ) : null;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{title}</h2>;
  return (
    <div className="creative-template" style={{ width: '100%', background: 'white', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif' }}>
      <div style={{ background: t.primary, padding: '28px 32px', color: 'white', position: 'relative' as const, overflow: 'hidden', textAlign: 'center' as const }}>
        <div style={{ position: 'absolute' as const, top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '10px' }}>
          {profilePic}
          <div><h1 style={{ color: 'white', margin: 0, fontSize: '28px', fontWeight: '800' }}>{p.fullName}</h1><p style={{ color: 'rgba(255,255,255,0.85)', margin: '5px 0 0', fontSize: '14px', fontWeight: '500' }}>{p.title}</p></div>
        </div>
        <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap' as const, justifyContent: 'center', gap: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.9)' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={12} color="rgba(255,255,255,0.9)" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={12} color="rgba(255,255,255,0.9)" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={12} color="rgba(255,255,255,0.9)" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={12} color="rgba(255,255,255,0.9)" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      <div style={{ padding: '24px 32px' }}>
        {p.summary && <div style={{ marginBottom: '20px', padding: '14px 16px', background: t.accent, borderRadius: '8px' }}><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Professional Summary</h2>{renderSummary(p.summary, { color: '#4b5563', fontSize: '13px', lineHeight: '1.6', margin: 0 })}</div>}
        {displayData.experiences.length > 0 && <div style={{ marginBottom: '20px' }}>{sHdr('Creative Experience')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {displayData.education.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', textTransform: 'uppercase' as const }}>Education</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 2px', fontSize: '13px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: t.primary, margin: '0 0 2px', fontSize: '12px' }}>{edu.institution}</p><p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', textTransform: 'uppercase' as const }}>Creative Skills</h2>{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.primary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.soft, '#f3f4f6', '#374151')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
        </div>
        {displayData.projects.length > 0 && <div style={{ marginTop: '20px' }}>{sHdr('Featured Projects')}{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}{proj.technologies?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '3px' }}>{proj.technologies.map((tech: string, i: number) => <span key={i} style={{ background: t.accent, color: t.primary, padding: '1px 8px', borderRadius: '8px', fontSize: '11px' }}>{tech}</span>)}</div>}</div>))}</div>}
        {displayData.certifications.length > 0 && <div style={{ marginTop: '16px' }}>{sHdr('Certifications')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
      </div>
    </div>
  );
};

// ============================================================
// 4. EXECUTIVE TEMPLATE
// ============================================================
export const renderExecutiveTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#374151', secondary: '#6b7280', accent: '#f9fafb', text: '#111827', lightAccent: '#e5e7eb' };
  const p = displayData.personalInfo;
  const sHdr = (title: string) => <h2 style={{ color: t.text, fontSize: '13px', margin: '0 0 8px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>{title}</h2>;
  return (
    <div className="executive-template" style={{ width: '100%', background: 'white', padding: '32px', fontFamily: '"Times New Roman",Times,Georgia,serif', fontSize: '14px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ textAlign: 'center' as const, paddingBottom: '18px', marginBottom: '22px' }}>
        <h1 style={{ color: t.text, margin: '0 0 6px', fontSize: '28px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>{p.fullName}</h1>
        <p style={{ color: t.primary, margin: '0 0 10px', fontSize: '14px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' as const }}>{p.title}</p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: '20px', fontSize: '12px', color: '#4b5563' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><FAIcon iconName="Mail" size={12} color="#6b7280" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><FAIcon iconName="Phone" size={12} color="#6b7280" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><FAIcon iconName="MapPin" size={12} color="#6b7280" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><FAIcon iconName="Linkedin" size={12} color="#6b7280" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      {p.summary && <div style={{ marginBottom: '20px' }}>{sHdr('Executive Summary')}{renderSummary(p.summary, { color: '#374151', fontSize: '13px', lineHeight: '1.7', textAlign: 'justify' as const, margin: 0 })}</div>}
      {displayData.experiences.length > 0 && <div style={{ marginBottom: '20px' }}><h2 style={{ color: t.text, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Professional Experience</h2>{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.secondary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
      {displayData.education.length > 0 && <div style={{ marginBottom: '20px' }}><h2 style={{ color: t.text, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Education &amp; Qualifications</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</span></div><p style={{ color: t.secondary, margin: '2px 0 0', fontSize: '12px' }}>{edu.institution}{edu.location ? ` • ${edu.location}` : ''}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div style={{ marginBottom: '20px' }}>{sHdr('CORE COMPETENCIES')}<div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '5px' }}>{skillPills([...displayData.skills.technical, ...displayData.skills.soft], '#f3f4f6', '#374151')}</div>{(displayData.skills.languages||[]).length > 0 && <div style={{ marginTop: '8px' }}><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
      {displayData.certifications.length > 0 && <div style={{ marginBottom: '20px' }}>{sHdr('CERTIFICATIONS')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
    </div>
  );
};

// ============================================================
// 5. MINIMAL TEMPLATE
// ============================================================
export const renderMinimalTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#16a34a', secondary: '#15803d', accent: '#f0fdf4', text: '#1f2937', lightAccent: '#dcfce7' };
  const p = displayData.personalInfo;
  const sHdr = (title: string) => <h2 style={{ color: t.text, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' as const }}>{title}</h2>;
  return (
    <div className="minimal-template" style={{ width: '100%', background: 'white', padding: '32px 36px', fontFamily: 'Georgia,"Times New Roman",serif', fontSize: '14px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: t.text, margin: '0 0 4px', fontSize: '30px', fontWeight: '700' }}>{p.fullName}</h1>
        <p style={{ color: t.primary, margin: '0 0 10px', fontSize: '14px' }}>{p.title}</p>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          {[p.email, p.phone, p.location, p.linkedin ? cleanUrl(p.linkedin) : '', p.website ? cleanUrl(p.website) : ''].filter(Boolean).join(' · ')}
        </div>
      </div>
      {p.summary && <div style={{ marginBottom: '20px' }}>{sHdr('Professional Summary')}{renderSummary(p.summary, { color: '#374151', fontSize: '13px', lineHeight: '1.7', margin: 0, textAlign: 'justify' as const })}</div>}
      {displayData.experiences.length > 0 && <div style={{ marginBottom: '20px' }}>{sHdr('Experience')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
      {displayData.education.length > 0 && <div style={{ marginBottom: '20px' }}>{sHdr('Education')}{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 0', fontSize: '12px' }}>{edu.institution}{edu.location ? ` • ${edu.location}` : ''}{edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div style={{ marginBottom: '20px' }}>{sHdr('Skills')}<div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.8' }}>{displayData.skills.technical.length > 0 && <p style={{ margin: '0 0 4px' }}><strong>Technical:</strong> {displayData.skills.technical.join(', ')}</p>}{displayData.skills.soft.length > 0 && <p style={{ margin: '0 0 4px' }}><strong>Soft Skills:</strong> {displayData.skills.soft.join(', ')}</p>}{(displayData.skills.languages||[]).length > 0 && <p style={{ margin: 0 }}><strong>Languages:</strong> {(displayData.skills.languages||[]).join(', ')}</p>}</div></div>}
      {displayData.projects.length > 0 && <div style={{ marginBottom: '20px' }}>{sHdr('Projects')}{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}</div>))}</div>}
      {displayData.certifications.length > 0 && <div style={{ marginBottom: '20px' }}>{sHdr('Certifications')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
    </div>
  );
};

// ============================================================
// 6. ACADEMIC TEMPLATE
// ============================================================
export const renderAcademicTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#7c3aed', secondary: '#8b5cf6', accent: '#f5f3ff', text: '#1f2937', lightAccent: '#ede9fe' };
  const p = displayData.personalInfo;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 10px', fontWeight: '700', borderLeft: `4px solid ${t.primary}`, paddingLeft: '8px' }}>{title}</h2>;
  return (
    <div className="academic-template" style={{ width: '100%', background: 'white', padding: '32px 36px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ textAlign: 'center' as const, background: t.lightAccent, padding: '22px', marginBottom: '20px' }}>
        <h1 style={{ color: t.text, margin: '0 0 6px', fontSize: '26px', fontWeight: '700' }}>{p.fullName}</h1>
        <p style={{ color: t.primary, margin: '0 0 10px', fontSize: '14px', fontWeight: '600' }}>{p.title}</p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: '12px', fontSize: '12px', color: '#4b5563' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={12} color="#4b5563" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={12} color="#4b5563" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={12} color="#4b5563" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={12} color="#4b5563" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      {p.summary && <div style={{ marginBottom: '18px' }}>{sHdr('Research Interests')}{renderSummary(p.summary, { color: '#374151', fontSize: '12px', lineHeight: '1.7', margin: 0, textAlign: 'justify' as const })}</div>}
      {displayData.education.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Education')}{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 0', fontSize: '12px' }}>{edu.institution}{edu.location ? ` • ${edu.location}` : ''}{edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
      {displayData.experiences.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Academic Positions')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
      {displayData.projects.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Research Projects')}{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}</div>))}</div>}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div style={{ marginBottom: '18px' }}>{sHdr('Research Skills')}<div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '5px' }}>{skillPills([...displayData.skills.technical, ...displayData.skills.soft], t.accent, t.secondary)}</div>{(displayData.skills.languages||[]).length > 0 && <div style={{ marginTop: '8px' }}><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
      {displayData.certifications.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Certifications & Awards')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
    </div>
  );
};

// ============================================================
// 7. BOLD TEMPLATE
// ============================================================
export const renderBoldTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#dc2626', secondary: '#ef4444', accent: '#fef2f2', text: '#1f2937', lightAccent: '#fee2e2' };
  const p = displayData.personalInfo;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 12px', fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: '2px' }}>{title}</h2>;
  return (
    <div className="bold-template" style={{ width: '100%', background: 'white', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', lineHeight: '1.4' }}>
      <div style={{ background: t.primary, padding: '28px', color: 'white' }}>
        <h1 style={{ color: 'white', margin: '0 0 4px', fontSize: '34px', fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: '2px' }}>{p.fullName}</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 0 14px', fontSize: '16px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{p.title}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '14px', fontSize: '12px', color: 'rgba(255,255,255,0.9)' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={12} color="rgba(255,255,255,0.9)" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={12} color="rgba(255,255,255,0.9)" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={12} color="rgba(255,255,255,0.9)" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={12} color="rgba(255,255,255,0.9)" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      <div style={{ padding: '24px' }}>
        {p.summary && <div style={{ marginBottom: '20px', padding: '14px', background: t.accent, border: `2px solid ${t.primary}`, borderRadius: '4px' }}><h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 8px', fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: '2px' }}>Professional Summary</h2>{renderSummary(p.summary, { color: '#4b5563', fontSize: '13px', lineHeight: '1.6', margin: 0 })}</div>}
        {displayData.experiences.length > 0 && <div style={{ marginBottom: '20px' }}>{sHdr('Results-Driven Leadership')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {displayData.education.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 12px', fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>EDUCATION</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 2px', fontSize: '13px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: t.primary, margin: '0 0 2px', fontSize: '12px' }}>{edu.institution}</p><p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div><h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 12px', fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Core Competencies</h2>{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.primary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.soft, '#f3f4f6', '#374151')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
        </div>
        {displayData.certifications.length > 0 && <div style={{ marginTop: '16px' }}><h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 10px', fontWeight: '900', textTransform: 'uppercase' as const }}>CERTIFICATIONS</h2>{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
      </div>
    </div>
  );
};

// ============================================================
// 8. ELEGANT TEMPLATE
// ============================================================
export const renderElegantTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#4338ca', secondary: '#6366f1', accent: '#eef2ff', text: '#1f2937', lightAccent: '#e0e7ff' };
  const p = displayData.personalInfo;
  return (
    <div className="elegant-template" style={{ width: '100%', background: 'white', padding: '32px 36px', fontFamily: '"Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ textAlign: 'center' as const, padding: '24px 20px 18px', marginBottom: '22px' }}>
        <div style={{ display: 'inline-block', width: '80px', height: '2px', background: t.primary, marginBottom: '12px' }} />
        <h1 style={{ color: t.text, margin: '0 0 5px', fontSize: '30px', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase' as const }}>{p.fullName}</h1>
        <p style={{ color: t.primary, margin: '0 0 12px', fontSize: '14px', fontStyle: 'italic' as const }}>{p.title}</p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: '12px', fontSize: '12px', color: '#6b7280' }}>
          <span>{[p.email, p.phone, p.location].filter(Boolean).join('  •  ')}{p.linkedin ? ` • ${cleanUrl(p.linkedin)}` : ''}</span>
        </div>
      </div>
      {p.summary && <div style={{ marginBottom: '20px' }}><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Professional Summary</h2>{renderSummary(p.summary, { color: '#374151', fontSize: '13px', lineHeight: '1.8', margin: 0, fontStyle: 'italic' as const })}</div>}
      {displayData.experiences.length > 0 && <div style={{ marginBottom: '20px' }}><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase' as const, textAlign: 'center' as const, borderTop: `1px solid ${t.accent}`, padding: '6px 0' }}>Distinguished Career</h2>{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {displayData.education.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Education</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 2px', fontSize: '13px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: t.primary, margin: '0 0 2px', fontSize: '12px' }}>{edu.institution}</p><p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
        {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Skills</h2>{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.secondary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.soft, '#f9fafb', '#4b5563')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
      </div>
      {displayData.certifications.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Certifications</h2>{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
    </div>
  );
};

// ============================================================
// 9. TECH TEMPLATE
// ============================================================
export const renderTechTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#06b6d4', secondary: '#0891b2', accent: '#ecfeff', text: '#e2e8f0', lightAccent: '#164e63' };
  const p = displayData.personalInfo;
  const profilePic = p.profilePicture ? (
    <img src={p.profilePicture} alt="Profile" style={{ width: '65px', height: '65px', borderRadius: '50%', objectFit: 'cover' as const, border: '2px solid rgba(255,255,255,0.4)' }} />
  ) : null;
  return (
    <div className="tech-template" style={{ width: '100%', background: '#0f172a', color: '#e2e8f0', fontFamily: '"Courier New",Courier,monospace', fontSize: '13px', lineHeight: '1.4', minHeight: '297mm' }}>
      <div style={{ background: `linear-gradient(135deg,${t.primary} 0%,${t.secondary} 100%)`, padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
          {profilePic}
          <div>
            <h1 style={{ color: 'white', margin: '0 0 4px', fontSize: '26px', fontWeight: '700' }}>{p.fullName}</h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 0 8px', fontSize: '13px' }}>{p.title}</p>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 12px', borderRadius: '20px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.3)' }}>Available for Opportunities</span>
          </div>
        </div>
        <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap' as const, gap: '14px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={12} color="rgba(255,255,255,0.85)" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={12} color="rgba(255,255,255,0.85)" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={12} color="rgba(255,255,255,0.85)" />{p.location}</span>}
          {p.github && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Github" size={12} color="rgba(255,255,255,0.85)" />{cleanUrl(p.github)}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={12} color="rgba(255,255,255,0.85)" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
        <div style={{ background: '#1e293b', padding: '20px', borderRight: '1px solid #334155' }}>
          {p.summary && <div style={{ marginBottom: '20px' }}><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Technical Profile</h3>{renderSummary(p.summary, { color: '#94a3b8', fontSize: '12px', lineHeight: '1.6', margin: 0 })}</div>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div style={{ marginBottom: '18px' }}><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Tech Stack</h3>{displayData.skills.technical.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px', marginBottom: '8px' }}>{displayData.skills.technical.map((s: string, i: number) => <span key={i} style={{ background: '#0f172a', color: t.primary, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', border: `1px solid ${t.secondary}` }}>{s}</span>)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}><strong style={{ fontSize: '11px', color: '#94a3b8' }}>Soft Skills</strong><div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap' as const, gap: '4px' }}>{skillPills(displayData.skills.soft, '#1e293b', '#94a3b8')}</div></div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '11px', color: '#94a3b8' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#1e293b', '#fbbf24')}</div></div>}</div>}
          {displayData.education.length > 0 && <div><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Education</h3>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><p style={{ color: '#e2e8f0', fontSize: '12px', margin: '0 0 2px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: '#94a3b8', fontSize: '11px', margin: 0 }}>{edu.institution}</p><p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
        </div>
        <div style={{ padding: '20px' }}>
          {displayData.experiences.length > 0 && <div style={{ marginBottom: '20px' }}><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Engineering Experience</h3>{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '16px' }}><div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' as const, marginBottom: '4px' }}><h4 style={{ color: '#e2e8f0', fontSize: '14px', margin: 0, fontWeight: '600' }}>{exp.position}</h4><span style={{ color: '#64748b', fontSize: '11px' }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '0 0 6px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#94a3b8', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
          {displayData.projects.length > 0 && <div style={{ marginBottom: '20px' }}><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Projects</h3>{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '12px', padding: '10px', background: '#0f172a', borderRadius: '6px', border: '1px solid #334155' }}><p style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 4px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 5px', lineHeight: '1.5' }}>{proj.description}</p>}{proj.technologies?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '3px' }}>{proj.technologies.map((tech: string, i: number) => <span key={i} style={{ background: '#334155', color: t.primary, padding: '1px 7px', borderRadius: '3px', fontSize: '10px' }}>{tech}</span>)}</div>}</div>))}</div>}
          {displayData.certifications.length > 0 && <div><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Certifications</h3>{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#94a3b8', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
          
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 10. STARTUP TEMPLATE
// ============================================================
export const renderStartupTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#f97316', secondary: '#ea580c', accent: '#fff7ed', text: '#1f2937', lightAccent: '#fed7aa' };
  const p = displayData.personalInfo;
  const profilePic = p.profilePicture ? (
    <img src={p.profilePicture} alt="Profile" style={{ width: '65px', height: '65px', borderRadius: '50%', objectFit: 'cover' as const, border: `2px solid ${t.primary}` }} />
  ) : null;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 12px', fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{title}</h2>;
  return (
    <div className="startup-template" style={{ width: '100%', background: 'white', padding: '32px 36px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ border: `3px solid ${t.primary}`, padding: '22px', marginBottom: '20px', position: 'relative' as const, marginTop: '12px' }}>
        <div style={{ position: 'absolute' as const, top: '-15px', left: '20px', background: t.primary, color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>⚡ Builder • Creator • Innovator</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
          {profilePic}
          <div style={{ flex: 1 }}>
            <h1 style={{ color: t.text, margin: '0 0 4px', fontSize: '28px', fontWeight: '800' }}>{p.fullName}</h1>
            <p style={{ color: t.primary, margin: '0 0 10px', fontSize: '14px', fontWeight: '600' }}>{p.title}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', fontSize: '12px', color: '#4b5563' }}>
              {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={12} color="#4b5563" />{p.email}</span>}
              {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={12} color="#4b5563" />{p.phone}</span>}
              {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={12} color="#4b5563" />{p.location}</span>}
              {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={12} color="#4b5563" />{cleanUrl(p.linkedin)}</span>}
            </div>
          </div>
        </div>
      </div>
      {p.summary && <div style={{ marginBottom: '18px', padding: '14px', background: t.accent, borderRadius: '8px' }}><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Professional Summary</h2>{renderSummary(p.summary, { color: '#374151', fontSize: '13px', lineHeight: '1.6', margin: 0 })}</div>}
      {displayData.experiences.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Startup Journey')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
        {displayData.education.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Education</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '8px' }}><p style={{ color: t.text, margin: '0 0 2px', fontSize: '12px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: t.primary, margin: 0, fontSize: '11px' }}>{edu.institution}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
        {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Skills</h2>{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.primary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.soft, '#f3f4f6', '#374151')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
      </div>
      {displayData.projects.length > 0 && <div style={{ marginBottom: '18px' }}><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Projects</h2>{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}</div>))}</div>}
      {displayData.certifications.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Certifications</h2>{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
    </div>
  );
};

// ============================================================
// 11. CONSULTING TEMPLATE
// ============================================================
export const renderConsultingTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#0d9488', secondary: '#14b8a6', accent: '#f0fdfa', text: '#1f2937', lightAccent: '#ccfbf1' };
  const p = displayData.personalInfo;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 10px', fontWeight: '700' }}>{title}</h2>;
  return (
    <div className="consulting-template" style={{ width: '100%', background: 'white', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ background: t.primary, color: 'white', padding: '22px 24px' }}>
        <h1 style={{ color: 'white', margin: '0 0 4px', fontSize: '28px', fontWeight: '700' }}>{p.fullName}</h1>
        <p style={{ color: 'rgba(255,255,255,0.9)', margin: '0 0 14px', fontSize: '14px' }}>{p.title}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
          <div>
            {p.email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><FAIcon iconName="Mail" size={12} color="rgba(255,255,255,0.85)" />{p.email}</div>}
            {p.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FAIcon iconName="Phone" size={12} color="rgba(255,255,255,0.85)" />{p.phone}</div>}
          </div>
          <div>
            {p.location && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><FAIcon iconName="MapPin" size={12} color="rgba(255,255,255,0.85)" />{p.location}</div>}
            {p.linkedin && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FAIcon iconName="Linkedin" size={12} color="rgba(255,255,255,0.85)" />{cleanUrl(p.linkedin)}</div>}
          </div>
        </div>
      </div>
      <div style={{ padding: '22px' }}>
        {p.summary && <div style={{ marginBottom: '20px' }}>{sHdr('Professional Summary')}{renderSummary(p.summary, { color: '#374151', fontSize: '13px', lineHeight: '1.7', margin: 0, textAlign: 'justify' as const })}</div>}
        {displayData.experiences.length > 0 && <div style={{ marginBottom: '20px' }}>{sHdr('Professional Experience')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {displayData.education.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 10px', fontWeight: '700' }}>Education</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '8px' }}><p style={{ color: t.text, margin: '0 0 2px', fontSize: '12px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: t.primary, margin: 0, fontSize: '11px' }}>{edu.institution}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div><h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 10px', fontWeight: '700' }}>Core Competencies</h2>{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.secondary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.soft, '#f3f4f6', '#374151')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
        </div>
        {displayData.projects.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Key Projects')}{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}</div>))}</div>}
        {displayData.certifications.length > 0 && <div>{sHdr('Certifications')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
      </div>
    </div>
  );
};

// ============================================================
// 12. MEDICAL TEMPLATE
// ============================================================
export const renderMedicalTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#059669', secondary: '#10b981', accent: '#f0fdf4', text: '#1f2937', lightAccent: '#d1fae5' };
  const p = displayData.personalInfo;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 10px', fontWeight: '700' }}>{title}</h2>;
  return (
    <div className="medical-template" style={{ width: '100%', background: 'white', padding: '32px 36px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ textAlign: 'center' as const, padding: '22px', marginBottom: '20px' }}>
        <div style={{ fontSize: '28px', marginBottom: '6px' }}>⚕️</div>
        <h1 style={{ color: t.text, margin: '0 0 4px', fontSize: '26px', fontWeight: '700' }}>Dr. {p.fullName}</h1>
        <p style={{ color: t.primary, margin: '0 0 12px', fontSize: '14px', fontWeight: '600' }}>{p.title}</p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: '14px', fontSize: '12px', color: '#4b5563' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={12} color="#4b5563" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={12} color="#4b5563" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={12} color="#4b5563" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={12} color="#4b5563" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      {p.summary && <div style={{ marginBottom: '18px' }}>{sHdr('Medical Expertise')}{renderSummary(p.summary, { color: '#374151', fontSize: '13px', lineHeight: '1.7', margin: 0, textAlign: 'justify' as const })}</div>}
      {displayData.education.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Medical Education')}{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 0', fontSize: '12px' }}>{edu.institution}{edu.location ? ` • ${edu.location}` : ''}{edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
      {displayData.experiences.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Professional Experience')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 6px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 3px', fontSize: '12px', paddingLeft: '12px' }}>• {d}</p>)}</div>))}</div>}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div style={{ marginBottom: '18px' }}>{sHdr('Medical Skills')}{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '6px' }}>{skillPills(displayData.skills.technical, t.accent, t.secondary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '6px' }}>{skillPills(displayData.skills.soft, '#f3f4f6', '#374151')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
      {displayData.certifications.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Certifications & Licenses')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
    </div>
  );
};

// ============================================================
// 13. FINANCE TEMPLATE
// ============================================================
export const renderFinanceTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#1e40af', secondary: '#3b82f6', accent: '#eff6ff', text: '#1f2937', lightAccent: '#dbeafe' };
  const p = displayData.personalInfo;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '12px', margin: '0 0 8px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>{title}</h2>;
  return (
    <div className="finance-template" style={{ width: '100%', background: 'white', border: '1px solid #d1d5db', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ background: t.primary, color: 'white', padding: '22px', textTransform: 'uppercase' as const }}>
        <h1 style={{ color: 'white', margin: '0 0 4px', fontSize: '26px', fontWeight: '700', letterSpacing: '2px' }}>{p.fullName}</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 0 12px', fontSize: '12px', letterSpacing: '2px' }}>{p.title}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '14px', fontSize: '11px', color: 'rgba(255,255,255,0.9)', textTransform: 'none' as const }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={11} color="rgba(255,255,255,0.9)" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={11} color="rgba(255,255,255,0.9)" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={11} color="rgba(255,255,255,0.9)" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={11} color="rgba(255,255,255,0.9)" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      <div style={{ padding: '22px' }}>
        {p.summary && <div style={{ marginBottom: '18px' }}>{sHdr('Financial Expertise')}{renderSummary(p.summary, { color: '#374151', fontSize: '12px', lineHeight: '1.7', margin: 0, textAlign: 'justify' as const })}</div>}
        {displayData.experiences.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('PROFESSIONAL EXPERIENCE')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          {displayData.education.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '12px', margin: '0 0 10px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>EDUCATION</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '8px' }}><p style={{ color: t.text, margin: '0 0 2px', fontSize: '12px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: t.primary, margin: 0, fontSize: '11px' }}>{edu.institution}{edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div><h2 style={{ color: t.primary, fontSize: '12px', margin: '0 0 10px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const }}>KEY SKILLS</h2>{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.secondary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.soft, '#f3f4f6', '#374151')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
        </div>
        {displayData.certifications.length > 0 && <div>{sHdr('CERTIFICATIONS')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
      </div>
    </div>
  );
};

// ============================================================
// 14. MARKETING TEMPLATE
// ============================================================
export const renderMarketingTemplate = ({
  displayData, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#f97316', secondary: '#fb923c', accent: '#fff7ed', text: '#1f2937', lightAccent: '#fed7aa' };
  const p = displayData.personalInfo;
  const profilePic = p.profilePicture ? (
    <img src={p.profilePicture} alt="Profile" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover' as const, border: '2px solid rgba(255,255,255,0.5)', marginBottom: '8px' }} />
  ) : null;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 12px', fontWeight: '700' }}>{title}</h2>;
  return (
    <div className="marketing-template" style={{ width: '100%', background: 'white', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ background: `linear-gradient(135deg,${t.primary} 0%,${t.secondary} 50%,${t.primary} 100%)`, padding: '24px', color: 'white', textAlign: 'center' as const }}>
        {profilePic}
        <h1 style={{ color: 'white', margin: '10px 0 4px', fontSize: '28px', fontWeight: '800' }}>{p.fullName}</h1>
        <p style={{ color: 'rgba(255,255,255,0.9)', margin: '0 0 12px', fontSize: '14px' }}>📈 {p.title}</p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={12} color="rgba(255,255,255,0.85)" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={12} color="rgba(255,255,255,0.85)" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={12} color="rgba(255,255,255,0.85)" />{p.location}</span>}
        </div>
      </div>
      <div style={{ padding: '22px' }}>
        {p.summary && <div style={{ marginBottom: '18px', background: t.accent, padding: '14px', borderRadius: '8px' }}><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '700' }}>Professional Summary</h2>{renderSummary(p.summary, { color: '#374151', fontSize: '13px', lineHeight: '1.6', margin: 0 })}</div>}
        {displayData.experiences.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Growth Achievements')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          {displayData.education.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700' }}>Education</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '8px' }}><p style={{ color: t.text, margin: '0 0 2px', fontSize: '12px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: t.primary, margin: 0, fontSize: '11px' }}>{edu.institution}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700' }}>Skills &amp; Tools</h2>{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.primary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.soft, '#fef3c7', '#92400e')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
        </div>
        {displayData.projects.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Campaigns & Projects')}{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}</div>))}</div>}
        {displayData.certifications.length > 0 && <div>{sHdr('Certifications')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
      
      </div>
    </div>
  );
};

// ============================================================
// 15. DATA TEMPLATE
// ============================================================
export const renderDataTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#7c3aed', secondary: '#8b5cf6', accent: '#f5f3ff', text: '#1f2937', lightAccent: '#ede9fe' };
  const p = displayData.personalInfo;
  const profilePic = p.profilePicture ? (
    <img src={p.profilePicture} alt="Profile" style={{ width: '65px', height: '65px', borderRadius: '50%', objectFit: 'cover' as const, border: '2px solid rgba(255,255,255,0.4)' }} />
  ) : null;
  return (
    <div className="data-template" style={{ width: '100%', background: 'white', border: `2px solid ${t.primary}`, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ background: t.primary, color: 'white', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
          {profilePic}
          <div>
            <h1 style={{ color: 'white', margin: '0 0 4px', fontSize: '26px', fontWeight: '700' }}>{p.fullName}</h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 0 8px', fontSize: '13px' }}>📊 {p.title}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
              {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={11} color="rgba(255,255,255,0.85)" />{p.email}</span>}
              {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={11} color="rgba(255,255,255,0.85)" />{p.phone}</span>}
              {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={11} color="rgba(255,255,255,0.85)" />{p.location}</span>}
              {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={11} color="rgba(255,255,255,0.85)" />{cleanUrl(p.linkedin)}</span>}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
        <div style={{ background: t.lightAccent, padding: '18px', borderRight: `2px solid ${t.primary}` }}>
          {p.summary && <div style={{ marginBottom: '18px' }}><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '700', textTransform: 'uppercase' as const }}>Research Focus</h3>{renderSummary(p.summary, { color: '#374151', fontSize: '12px', lineHeight: '1.6', margin: 0 })}</div>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div style={{ marginBottom: '18px' }}><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '700', textTransform: 'uppercase' as const }}>Technical Skills</h3>{displayData.skills.technical.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '3px', marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.secondary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}><strong style={{ fontSize: '12px', color: '#374151' }}>Soft Skills</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.soft, '#f3f4f6', '#374151')}</div></div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
          {displayData.education.length > 0 && <div><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '700', textTransform: 'uppercase' as const }}>Education</h3>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '8px' }}><p style={{ color: t.text, fontSize: '12px', margin: '0 0 2px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: '#6b7280', fontSize: '11px', margin: 0 }}>{edu.institution}</p><p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>{fmtDate(edu.startDate)} - {fmtDate(edu.endDate)}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
        </div>
        <div style={{ padding: '18px' }}>
          {displayData.experiences.length > 0 && <div style={{ marginBottom: '18px' }}><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 12px', fontWeight: '700', textTransform: 'uppercase' as const }}>Experience</h3>{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
          {displayData.projects.length > 0 && <div style={{ marginBottom: '18px' }}><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700', textTransform: 'uppercase' as const }}>Data Projects</h3>{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}</div>))}</div>}
          {displayData.certifications.length > 0 && <div><h3 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '700', textTransform: 'uppercase' as const }}>Certifications</h3>{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
          
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 16. NONPROFIT TEMPLATE
// ============================================================
export const renderNonprofitTemplate = ({
  displayData, cleanUrl, colors
}: TemplateProps & { colors?: any }) => {
  const t = colors || { primary: '#db2777', secondary: '#ec4899', accent: '#fdf2f8', text: '#1f2937', lightAccent: '#fce7f3' };
  const p = displayData.personalInfo;
  const sHdr = (title: string) => <h2 style={{ color: t.primary, fontSize: '14px', margin: '0 0 12px', fontWeight: '700' }}>{title}</h2>;
  return (
    <div className="nonprofit-template" style={{ width: '100%', background: 'white', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif', fontSize: '13px', lineHeight: '1.4', color: '#000' }}>
      <div style={{ background: t.primary, color: 'white', padding: '24px', textAlign: 'center' as const }}>
        <div style={{ fontSize: '28px', marginBottom: '6px' }}>🤝</div>
        <h1 style={{ color: 'white', margin: '0 0 4px', fontSize: '26px', fontWeight: '700' }}>{p.fullName}</h1>
        <p style={{ color: 'rgba(255,255,255,0.9)', margin: '0 0 12px', fontSize: '14px' }}>{p.title}</p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' as const, gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
          {p.email && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Mail" size={12} color="rgba(255,255,255,0.85)" />{p.email}</span>}
          {p.phone && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Phone" size={12} color="rgba(255,255,255,0.85)" />{p.phone}</span>}
          {p.location && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="MapPin" size={12} color="rgba(255,255,255,0.85)" />{p.location}</span>}
          {p.linkedin && <span style={{ display: 'flex', alignItems: 'center' }}><FAIcon iconName="Linkedin" size={12} color="rgba(255,255,255,0.85)" />{cleanUrl(p.linkedin)}</span>}
        </div>
      </div>
      <div style={{ padding: '22px' }}>
        {p.summary && <div style={{ marginBottom: '18px', padding: '14px', background: t.accent, borderLeft: `4px solid ${t.primary}`, borderRadius: '0 8px 8px 0' }}><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 8px', fontWeight: '700' }}>Professional Summary</h2>{renderSummary(p.summary, { color: '#374151', fontSize: '13px', lineHeight: '1.6', margin: 0 })}</div>}
        {displayData.experiences.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Leadership Experience')}{displayData.experiences.map((exp: Experience) => (<div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><p style={{ color: t.text, margin: 0, fontSize: '13px', fontWeight: '600' }}>{exp.position}</p><span style={{ color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' as const }}>{fmtDate(exp.startDate)} - {exp.current ? 'Present' : fmtDate(exp.endDate)}</span></div><p style={{ color: t.primary, margin: '2px 0 5px', fontSize: '12px' }}>{exp.company}{exp.location ? ` • ${exp.location}` : ''}</p>{exp.description.filter((d: string) => d.trim()).map((d: string, i: number) => <p key={i} style={{ color: '#4b5563', margin: '0 0 3px', fontSize: '12px', paddingLeft: '10px' }}>• {d}</p>)}</div>))}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          {displayData.education.length > 0 && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700' }}>Education</h2>{displayData.education.map((edu: Education) => (<div key={edu.id} style={{ marginBottom: '8px' }}><p style={{ color: t.text, margin: '0 0 2px', fontSize: '12px', fontWeight: '600' }}>{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p><p style={{ color: t.primary, margin: 0, fontSize: '11px' }}>{edu.institution}</p>{(edu.achievements||[]).filter((a: string) => a.trim()).length > 0 && <p style={{ color: '#374151', margin: '2px 0 0', fontSize: '11px' }}><strong>Achievements</strong> - {(edu.achievements||[]).filter((a: string) => a.trim()).join(' • ')}</p>}</div>))}</div>}{displayData.achievements.length > 0 && <p style={{ color: '#374151', margin: '4px 0 0', fontSize: '12px' }}><strong>Achievements</strong> - {displayData.achievements.join(' • ')}</p>}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || (displayData.skills.languages||[]).length > 0) && <div><h2 style={{ color: t.primary, fontSize: '13px', margin: '0 0 10px', fontWeight: '700' }}>Skills</h2>{displayData.skills.technical.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.technical, t.accent, t.secondary)}</div>}{displayData.skills.soft.length > 0 && <div style={{ marginBottom: '8px' }}>{skillPills(displayData.skills.soft, '#fdf2f8', '#9d174d')}</div>}{(displayData.skills.languages||[]).length > 0 && <div><strong style={{ fontSize: '12px', color: '#374151' }}>Languages</strong><div style={{ marginTop: '4px' }}>{skillPills(displayData.skills.languages, '#fef3c7', '#92400e')}</div></div>}</div>}
        </div>
        {displayData.projects.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Community Projects')}{displayData.projects.map((proj: Project) => (<div key={proj.id} style={{ marginBottom: '10px' }}><p style={{ color: t.text, margin: '0 0 3px', fontSize: '13px', fontWeight: '600' }}>{proj.name}</p>{proj.description && <p style={{ color: '#4b5563', margin: '0 0 4px', fontSize: '12px' }}>{proj.description}</p>}</div>))}</div>}
        {displayData.certifications.length > 0 && <div style={{ marginBottom: '18px' }}>{sHdr('Certifications')}{displayData.certifications.map((c: string, i: number) => <p key={i} style={{ color: '#374151', margin: '0 0 4px', fontSize: '12px' }}>• {c}</p>)}</div>}
        
      </div>
    </div>
  );
};
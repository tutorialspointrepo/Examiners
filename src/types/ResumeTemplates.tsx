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
  SummaryText: React.FC<{ text: string; style?: React.CSSProperties }>;
  mode?: 'preview' | 'pdf';
}

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

// 1. Modern Template
export const renderModernTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to modern blue colors
  const theme = colors || {
    primary: '#3b82f6',
    secondary: '#1e40af', 
    accent: '#dbeafe',
    text: '#1f2937',
    lightAccent: '#e5e7eb'
  };

  return (
    <div className="modern-template" style={{
      width: '100%',
      background: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000'
    }}>
      {/* Header Section */}
      <div style={{ 
        borderBottom: `3px solid ${theme.primary}`, 
        paddingBottom: '20px', 
        marginBottom: '25px' 
      }}>
        <h1 style={{ 
          color: theme.text, 
          margin: '0', 
          fontSize: '28px', 
          fontWeight: '700',
          lineHeight: '1.2'
        }}>
          {displayData.personalInfo.fullName}
        </h1>
        
        <p style={{ 
          color: theme.primary, 
          margin: '8px 0 0 0', 
          fontSize: '16px', 
          fontWeight: '600' 
        }}>
          {displayData.personalInfo.title || 'Professional'}
        </p>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '16px', 
          marginTop: '12px', 
          fontSize: '13px', 
          color: '#6b7280',
          lineHeight: '1.4' 
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FAIcon iconName="Mail" size={14} />
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FAIcon iconName="Phone" size={14} />
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FAIcon iconName="MapPin" size={14} />
              {displayData.personalInfo.location}
            </span>
          )}
        </div>

        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '12px', 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#6b7280' 
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FAIcon iconName="Linkedin" size={14} />
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FAIcon iconName="Globe" size={14} />
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Professional Summary */}
      {displayData.personalInfo.summary && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '600' 
          }}>
            Professional Summary
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: '#4b5563', 
              lineHeight: '1.6', 
              textAlign: 'justify',
              fontSize: '14px'
            }}
          />
        </div>
      )}

      {/* Experience Section */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 15px 0', 
            fontWeight: '600' 
          }}>
            Experience
          </h2>
          {displayData.experiences.map((exp: Experience) => (
            <div key={exp.id} style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '6px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '16px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 8px 0', 
                fontSize: '14px', 
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` • ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: '#e0f2fe', 
                    color: '#0369a1', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    fontSize: '10px', 
                    fontWeight: '500', 
                    marginLeft: '8px' 
                  }}>
                    {exp.type.charAt(0).toUpperCase() + exp.type.slice(1)}
                  </span>
                )}
              </p>
              
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 18px', 
                  padding: '0',
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '4px', 
                      lineHeight: '1.5',
                      fontSize: '13px'
                    }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education Section */}
      {displayData.education.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 15px 0', 
            fontWeight: '600' 
          }}>
            Education
          </h2>
          {displayData.education.map((edu: Education) => (
            <div key={edu.id} style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '5px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '16px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.startDate} - {edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 6px 0', 
                fontSize: '14px', 
                fontWeight: '500' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 18px', 
                  padding: '0' 
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '2px', 
                      fontSize: '13px',
                      lineHeight: '1.4'
                    }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skills Section */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '600' 
          }}>
            Skills
          </h2>
          
          {displayData.skills.technical.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ 
                margin: '0 0 6px 0', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151' 
              }}>
                Technical Skills
              </h4>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px' 
              }}>
                {displayData.skills.technical.map((skill: string, index: number) => (
                  <span key={index} style={{ 
                    background: theme.accent, 
                    color: theme.secondary, 
                    padding: '4px 12px', 
                    borderRadius: '16px', 
                    fontSize: '12px', 
                    fontWeight: '500' 
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {displayData.skills.soft.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ 
                margin: '0 0 6px 0', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151' 
              }}>
                Soft Skills
              </h4>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px' 
              }}>
                {displayData.skills.soft.map((skill: string, index: number) => (
                  <span key={index} style={{ 
                    background: '#f0fdf4', 
                    color: '#166534', 
                    padding: '4px 12px', 
                    borderRadius: '16px', 
                    fontSize: '12px', 
                    fontWeight: '500' 
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {displayData.skills.languages.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ 
                margin: '0 0 6px 0', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151' 
              }}>
                Languages
              </h4>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px' 
              }}>
                {displayData.skills.languages.map((skill: string, index: number) => (
                  <span key={index} style={{ 
                    background: '#fef3c7', 
                    color: '#92400e', 
                    padding: '4px 12px', 
                    borderRadius: '16px', 
                    fontSize: '12px', 
                    fontWeight: '500' 
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projects Section */}
      {displayData.projects.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '600' 
          }}>
            Projects
          </h2>
          {displayData.projects.map((project: Project) => (
            <div key={project.id} style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '5px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {project.name}
                </h3>
              </div>
              {(project.link || project.github) && (
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0 4px 0', 
                  fontSize: '11px',
                  display: 'flex',
                  gap: '12px'
                }}>
                  {project.link && (
                    project.link.includes('.') ? (
                      <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Globe" size={10} />
                        {project.link}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Globe" size={10} />
                        {project.link}
                      </span>
                    )
                  )}
                  {project.github && (
                    project.github.includes('.') ? (
                      <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Github" size={10} />
                        {project.github}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Github" size={10} />
                        {project.github}
                      </span>
                    )
                  )}
                </p>
              )}
              {project.description && (
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  lineHeight: '1.5',
                  textAlign: 'justify'
                }}>
                  {project.description}
                </p>
              )}
              {project.technologies.length > 0 && (
                <p style={{ 
                  color: '#6b7280', 
                  margin: '0', 
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  <strong>Technologies:</strong> {project.technologies.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certifications Section */}
      {displayData.certifications.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '600' 
          }}>
            Certifications
          </h2>
          <ul style={{ 
            color: '#4b5563', 
            margin: '0 0 0 18px', 
            padding: '0',
            listStyleType: 'disc'
          }}>
            {displayData.certifications.map((cert: string, index: number) => (
              <li key={index} style={{ 
                marginBottom: '4px', 
                fontSize: '13px',
                lineHeight: '1.4'
              }}>
                {cert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Achievements Section */}
      {displayData.achievements.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '600' 
          }}>
            Achievements
          </h2>
          <ul style={{ 
            color: '#4b5563', 
            margin: '0 0 0 18px', 
            padding: '0',
            listStyleType: 'disc'
          }}>
            {displayData.achievements.map((achievement: string, index: number) => (
              <li key={index} style={{ 
                marginBottom: '4px', 
                fontSize: '13px',
                lineHeight: '1.4'
              }}>
                {achievement}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// 2. Professional Blue Template
export const renderProfessionalBlueTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to professional blue colors
  const theme = colors || {
    primary: '#4f87c7',
    secondary: '#6ba3d6', 
    accent: '#f8f9fa',
    text: '#1f2937',
    lightAccent: '#e5e7eb'
  };

  return (
    <div className="professionalBlue-template" style={{
      background: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      width: '100%',
      minHeight: '297mm'
    }}>
      {/* Header with Blue Gradient */}
      <div style={{ 
        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`, 
        padding: '20px', 
        color: 'white'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          {/* Profile Photo */}
          <div style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            background: '#ffffff', 
            padding: '3px',
            flexShrink: 0
          }}>
            <div style={{ 
              width: '74px', 
              height: '74px', 
              borderRadius: '50%', 
              overflow: 'hidden',
              background: 'linear-gradient(45deg, #e0e0e0, #f5f5f5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {displayData.personalInfo.profilePicture && 
               typeof displayData.personalInfo.profilePicture === 'string' && 
               displayData.personalInfo.profilePicture.trim() !== '' ? (
                <img 
                  src={displayData.personalInfo.profilePicture} 
                  alt="Profile"
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }}
                />
              ) : (
                <span style={{ 
                  color: '#666', 
                  fontSize: '14px', 
                  fontWeight: '600'
                }}>
                  Photo
                </span>
              )}
            </div>
          </div>
          
          {/* Name and Title */}
          <div>
            <h1 style={{ 
              color: 'white', 
              margin: '0', 
              fontSize: '28px', 
              fontWeight: '700', 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              lineHeight: '1.2'
            }}>
              {displayData.personalInfo.fullName}
            </h1>
            <p style={{ 
              color: 'rgba(255,255,255,0.9)', 
              margin: '6px 0 0 0', 
              fontSize: '16px', 
              fontWeight: '500' 
            }}>
              {displayData.personalInfo.title || 'Professional'}
            </p>
          </div>
        </div>
        
        {/* Contact Info in Header */}
        <div style={{ 
          marginTop: '15px', 
          display: 'flex',
          flexWrap: 'wrap', 
          gap: '20px', 
          fontSize: '14px', 
          color: 'rgba(255,255,255,0.9)',
          lineHeight: '1.4',
          alignItems: 'center'
        }}>
          {displayData.personalInfo.phone && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              minHeight: '20px'
            }}>
              <FAIcon iconName="Phone" size={16} color="currentColor" />
              <span style={{ lineHeight: '1.2' }}>{displayData.personalInfo.phone}</span>
            </div>
          )}
          {displayData.personalInfo.email && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              minHeight: '20px'
            }}>
              <FAIcon iconName="Mail" size={16} color="currentColor" />
              <span style={{ lineHeight: '1.2' }}>{displayData.personalInfo.email}</span>
            </div>
          )}
          {displayData.personalInfo.location && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              minHeight: '20px'
            }}>
              <FAIcon iconName="MapPin" size={16} color="currentColor" />
              <span style={{ lineHeight: '1.2' }}>{displayData.personalInfo.location}</span>
            </div>
          )}
          {displayData.personalInfo.linkedin && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              minHeight: '20px'
            }}>
              <FAIcon iconName="Linkedin" size={16} color="currentColor" />
              <span style={{ lineHeight: '1.2' }}>{cleanUrl(displayData.personalInfo.linkedin)}</span>
            </div>
          )}
          {displayData.personalInfo.website && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              minHeight: '20px'
            }}>
              <FAIcon iconName="Globe" size={16} color="currentColor" />
              <span style={{ lineHeight: '1.2' }}>{cleanUrl(displayData.personalInfo.website)}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Two Column Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 2fr', 
        gap: '0',
        minHeight: 'calc(297mm - 120px)'
      }}>
        {/* Left Column */}
        <div style={{ 
          background: theme.accent, 
          padding: '25px 20px', 
          borderRight: `1px solid ${theme.lightAccent}`
        }}>
          {/* About Me */}
          {displayData.personalInfo.summary && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 12px 0', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                borderBottom: `2px solid ${theme.primary}`, 
                paddingBottom: '5px',
                minHeight: '24px',
                lineHeight: '1.2'
              }}>
                <FAIcon iconName="User" size={16} color={theme.primary} />
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '16px',
                  lineHeight: '16px'
                }}>
                  About Me
                </span>
              </h3>
              <SummaryText 
                text={displayData.personalInfo.summary} 
                style={{ 
                  color: '#374151', 
                  fontSize: '13px', 
                  lineHeight: '1.6', 
                  margin: '0', 
                  textAlign: 'justify' 
                }}
              />
            </div>
          )}

          {/* Education */}
          {displayData.education.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 12px 0', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                borderBottom: `2px solid ${theme.primary}`, 
                paddingBottom: '5px',
                minHeight: '24px',
                lineHeight: '1.2'
              }}>
                <FAIcon iconName="GraduationCap" size={16} color={theme.primary} />
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '16px',
                  lineHeight: '16px'
                }}>
                  Education
                </span>
              </h3>
              {displayData.education.map((edu: Education) => (
                <div key={edu.id} style={{ marginBottom: '12px' }}>
                  <h4 style={{ 
                    color: theme.text, 
                    fontSize: '14px', 
                    margin: '0 0 2px 0', 
                    fontWeight: '600' 
                  }}>
                    {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                  </h4>
                  <p style={{ 
                    color: '#6b7280', 
                    fontSize: '12px', 
                    margin: '0' 
                  }}>
                    {edu.institution} • {edu.startDate} - {edu.endDate}
                  </p>
                  {edu.gpa && (
                    <p style={{ 
                      color: '#6b7280', 
                      fontSize: '12px', 
                      margin: '0' 
                    }}>
                      GPA: {edu.gpa}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Skills */}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0) && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 12px 0', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                borderBottom: `2px solid ${theme.primary}`, 
                paddingBottom: '5px',
                minHeight: '24px',
                lineHeight: '1.2'
              }}>
                <FAIcon iconName="Star" size={16} color={theme.primary} />
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '16px',
                  lineHeight: '16px'
                }}>
                  Expertise
                </span>
              </h3>
              <div style={{ fontSize: '12px', color: '#374151' }}>
                {displayData.skills.technical.map((skill: string, index: number) => (
                  <p key={`tech-${index}`} style={{ margin: '0 0 4px 0' }}>
                    • {skill}
                  </p>
                ))}
                {displayData.skills.soft.map((skill: string, index: number) => (
                  <p key={`soft-${index}`} style={{ margin: '0 0 4px 0' }}>
                    • {skill}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {displayData.skills.languages.length > 0 && (
            <div>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 12px 0', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                borderBottom: `2px solid ${theme.primary}`, 
                paddingBottom: '5px',
                minHeight: '24px',
                lineHeight: '1.2'
              }}>
                <FAIcon iconName="Globe" size={16} color={theme.primary} />
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '16px',
                  lineHeight: '16px'
                }}>
                  Language
                </span>
              </h3>
              <ul style={{ 
                color: '#374151', 
                margin: '0 0 0 15px', 
                padding: '0', 
                fontSize: '13px',
                listStyleType: 'disc'
              }}>
                {displayData.skills.languages.map((language: string, index: number) => (
                  <li key={index} style={{ marginBottom: '4px' }}>
                    {language}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Right Column */}
        <div style={{ padding: '25px 20px' }}>
          {/* Experience */}
          {displayData.experiences.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '18px', 
                margin: '0 0 15px 0', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                minHeight: '26px',
                lineHeight: '1.2'
              }}>
                <FAIcon iconName="Monitor" size={18} color={theme.primary} />
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '18px',
                  lineHeight: '18px'
                }}>
                  Experience
                </span>
              </h3>
              
              {displayData.experiences.map((exp: Experience) => (
                <div key={exp.id} style={{ 
                  marginBottom: '20px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'baseline', 
                    marginBottom: '5px',
                    flexWrap: 'wrap'
                  }}>
                    <h4 style={{ 
                      color: theme.text, 
                      fontSize: '15px', 
                      margin: '0', 
                      fontWeight: '600',
                      flex: '1 1 auto'
                    }}>
                      {exp.position}
                    </h4>
                    <span style={{ 
                      color: '#6b7280', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      whiteSpace: 'nowrap',
                      marginTop: '2px'
                    }}>
                      {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                    </span>
                  </div>
                  <p style={{ 
                    color: theme.primary, 
                    margin: '2px 0 8px 0', 
                    fontSize: '13px', 
                    fontWeight: '500' 
                  }}>
                    {exp.company}{exp.location && `, ${exp.location}`}
                  </p>
                  {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                    <ul style={{ 
                      color: '#374151', 
                      margin: '0 0 0 15px', 
                      padding: '0', 
                      fontSize: '12px', 
                      lineHeight: '1.5',
                      listStyleType: 'disc'
                    }}>
                      {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                        <li key={index} style={{ marginBottom: '3px' }}>
                          {desc}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Projects */}
          {displayData.projects.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '18px', 
                margin: '0 0 15px 0', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                minHeight: '26px',
                lineHeight: '1.2'
              }}>
                <FAIcon iconName="Star" size={18} color={theme.primary} />
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '18px',
                  lineHeight: '18px'
                }}>
                  Projects
                </span>
              </h3>
              {displayData.projects.map((project: Project) => (
                <div key={project.id} style={{ 
                  marginBottom: '16px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'baseline', 
                    marginBottom: '5px',
                    flexWrap: 'wrap'
                  }}>
                    <h4 style={{ 
                      color: theme.text, 
                      fontSize: '14px', 
                      margin: '0', 
                      fontWeight: '600',
                      flex: '1 1 auto'
                    }}>
                      {project.name}
                    </h4>
                  </div>
                  {(project.link || project.github) && (
                    <p style={{ 
                      color: '#4b5563', 
                      margin: '2px 0 6px 0', 
                      fontSize: '11px',
                      display: 'flex',
                      gap: '12px'
                    }}>
                      {project.link && (
                        project.link.includes('.') ? (
                          <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                            <FAIcon iconName="Globe" size={10} />
                            {project.link}
                          </a>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                            <FAIcon iconName="Globe" size={10} />
                            {project.link}
                          </span>
                        )
                      )}
                      {project.github && (
                        project.github.includes('.') ? (
                          <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                            <FAIcon iconName="Github" size={10} />
                            {project.github}
                          </a>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                            <FAIcon iconName="Github" size={10} />
                            {project.github}
                          </span>
                        )
                      )}
                    </p>
                  )}
                  {project.description && (
                    <p style={{ 
                      color: '#374151', 
                      margin: '0 0 6px 0', 
                      fontSize: '12px', 
                      lineHeight: '1.5',
                      textAlign: 'justify'
                    }}>
                      {project.description}
                    </p>
                  )}
                  {project.technologies.length > 0 && (
                    <p style={{ 
                      color: '#6b7280', 
                      margin: '0', 
                      fontSize: '11px',
                      lineHeight: '1.4'
                    }}>
                      <strong>Technologies:</strong> {project.technologies.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Certifications */}
          {displayData.certifications.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '18px', 
                margin: '0 0 12px 0', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                minHeight: '26px',
                lineHeight: '1.2'
              }}>
                <FAIcon iconName="Zap" size={18} color={theme.primary} />
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '18px',
                  lineHeight: '18px'
                }}>
                  Certification
                </span>
              </h3>
              <ul style={{ 
                color: '#374151', 
                margin: '0 0 0 15px', 
                padding: '0', 
                fontSize: '13px',
                listStyleType: 'disc'
              }}>
                {displayData.certifications.map((cert: string, index: number) => (
                  <li key={index} style={{ marginBottom: '4px' }}>
                    {cert}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Achievements */}
          {displayData.achievements.length > 0 && (
            <div>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '18px', 
                margin: '0 0 12px 0', 
                fontWeight: '700', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                minHeight: '26px',
                lineHeight: '1.2'
              }}>
                <FAIcon iconName="Award" size={18} color={theme.primary} />
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  height: '18px',
                  lineHeight: '18px'
                }}>
                  Achievements
                </span>
              </h3>
              <ul style={{ 
                color: '#374151', 
                margin: '0 0 0 15px', 
                padding: '0', 
                fontSize: '13px',
                listStyleType: 'disc'
              }}>
                {displayData.achievements.map((achievement: string, index: number) => (
                  <li key={index} style={{ marginBottom: '4px' }}>
                    {achievement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// 3. Creative Template
export const renderCreativeTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to creative orange colors
  const theme = colors || {
    primary: '#f59e0b',
    secondary: '#f97316', 
    accent: '#fef3c7',
    text: '#1f2937',
    lightAccent: '#fde68a'
  };

  return (
    <div className="creative-template" style={{
      width: '100%',
      background: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative elements */}
      <div style={{
        position: 'absolute',
        top: '0',
        right: '0',
        width: '200px',
        height: '200px',
        background: `linear-gradient(135deg, ${theme.primary}1a 0%, ${theme.secondary}1a 100%)`,
        borderRadius: '50%',
        transform: 'translate(50%, -50%)',
        zIndex: 0
      }} />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header Section */}
        <div style={{ 
          borderBottom: `3px solid ${theme.primary}`, 
          paddingBottom: '20px', 
          marginBottom: '25px',
          position: 'relative'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px', 
            marginBottom: '15px',
            flexWrap: 'wrap'
          }}>
            {/* Creative Icon */}
            <div style={{ 
              width: '70px', 
              height: '70px', 
              background: displayData.personalInfo.profilePicture && 
                         typeof displayData.personalInfo.profilePicture === 'string' && 
                         displayData.personalInfo.profilePicture.trim() !== '' 
                         ? 'transparent' 
                         : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
              borderRadius: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white',
              boxShadow: `0 8px 25px ${theme.primary}4d`,
              flexShrink: 0,
              transform: 'rotate(-5deg)',
              overflow: 'hidden'
            }}>
              {displayData.personalInfo.profilePicture && 
               typeof displayData.personalInfo.profilePicture === 'string' && 
               displayData.personalInfo.profilePicture.trim() !== '' ? (
                <img 
                  src={displayData.personalInfo.profilePicture} 
                  alt="Profile"
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    transform: 'rotate(5deg)' // Counter-rotate the image
                  }}
                />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
              )}
            </div>
            
            {/* Name and Title */}
            <div>
              <h1 style={{ 
                color: theme.text, 
                margin: '0', 
                fontSize: '28px', 
                fontWeight: '700',
                lineHeight: '1.2'
              }}>
                {displayData.personalInfo.fullName}
              </h1>
              <p style={{ 
                color: theme.primary, 
                margin: '8px 0 0 0', 
                fontSize: '16px', 
                fontWeight: '600' 
              }}>
                {displayData.personalInfo.title || 'Creative Professional'}
              </p>
            </div>
          </div>
          
          {/* Contact Info */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '16px', 
            fontSize: '13px', 
            color: '#6b7280',
            lineHeight: '1.4' 
          }}>
            {displayData.personalInfo.email && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FAIcon iconName="Mail" size={14} />
                {displayData.personalInfo.email}
              </span>
            )}
            {displayData.personalInfo.phone && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FAIcon iconName="Phone" size={14} />
                {displayData.personalInfo.phone}
              </span>
            )}
            {displayData.personalInfo.location && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FAIcon iconName="MapPin" size={14} />
                {displayData.personalInfo.location}
              </span>
            )}
          </div>

          {/* Social Links */}
          {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '12px', 
              marginTop: '8px', 
              fontSize: '13px', 
              color: '#6b7280' 
            }}>
              {displayData.personalInfo.linkedin && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FAIcon iconName="Linkedin" size={14} />
                  {cleanUrl(displayData.personalInfo.linkedin)}
                </span>
              )}
              {displayData.personalInfo.website && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FAIcon iconName="Globe" size={14} />
                  {cleanUrl(displayData.personalInfo.website)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Professional Summary */}
        {displayData.personalInfo.summary && (
          <div style={{ 
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.lightAccent} 100%)`, 
            padding: '20px', 
            borderRadius: '12px', 
            marginBottom: '25px', 
            borderLeft: `4px solid ${theme.primary}`,
            boxShadow: `0 4px 12px ${theme.primary}1a`
          }}>
            <h2 style={{ 
              color: '#92400e', 
              fontSize: '18px', 
              margin: '0 0 12px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FAIcon iconName="User" size={16} color="#92400e" />
              Creative Vision
            </h2>
            <SummaryText 
              text={displayData.personalInfo.summary}
              style={{ 
                color: '#374151', 
                lineHeight: '1.6', 
                textAlign: 'justify',
                fontSize: '14px',
                margin: '0'
              }}
            />
          </div>
        )}

        {/* Experience Section */}
        {displayData.experiences.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 15px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FAIcon iconName="Briefcase" size={16} color={theme.primary} />
              Creative Experience
            </h2>
            {displayData.experiences.map((exp: Experience) => (
              <div key={exp.id} style={{ 
                marginBottom: '20px',
                background: '#fffbeb',
                padding: '16px',
                borderRadius: '10px',
                borderLeft: `4px solid ${theme.primary}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline', 
                  marginBottom: '6px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '16px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto',
                    minWidth: '60%'
                  }}>
                    {exp.position}
                  </h3>
                  <span style={{ 
                    color: '#6b7280', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </span>
                </div>
                
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0 8px 0', 
                  fontSize: '14px', 
                  fontWeight: '500',
                  lineHeight: '1.4'
                }}>
                  {exp.company}
                  {exp.location && ` • ${exp.location}`}
                  {exp.type && exp.type !== 'full-time' && (
                    <span style={{ 
                      background: '#fed7aa', 
                      color: '#9a3412', 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '10px', 
                      fontWeight: '500', 
                      marginLeft: '8px' 
                    }}>
                      {exp.type.charAt(0).toUpperCase() + exp.type.slice(1)}
                    </span>
                  )}
                </p>
                
                {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                  <ul style={{ 
                    color: '#4b5563', 
                    margin: '0 0 0 18px', 
                    padding: '0',
                    listStyleType: 'disc'
                  }}>
                    {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                      <li key={index} style={{ 
                        marginBottom: '4px', 
                        lineHeight: '1.5',
                        fontSize: '13px'
                      }}>
                        {desc}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Education Section */}
        {displayData.education.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 15px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FAIcon iconName="GraduationCap" size={16} color={theme.primary} />
              Education
            </h2>
            {displayData.education.map((edu: Education) => (
              <div key={edu.id} style={{ marginBottom: '16px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline', 
                  marginBottom: '5px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '16px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                  </h3>
                  <span style={{ 
                    color: '#6b7280', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {edu.startDate} - {edu.endDate}
                  </span>
                </div>
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0 6px 0', 
                  fontSize: '14px', 
                  fontWeight: '500' 
                }}>
                  {edu.institution}
                  {edu.location && ` • ${edu.location}`}
                  {edu.gpa && ` • GPA: ${edu.gpa}`}
                </p>
                {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                  <ul style={{ 
                    color: '#4b5563', 
                    margin: '0 0 0 18px', 
                    padding: '0' 
                  }}>
                    {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                      <li key={index} style={{ 
                        marginBottom: '2px', 
                        fontSize: '13px',
                        lineHeight: '1.4'
                      }}>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Skills Section */}
        {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
          <div style={{ marginBottom: '25px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 12px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FAIcon iconName="Star" size={16} color={theme.primary} />
              Creative Skills
            </h2>
            
            {displayData.skills.technical.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ 
                  margin: '0 0 6px 0', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151' 
                }}>
                  Technical Skills
                </h4>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px' 
                }}>
                  {displayData.skills.technical.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
                      color: 'white', 
                      padding: '6px 14px', 
                      borderRadius: '20px', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      boxShadow: `0 2px 8px ${theme.primary}33`
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {displayData.skills.soft.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ 
                  margin: '0 0 6px 0', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151' 
                }}>
                  Soft Skills
                </h4>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px' 
                }}>
                  {displayData.skills.soft.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: theme.accent, 
                      color: '#92400e', 
                      padding: '4px 12px', 
                      borderRadius: '16px', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      border: `1px solid ${theme.lightAccent}`
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {displayData.skills.languages.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ 
                  margin: '0 0 6px 0', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151' 
                }}>
                  Languages
                </h4>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '6px' 
                }}>
                  {displayData.skills.languages.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: '#fed7aa', 
                      color: '#9a3412', 
                      padding: '4px 12px', 
                      borderRadius: '16px', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      border: '1px solid #fdba74'
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Projects Section */}
        {displayData.projects.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 12px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FAIcon iconName="Star" size={16} color={theme.primary} />
              Featured Projects
            </h2>
            {displayData.projects.map((project: Project) => (
              <div key={project.id} style={{ 
                marginBottom: '16px',
                background: '#fffbeb',
                padding: '14px',
                borderRadius: '8px',
                border: `1px solid ${theme.lightAccent}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline', 
                  marginBottom: '5px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '15px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {project.name}
                  </h3>
                </div>
                {(project.link || project.github) && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '2px 0 6px 0', 
                    fontSize: '11px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {project.link && (
                      project.link.includes('.') ? (
                        <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </span>
                      )
                    )}
                    {project.github && (
                      project.github.includes('.') ? (
                        <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </span>
                      )
                    )}
                  </p>
                )}
                {project.description && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '0 0 6px 0', 
                    fontSize: '13px', 
                    lineHeight: '1.5',
                    textAlign: 'justify'
                  }}>
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <p style={{ 
                    color: '#6b7280', 
                    margin: '0', 
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    <strong>Technologies:</strong> {project.technologies.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certifications Section */}
        {displayData.certifications.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 12px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FAIcon iconName="Award" size={16} color={theme.primary} />
              Certifications
            </h2>
            <ul style={{ 
              color: '#4b5563', 
              margin: '0 0 0 18px', 
              padding: '0',
              listStyleType: 'disc'
            }}>
              {displayData.certifications.map((cert: string, index: number) => (
                <li key={index} style={{ 
                  marginBottom: '4px', 
                  fontSize: '13px',
                  lineHeight: '1.4'
                }}>
                  {cert}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Achievements Section */}
        {displayData.achievements.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 12px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FAIcon iconName="Award" size={16} color={theme.primary} />
              Achievements
            </h2>
            <ul style={{ 
              color: '#4b5563', 
              margin: '0 0 0 18px', 
              padding: '0',
              listStyleType: 'disc'
            }}>
              {displayData.achievements.map((achievement: string, index: number) => (
                <li key={index} style={{ 
                  marginBottom: '4px', 
                  fontSize: '13px',
                  lineHeight: '1.4'
                }}>
                  {achievement}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
// 4. Executive Template
export const renderExecutiveTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to executive dark gray colors
  const theme = colors || {
    primary: '#1f2937',
    secondary: '#374151', 
    accent: '#f3f4f6',
    text: '#1f2937',
    lightAccent: '#e5e7eb'
  };

  return (
    <div className="executive-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '25px 20px',
      fontFamily: 'Times New Roman, serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000'
    }}>
      {/* Header Section */}
      <div style={{ 
        textAlign: 'center', 
        borderBottom: `2px solid ${theme.primary}`, 
        paddingBottom: '25px', 
        marginBottom: '30px' 
      }}>
        <h1 style={{ 
          color: theme.primary, 
          margin: '0', 
          fontSize: '36px', 
          letterSpacing: '2px', 
          fontWeight: '400',
          lineHeight: '1.2'
        }}>
          {displayData.personalInfo.fullName.toUpperCase()}
        </h1>
        
        {/* Decorative Line */}
        <div style={{ 
          width: '100px', 
          height: '2px', 
          background: theme.primary, 
          margin: '15px auto' 
        }} />
        
        <p style={{ 
          color: theme.secondary, 
          margin: '15px 0 0 0', 
          fontSize: '20px', 
          fontWeight: 'bold', 
          letterSpacing: '1px' 
        }}>
          {displayData.personalInfo.title ? displayData.personalInfo.title.toUpperCase() : 'SENIOR EXECUTIVE'}
        </p>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          justifyContent: 'center', 
          gap: '20px', 
          marginTop: '20px', 
          fontSize: '14px', 
          color: '#6b7280',
          lineHeight: '1.4' 
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FAIcon iconName="Mail" size={14} />
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FAIcon iconName="Phone" size={14} />
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FAIcon iconName="MapPin" size={14} />
              {displayData.personalInfo.location}
            </span>
          )}
        </div>

        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            justifyContent: 'center', 
            gap: '20px', 
            marginTop: '10px', 
            fontSize: '14px', 
            color: '#6b7280' 
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FAIcon iconName="Linkedin" size={14} />
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FAIcon iconName="Globe" size={14} />
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Executive Summary */}
      {displayData.personalInfo.summary && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '20px', 
            margin: '0 0 10px 0', 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '8px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FAIcon iconName="User" size={18} color={theme.primary} />
            Executive Summary
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: theme.secondary, 
              lineHeight: '1.8', 
              fontSize: '16px',
              textAlign: 'justify'
            }}
          />
        </div>
      )}

      {/* Professional Experience */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '20px', 
            margin: '0 0 10px 0', 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '8px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FAIcon iconName="Briefcase" size={18} color={theme.primary} />
            Professional Experience
          </h2>
          {displayData.experiences.map((exp: Experience) => (
            <div key={exp.id} style={{ marginBottom: '25px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '8px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.primary, 
                  fontSize: '18px', 
                  margin: '0', 
                  fontWeight: 'bold',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '15px', 
                  fontWeight: '500', 
                  fontStyle: 'italic',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              
              <p style={{ 
                color: theme.secondary, 
                margin: '4px 0 12px 0', 
                fontSize: '16px', 
                fontWeight: '600', 
                fontStyle: 'italic',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` | ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: theme.accent, 
                    color: theme.primary, 
                    padding: '3px 10px', 
                    borderRadius: '4px', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    marginLeft: '12px', 
                    fontStyle: 'normal',
                    border: '1px solid #d1d5db',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {exp.type}
                  </span>
                )}
              </p>
              
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: theme.secondary, 
                  margin: '0 0 0 25px', 
                  padding: '0', 
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '8px', 
                      lineHeight: '1.7', 
                      fontSize: '15px'
                    }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education & Qualifications */}
      {displayData.education.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '20px', 
            margin: '0 0 10px 0', 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '8px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FAIcon iconName="GraduationCap" size={18} color={theme.primary} />
            Education & Qualifications
          </h2>
          {displayData.education.map((edu: Education) => (
            <div key={edu.id} style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '6px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.primary, 
                  fontSize: '18px', 
                  margin: '0', 
                  fontWeight: 'bold',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '15px', 
                  fontWeight: '500', 
                  fontStyle: 'italic',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.startDate} - {edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.secondary, 
                margin: '2px 0 8px 0', 
                fontSize: '16px', 
                fontWeight: '600', 
                fontStyle: 'italic' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 25px', 
                  padding: '0', 
                  listStyleType: 'disc'
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '4px', 
                      fontSize: '14px', 
                      lineHeight: '1.6'
                    }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Core Competencies */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '20px', 
            margin: '0 0 10px 0', 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '8px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FAIcon iconName="Star" size={18} color={theme.primary} />
            Core Competencies
          </h2>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px' 
          }}>
            {displayData.skills.technical.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 10px 0', 
                  fontSize: '16px', 
                  fontWeight: '600' 
                }}>
                  Technical Expertise
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '15px', 
                  lineHeight: '1.6' 
                }}>
                  {displayData.skills.technical.join(', ')}
                </p>
              </div>
            )}
            {displayData.skills.soft.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 10px 0', 
                  fontSize: '16px', 
                  fontWeight: '600' 
                }}>
                  Leadership Skills
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '15px', 
                  lineHeight: '1.6' 
                }}>
                  {displayData.skills.soft.join(', ')}
                </p>
              </div>
            )}
            {displayData.skills.languages.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 10px 0', 
                  fontSize: '16px', 
                  fontWeight: '600' 
                }}>
                  Languages
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '15px', 
                  lineHeight: '1.6' 
                }}>
                  {displayData.skills.languages.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Strategic Projects */}
      {displayData.projects.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '20px', 
            margin: '0 0 10px 0', 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '8px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FAIcon iconName="Award" size={18} color={theme.primary} />
            Strategic Projects
          </h2>
          {displayData.projects.map((project: Project) => (
            <div key={project.id} style={{ marginBottom: '20px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '17px', 
                margin: '0 0 5px 0', 
                fontWeight: 'bold'
              }}>
                {project.name}
              </h3>
              {(project.link || project.github) && (
                <div style={{ 
                  display: 'flex', 
                  gap: '15px', 
                  alignItems: 'center',
                  marginBottom: '8px',
                  fontSize: '12px'
                }}>
                  {project.link && (
                    project.link.includes('.') ? (
                      <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Globe" size={12} />
                        {cleanUrl(project.link)}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Globe" size={12} />
                        {project.link}
                      </span>
                    )
                  )}
                  {project.github && (
                    project.github.includes('.') ? (
                      <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Code" size={12} />
                        {cleanUrl(project.github)}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Code" size={12} />
                        {project.github}
                      </span>
                    )
                  )}
                </div>
              )}
              {project.description && (
                <p style={{ 
                  color: theme.secondary, 
                  margin: '0 0 8px 0', 
                  fontSize: '15px', 
                  lineHeight: '1.7',
                  textAlign: 'justify'
                }}>
                  {project.description}
                </p>
              )}
              {project.technologies.length > 0 && (
                <p style={{ 
                  color: '#6b7280', 
                  margin: '0', 
                  fontSize: '14px', 
                  fontStyle: 'italic',
                  lineHeight: '1.4'
                }}>
                  <strong>Technologies:</strong> {project.technologies.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Professional Certifications */}
      {displayData.certifications.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '20px', 
            margin: '0 0 10px 0', 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '8px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FAIcon iconName="Award" size={18} color={theme.primary} />
            Professional Certifications
          </h2>
          <ul style={{ 
            color: theme.secondary, 
            margin: '0 0 0 25px', 
            padding: '0', 
            listStyleType: 'disc'
          }}>
            {displayData.certifications.map((cert: string, index: number) => (
              <li key={index} style={{ 
                marginBottom: '6px', 
                fontSize: '15px', 
                lineHeight: '1.6'
              }}>
                {cert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Achievements */}
      {displayData.achievements.length > 0 && (
        <div>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '20px', 
            margin: '0 0 10px 0', 
            textTransform: 'uppercase', 
            letterSpacing: '1px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '8px', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FAIcon iconName="Star" size={18} color={theme.primary} />
            Key Achievements
          </h2>
          <ul style={{ 
            color: theme.secondary, 
            margin: '0 0 0 25px', 
            padding: '0', 
            listStyleType: 'disc'
          }}>
            {displayData.achievements.map((achievement: string, index: number) => (
              <li key={index} style={{ 
                marginBottom: '8px', 
                fontSize: '15px', 
                lineHeight: '1.7'
              }}>
                {achievement}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
// 5. Minimal Template
export const renderMinimalTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to minimal gray colors (matching preview)
  const theme = colors || {
    primary: '#374151',
    secondary: '#6b7280', 
    accent: '#f9fafb',
    text: '#1f2937',
    lightAccent: '#e5e7eb'
  };

  return (
    <div className="minimal-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '35px',
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      lineHeight: '1.5',
      color: theme.text
    }}>
      {/* Header Section */}
      <div style={{ 
        marginBottom: '30px', 
        paddingBottom: '20px', 
        borderBottom: `1px solid ${theme.lightAccent}` 
      }}>
        <h1 style={{ 
          color: theme.text, 
          margin: '0', 
          fontSize: '36px', 
          fontWeight: '400', 
          lineHeight: '1.2' 
        }}>
          {displayData.personalInfo.fullName}
        </h1>
        {displayData.personalInfo.title && (
          <p style={{ 
            color: theme.secondary, 
            margin: '10px 0 0 0', 
            fontSize: '18px', 
            fontWeight: '400'
          }}>
            {displayData.personalInfo.title}
          </p>
        )}
        
        {/* Contact Info - inline with dots */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px', 
          marginTop: '14px', 
          fontSize: '14px', 
          color: '#9ca3af',
          alignItems: 'center'
        }}>
          {displayData.personalInfo.email && (
            <>
              <span>{displayData.personalInfo.email}</span>
              {(displayData.personalInfo.phone || displayData.personalInfo.location || displayData.personalInfo.linkedin || displayData.personalInfo.website) && <span>•</span>}
            </>
          )}
          {displayData.personalInfo.phone && (
            <>
              <span>{displayData.personalInfo.phone}</span>
              {(displayData.personalInfo.location || displayData.personalInfo.linkedin || displayData.personalInfo.website) && <span>•</span>}
            </>
          )}
          {displayData.personalInfo.location && (
            <>
              <span>{displayData.personalInfo.location}</span>
              {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && <span>•</span>}
            </>
          )}
          {displayData.personalInfo.linkedin && (
            <>
              <span>{cleanUrl(displayData.personalInfo.linkedin)}</span>
              {displayData.personalInfo.website && <span>•</span>}
            </>
          )}
          {displayData.personalInfo.website && (
            <span>{cleanUrl(displayData.personalInfo.website)}</span>
          )}
        </div>
      </div>

      {/* About Section */}
      {displayData.personalInfo.summary && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            color: '#4b5563', 
            fontSize: '15px', 
            margin: '0 0 10px 0', 
            fontWeight: '500', 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px' 
          }}>
            About
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: '#4b5563', 
              lineHeight: '1.7', 
              margin: '0', 
              fontSize: '14px', 
              fontWeight: '400'
            }}
          />
        </div>
      )}

      {/* Experience Section */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            color: '#4b5563', 
            fontSize: '15px', 
            margin: '0 0 12px 0', 
            fontWeight: '500', 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px' 
          }}>
            Experience
          </h2>
          {displayData.experiences.map((exp: Experience) => (
            <div key={exp.id} style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '2px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '500',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#9ca3af', 
                  fontSize: '12px', 
                  fontWeight: '400',
                  whiteSpace: 'nowrap'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p style={{ 
                color: '#6b7280', 
                margin: '2px 0 6px 0', 
                fontSize: '13px' 
              }}>
                {exp.company}{exp.location ? ` • ${exp.location}` : ''}
              </p>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <div style={{ 
                  color: theme.secondary, 
                  margin: '0', 
                  fontSize: '14px', 
                  lineHeight: '1.6' 
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <p key={index} style={{ margin: '0 0 4px 0' }}>
                      • {desc}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education Section */}
      {displayData.education.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            color: '#4b5563', 
            fontSize: '15px', 
            margin: '0 0 12px 0', 
            fontWeight: '500', 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px' 
          }}>
            Education
          </h2>
          {displayData.education.map((edu: Education) => (
            <div key={edu.id} style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '16px', 
                  margin: '0', 
                  fontWeight: '500',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#666666', 
                  fontSize: '12px', 
                  fontWeight: '400',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.startDate}—{edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.secondary, 
                margin: '2px 0 8px 0', 
                fontSize: '14px', 
                fontWeight: '400' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <div style={{ 
                  color: theme.secondary, 
                  margin: '0', 
                  fontSize: '14px', 
                  lineHeight: '1.6' 
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <p key={index} style={{ margin: '0 0 4px 0' }}>
                      • {achievement}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Projects Section */}
      {displayData.projects.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            color: '#4b5563', 
            fontSize: '15px', 
            margin: '0 0 12px 0', 
            fontWeight: '500', 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px' 
          }}>
            Projects
          </h2>
          {displayData.projects.map((project: Project) => (
            <div key={project.id} style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '16px', 
                  margin: '0', 
                  fontWeight: '500',
                  flex: '1 1 auto'
                }}>
                  {project.name}
                </h3>
              </div>
              {(project.link || project.github) && (
                <p style={{ 
                  color: '#4b5563', 
                  margin: '2px 0 6px 0', 
                  fontSize: '11px',
                  display: 'flex',
                  gap: '12px'
                }}>
                  {project.link && (
                    project.link.includes('.') ? (
                      <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Globe" size={10} />
                        {project.link}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Globe" size={10} />
                        {project.link}
                      </span>
                    )
                  )}
                  {project.github && (
                    project.github.includes('.') ? (
                      <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Github" size={10} />
                        {project.github}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Github" size={10} />
                        {project.github}
                      </span>
                    )
                  )}
                </p>
              )}
              {project.description && (
                <p style={{ 
                  color: theme.secondary, 
                  margin: '2px 0 6px 0', 
                  fontSize: '14px', 
                  lineHeight: '1.6',
                  textAlign: 'justify'
                }}>
                  {project.description}
                </p>
              )}
              {project.technologies.length > 0 && (
                <p style={{ 
                  color: '#666666', 
                  margin: '0', 
                  fontSize: '12px', 
                  fontStyle: 'italic',
                  lineHeight: '1.4'
                }}>
                  {project.technologies.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skills Section */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            color: '#4b5563', 
            fontSize: '15px', 
            margin: '0 0 12px 0', 
            fontWeight: '500', 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px' 
          }}>
            Skills
          </h2>
          {displayData.skills.technical.length > 0 && (
            <p style={{ 
              color: theme.secondary, 
              margin: '0 0 8px 0', 
              fontSize: '14px', 
              lineHeight: '1.6' 
            }}>
              <span style={{ fontWeight: '500', color: theme.text }}>Technical:</span> {displayData.skills.technical.join(', ')}
            </p>
          )}
          {displayData.skills.soft.length > 0 && (
            <p style={{ 
              color: theme.secondary, 
              margin: '0 0 8px 0', 
              fontSize: '14px', 
              lineHeight: '1.6' 
            }}>
              <span style={{ fontWeight: '500', color: theme.text }}>Soft Skills:</span> {displayData.skills.soft.join(', ')}
            </p>
          )}
          {displayData.skills.languages.length > 0 && (
            <p style={{ 
              color: theme.secondary, 
              margin: '0', 
              fontSize: '14px', 
              lineHeight: '1.6' 
            }}>
              <span style={{ fontWeight: '500', color: theme.text }}>Languages:</span> {displayData.skills.languages.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Certifications Section */}
      {displayData.certifications.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            color: '#4b5563', 
            fontSize: '15px', 
            margin: '0 0 12px 0', 
            fontWeight: '500', 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px' 
          }}>
            Certifications
          </h2>
          {displayData.certifications.map((cert: string, index: number) => (
            <p key={index} style={{ 
              color: theme.secondary, 
              margin: '0 0 4px 0', 
              fontSize: '14px', 
              lineHeight: '1.6' 
            }}>
              • {cert}
            </p>
          ))}
        </div>
      )}

      {/* Achievements Section */}
      {displayData.achievements.length > 0 && (
        <div>
          <h2 style={{ 
            color: '#4b5563', 
            fontSize: '15px', 
            margin: '0 0 12px 0', 
            fontWeight: '500', 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px' 
          }}>
            Achievements
          </h2>
          {displayData.achievements.map((achievement: string, index: number) => (
            <p key={index} style={{ 
              color: theme.secondary, 
              margin: '0 0 4px 0', 
              fontSize: '14px', 
              lineHeight: '1.6' 
            }}>
              • {achievement}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

// 6. Academic Template
export const renderAcademicTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original purple colors
  const theme = colors || {
    primary: '#8b5cf6',
    secondary: '#7c3aed', 
    accent: '#f9f5ff',
    text: '#1f2937',
    lightAccent: '#e5e7eb'
  };

  return (
    <div className="academic-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '30px',
      fontFamily: 'Times New Roman, serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      border: 'none',
      outline: 'none'
    }}>
      {/* Header Section */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '30px', 
        paddingBottom: '20px', 
        borderBottom: `1px solid ${theme.lightAccent}` 
      }}>
        <h1 style={{ 
          color: theme.text, 
          margin: '0', 
          fontSize: '28px', 
          fontWeight: '400', 
          letterSpacing: '0.5px',
          lineHeight: '1.2'
        }}>
          {displayData.personalInfo.fullName}
        </h1>
        <p style={{ 
          color: theme.primary, 
          margin: '8px 0 0 0', 
          fontSize: '16px', 
          fontWeight: '500' 
        }}>
          {displayData.personalInfo.title || 'Academic Professional'}
        </p>
        <p style={{ 
          color: '#6b7280', 
          margin: '6px 0 0 0', 
          fontSize: '14px', 
          fontStyle: 'italic' 
        }}>
          Research & Academic Excellence
        </p>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '20px', 
          marginTop: '15px', 
          fontSize: '13px', 
          color: '#6b7280',
          flexWrap: 'wrap',
          lineHeight: '1.4'
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </span>
          )}
        </div>
        
        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '20px', 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#6b7280',
            flexWrap: 'wrap'
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Research Interests */}
      {displayData.personalInfo.summary && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            Research Interests
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: '#374151', 
              lineHeight: '1.7', 
              margin: '0', 
              fontSize: '14px', 
              textAlign: 'justify' 
            }}
          />
        </div>
      )}

      {/* Academic Positions */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 15px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Academic Positions
          </h2>
          {displayData.experiences.map((exp: any) => (
            <div key={exp.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600', 
                  fontStyle: 'italic',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 8px 0', 
                fontSize: '14px', 
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` • ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: '#f3f4f6', 
                    color: theme.primary, 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '11px', 
                    fontWeight: '500', 
                    marginLeft: '8px',
                    fontStyle: 'normal',
                    textTransform: 'uppercase'
                  }}>
                    {exp.type}
                  </span>
                )}
              </p>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 20px', 
                  padding: '0',
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '4px', 
                      fontSize: '13px', 
                      lineHeight: '1.5'
                    }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education - Full Width */}
      {displayData.education.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
            Education
          </h3>
          {displayData.education.map((edu: any) => (
            <div key={edu.id} style={{ marginBottom: '14px' }}>
              <p style={{ 
                color: theme.text, 
                margin: '0', 
                fontSize: '15px', 
                fontWeight: '600' 
              }}>
                {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
              </p>
              <p style={{ 
                color: '#4b5563', 
                margin: '4px 0', 
                fontSize: '14px', 
                lineHeight: '1.5' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {` (${edu.endDate})`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#6b7280', 
                  margin: '4px 0 0 15px', 
                  padding: '0', 
                  fontSize: '13px',
                  listStyleType: 'disc'
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ marginBottom: '2px' }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Honors & Awards - Full Width */}
      {displayData.achievements.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            Honors & Awards
          </h3>
          {displayData.achievements.map((achievement: string, index: number) => (
            <p key={index} style={{ 
              color: '#4b5563', 
              margin: '0 0 6px 0', 
              lineHeight: '1.5', 
              fontSize: '14px' 
            }}>
              {achievement}
            </p>
          ))}
        </div>
      )}

      {/* Research Skills - Single Column */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px', 
            borderBottom: `1px solid ${theme.lightAccent}`, 
            paddingBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Research Skills
          </h2>
          {displayData.skills.technical.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ 
                color: '#374151', 
                margin: '0 0 6px 0', 
                fontSize: '15px', 
                fontWeight: '600' 
              }}>
                Technical Skills
              </h4>
              <p style={{ 
                color: '#4b5563', 
                margin: '0', 
                fontSize: '14px', 
                lineHeight: '1.5' 
              }}>
                {displayData.skills.technical.join(', ')}
              </p>
            </div>
          )}
          {displayData.skills.soft.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ 
                color: '#374151', 
                margin: '0 0 6px 0', 
                fontSize: '15px', 
                fontWeight: '600' 
              }}>
                Research Skills
              </h4>
              <p style={{ 
                color: '#4b5563', 
                margin: '0', 
                fontSize: '14px', 
                lineHeight: '1.5' 
              }}>
                {displayData.skills.soft.join(', ')}
              </p>
            </div>
          )}
          {displayData.skills.languages.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ 
                color: '#374151', 
                margin: '0 0 6px 0', 
                fontSize: '15px', 
                fontWeight: '600' 
              }}>
                Languages
              </h4>
              <p style={{ 
                color: '#4b5563', 
                margin: '0', 
                fontSize: '14px', 
                lineHeight: '1.5' 
              }}>
                {displayData.skills.languages.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Research Projects - Full Width */}
      {displayData.projects.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 10px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            Research Projects
          </h3>
          {displayData.projects.map((project: any) => (
            <div key={project.id} style={{ marginBottom: '14px' }}>
              <h4 style={{ 
                color: theme.text, 
                fontSize: '15px', 
                margin: '0 0 4px 0', 
                fontWeight: '600'
              }}>
                {project.name}
              </h4>
              {(project.link || project.github) && (
                <div style={{ 
                  display: 'flex', 
                  gap: '20px', 
                  alignItems: 'center',
                  marginBottom: '6px',
                  flexWrap: 'wrap'
                }}>
                  {project.link && (
                    project.link.includes('.') ? (
                      <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ 
                        fontSize: '12px', 
                        color: theme.primary, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        textDecoration: 'none'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                        {cleanUrl(project.link)}
                      </a>
                    ) : (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#6b7280', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                        {project.link}
                      </span>
                    )
                  )}
                  {project.github && (
                    project.github.includes('.') ? (
                      <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ 
                        fontSize: '12px', 
                        color: theme.primary, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        textDecoration: 'none'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 18l6-6-6-6"></path>
                          <path d="M8 6l-6 6 6 6"></path>
                        </svg>
                        {cleanUrl(project.github)}
                      </a>
                    ) : (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#6b7280', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 18l6-6-6-6"></path>
                          <path d="M8 6l-6 6 6 6"></path>
                        </svg>
                        {project.github}
                      </span>
                    )
                  )}
                </div>
              )}
              {project.description && (
                <p style={{ 
                  color: '#4b5563', 
                  margin: '2px 0', 
                  fontSize: '13px', 
                  lineHeight: '1.5',
                  textAlign: 'justify'
                }}>
                  {project.description}
                </p>
              )}
              {project.technologies.length > 0 && (
                <p style={{ 
                  color: '#6b7280', 
                  margin: '4px 0 0 0', 
                  fontSize: '12px', 
                  fontStyle: 'italic',
                  lineHeight: '1.4'
                }}>
                  <strong>Methods:</strong> {project.technologies.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certifications - At the End */}
      {displayData.certifications.length > 0 && (
        <div>
          <h3 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 10px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            Certifications
          </h3>
          {displayData.certifications.map((cert: string, index: number) => (
            <p key={index} style={{ 
              color: '#4b5563', 
              margin: '0 0 6px 0', 
              fontSize: '14px', 
              lineHeight: '1.5' 
            }}>
              {cert}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

// 7. Bold Template
export const renderBoldTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original red colors
  const theme = colors || {
    primary: '#ef4444',
    secondary: '#dc2626', 
    accent: '#fef2f2',
    text: '#1f2937',
    lightAccent: '#fecaca'
  };

  return (
    <div className="bold-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '25px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header Section */}
      <div style={{ marginBottom: '25px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px', 
          marginBottom: '15px',
          flexWrap: 'wrap'
        }}>
          {/* Bold Icon */}
          <div style={{ 
            width: '70px', 
            height: '70px', 
            background: displayData.personalInfo.profilePicture && 
                       typeof displayData.personalInfo.profilePicture === 'string' && 
                       displayData.personalInfo.profilePicture.trim() !== '' 
                       ? 'transparent' 
                       : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'white', 
            boxShadow: `0 4px 12px ${theme.primary}4d`,
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            {displayData.personalInfo.profilePicture && 
             typeof displayData.personalInfo.profilePicture === 'string' && 
             displayData.personalInfo.profilePicture.trim() !== '' ? (
              <img 
                src={displayData.personalInfo.profilePicture} 
                alt="Profile"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  borderRadius: '50%'
                }}
              />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
              </svg>
            )}
          </div>
          
          {/* Name and Title */}
          <div>
            <h1 style={{ 
              color: theme.text, 
              margin: '0', 
              fontSize: '28px', 
              fontWeight: '800', 
              letterSpacing: '-0.5px',
              lineHeight: '1.2',
              textTransform: 'uppercase'
            }}>
              {displayData.personalInfo.fullName}
            </h1>
            <p style={{ 
              color: theme.primary, 
              margin: '6px 0 0 0', 
              fontSize: '16px', 
              fontWeight: '700',
              textTransform: 'uppercase'
            }}>
              {displayData.personalInfo.title || 'High-Impact Professional'}
            </p>
          </div>
        </div>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '14px', 
          fontSize: '13px', 
          color: '#6b7280',
          lineHeight: '1.4'
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </span>
          )}
        </div>
        
        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '14px', 
            marginTop: '8px',
            fontSize: '13px', 
            color: '#6b7280'
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results-Driven Leadership Section */}
      {displayData.personalInfo.summary && (
        <div style={{ 
          background: theme.accent, 
          padding: '20px', 
          borderRadius: '10px', 
          marginBottom: '20px'
        }}>
          <h2 style={{ 
            color: theme.secondary, 
            fontSize: '16px', 
            margin: '0 0 10px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"></polygon>
            </svg>
            Results-Driven Leadership
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: theme.text, 
              lineHeight: '1.6', 
              margin: '0', 
              fontSize: '14px',
              textAlign: 'justify'
            }}
          />
        </div>
      )}

      {/* Key Achievements / Experience Section */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Key Achievements
          </h2>
          {displayData.experiences.map((exp: any) => (
            <div key={exp.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 6px 0', 
                fontSize: '13px', 
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` • ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: theme.secondary, 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '10px', 
                    fontWeight: '600', 
                    marginLeft: '8px',
                    textTransform: 'uppercase'
                  }}>
                    {exp.type}
                  </span>
                )}
              </p>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 18px', 
                  padding: '0',
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '4px', 
                      fontSize: '13px', 
                      lineHeight: '1.4'
                    }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education Section */}
      {displayData.education.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
            Education
          </h2>
          {displayData.education.map((edu: any) => (
            <div key={edu.id} style={{ marginBottom: '12px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.startDate} - {edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 6px 0', 
                fontSize: '13px', 
                fontWeight: '500'
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 18px', 
                  padding: '0',
                  listStyleType: 'disc'
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '2px', 
                      fontSize: '12px',
                      lineHeight: '1.4'
                    }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Core Competencies / Skills Section */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          {displayData.skills.technical.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 12px 0', 
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                Core Competencies
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {displayData.skills.technical.map((skill: string, index: number) => (
                  <span key={index} style={{ 
                    background: theme.primary, 
                    color: 'white', 
                    padding: '6px 12px', 
                    borderRadius: '6px', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    boxShadow: `0 2px 4px ${theme.primary}33`
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Leadership Skills */}
          {displayData.skills.soft.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '14px', 
                margin: '0 0 8px 0', 
                fontWeight: '700'
              }}>
                Leadership Skills
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {displayData.skills.soft.map((skill: string, index: number) => (
                  <span key={index} style={{ 
                    background: theme.accent, 
                    color: theme.secondary, 
                    padding: '4px 10px', 
                    borderRadius: '4px', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    border: `1px solid ${theme.lightAccent}`
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {displayData.skills.languages.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ 
                color: theme.primary, 
                fontSize: '14px', 
                margin: '0 0 8px 0', 
                fontWeight: '700'
              }}>
                Languages
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {displayData.skills.languages.map((skill: string, index: number) => (
                  <span key={index} style={{ 
                    background: `${theme.primary}1a`, 
                    color: theme.secondary, 
                    padding: '4px 10px', 
                    borderRadius: '4px', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    border: `1px solid ${theme.lightAccent}`
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projects Section */}
      {displayData.projects.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Impact Projects
          </h2>
          {displayData.projects.map((project: any) => (
            <div key={project.id} style={{ marginBottom: '12px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {project.name}
                </h3>
              </div>
              {(project.link || project.github) && (
                <p style={{ 
                  color: '#4b5563', 
                  margin: '2px 0 6px 0', 
                  fontSize: '11px',
                  display: 'flex',
                  gap: '12px'
                }}>
                  {project.link && (
                    project.link.includes('.') ? (
                      <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Globe" size={10} />
                        {project.link}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Globe" size={10} />
                        {project.link}
                      </span>
                    )
                  )}
                  {project.github && (
                    project.github.includes('.') ? (
                      <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Github" size={10} />
                        {project.github}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Github" size={10} />
                        {project.github}
                      </span>
                    )
                  )}
                </p>
              )}
              {project.description && (
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  lineHeight: '1.5',
                  textAlign: 'justify'
                }}>
                  {project.description}
                </p>
              )}
              {project.technologies.length > 0 && (
                <p style={{ 
                  color: '#6b7280', 
                  margin: '0', 
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  <strong>Technologies:</strong> {project.technologies.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {displayData.certifications.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            Certifications
          </h2>
          <ul style={{ 
            color: '#4b5563', 
            margin: '0 0 0 18px', 
            padding: '0',
            listStyleType: 'disc'
          }}>
            {displayData.certifications.map((cert: string, index: number) => (
              <li key={index} style={{ 
                marginBottom: '4px', 
                fontSize: '13px',
                lineHeight: '1.4'
              }}>
                {cert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Achievements */}
      {displayData.achievements.length > 0 && (
        <div>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Notable Achievements
          </h2>
          <ul style={{ 
            color: '#4b5563', 
            margin: '0 0 0 18px', 
            padding: '0',
            listStyleType: 'disc'
          }}>
            {displayData.achievements.map((achievement: string, index: number) => (
              <li key={index} style={{ 
                marginBottom: '4px', 
                fontSize: '13px',
                lineHeight: '1.4'
              }}>
                {achievement}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// 8. Elegant Template
export const renderElegantTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original indigo colors
  const theme = colors || {
    primary: '#6366f1',
    secondary: '#8b5cf6', 
    accent: '#f8fafc',
    text: '#1f2937',
    lightAccent: '#e2e8f0'
  };

  return (
    <div className="elegant-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '30px',
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000'
    }}>
      
      {/* Header Section */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '30px', 
        padding: '25px', 
        background: theme.accent, 
        borderRadius: '12px', 
        border: `1px solid ${theme.lightAccent}` 
      }}>
        <h1 style={{ 
          color: theme.text, 
          margin: '0', 
          fontSize: '28px', 
          letterSpacing: '1px', 
          fontWeight: '400',
          lineHeight: '1.2',
          textTransform: 'uppercase'
        }}>
          {displayData.personalInfo.fullName}
        </h1>
        
        {/* Decorative line */}
        <div style={{ 
          width: '60px', 
          height: '2px', 
          background: theme.primary, 
          margin: '10px auto' 
        }} />
        
        <p style={{ 
          color: theme.primary, 
          margin: '10px 0 0 0', 
          fontSize: '14px', 
          letterSpacing: '1px', 
          textTransform: 'uppercase', 
          fontWeight: '500' 
        }}>
          {displayData.personalInfo.title || 'Distinguished Professional'}
        </p>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '20px', 
          marginTop: '15px', 
          fontSize: '12px', 
          color: '#6b7280',
          flexWrap: 'wrap',
          lineHeight: '1.4'
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </span>
          )}
        </div>
        
        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '20px', 
            marginTop: '8px', 
            fontSize: '12px', 
            color: '#6b7280',
            flexWrap: 'wrap'
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expertise Section */}
      {displayData.personalInfo.summary && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            letterSpacing: '1px', 
            textTransform: 'uppercase', 
            textAlign: 'left', 
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Expertise
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: '#4b5563', 
              lineHeight: '1.7', 
              margin: '0', 
              textAlign: 'left', 
              fontStyle: 'italic', 
              fontSize: '14px' 
            }}
          />
        </div>
      )}

      {/* Distinguished Career Section */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 15px 0', 
            letterSpacing: '1px', 
            textTransform: 'uppercase', 
            textAlign: 'left', 
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Distinguished Career
          </h2>
          {displayData.experiences.map((exp: any) => (
            <div key={exp.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'baseline', 
                  gap: '8px',
                  flex: '1 1 auto',
                  minWidth: '60%',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '15px', 
                    margin: '0', 
                    fontWeight: '600',
                    textAlign: 'left'
                  }}>
                    {exp.position}
                  </h3>
                  <span style={{ 
                    color: theme.primary, 
                    fontSize: '13px', 
                    fontStyle: 'italic', 
                    fontWeight: '500'
                  }}>
                    {exp.company}{exp.location && `, ${exp.location}`}
                    {exp.type && exp.type !== 'full-time' && (
                      <span style={{ 
                        color: theme.secondary, 
                        fontSize: '11px', 
                        fontWeight: '500', 
                        marginLeft: '8px',
                        fontStyle: 'normal'
                      }}>
                        ({exp.type})
                      </span>
                    )}
                  </span>
                </div>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <div style={{ 
                  color: '#4b5563', 
                  margin: '8px 0 0 0', 
                  fontSize: '13px', 
                  textAlign: 'left'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <p key={index} style={{ margin: '0 0 4px 0' }}>
                      • {desc}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Elite Projects - Same style as Distinguished Career */}
      {displayData.projects.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 15px 0', 
            letterSpacing: '1px', 
            textTransform: 'uppercase', 
            textAlign: 'left', 
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Elite Projects
          </h2>
          {displayData.projects.map((project: any) => (
            <div key={project.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'baseline', 
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '4px'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  textAlign: 'left'
                }}>
                  {project.name}
                </h3>
                {project.technologies.length > 0 && (
                  <span style={{ 
                    color: theme.primary, 
                    fontSize: '13px', 
                    fontStyle: 'italic', 
                    fontWeight: '500'
                  }}>
                    {project.technologies.join(', ')}
                  </span>
                )}
              </div>
              {(project.link || project.github) && (
                <div style={{ 
                  display: 'flex', 
                  gap: '16px', 
                  alignItems: 'center',
                  marginBottom: '4px'
                }}>
                  {project.link && (
                    <span style={{ 
                      color: '#6b7280', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <FAIcon iconName="Globe" size={10} />
                      {project.link}
                    </span>
                  )}
                  {project.github && (
                    <span style={{ 
                      color: '#6b7280', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <FAIcon iconName="Github" size={10} />
                      {project.github}
                    </span>
                  )}
                </div>
              )}
              {project.description && (
                <div style={{ 
                  color: '#4b5563', 
                  margin: '4px 0 0 0', 
                  fontSize: '13px', 
                  textAlign: 'left'
                }}>
                  <p style={{ margin: '0 0 4px 0' }}>
                    • {project.description}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education, Skills, and Certifications Box */}
      {(displayData.education.length > 0 || displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0 || displayData.certifications.length > 0) && (
        <div style={{ 
          marginBottom: '25px', 
          padding: '25px', 
          background: theme.accent, 
          borderRadius: '12px', 
          border: `1px solid ${theme.lightAccent}` 
        }}>
          {/* Education Section */}
          {displayData.education.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 12px 0', 
                letterSpacing: '1px', 
                textTransform: 'uppercase', 
                textAlign: 'center', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                </svg>
                Education
              </h2>
              {displayData.education.map((edu: any) => (
                <div key={edu.id} style={{ textAlign: 'center', marginBottom: '12px' }}>
                  <p style={{ 
                    color: theme.text, 
                    margin: '0', 
                    fontSize: '14px', 
                    fontWeight: '600' 
                  }}>
                    {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                  </p>
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '2px 0', 
                    fontSize: '13px', 
                    fontStyle: 'italic' 
                  }}>
                    {edu.institution}
                    {edu.location && ` • ${edu.location}`}
                    {edu.gpa && ` • GPA: ${edu.gpa}`}
                    {` (${edu.startDate} - ${edu.endDate})`}
                  </p>
                  {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                    <div style={{ 
                      color: '#6b7280', 
                      margin: '4px 0', 
                      fontSize: '12px', 
                      textAlign: 'left'
                    }}>
                      {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                        <p key={index} style={{ margin: '0 0 2px 0' }}>
                          • {achievement}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Refined Skills Section */}
          {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 12px 0', 
                letterSpacing: '1px', 
                textTransform: 'uppercase', 
                textAlign: 'center', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
                </svg>
                Refined Skills
              </h2>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '15px', 
                textAlign: 'center' 
              }}>
                {displayData.skills.technical.length > 0 && (
                  <div>
                    <h4 style={{ 
                      color: '#374151', 
                      margin: '0 0 6px 0', 
                      fontSize: '13px', 
                      fontWeight: '600' 
                    }}>
                      Technical Mastery
                    </h4>
                    <p style={{ 
                      color: '#4b5563', 
                      margin: '0', 
                      fontSize: '12px', 
                      lineHeight: '1.5', 
                      fontStyle: 'italic' 
                    }}>
                      {displayData.skills.technical.join(', ')}
                    </p>
                  </div>
                )}
                {displayData.skills.soft.length > 0 && (
                  <div>
                    <h4 style={{ 
                      color: '#374151', 
                      margin: '0 0 6px 0', 
                      fontSize: '13px', 
                      fontWeight: '600' 
                    }}>
                      Soft Skills
                    </h4>
                    <p style={{ 
                      color: '#4b5563', 
                      margin: '0', 
                      fontSize: '12px', 
                      lineHeight: '1.5', 
                      fontStyle: 'italic' 
                    }}>
                      {displayData.skills.soft.join(', ')}
                    </p>
                  </div>
                )}
                {displayData.skills.languages.length > 0 && (
                  <div>
                    <h4 style={{ 
                      color: '#374151', 
                      margin: '0 0 6px 0', 
                      fontSize: '13px', 
                      fontWeight: '600' 
                    }}>
                      Languages
                    </h4>
                    <p style={{ 
                      color: '#4b5563', 
                      margin: '0', 
                      fontSize: '12px', 
                      lineHeight: '1.5', 
                      fontStyle: 'italic' 
                    }}>
                      {displayData.skills.languages.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certifications Section */}
          {displayData.certifications.length > 0 && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 12px 0', 
                letterSpacing: '1px', 
                textTransform: 'uppercase', 
                textAlign: 'center', 
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Certifications
              </h2>
              {displayData.certifications.map((cert: string, index: number) => (
                <p key={index} style={{ 
                  color: '#4b5563', 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  lineHeight: '1.4', 
                  textAlign: 'center', 
                  fontStyle: 'italic'
                }}>
                  {cert}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Honors Section */}
      {displayData.achievements.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            letterSpacing: '1px', 
            textTransform: 'uppercase', 
            textAlign: 'center', 
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            Honors
          </h2>
          {displayData.achievements.map((achievement: string, index: number) => (
            <p key={index} style={{ 
              color: '#4b5563', 
              margin: '0 0 4px 0', 
              fontSize: '12px', 
              lineHeight: '1.4', 
              textAlign: 'center', 
              fontStyle: 'italic'
            }}>
              {achievement}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

// 9. Tech Template
export const renderTechTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original cyan colors
  const theme = colors || {
    primary: '#06b6d4',
    secondary: '#0891b2', 
    accent: '#f0f9ff',
    text: '#0f172a',
    lightAccent: '#e0f2fe'
  };

  return (
    <div className="tech-template" style={{
      width: '100%',
      background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.lightAccent} 100%)`,
      padding: '25px',
      fontFamily: 'SF Pro Display, Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      margin: '0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <div style={{ 
        position: 'absolute', 
        top: '-30px', 
        right: '-30px', 
        width: '120px', 
        height: '120px', 
        background: `linear-gradient(45deg, ${theme.primary}, ${theme.secondary})`, 
        opacity: '0.1', 
        borderRadius: '50%', 
        transform: 'rotate(45deg)' 
      }} />
      
      <div style={{ position: 'relative', zIndex: '1' }}>
        {/* Header Section */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between', 
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            {/* Status Badge */}
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'white', 
              padding: '8px 16px', 
              borderRadius: '20px', 
              marginBottom: '12px', 
              boxShadow: `0 2px 8px ${theme.primary}33` 
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                background: '#10b981', 
                borderRadius: '50%' 
              }} />
              <span style={{ 
                fontSize: '12px', 
                color: '#10b981', 
                fontWeight: '600' 
              }}>
                AVAILABLE FOR OPPORTUNITIES
              </span>
            </div>
            
            <h1 style={{ 
              color: theme.text, 
              margin: '0', 
              fontSize: '32px', 
              fontWeight: '800', 
              letterSpacing: '-1px',
              lineHeight: '1.1'
            }}>
              {displayData.personalInfo.fullName}
            </h1>
            <p style={{ 
              color: theme.primary, 
              margin: '6px 0 0 0', 
              fontSize: '18px', 
              fontWeight: '600' 
            }}>
              {displayData.personalInfo.title || 'Full-Stack Engineer & Tech Lead'}
            </p>
          </div>
          
          {/* Tech Icon */}
          <div style={{ 
            width: '60px', 
            height: '60px', 
            background: displayData.personalInfo.profilePicture && 
                       typeof displayData.personalInfo.profilePicture === 'string' && 
                       displayData.personalInfo.profilePicture.trim() !== '' 
                       ? 'transparent' 
                       : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'white', 
            boxShadow: `0 4px 12px ${theme.primary}66`,
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            {displayData.personalInfo.profilePicture && 
             typeof displayData.personalInfo.profilePicture === 'string' && 
             displayData.personalInfo.profilePicture.trim() !== '' ? (
              <img 
                src={displayData.personalInfo.profilePicture} 
                alt="Profile"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  borderRadius: '12px'
                }}
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            )}
          </div>
        </div>

        {/* Contact Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '12px', 
          marginBottom: '20px', 
          fontSize: '12px', 
          color: '#475569' 
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </span>
          )}
          {displayData.personalInfo.linkedin && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
              {cleanUrl(displayData.personalInfo.linkedin)}
            </span>
          )}
          {displayData.personalInfo.website && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              {cleanUrl(displayData.personalInfo.website)}
            </span>
          )}
        </div>

        {/* Technical Profile */}
        {displayData.personalInfo.summary && (
          <div style={{ 
            background: 'white', 
            padding: '16px', 
            borderRadius: '12px', 
            marginBottom: '16px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
          }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '14px', 
              margin: '0 0 8px 0', 
              fontWeight: '700', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Technical Profile
            </h2>
            <SummaryText 
              text={displayData.personalInfo.summary}
              style={{ 
                color: '#334155', 
                lineHeight: '1.5', 
                margin: '0', 
                fontSize: '13px',
                textAlign: 'justify'
              }}
            />
          </div>
        )}

        {/* Engineering Experience */}
        {displayData.experiences.length > 0 && (
          <div style={{ 
            background: 'white', 
            padding: '16px', 
            borderRadius: '12px', 
            marginBottom: '16px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
          }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '14px', 
              margin: '0 0 10px 0', 
              fontWeight: '700', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Engineering Experience
            </h2>
            {displayData.experiences.map((exp: any) => (
              <div key={exp.id} style={{ marginBottom: '12px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline', 
                  marginBottom: '4px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '14px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto',
                    minWidth: '60%'
                  }}>
                    {exp.position}
                  </h3>
                  <span style={{ 
                    color: '#64748b', 
                    fontSize: '11px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </span>
                </div>
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0 4px 0', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  lineHeight: '1.4'
                }}>
                  {exp.company}
                  {exp.location && ` • ${exp.location}`}
                  {exp.type && exp.type !== 'full-time' && (
                    <span style={{ 
                      background: theme.secondary, 
                      color: 'white', 
                      padding: '2px 6px', 
                      borderRadius: '8px', 
                      fontSize: '9px', 
                      fontWeight: '600', 
                      marginLeft: '6px',
                      textTransform: 'uppercase'
                    }}>
                      {exp.type}
                    </span>
                  )}
                </p>
                {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                  <div style={{ 
                    color: '#475569', 
                    margin: '0', 
                    fontSize: '12px' 
                  }}>
                    {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                      <p key={index} style={{ margin: '0 0 2px 0' }}>
                        • {desc}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Education */}
        {displayData.education.length > 0 && (
          <div style={{ 
            background: 'white', 
            padding: '16px', 
            borderRadius: '12px', 
            marginBottom: '16px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
          }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '14px', 
              margin: '0 0 10px 0', 
              fontWeight: '700', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
              Education
            </h2>
            {displayData.education.map((edu: any) => (
              <div key={edu.id} style={{ marginBottom: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '13px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                  </h3>
                  <span style={{ 
                    color: '#64748b', 
                    fontSize: '11px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {edu.endDate}
                  </span>
                </div>
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0', 
                  fontSize: '12px', 
                  fontWeight: '500' 
                }}>
                  {edu.institution}
                  {edu.location && ` • ${edu.location}`}
                  {edu.gpa && ` • GPA: ${edu.gpa}`}
                </p>
                {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                  <div style={{ 
                    color: '#475569', 
                    margin: '4px 0 0 0', 
                    fontSize: '11px'
                  }}>
                    {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                      <p key={index} style={{ margin: '0 0 2px 0' }}>
                        • {achievement}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Key Projects */}
        {displayData.projects.length > 0 && (
          <div style={{ 
            background: 'white', 
            padding: '16px', 
            borderRadius: '12px', 
            marginBottom: '16px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
          }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '14px', 
              margin: '0 0 10px 0', 
              fontWeight: '700', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Key Projects
            </h2>
            {displayData.projects.map((project: any) => (
              <div key={project.id} style={{ marginBottom: '10px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '13px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {project.name}
                  </h3>
                </div>
                {(project.link || project.github) && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '2px 0 6px 0', 
                    fontSize: '11px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {project.link && (
                      project.link.includes('.') ? (
                        <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </span>
                      )
                    )}
                    {project.github && (
                      project.github.includes('.') ? (
                        <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </span>
                      )
                    )}
                  </p>
                )}
                {project.description && (
                  <p style={{ 
                    color: '#475569', 
                    margin: '2px 0', 
                    fontSize: '11px', 
                    lineHeight: '1.4',
                    textAlign: 'justify'
                  }}>
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '4px', 
                    marginTop: '4px' 
                  }}>
                    {project.technologies.slice(0, 6).map((tech: string, index: number) => (
                      <span key={index} style={{ 
                        background: theme.lightAccent, 
                        color: theme.secondary, 
                        padding: '2px 6px', 
                        borderRadius: '6px', 
                        fontSize: '9px', 
                        fontWeight: '500' 
                      }}>
                        {tech}
                      </span>
                    ))}
                    {project.technologies.length > 6 && (
                      <span style={{ 
                        color: '#64748b', 
                        fontSize: '9px', 
                        fontStyle: 'italic',
                        alignSelf: 'center'
                      }}>
                        +{project.technologies.length - 6} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tech Stack */}
        {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
          <div style={{ 
            background: 'white', 
            padding: '16px', 
            borderRadius: '12px', 
            marginBottom: '16px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
          }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '14px', 
              margin: '0 0 10px 0', 
              fontWeight: '700', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Tech Stack
            </h2>
            
            {displayData.skills.technical.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <h4 style={{ 
                  color: '#334155', 
                  fontSize: '11px', 
                  margin: '0 0 4px 0', 
                  fontWeight: '600', 
                  textTransform: 'uppercase' 
                }}>
                  Technologies
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.technical.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: theme.primary, 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: '8px', 
                      fontSize: '10px', 
                      fontWeight: '600' 
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {displayData.skills.soft.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <h4 style={{ 
                  color: '#334155', 
                  fontSize: '11px', 
                  margin: '0 0 4px 0', 
                  fontWeight: '600', 
                  textTransform: 'uppercase' 
                }}>
                  Soft Skills
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.soft.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: theme.lightAccent, 
                      color: theme.secondary, 
                      padding: '4px 8px', 
                      borderRadius: '8px', 
                      fontSize: '10px', 
                      fontWeight: '600' 
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {displayData.skills.languages.length > 0 && (
              <div>
                <h4 style={{ 
                  color: '#334155', 
                  fontSize: '11px', 
                  margin: '0 0 4px 0', 
                  fontWeight: '600', 
                  textTransform: 'uppercase' 
                }}>
                  Languages
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.languages.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: theme.accent, 
                      color: '#0369a1', 
                      padding: '4px 8px', 
                      borderRadius: '8px', 
                      fontSize: '10px', 
                      fontWeight: '600', 
                      border: `1px solid ${theme.primary}40` 
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Two Column Layout for Certifications and Achievements */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '16px' 
        }}>
          {displayData.certifications.length > 0 && (
            <div style={{ 
              background: 'white', 
              padding: '16px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
            }}>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '14px', 
                margin: '0 0 8px 0', 
                fontWeight: '700', 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Certifications
              </h2>
              {displayData.certifications.map((cert: string, index: number) => (
                <p key={index} style={{ 
                  color: '#475569', 
                  margin: '0 0 4px 0', 
                  fontSize: '11px', 
                  lineHeight: '1.4' 
                }}>
                  • {cert}
                </p>
              ))}
            </div>
          )}
          
          {displayData.achievements.length > 0 && (
            <div style={{ 
              background: 'white', 
              padding: '16px', 
              borderRadius: '12px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
            }}>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '14px', 
                margin: '0 0 8px 0', 
                fontWeight: '700', 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Achievements
              </h2>
              {displayData.achievements.map((achievement: string, index: number) => (
                <p key={index} style={{ 
                  color: '#475569', 
                  margin: '0 0 4px 0', 
                  fontSize: '11px', 
                  lineHeight: '1.4' 
                }}>
                  • {achievement}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// 10. Startup Template
export const renderStartupTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original orange colors
  const theme = colors || {
    primary: '#f97316',
    secondary: '#ea580c', 
    accent: '#fff7ed',
    text: '#1f2937',
    lightAccent: '#fed7aa'
  };

  return (
    <div className="startup-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '25px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      border: `1px solid ${theme.primary}`,
      borderRadius: '16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <div style={{ 
        position: 'absolute', 
        top: '-20px', 
        right: '-20px', 
        width: '80px', 
        height: '80px', 
        background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
        opacity: '0.1', 
        borderRadius: '50%' 
      }} />
      
      <div style={{ position: 'relative', zIndex: '1' }}>
        {/* Header Section */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h1 style={{ 
              color: theme.text, 
              margin: '0', 
              fontSize: '28px', 
              fontWeight: '800', 
              letterSpacing: '-0.5px',
              lineHeight: '1.1',
              textTransform: 'uppercase'
            }}>
              {displayData.personalInfo.fullName}
            </h1>
            <p style={{ 
              color: theme.primary, 
              margin: '6px 0 0 0', 
              fontSize: '16px', 
              fontWeight: '700',
              textTransform: 'uppercase'
            }}>
              {displayData.personalInfo.title || 'Startup Founder & CEO'}
            </p>
            
            {/* Contact Info */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '12px', 
              marginTop: '8px', 
              fontSize: '12px', 
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              {displayData.personalInfo.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  {displayData.personalInfo.email}
                </span>
              )}
              {displayData.personalInfo.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  {displayData.personalInfo.phone}
                </span>
              )}
              {displayData.personalInfo.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {displayData.personalInfo.location}
                </span>
              )}
            </div>
            
            {/* Social Links */}
            {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '12px', 
                marginTop: '4px', 
                fontSize: '12px', 
                color: '#6b7280'
              }}>
                {displayData.personalInfo.linkedin && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                      <rect x="2" y="9" width="4" height="12"></rect>
                      <circle cx="4" cy="4" r="2"></circle>
                    </svg>
                    {cleanUrl(displayData.personalInfo.linkedin)}
                  </span>
                )}
                {displayData.personalInfo.website && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    {cleanUrl(displayData.personalInfo.website)}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Startup Rocket Icon */}
            <div style={{ 
              width: '70px', 
              height: '70px', 
              background: displayData.personalInfo.profilePicture && 
                         typeof displayData.personalInfo.profilePicture === 'string' && 
                         displayData.personalInfo.profilePicture.trim() !== '' 
                         ? 'transparent' 
                         : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              boxShadow: `0 4px 12px ${theme.primary}33`,
              flexShrink: 0,
              overflow: 'hidden'
            }}>
              {displayData.personalInfo.profilePicture && 
               typeof displayData.personalInfo.profilePicture === 'string' && 
               displayData.personalInfo.profilePicture.trim() !== '' ? (
                <img 
                  src={displayData.personalInfo.profilePicture} 
                  alt="Profile"
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }}
                />
              ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              )}
            </div>
        </div>

        {/* Mission Statement */}
        {displayData.personalInfo.summary && (
          <div style={{ 
            background: theme.accent, 
            padding: '18px', 
            borderRadius: '12px', 
            marginBottom: '20px', 
            borderLeft: `4px solid ${theme.primary}` 
          }}>
            <h2 style={{ 
              color: theme.secondary, 
              fontSize: '16px', 
              margin: '0 0 10px 0', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
              </svg>
              Mission Statement
            </h2>
            <SummaryText 
              text={displayData.personalInfo.summary}
              style={{ 
                color: theme.text, 
                lineHeight: '1.6', 
                margin: '0', 
                fontSize: '14px',
                textAlign: 'justify'
              }}
            />
          </div>
        )}

        {/* Startup Journey */}
        {displayData.experiences.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 12px 0', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Startup Journey
            </h2>
            {displayData.experiences.map((exp: any) => (
              <div key={exp.id} style={{ marginBottom: '12px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline', 
                  marginBottom: '4px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '15px', 
                    margin: '0', 
                    fontWeight: '700',
                    flex: '1 1 auto',
                    minWidth: '60%'
                  }}>
                    {exp.position}
                  </h3>
                  <span style={{ 
                    color: '#6b7280', 
                    fontSize: '12px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </span>
                </div>
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600',
                  lineHeight: '1.4'
                }}>
                  {exp.company}
                  {exp.location && ` • ${exp.location}`}
                  {exp.type && exp.type !== 'full-time' && (
                    <span style={{ 
                      background: theme.secondary, 
                      color: 'white', 
                      padding: '2px 6px', 
                      borderRadius: '8px', 
                      fontSize: '10px', 
                      fontWeight: '600', 
                      marginLeft: '8px',
                      textTransform: 'uppercase'
                    }}>
                      {exp.type}
                    </span>
                  )}
                </p>
                {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                  <ul style={{ 
                    color: '#4b5563', 
                    margin: '0 0 0 18px', 
                    padding: '0', 
                    fontSize: '13px',
                    listStyleType: 'disc'
                  }}>
                    {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                      <li key={index} style={{ marginBottom: '2px' }}>
                        {desc}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Education */}
        {displayData.education.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 12px 0', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
              Education
            </h2>
            {displayData.education.map((edu: any) => (
              <div key={edu.id} style={{ marginBottom: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '14px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                  </h3>
                  <span style={{ 
                    color: '#6b7280', 
                    fontSize: '12px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {edu.endDate}
                  </span>
                </div>
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0', 
                  fontSize: '13px', 
                  fontWeight: '500' 
                }}>
                  {edu.institution}
                  {edu.location && ` • ${edu.location}`}
                  {edu.gpa && ` • GPA: ${edu.gpa}`}
                </p>
                {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                  <ul style={{ 
                    color: '#4b5563', 
                    margin: '4px 0 0 18px', 
                    padding: '0',
                    listStyleType: 'disc'
                  }}>
                    {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                      <li key={index} style={{ 
                        marginBottom: '2px', 
                        fontSize: '12px',
                        lineHeight: '1.4'
                      }}>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Key Projects */}
        {displayData.projects.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 12px 0', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
              </svg>
              Key Projects
            </h2>
            {displayData.projects.map((project: any) => (
              <div key={project.id} style={{ marginBottom: '10px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '14px', 
                    margin: '0 0 4px 0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {project.name}
                  </h3>
                </div>
                {(project.link || project.github) && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '2px 0 6px 0', 
                    fontSize: '11px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {project.link && (
                      project.link.includes('.') ? (
                        <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </span>
                      )
                    )}
                    {project.github && (
                      project.github.includes('.') ? (
                        <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </span>
                      )
                    )}
                  </p>
                )}
                {project.description && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    lineHeight: '1.4',
                    textAlign: 'justify'
                  }}>
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <p style={{ 
                    color: '#6b7280', 
                    margin: '0', 
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}>
                    <strong>Tech:</strong> {project.technologies.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Core Skills */}
        {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 12px 0', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
              </svg>
              Core Skills
            </h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '12px' 
            }}>
              {displayData.skills.technical.length > 0 && (
                <div>
                  <h4 style={{ 
                    color: theme.text, 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    fontWeight: '600' 
                  }}>
                    Technical
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {displayData.skills.technical.slice(0, 6).map((skill: string, index: number) => (
                      <span key={index} style={{ 
                        background: theme.primary, 
                        color: 'white', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontSize: '10px', 
                        fontWeight: '600' 
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {displayData.skills.soft.length > 0 && (
                <div>
                  <h4 style={{ 
                    color: theme.text, 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    fontWeight: '600' 
                  }}>
                    Leadership
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {displayData.skills.soft.slice(0, 6).map((skill: string, index: number) => (
                      <span key={index} style={{ 
                        background: theme.accent, 
                        color: theme.secondary, 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontSize: '10px', 
                        fontWeight: '600', 
                        border: `1px solid ${theme.lightAccent}`
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {displayData.skills.languages.length > 0 && (
                <div>
                  <h4 style={{ 
                    color: theme.text, 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    fontWeight: '600' 
                  }}>
                    Languages
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {displayData.skills.languages.slice(0, 4).map((skill: string, index: number) => (
                      <span key={index} style={{ 
                        background: theme.lightAccent, 
                        color: theme.secondary, 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontSize: '10px', 
                        fontWeight: '600' 
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Two Column Layout for Certifications and Achievements */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px' 
        }}>
          {displayData.certifications.length > 0 && (
            <div>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 10px 0', 
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Certifications
              </h2>
              <ul style={{ 
                color: '#4b5563', 
                margin: '0 0 0 20px', 
                padding: '0',
                listStyleType: 'disc'
              }}>
                {displayData.certifications.map((cert: string, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '4px', 
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    {cert}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {displayData.achievements.length > 0 && (
            <div>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 10px 0', 
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Achievements
              </h2>
              <ul style={{ 
                color: '#4b5563', 
                margin: '0 0 0 20px', 
                padding: '0',
                listStyleType: 'disc'
              }}>
                {displayData.achievements.map((achievement: string, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '4px', 
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    {achievement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 11. Consulting Template
export const renderConsultingTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original teal colors
  const theme = colors || {
    primary: '#0d9488',
    secondary: '#14b8a6', 
    accent: '#f8fafc',
    text: '#1f2937',
    lightAccent: '#f0f9ff'
  };

  return (
    <div className="consulting-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '25px',
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000'
    }}>
      {/* Header Section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '25px', 
        paddingBottom: '20px', 
        borderBottom: `2px solid ${theme.lightAccent}`,
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ flex: '1', minWidth: '250px' }}>
          <h1 style={{ 
            color: theme.text, 
            margin: '0', 
            fontSize: '28px', 
            fontWeight: '600',
            lineHeight: '1.2'
          }}>
            {displayData.personalInfo.fullName}
          </h1>
          <p style={{ 
            color: theme.primary, 
            margin: '8px 0 4px 0', 
            fontSize: '16px', 
            fontWeight: '600' 
          }}>
            {displayData.personalInfo.title || 'Senior Management Consultant'}
          </p>
          <p style={{ 
            color: '#6b7280', 
            margin: '0', 
            fontSize: '14px' 
          }}>
            Strategic Business Professional
          </p>
        </div>
        
        {/* Contact Information */}
        <div style={{ 
          textAlign: 'right', 
          color: '#6b7280', 
          fontSize: '12px',
          flexShrink: 0,
          minWidth: '200px'
        }}>
          {displayData.personalInfo.email && (
            <p style={{ 
              margin: '2px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              justifyContent: 'flex-end' 
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </p>
          )}
          {displayData.personalInfo.phone && (
            <p style={{ 
              margin: '2px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              justifyContent: 'flex-end' 
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </p>
          )}
          {displayData.personalInfo.location && (
            <p style={{ 
              margin: '2px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              justifyContent: 'flex-end' 
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </p>
          )}
          {displayData.personalInfo.linkedin && (
            <p style={{ 
              margin: '2px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              justifyContent: 'flex-end' 
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
              {cleanUrl(displayData.personalInfo.linkedin)}
            </p>
          )}
          {displayData.personalInfo.website && (
            <p style={{ 
              margin: '2px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              justifyContent: 'flex-end' 
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              {cleanUrl(displayData.personalInfo.website)}
            </p>
          )}
        </div>
      </div>

      {/* Core Competencies */}
      {displayData.personalInfo.summary && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Core Competencies
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: '#4b5563', 
              lineHeight: '1.7', 
              margin: '0', 
              fontSize: '14px',
              textAlign: 'justify'
            }}
          />
        </div>
      )}

      {/* Professional Experience */}
      {displayData.experiences.length > 0 && (
        <div style={{ 
          background: theme.accent, 
          padding: '20px', 
          borderRadius: '8px', 
          borderLeft: `3px solid ${theme.primary}`, 
          marginBottom: '25px' 
        }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 15px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Professional Experience
          </h2>
          {displayData.experiences.map((exp: any) => (
            <div key={exp.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 8px 0', 
                fontSize: '14px', 
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` • ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: theme.secondary, 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    fontSize: '11px', 
                    fontWeight: '500', 
                    marginLeft: '8px',
                    textTransform: 'uppercase'
                  }}>
                    {exp.type}
                  </span>
                )}
              </p>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  fontSize: '13px', 
                  margin: '0 0 0 18px', 
                  padding: '0',
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ 
                      margin: '2px 0', 
                      lineHeight: '1.5'
                    }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {displayData.education.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
            Education
          </h2>
          {displayData.education.map((edu: any) => (
            <div key={edu.id} style={{ marginBottom: '12px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.startDate} - {edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0', 
                fontSize: '14px', 
                fontWeight: '500' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#6b7280', 
                  margin: '4px 0 0 18px', 
                  padding: '0', 
                  fontSize: '12px',
                  listStyleType: 'disc'
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ marginBottom: '2px' }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Key Skills */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Key Skills
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '15px' 
          }}>
            {displayData.skills.technical.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600' 
                }}>
                  Technical Skills
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '14px', 
                  lineHeight: '1.5' 
                }}>
                  {displayData.skills.technical.join(' • ')}
                </p>
              </div>
            )}
            {displayData.skills.soft.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600' 
                }}>
                  Leadership Skills
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '14px', 
                  lineHeight: '1.5' 
                }}>
                  {displayData.skills.soft.join(' • ')}
                </p>
              </div>
            )}
            {displayData.skills.languages.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600' 
                }}>
                  Languages
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '14px', 
                  lineHeight: '1.5' 
                }}>
                  {displayData.skills.languages.join(' • ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two Column Layout for Projects, Certifications, and Achievements */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '25px' 
      }}>
        {/* Key Projects */}
        {displayData.projects.length > 0 && (
          <div>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 12px 0', 
              fontWeight: '600', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Key Projects
            </h2>
            {displayData.projects.map((project: any) => (
              <div key={project.id} style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '4px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '14px', 
                    margin: '0 0 4px 0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {project.name}
                  </h3>
                </div>
                {(project.link || project.github) && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '2px 0 6px 0', 
                    fontSize: '11px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {project.link && (
                      project.link.includes('.') ? (
                        <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </span>
                      )
                    )}
                    {project.github && (
                      project.github.includes('.') ? (
                        <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </span>
                      )
                    )}
                  </p>
                )}
                {project.description && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '0 0 4px 0', 
                    fontSize: '13px', 
                    lineHeight: '1.4',
                    textAlign: 'justify'
                  }}>
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <p style={{ 
                    color: '#6b7280', 
                    margin: '0', 
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    <strong>Technologies:</strong> {project.technologies.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Achievements Column */}
        {displayData.achievements.length > 0 && (
          <div>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 12px 0', 
              fontWeight: '600', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              Achievements
            </h2>
            <ul style={{ 
              color: '#4b5563', 
              margin: '0 0 0 18px', 
              padding: '0',
              listStyleType: 'disc'
            }}>
              {displayData.achievements.map((achievement: string, index: number) => (
                <li key={index} style={{ 
                  marginBottom: '4px', 
                  fontSize: '13px', 
                  lineHeight: '1.4'
                }}>
                  {achievement}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Certifications - At the bottom */}
      {displayData.certifications.length > 0 && (
        <div style={{ marginTop: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            Certifications
          </h2>
          <ul style={{ 
            color: '#4b5563', 
            margin: '0 0 0 18px', 
            padding: '0',
            listStyleType: 'disc'
          }}>
            {displayData.certifications.map((cert: string, index: number) => (
              <li key={index} style={{ 
                marginBottom: '4px', 
                fontSize: '13px', 
                lineHeight: '1.4'
              }}>
                {cert}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// 12. Medical Template
export const renderMedicalTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original green colors
  const theme = colors || {
    primary: '#059669',
    secondary: '#10b981', 
    accent: '#f0fdf4',
    text: '#1f2937',
    lightAccent: '#d1fae5'
  };

  return (
    <div className="medical-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '30px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000'
    }}>
      {/* Header Section */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '25px', 
        paddingBottom: '20px', 
        borderBottom: `2px solid ${theme.lightAccent}` 
      }}>
        {/* Medical Symbol */}
        <div style={{ 
          width: '80px', 
          height: '80px', 
          background: displayData.personalInfo.profilePicture && 
                     typeof displayData.personalInfo.profilePicture === 'string' && 
                     displayData.personalInfo.profilePicture.trim() !== '' 
                     ? 'transparent' 
                     : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
          borderRadius: '50%', 
          margin: '0 auto 15px auto', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white', 
          boxShadow: `0 4px 12px ${theme.primary}33`,
          overflow: 'hidden'
        }}>
          {displayData.personalInfo.profilePicture && 
           typeof displayData.personalInfo.profilePicture === 'string' && 
           displayData.personalInfo.profilePicture.trim() !== '' ? (
            <img 
              src={displayData.personalInfo.profilePicture} 
              alt="Profile"
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                borderRadius: '50%'
              }}
            />
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          )}
        </div>
        
        <h1 style={{ 
          color: theme.text, 
          margin: '0', 
          fontSize: '28px', 
          fontWeight: '700',
          lineHeight: '1.2'
        }}>
          Dr. {displayData.personalInfo.fullName}
        </h1>
        <p style={{ 
          color: theme.primary, 
          margin: '8px 0 0 0', 
          fontSize: '16px', 
          fontWeight: '600' 
        }}>
          {displayData.personalInfo.title || 'Medical Professional'}
        </p>
        <p style={{ 
          color: '#6b7280', 
          margin: '8px 0 0 0', 
          fontSize: '14px' 
        }}>
          Healthcare Excellence • Patient-Centered Care
        </p>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '16px', 
          marginTop: '15px', 
          fontSize: '13px', 
          color: '#6b7280',
          flexWrap: 'wrap',
          lineHeight: '1.4'
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </span>
          )}
        </div>
        
        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '16px', 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#6b7280',
            flexWrap: 'wrap'
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Medical Expertise */}
      {displayData.personalInfo.summary && (
        <div style={{ 
          background: theme.accent, 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px', 
          borderLeft: `4px solid ${theme.primary}` 
        }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Medical Expertise
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: theme.text, 
              lineHeight: '1.6', 
              margin: '0', 
              fontSize: '14px',
              textAlign: 'justify'
            }}
          />
        </div>
      )}

      {/* Professional Experience */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 15px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Professional Experience
          </h2>
          {displayData.experiences.map((exp: any) => (
            <div key={exp.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '16px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 6px 0', 
                fontSize: '14px', 
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` • ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: theme.secondary, 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '8px', 
                    fontSize: '10px', 
                    fontWeight: '500', 
                    marginLeft: '8px',
                    textTransform: 'uppercase'
                  }}>
                    {exp.type}
                  </span>
                )}
              </p>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 18px', 
                  padding: '0', 
                  fontSize: '14px',
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '4px', 
                      lineHeight: '1.5'
                    }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Medical Education */}
      {displayData.education.length > 0 && (
        <div style={{ 
          background: theme.accent, 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
            Medical Education
          </h2>
          {displayData.education.map((edu: any) => (
            <div key={edu.id} style={{ marginBottom: '12px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.startDate} - {edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0', 
                fontSize: '13px', 
                fontWeight: '500' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#6b7280', 
                  margin: '4px 0 0 15px', 
                  padding: '0', 
                  fontSize: '12px',
                  listStyleType: 'disc'
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ marginBottom: '2px' }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Medical Skills */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Medical Skills
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minWidth(200px, 1fr))', 
            gap: '15px' 
          }}>
            {displayData.skills.technical.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600' 
                }}>
                  Clinical Skills
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '12px', 
                  lineHeight: '1.5' 
                }}>
                  {displayData.skills.technical.join(', ')}
                </p>
              </div>
            )}
            {displayData.skills.soft.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600' 
                }}>
                  Patient Care
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '12px', 
                  lineHeight: '1.5' 
                }}>
                  {displayData.skills.soft.join(', ')}
                </p>
              </div>
            )}
            {displayData.skills.languages.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600' 
                }}>
                  Languages
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '12px', 
                  lineHeight: '1.5' 
                }}>
                  {displayData.skills.languages.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two Column Layout for Projects and Achievements */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px' 
      }}>
        {/* Medical Projects */}
        {displayData.projects.length > 0 && (
          <div>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 10px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              Medical Projects
            </h2>
            {displayData.projects.map((project: any) => (
              <div key={project.id} style={{ marginBottom: '10px' }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '14px', 
                  margin: '0 0 4px 0', 
                  fontWeight: '600'
                }}>
                  {project.name}
                </h3>
                {(project.link || project.github) && (
                  <p style={{ 
                    color: theme.primary, 
                    margin: '2px 0 4px 0', 
                    fontSize: '11px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {project.link && (
                      project.link.includes('.') ? (
                        <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                          </svg>
                          {project.link}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                          </svg>
                          {project.link}
                        </span>
                      )
                    )}
                    {project.github && (
                      project.github.includes('.') ? (
                        <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                          </svg>
                          {project.github}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                          </svg>
                          {project.github}
                        </span>
                      )
                    )}
                  </p>
                )}
                {project.description && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    lineHeight: '1.4',
                    textAlign: 'justify'
                  }}>
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <p style={{ 
                    color: '#6b7280', 
                    margin: '0', 
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}>
                    <strong>Methods:</strong> {project.technologies.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Achievements Column */}
        {displayData.achievements.length > 0 && (
          <div>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 10px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              Achievements
            </h2>
            <ul style={{ 
              color: '#4b5563', 
              margin: '0 0 0 20px', 
              padding: '0',
              listStyleType: 'disc'
            }}>
              {displayData.achievements.map((achievement: string, index: number) => (
                <li key={index} style={{ 
                  marginBottom: '4px', 
                  fontSize: '13px',
                  lineHeight: '1.4'
                }}>
                  {achievement}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Certifications - At the bottom */}
      {displayData.certifications.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 10px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            Certifications
          </h2>
          <ul style={{ 
            color: '#4b5563', 
            margin: '0 0 0 20px', 
            padding: '0',
            listStyleType: 'disc'
          }}>
            {displayData.certifications.map((cert: string, index: number) => (
              <li key={index} style={{ 
                marginBottom: '4px', 
                fontSize: '13px',
                lineHeight: '1.4'
              }}>
                {cert}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// 13. Finance Template
export const renderFinanceTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original blue colors
  const theme = colors || {
    primary: '#1e40af',
    secondary: '#1d4ed8', 
    accent: '#eff6ff',
    text: '#1f2937',
    lightAccent: '#bfdbfe'
  };

  return (
    <div className="finance-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '30px',
      fontFamily: 'Times New Roman, serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      border: `3px solid ${theme.primary}`
    }}>
      {/* Header Section */}
      <div style={{ 
        textAlign: 'center', 
        borderBottom: `2px solid ${theme.primary}`, 
        paddingBottom: '25px', 
        marginBottom: '30px' 
      }}>
        <h1 style={{ 
          color: theme.primary, 
          margin: '0', 
          fontSize: '32px', 
          fontWeight: '700', 
          letterSpacing: '1px',
          lineHeight: '1.1',
          textTransform: 'uppercase'
        }}>
          {displayData.personalInfo.fullName}
        </h1>
        <p style={{ 
          color: theme.text, 
          margin: '8px 0 0 0', 
          fontSize: '18px', 
          fontWeight: '600',
          textTransform: 'uppercase'
        }}>
          {displayData.personalInfo.title || 'Investment Banking Director'}
        </p>
        <p style={{ 
          color: '#6b7280', 
          margin: '8px 0 0 0', 
          fontSize: '14px' 
        }}>
          Financial Excellence • Strategic Investment • Risk Management
        </p>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '20px', 
          marginTop: '15px', 
          fontSize: '13px', 
          color: '#6b7280',
          flexWrap: 'wrap',
          lineHeight: '1.4'
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </span>
          )}
        </div>
        
        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '20px', 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#6b7280',
            flexWrap: 'wrap'
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Financial Expertise */}
      {displayData.personalInfo.summary && (
        <div style={{ 
          background: theme.accent, 
          padding: '25px', 
          borderRadius: '8px', 
          marginBottom: '25px', 
          border: `1px solid ${theme.lightAccent}` 
        }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 15px 0', 
            fontWeight: '700', 
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Financial Expertise
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: theme.text, 
              lineHeight: '1.7', 
              margin: '0', 
              textAlign: 'justify', 
              fontSize: '14px' 
            }}
          />
        </div>
      )}

      {/* Professional Experience */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 15px 0', 
            fontWeight: '700', 
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Professional Experience
          </h2>
          {displayData.experiences.map((exp: any) => (
            <div key={exp.id} style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '6px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '16px', 
                  margin: '0', 
                  fontWeight: '700',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '14px', 
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 8px 0', 
                fontSize: '15px', 
                fontWeight: '600',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` • ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: theme.secondary, 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '11px', 
                    fontWeight: '600', 
                    marginLeft: '8px',
                    textTransform: 'uppercase'
                  }}>
                    {exp.type}
                  </span>
                )}
              </p>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 20px', 
                  padding: '0', 
                  fontSize: '14px',
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '4px', 
                      lineHeight: '1.6'
                    }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {displayData.education.length > 0 && (
        <div style={{ 
          background: theme.accent, 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '25px' 
        }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 15px 0', 
            fontWeight: '700', 
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
            Education
          </h2>
          {displayData.education.map((edu: any) => (
            <div key={edu.id} style={{ marginBottom: '12px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.startDate} - {edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0', 
                fontSize: '14px', 
                fontWeight: '500' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#6b7280', 
                  margin: '4px 0 0 18px', 
                  padding: '0', 
                  fontSize: '12px',
                  listStyleType: 'disc'
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ marginBottom: '2px' }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Core Competencies */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '700', 
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Core Competencies
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '15px' 
          }}>
            {displayData.skills.technical.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  textTransform: 'uppercase' 
                }}>
                  Technical Skills
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '15px', 
                  lineHeight: '1.6' 
                }}>
                  {displayData.skills.technical.join(' • ')}
                </p>
              </div>
            )}
            {displayData.skills.soft.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  textTransform: 'uppercase' 
                }}>
                  Leadership Skills
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '15px', 
                  lineHeight: '1.6' 
                }}>
                  {displayData.skills.soft.join(' • ')}
                </p>
              </div>
            )}
            {displayData.skills.languages.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.text, 
                  margin: '0 0 6px 0', 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  textTransform: 'uppercase' 
                }}>
                  Languages
                </h4>
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0', 
                  fontSize: '15px', 
                  lineHeight: '1.6' 
                }}>
                  {displayData.skills.languages.join(' • ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two Column Layout for Projects, Certifications, and Achievements */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '25px' 
      }}>
        {/* Key Projects */}
        {displayData.projects.length > 0 && (
          <div>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 12px 0', 
              fontWeight: '700', 
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Key Projects
            </h2>
            {displayData.projects.map((project: any) => (
              <div key={project.id} style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '4px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '14px', 
                    margin: '0 0 4px 0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {project.name}
                  </h3>
                </div>
                {(project.link || project.github) && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '2px 0 6px 0', 
                    fontSize: '11px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {project.link && (
                      project.link.includes('.') ? (
                        <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </span>
                      )
                    )}
                    {project.github && (
                      project.github.includes('.') ? (
                        <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </span>
                      )
                    )}
                  </p>
                )}
                {project.description && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '0', 
                    fontSize: '13px', 
                    lineHeight: '1.5',
                    textAlign: 'justify'
                  }}>
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <p style={{ 
                    color: '#6b7280', 
                    margin: '4px 0 0 0', 
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    <strong>Technologies:</strong> {project.technologies.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certifications and Achievements Column */}
        <div>
          {displayData.certifications.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '18px', 
                margin: '0 0 12px 0', 
                fontWeight: '700', 
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Certifications
              </h2>
              <ul style={{ 
                color: '#4b5563', 
                margin: '0 0 0 20px', 
                padding: '0',
                listStyleType: 'disc'
              }}>
                {displayData.certifications.map((cert: string, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '4px', 
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}>
                    {cert}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {displayData.achievements.length > 0 && (
            <div>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '18px', 
                margin: '0 0 12px 0', 
                fontWeight: '700', 
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Achievements
              </h2>
              <ul style={{ 
                color: '#4b5563', 
                margin: '0 0 0 20px', 
                padding: '0',
                listStyleType: 'disc'
              }}>
                {displayData.achievements.map((achievement: string, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '4px', 
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}>
                    {achievement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// 14. Marketing Template
export const renderMarketingTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original orange colors
  const theme = colors || {
    primary: '#c2410c',
    secondary: '#9a3412', 
    accent: '#fff7ed',
    text: '#1f2937',
    lightAccent: '#fed7aa'
  };

  return (
    <div className="marketing-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '25px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      borderRadius: '12px',
      border: '1px solid #f3f4f6'
    }}>
      {/* Header Section */}
      <div style={{ marginBottom: '25px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px', 
          marginBottom: '15px',
          flexWrap: 'wrap'
        }}>
          {/* Marketing Chart Icon */}
          <div style={{ 
            width: '70px', 
            height: '70px', 
            background: displayData.personalInfo.profilePicture && 
                       typeof displayData.personalInfo.profilePicture === 'string' && 
                       displayData.personalInfo.profilePicture.trim() !== '' 
                       ? 'transparent' 
                       : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'white', 
            boxShadow: `0 4px 12px ${theme.primary}33`,
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            {displayData.personalInfo.profilePicture && 
             typeof displayData.personalInfo.profilePicture === 'string' && 
             displayData.personalInfo.profilePicture.trim() !== '' ? (
              <img 
                src={displayData.personalInfo.profilePicture} 
                alt="Profile"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  borderRadius: '50%'
                }}
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
            )}
          </div>
          
          {/* Name and Title */}
          <div>
            <h1 style={{ 
              color: theme.text, 
              margin: '0', 
              fontSize: '28px', 
              fontWeight: '800', 
              letterSpacing: '-0.5px',
              lineHeight: '1.2',
              textTransform: 'uppercase'
            }}>
              {displayData.personalInfo.fullName}
            </h1>
            <p style={{ 
              color: theme.primary, 
              margin: '6px 0 0 0', 
              fontSize: '16px', 
              fontWeight: '700',
              textTransform: 'uppercase'
            }}>
              {displayData.personalInfo.title || 'Digital Marketing Specialist'}
            </p>
          </div>
        </div>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '14px', 
          fontSize: '13px', 
          color: '#6b7280',
          lineHeight: '1.4'
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </span>
          )}
        </div>
        
        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '14px', 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#6b7280'
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Growth Catalyst Section */}
      {displayData.personalInfo.summary && (
        <div style={{ 
          background: theme.accent, 
          padding: '20px', 
          borderRadius: '10px', 
          marginBottom: '20px', 
          borderLeft: `4px solid ${theme.primary}` 
        }}>
          <h2 style={{ 
            color: theme.secondary, 
            fontSize: '16px', 
            margin: '0 0 10px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Growth Catalyst
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: theme.text, 
              lineHeight: '1.6', 
              margin: '0', 
              fontSize: '14px',
              textAlign: 'justify'
            }}
          />
        </div>
      )}

      {/* Growth Achievements */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Growth Achievements
          </h2>
          {displayData.experiences.map((exp: any) => (
            <div key={exp.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 6px 0', 
                fontSize: '13px', 
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` • ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: theme.secondary, 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '8px', 
                    fontSize: '10px', 
                    fontWeight: '600', 
                    marginLeft: '8px',
                    textTransform: 'uppercase'
                  }}>
                    {exp.type}
                  </span>
                )}
              </p>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '0 0 0 18px', 
                  padding: '0', 
                  fontSize: '13px',
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ marginBottom: '2px' }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {displayData.education.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
            Education
          </h2>
          {displayData.education.map((edu: any) => (
            <div key={edu.id} style={{ marginBottom: '10px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '14px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0', 
                fontSize: '13px', 
                fontWeight: '500' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '4px 0 0 18px', 
                  padding: '0',
                  listStyleType: 'disc'
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '2px', 
                      fontSize: '12px',
                      lineHeight: '1.4'
                    }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Marketing Stack */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ 
          background: theme.accent, 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 10px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Marketing Stack
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '12px' 
          }}>
            {displayData.skills.technical.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  fontWeight: '600' 
                }}>
                  Technical
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.technical.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: theme.primary, 
                      color: 'white', 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: '500' 
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {displayData.skills.soft.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  fontWeight: '600' 
                }}>
                  Soft Skills
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.soft.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: theme.lightAccent, 
                      color: theme.secondary, 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: '500', 
                      border: `1px solid ${theme.primary}40`
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {displayData.skills.languages.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  fontWeight: '600' 
                }}>
                  Languages
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.languages.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: `${theme.primary}20`, 
                      color: theme.secondary, 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: '500',
                      border: `1px solid ${theme.primary}40`
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Campaign Highlights */}
      {displayData.projects.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 12px 0', 
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Campaign Highlights
          </h2>
          {displayData.projects.map((project: any) => (
            <div key={project.id} style={{ marginBottom: '10px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '14px', 
                  margin: '0 0 4px 0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {project.name}
                </h3>
              </div>
              {(project.link || project.github) && (
                <p style={{ 
                  color: '#4b5563', 
                  margin: '2px 0 6px 0', 
                  fontSize: '11px',
                  display: 'flex',
                  gap: '12px'
                }}>
                  {project.link && (
                    project.link.includes('.') ? (
                      <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Globe" size={10} />
                        {project.link}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Globe" size={10} />
                        {project.link}
                      </span>
                    )
                  )}
                  {project.github && (
                    project.github.includes('.') ? (
                      <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                        <FAIcon iconName="Github" size={10} />
                        {project.github}
                      </a>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                        <FAIcon iconName="Github" size={10} />
                        {project.github}
                      </span>
                    )
                  )}
                </p>
              )}
              {project.description && (
                <p style={{ 
                  color: '#4b5563', 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  lineHeight: '1.4',
                  textAlign: 'justify'
                }}>
                  {project.description}
                </p>
              )}
              {project.technologies.length > 0 && (
                <p style={{ 
                  color: '#6b7280', 
                  margin: '0', 
                  fontSize: '11px',
                  lineHeight: '1.4'
                }}>
                  <strong>Tools:</strong> {project.technologies.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Two Column Layout for Certifications and Achievements */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px' 
      }}>
        {displayData.certifications.length > 0 && (
          <div>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 10px 0', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              Certifications
            </h2>
            <ul style={{ 
              color: '#4b5563', 
              margin: '0 0 0 20px', 
              padding: '0',
              listStyleType: 'disc'
            }}>
              {displayData.certifications.map((cert: string, index: number) => (
                <li key={index} style={{ 
                  marginBottom: '4px', 
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  {cert}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {displayData.achievements.length > 0 && (
          <div>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 10px 0', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              Achievements
            </h2>
            <ul style={{ 
              color: '#4b5563', 
              margin: '0 0 0 20px', 
              padding: '0',
              listStyleType: 'disc'
            }}>
              {displayData.achievements.map((achievement: string, index: number) => (
                <li key={index} style={{ 
                  marginBottom: '4px', 
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  {achievement}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// 15. Data Template
export const renderDataTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original purple colors
  const theme = colors || {
    primary: '#7c3aed',
    secondary: '#581c87', 
    accent: '#faf5ff',
    text: '#1f2937',
    lightAccent: '#f3e8ff'
  };

  return (
    <div className="data-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '25px',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      border: `2px solid ${theme.primary}`,
      borderRadius: '12px',
      position: 'relative'
    }}>
      {/* Background decoration */}
      <div style={{ 
        position: 'absolute', 
        top: '0', 
        right: '0', 
        width: '100px', 
        height: '100px', 
        background: `linear-gradient(45deg, ${theme.primary}, ${theme.secondary})`, 
        opacity: '0.1', 
        borderRadius: '0 12px 0 100px' 
      }} />
      
      <div style={{ position: 'relative', zIndex: '1' }}>
        {/* Header Section */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '25px', 
          paddingBottom: '20px', 
          borderBottom: `2px solid ${theme.accent}`,
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h1 style={{ 
              color: theme.text, 
              margin: '0', 
              fontSize: '28px', 
              fontWeight: '700',
              lineHeight: '1.2'
            }}>
              {displayData.personalInfo.fullName}
            </h1>
            <p style={{ 
              color: theme.primary, 
              margin: '8px 0 4px 0', 
              fontSize: '16px', 
              fontWeight: '600' 
            }}>
              {displayData.personalInfo.title || 'Senior Data Scientist'}
            </p>
            <p style={{ 
              color: '#6b7280', 
              margin: '0', 
              fontSize: '14px' 
            }}>
              Advanced Analytics • Machine Learning • AI Research
            </p>
            
            {/* Contact Info */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '16px', 
              marginTop: '10px', 
              fontSize: '13px', 
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              {displayData.personalInfo.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  {displayData.personalInfo.email}
                </span>
              )}
              {displayData.personalInfo.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  {displayData.personalInfo.phone}
                </span>
              )}
              {displayData.personalInfo.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {displayData.personalInfo.location}
                </span>
              )}
            </div>
            
            {/* Social Links */}
            {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '16px', 
                marginTop: '6px', 
                fontSize: '13px', 
                color: '#6b7280'
              }}>
                {displayData.personalInfo.linkedin && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                      <rect x="2" y="9" width="4" height="12"></rect>
                      <circle cx="4" cy="4" r="2"></circle>
                    </svg>
                    {cleanUrl(displayData.personalInfo.linkedin)}
                  </span>
                )}
                {displayData.personalInfo.website && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    {cleanUrl(displayData.personalInfo.website)}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Data Analytics Icon */}
          <div style={{ 
            width: '70px', 
            height: '70px', 
            background: displayData.personalInfo.profilePicture && 
                       typeof displayData.personalInfo.profilePicture === 'string' && 
                       displayData.personalInfo.profilePicture.trim() !== '' 
                       ? 'transparent' 
                       : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'white', 
            boxShadow: `0 4px 12px ${theme.primary}33`,
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            {displayData.personalInfo.profilePicture && 
             typeof displayData.personalInfo.profilePicture === 'string' && 
             displayData.personalInfo.profilePicture.trim() !== '' ? (
              <img 
                src={displayData.personalInfo.profilePicture} 
                alt="Profile"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  borderRadius: '50%'
                }}
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            )}
          </div>
        </div>

        {/* Research Focus */}
        {displayData.personalInfo.summary && (
          <div style={{ 
            background: theme.accent, 
            padding: '20px', 
            borderRadius: '10px', 
            marginBottom: '20px', 
            borderLeft: `4px solid ${theme.primary}` 
          }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 12px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              Research Focus
            </h2>
            <SummaryText 
              text={displayData.personalInfo.summary}
              style={{ 
                color: theme.text, 
                lineHeight: '1.6', 
                margin: '0', 
                fontSize: '14px',
                textAlign: 'justify'
              }}
            />
          </div>
        )}

        {/* Experience */}
        {displayData.experiences.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 15px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Experience
            </h2>
            {displayData.experiences.map((exp: any) => (
              <div key={exp.id} style={{ marginBottom: '15px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline', 
                  marginBottom: '6px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '16px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto',
                    minWidth: '60%'
                  }}>
                    {exp.position}
                  </h3>
                  <span style={{ 
                    color: '#6b7280', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </span>
                </div>
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0 8px 0', 
                  fontSize: '14px', 
                  fontWeight: '500',
                  lineHeight: '1.4'
                }}>
                  {exp.company}
                  {exp.location && ` • ${exp.location}`}
                  {exp.type && exp.type !== 'full-time' && (
                    <span style={{ 
                      background: theme.secondary, 
                      color: 'white', 
                      padding: '2px 6px', 
                      borderRadius: '8px', 
                      fontSize: '10px', 
                      fontWeight: '500', 
                      marginLeft: '8px',
                      textTransform: 'uppercase'
                    }}>
                      {exp.type}
                    </span>
                  )}
                </p>
                {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                  <ul style={{ 
                    color: '#4b5563', 
                    margin: '0 0 0 18px', 
                    padding: '0', 
                    fontSize: '14px',
                    listStyleType: 'disc'
                  }}>
                    {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                      <li key={index} style={{ 
                        marginBottom: '4px', 
                        lineHeight: '1.5'
                      }}>
                        {desc}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Education */}
        {displayData.education.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '18px', 
              margin: '0 0 12px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
              Education
            </h2>
            {displayData.education.map((edu: any) => (
              <div key={edu.id} style={{ marginBottom: '10px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '15px', 
                    margin: '0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                  </h3>
                  <span style={{ 
                    color: '#6b7280', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {edu.startDate} - {edu.endDate}
                  </span>
                </div>
                <p style={{ 
                  color: theme.primary, 
                  margin: '2px 0', 
                  fontSize: '14px', 
                  fontWeight: '500' 
                }}>
                  {edu.institution}
                  {edu.location && ` • ${edu.location}`}
                  {edu.gpa && ` • GPA: ${edu.gpa}`}
                </p>
                {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                  <ul style={{ 
                    color: '#4b5563', 
                    margin: '4px 0 0 18px', 
                    padding: '0',
                    listStyleType: 'disc'
                  }}>
                    {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                      <li key={index} style={{ 
                        marginBottom: '2px', 
                        fontSize: '12px',
                        lineHeight: '1.4'
                      }}>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Technical Skills */}
        {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
          <div style={{ 
            background: theme.accent, 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px' 
          }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 10px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              Technical Skills
            </h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '12px' 
            }}>
              {displayData.skills.technical.length > 0 && (
                <div>
                  <h4 style={{ 
                    color: theme.secondary, 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    fontWeight: '600' 
                  }}>
                    Technologies
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {displayData.skills.technical.map((skill: string, index: number) => (
                      <span key={index} style={{ 
                        background: theme.primary, 
                        color: 'white', 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: '500' 
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {displayData.skills.soft.length > 0 && (
                <div>
                  <h4 style={{ 
                    color: theme.secondary, 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    fontWeight: '600' 
                  }}>
                    Soft Skills
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {displayData.skills.soft.map((skill: string, index: number) => (
                      <span key={index} style={{ 
                        background: theme.lightAccent, 
                        color: theme.secondary, 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: '500', 
                        border: `1px solid ${theme.primary}40`
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {displayData.skills.languages.length > 0 && (
                <div>
                  <h4 style={{ 
                    color: theme.secondary, 
                    margin: '0 0 4px 0', 
                    fontSize: '12px', 
                    fontWeight: '600' 
                  }}>
                    Languages
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {displayData.skills.languages.map((skill: string, index: number) => (
                      <span key={index} style={{ 
                        background: `${theme.primary}20`, 
                        color: theme.secondary, 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: '500',
                        border: `1px solid ${theme.primary}40`
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Research Projects */}
        {displayData.projects.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 12px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              Research Projects
            </h2>
            {displayData.projects.map((project: any) => (
              <div key={project.id} style={{ marginBottom: '12px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'baseline',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '14px', 
                    margin: '0 0 4px 0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {project.name}
                  </h3>
                </div>
                {(project.link || project.github) && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '2px 0 6px 0', 
                    fontSize: '11px',
                    display: 'flex',
                    gap: '12px'
                  }}>
                    {project.link && (
                      project.link.includes('.') ? (
                        <a href={project.link.startsWith('http') ? project.link : `https://${project.link}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Globe" size={10} />
                          {project.link}
                        </span>
                      )
                    )}
                    {project.github && (
                      project.github.includes('.') ? (
                        <a href={project.github.startsWith('http') ? project.github : `https://${project.github}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563', textDecoration: 'none' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </a>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                          <FAIcon iconName="Github" size={10} />
                          {project.github}
                        </span>
                      )
                    )}
                  </p>
                )}
                {project.description && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '0 0 4px 0', 
                    fontSize: '13px', 
                    lineHeight: '1.4',
                    textAlign: 'justify'
                  }}>
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <p style={{ 
                    color: theme.primary, 
                    margin: '0', 
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}>
                    <strong>Tech:</strong> {project.technologies.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Two Column Layout for Certifications and Achievements */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px' 
        }}>
          {displayData.certifications.length > 0 && (
            <div>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 10px 0', 
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Certifications
              </h2>
              <ul style={{ 
                color: '#4b5563', 
                margin: '0 0 0 20px', 
                padding: '0',
                listStyleType: 'disc'
              }}>
                {displayData.certifications.map((cert: string, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '4px', 
                    fontSize: '13px',
                    lineHeight: '1.4'
                  }}>
                    {cert}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {displayData.achievements.length > 0 && (
            <div>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 10px 0', 
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Achievements
              </h2>
              <ul style={{ 
                color: '#4b5563', 
                margin: '0 0 0 20px', 
                padding: '0',
                listStyleType: 'disc'
              }}>
                {displayData.achievements.map((achievement: string, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '4px', 
                    fontSize: '13px',
                    lineHeight: '1.4'
                  }}>
                    {achievement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 16. Nonprofit Template
export const renderNonprofitTemplate = ({ 
  displayData, 
  cleanUrl, 
  SummaryText,
  colors
}: TemplateProps & { colors?: any }) => {
  // Use provided colors or default to original pink colors
  const theme = colors || {
    primary: '#be185d',
    secondary: '#9d174d', 
    accent: '#fdf2f8',
    text: '#1f2937',
    lightAccent: '#fef7f0'
  };

  return (
    <div className="nonprofit-template" style={{
      width: '100%',
      background: '#ffffff',
      padding: '25px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000',
      borderLeft: `6px solid ${theme.primary}`,
      borderRadius: '12px'
    }}>
      {/* Header Section */}
      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        {/* Heart Icon */}
        <div style={{ 
          width: '80px', 
          height: '80px', 
          background: displayData.personalInfo.profilePicture && 
                     typeof displayData.personalInfo.profilePicture === 'string' && 
                     displayData.personalInfo.profilePicture.trim() !== '' 
                     ? 'transparent' 
                     : `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, 
          borderRadius: '50%', 
          margin: '0 auto 15px auto', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white', 
          boxShadow: `0 4px 12px ${theme.primary}33`,
          overflow: 'hidden'
        }}>
          {displayData.personalInfo.profilePicture && 
           typeof displayData.personalInfo.profilePicture === 'string' && 
           displayData.personalInfo.profilePicture.trim() !== '' ? (
            <img 
              src={displayData.personalInfo.profilePicture} 
              alt="Profile"
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                borderRadius: '50%'
              }}
            />
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          )}
        </div>
        
        <h1 style={{ 
          color: theme.text, 
          margin: '0', 
          fontSize: '26px', 
          fontWeight: '700',
          lineHeight: '1.2'
        }}>
          {displayData.personalInfo.fullName}
        </h1>
        <p style={{ 
          color: theme.primary, 
          margin: '8px 0 4px 0', 
          fontSize: '16px', 
          fontWeight: '600' 
        }}>
          {displayData.personalInfo.title || 'Executive Director'}
        </p>
        <p style={{ 
          color: '#6b7280', 
          margin: '0', 
          fontSize: '14px' 
        }}>
          Community Leadership • Social Impact • Advocacy
        </p>
        
        {/* Contact Info */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '16px', 
          marginTop: '15px', 
          fontSize: '13px', 
          color: '#6b7280',
          flexWrap: 'wrap',
          lineHeight: '1.4'
        }}>
          {displayData.personalInfo.email && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              {displayData.personalInfo.email}
            </span>
          )}
          {displayData.personalInfo.phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              {displayData.personalInfo.phone}
            </span>
          )}
          {displayData.personalInfo.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {displayData.personalInfo.location}
            </span>
          )}
        </div>
        
        {/* Social Links */}
        {(displayData.personalInfo.linkedin || displayData.personalInfo.website) && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '16px', 
            marginTop: '8px', 
            fontSize: '13px', 
            color: '#6b7280',
            flexWrap: 'wrap'
          }}>
            {displayData.personalInfo.linkedin && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
                {cleanUrl(displayData.personalInfo.linkedin)}
              </span>
            )}
            {displayData.personalInfo.website && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                {cleanUrl(displayData.personalInfo.website)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mission & Impact */}
      {displayData.personalInfo.summary && (
        <div style={{ 
          background: theme.accent, 
          padding: '20px', 
          borderRadius: '10px', 
          marginBottom: '20px', 
          border: `1px solid ${theme.primary}20`
        }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Mission & Impact
          </h2>
          <SummaryText 
            text={displayData.personalInfo.summary}
            style={{ 
              color: theme.text, 
              lineHeight: '1.6', 
              margin: '0', 
              fontSize: '14px',
              textAlign: 'justify'
            }}
          />
        </div>
      )}

      {/* Leadership Experience */}
      {displayData.experiences.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 15px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            Leadership Experience
          </h2>
          {displayData.experiences.map((exp: any) => (
            <div key={exp.id} style={{ marginBottom: '15px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline', 
                marginBottom: '6px',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '16px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto',
                  minWidth: '60%'
                }}>
                  {exp.position}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0 8px 0', 
                fontSize: '14px', 
                fontWeight: '500',
                lineHeight: '1.4'
              }}>
                {exp.company}
                {exp.location && ` • ${exp.location}`}
                {exp.type && exp.type !== 'full-time' && (
                  <span style={{ 
                    background: theme.secondary, 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '8px', 
                    fontSize: '10px', 
                    fontWeight: '500', 
                    marginLeft: '8px',
                    textTransform: 'uppercase'
                  }}>
                    {exp.type}
                  </span>
                )}
              </p>
              {exp.description && exp.description.filter((d: string) => d.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  fontSize: '14px', 
                  margin: '0 0 0 18px', 
                  padding: '0',
                  listStyleType: 'disc'
                }}>
                  {exp.description.filter((d: string) => d.trim()).map((desc: string, index: number) => (
                    <li key={index} style={{ 
                      margin: '2px 0', 
                      lineHeight: '1.5'
                    }}>
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {displayData.education.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '18px', 
            margin: '0 0 12px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
            Education
          </h2>
          {displayData.education.map((edu: any) => (
            <div key={edu.id} style={{ marginBottom: '10px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'baseline',
                flexWrap: 'wrap'
              }}>
                <h3 style={{ 
                  color: theme.text, 
                  fontSize: '15px', 
                  margin: '0', 
                  fontWeight: '600',
                  flex: '1 1 auto'
                }}>
                  {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || ""}
                </h3>
                <span style={{ 
                  color: '#6b7280', 
                  fontSize: '13px', 
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {edu.startDate} - {edu.endDate}
                </span>
              </div>
              <p style={{ 
                color: theme.primary, 
                margin: '2px 0', 
                fontSize: '14px', 
                fontWeight: '500' 
              }}>
                {edu.institution}
                {edu.location && ` • ${edu.location}`}
                {edu.gpa && ` • GPA: ${edu.gpa}`}
              </p>
              {edu.achievements && edu.achievements.filter((a: string) => a.trim()).length > 0 && (
                <ul style={{ 
                  color: '#4b5563', 
                  margin: '4px 0 0 18px', 
                  padding: '0',
                  listStyleType: 'disc'
                }}>
                  {edu.achievements.filter((a: string) => a.trim()).map((achievement: string, index: number) => (
                    <li key={index} style={{ 
                      marginBottom: '2px', 
                      fontSize: '12px',
                      lineHeight: '1.4'
                    }}>
                      {achievement}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Core Values & Skills */}
      {(displayData.skills.technical.length > 0 || displayData.skills.soft.length > 0 || displayData.skills.languages.length > 0) && (
        <div style={{ 
          background: theme.accent, 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          <h2 style={{ 
            color: theme.primary, 
            fontSize: '16px', 
            margin: '0 0 10px 0', 
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
            </svg>
            Core Values & Skills
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '12px' 
          }}>
            {displayData.skills.soft.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  fontWeight: '600' 
                }}>
                  Leadership
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.soft.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: theme.primary, 
                      color: 'white', 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: '500' 
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {displayData.skills.technical.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  fontWeight: '600' 
                }}>
                  Technical
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.technical.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: theme.lightAccent, 
                      color: theme.primary, 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: '500', 
                      border: `1px solid ${theme.primary}40`
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {displayData.skills.languages.length > 0 && (
              <div>
                <h4 style={{ 
                  color: theme.secondary, 
                  margin: '0 0 4px 0', 
                  fontSize: '12px', 
                  fontWeight: '600' 
                }}>
                  Languages
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayData.skills.languages.map((skill: string, index: number) => (
                    <span key={index} style={{ 
                      background: `${theme.primary}20`, 
                      color: theme.secondary, 
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: '500',
                      border: `1px solid ${theme.primary}40`
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two Column Layout for Projects, Certifications, and Achievements */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px' 
      }}>
        {/* Community Projects */}
        {displayData.projects.length > 0 && (
          <div>
            <h2 style={{ 
              color: theme.primary, 
              fontSize: '16px', 
              margin: '0 0 10px 0', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
              </svg>
              Community Projects
            </h2>
            {displayData.projects.map((project: any) => (
              <div key={project.id} style={{ marginBottom: '10px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '4px',
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ 
                    color: theme.text, 
                    fontSize: '14px', 
                    margin: '0 0 4px 0', 
                    fontWeight: '600',
                    flex: '1 1 auto'
                  }}>
                    {project.name}
                  </h3>
                  <div style={{ 
                    display: 'flex', 
                    gap: '6px', 
                    alignItems: 'center',
                    marginTop: '2px'
                  }}>
                    {project.link && (
                      <span style={{ 
                        fontSize: '10px', 
                        color: theme.primary, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px' 
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15,3 21,3 21,9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        Link
                      </span>
                    )}
                    {project.github && (
                      <span style={{ 
                        fontSize: '10px', 
                        color: theme.primary, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px' 
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 19c-5 0-8-3-8-8s3-8 8-8 8 3 8 8-3 8-8 8z"></path>
                          <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                          <line x1="9" y1="9" x2="9.01" y2="9"></line>
                          <line x1="15" y1="9" x2="15.01" y2="9"></line>
                        </svg>
                        Code
                      </span>
                    )}
                  </div>
                </div>
                {project.description && (
                  <p style={{ 
                    color: '#4b5563', 
                    margin: '0', 
                    fontSize: '12px', 
                    lineHeight: '1.4',
                    textAlign: 'justify'
                  }}>
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <p style={{ 
                    color: theme.primary, 
                    margin: '4px 0 0 0', 
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}>
                    <strong>Tools:</strong> {project.technologies.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certifications and Impact & Recognition Column */}
        <div>
          {displayData.certifications.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 10px 0', 
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Certifications
              </h2>
              <ul style={{ 
                color: '#4b5563', 
                margin: '0 0 0 20px', 
                padding: '0',
                listStyleType: 'disc'
              }}>
                {displayData.certifications.map((cert: string, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '4px', 
                    fontSize: '13px',
                    lineHeight: '1.4'
                  }}>
                    {cert}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {displayData.achievements.length > 0 && (
            <div>
              <h2 style={{ 
                color: theme.primary, 
                fontSize: '16px', 
                margin: '0 0 10px 0', 
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                Impact & Recognition
              </h2>
              <ul style={{ 
                color: '#4b5563', 
                margin: '0 0 0 20px', 
                padding: '0',
                listStyleType: 'disc'
              }}>
                {displayData.achievements.map((achievement: string, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '4px', 
                    fontSize: '13px',
                    lineHeight: '1.4'
                  }}>
                    {achievement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
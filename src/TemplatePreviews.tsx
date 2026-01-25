import React from 'react';
import { Mail, Phone, MapPin, Linkedin, Globe, Star, User } from 'lucide-react';

// Modern Template Preview
export const ModernTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-lg font-['Segoe_UI',Arial,sans-serif] border border-gray-200 shadow-md">
      <div className="border-b-[3px] border-blue-500 pb-5 mb-6">
        <h1 className="text-gray-800 m-0 text-[28px] font-bold">John Anderson</h1>
        <p className="text-blue-500 mt-2 mb-0 text-base font-semibold">Senior Software Engineer</p>
        <div className="flex flex-wrap gap-4 mt-3 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={14} />john.anderson@email.com</span>
          <span className="flex items-center gap-1.5"><Phone size={14} />+1 (555) 123-4567</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} />San Francisco, CA</span>
          <span className="flex items-center gap-1.5"><Linkedin size={14} />LinkedIn</span>
        </div>
      </div>
      <div className="mb-5">
        <h2 className="text-blue-500 text-base mb-2.5 mt-0 font-semibold">Professional Summary</h2>
        <p className="text-gray-600 leading-relaxed m-0 text-sm">
          Experienced software engineer with 8+ years developing scalable applications. Expertise in React, Node.js, and cloud technologies with proven track record of delivering high-quality solutions.
        </p>
      </div>
      <div>
        <h2 className="text-blue-500 text-base mb-3 mt-0 font-semibold">Experience</h2>
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-semibold">Senior Software Engineer</h3>
            <span className="text-gray-500 text-xs font-medium">2021 - Present</span>
          </div>
          <p className="text-blue-500 my-0.5 mb-1.5 text-[13px] font-medium">Google • Mountain View, CA</p>
          <p className="text-gray-600 m-0 text-[13px]">• Led development of microservices architecture serving 10M+ users</p>
        </div>
      </div>
    </div>
  );
};

// Creative Template Preview
export const CreativeTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl font-['Arial',sans-serif] shadow-md">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-[60px] h-[60px] bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white">
            <Star size={28} />
          </div>
          <div>
            <h1 className="text-gray-800 m-0 text-[26px] font-bold">Sarah Martinez</h1>
            <p className="text-amber-500 mt-1 mb-0 text-base font-semibold">Creative Director</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3.5 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={14} />sarah.martinez@email.com</span>
          <span className="flex items-center gap-1.5"><Phone size={14} />+1 (555) 987-6543</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} />New York, NY</span>
          <span className="flex items-center gap-1.5"><Globe size={14} />Portfolio</span>
        </div>
      </div>
      <div className="bg-amber-50 p-4 rounded-lg mb-5 border-l-4 border-amber-500">
        <h2 className="text-amber-800 text-base mb-2.5 mt-0 font-semibold">Creative Vision</h2>
        <p className="text-gray-700 leading-relaxed m-0 text-sm">
          Award-winning creative director with 7+ years crafting compelling visual experiences for global brands. Specialized in brand identity, digital campaigns, and user experience design.
        </p>
      </div>
      <div>
        <h2 className="text-amber-500 text-base mb-3 mt-0 font-semibold">Experience</h2>
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-semibold">Creative Director</h3>
            <span className="text-gray-500 text-xs font-medium">2020 - Present</span>
          </div>
          <p className="text-amber-500 my-0.5 mb-1.5 text-[13px] font-medium">Design Studio Pro • New York, NY</p>
          <p className="text-gray-600 m-0 text-[13px]">• Led creative campaigns resulting in 40% increase in brand engagement</p>
        </div>
      </div>
    </div>
  );
};

// Professional Blue Template Preview
export const ProfessionalBlueTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white rounded-lg font-['Arial',sans-serif] border border-gray-200 shadow-md overflow-hidden">
      {/* Header with Blue Gradient */}
      <div className="bg-gradient-to-br from-[#4f87c7] to-[#6ba3d6] p-5 text-white">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-white p-[3px]">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-200 to-gray-100 flex items-center justify-center text-gray-500 text-sm font-semibold">
              Photo
            </div>
          </div>
          <div>
            <h1 className="text-white m-0 text-[28px] font-bold uppercase tracking-wide">Tulsi Das</h1>
            <p className="text-white/90 mt-1.5 mb-0 text-base font-medium">Candidate Success Executive - Operations</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm text-white/90">
          <div className="flex items-center gap-1.5"><Phone size={16} />+91-799232354</div>
          <div className="flex items-center gap-1.5"><Mail size={16} />tulasi@gmail.com</div>
          <div className="flex items-center gap-1.5"><MapPin size={16} />Hyderabad</div>
          <div className="flex items-center gap-1.5"><Linkedin size={16} />LinkedIn Profile</div>
        </div>
      </div>
      {/* Two Column Layout */}
      <div className="grid grid-cols-[1fr_2fr] min-h-[200px]">
        <div className="bg-gray-50 p-5 border-r border-gray-200">
          <div className="mb-5">
            <h2 className="text-[#4f87c7] text-sm mb-2 mt-0 font-semibold uppercase">About Me</h2>
            <p className="text-gray-600 text-[13px] leading-relaxed m-0">
              Dedicated professional with expertise in operations and customer success.
            </p>
          </div>
          <div>
            <h2 className="text-[#4f87c7] text-sm mb-2 mt-0 font-semibold uppercase">Skills</h2>
            <div className="flex flex-wrap gap-1.5">
              {['Operations', 'CRM', 'Analytics'].map(skill => (
                <span key={skill} className="bg-[#4f87c7]/10 text-[#4f87c7] px-2 py-1 rounded text-xs">{skill}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5">
          <h2 className="text-[#4f87c7] text-sm mb-3 mt-0 font-semibold uppercase">Experience</h2>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <h3 className="text-gray-800 text-[15px] m-0 font-semibold">Success Executive</h3>
              <span className="text-gray-500 text-xs">2022 - Present</span>
            </div>
            <p className="text-[#4f87c7] text-[13px] font-medium my-0.5">TechCorp • Hyderabad</p>
            <p className="text-gray-600 text-[13px] m-0">• Managed client relationships and operations</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Executive Template Preview
export const ExecutiveTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-8 font-['Times_New_Roman',serif] shadow-md">
      <div className="text-center border-b-2 border-gray-800 pb-5 mb-6">
        <h1 className="text-gray-800 m-0 text-[32px] font-normal tracking-wide">WILLIAM THOMPSON</h1>
        <p className="text-gray-600 mt-2 mb-0 text-lg font-medium tracking-widest uppercase">Chief Executive Officer</p>
        <div className="flex justify-center flex-wrap gap-5 mt-4 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={14} />william.t@corporation.com</span>
          <span className="flex items-center gap-1.5"><Phone size={14} />+1 (555) 000-0001</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} />New York, NY</span>
        </div>
      </div>
      <div className="mb-5">
        <h2 className="text-gray-800 text-lg mb-3 mt-0 font-semibold uppercase tracking-wide border-b border-gray-300 pb-1">Executive Summary</h2>
        <p className="text-gray-600 leading-relaxed m-0 text-sm">
          Visionary C-suite executive with 20+ years driving organizational transformation and revenue growth across Fortune 500 companies.
        </p>
      </div>
      <div>
        <h2 className="text-gray-800 text-lg mb-3 mt-0 font-semibold uppercase tracking-wide border-b border-gray-300 pb-1">Leadership Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-semibold">Chief Executive Officer</h3>
            <span className="text-gray-500 text-xs font-medium">2018 - Present</span>
          </div>
          <p className="text-gray-700 my-0.5 text-sm font-medium">Global Industries Inc. • New York, NY</p>
          <p className="text-gray-600 m-0 text-[13px]">• Drove 150% revenue growth through strategic acquisitions</p>
        </div>
      </div>
    </div>
  );
};

// Bold Template Preview
export const BoldTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl font-['Arial',sans-serif] shadow-md">
      <div className="mb-6">
        <h1 className="text-gray-800 m-0 text-[28px] font-bold">ALEX RIVERA</h1>
        <p className="text-red-500 mt-2 mb-0 text-lg font-bold uppercase tracking-wide">Full Stack Developer</p>
        <div className="flex flex-wrap gap-4 mt-3 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={14} />alex.r@techmail.com</span>
          <span className="flex items-center gap-1.5"><Phone size={14} />+1 (555) 789-0123</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} />Austin, TX</span>
        </div>
      </div>
      <div className="bg-red-50 p-4 rounded-lg mb-5">
        <h2 className="text-red-700 text-base mb-2 mt-0 font-bold uppercase">About Me</h2>
        <p className="text-gray-700 leading-relaxed m-0 text-sm">
          Passionate full-stack developer with 6+ years building high-performance web applications.
        </p>
      </div>
      <div>
        <h2 className="text-red-500 text-base mb-3 mt-0 font-bold uppercase">Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-bold">Senior Developer</h3>
            <span className="text-gray-500 text-xs font-semibold">2021 - Present</span>
          </div>
          <p className="text-red-500 my-0.5 text-[13px] font-semibold">TechStartup Inc. • Austin, TX</p>
          <p className="text-gray-600 m-0 text-[13px]">• Built scalable microservices handling 1M+ daily requests</p>
        </div>
      </div>
    </div>
  );
};

// Minimal Template Preview
export const MinimalTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-lg font-['Georgia',serif] border border-gray-200 shadow-md">
      <div className="mb-8 pb-5 border-b border-gray-200">
        <h1 className="text-gray-800 m-0 text-[26px] font-normal">Emily Chen</h1>
        <p className="text-gray-500 mt-2 mb-0 text-base">UX Designer</p>
        <div className="flex flex-wrap gap-4 mt-3 text-[13px] text-gray-400">
          <span>emily.chen@design.co</span>
          <span>•</span>
          <span>San Francisco, CA</span>
          <span>•</span>
          <span>Portfolio</span>
        </div>
      </div>
      <div className="mb-6">
        <h2 className="text-gray-700 text-sm mb-2 mt-0 font-medium uppercase tracking-wider">About</h2>
        <p className="text-gray-600 leading-relaxed m-0 text-sm">
          Thoughtful designer focused on creating intuitive, accessible digital experiences.
        </p>
      </div>
      <div>
        <h2 className="text-gray-700 text-sm mb-3 mt-0 font-medium uppercase tracking-wider">Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-medium">Senior UX Designer</h3>
            <span className="text-gray-400 text-xs">2020 - Present</span>
          </div>
          <p className="text-gray-500 my-0.5 text-[13px]">Design Studio</p>
          <p className="text-gray-600 m-0 text-[13px]">Led design systems initiatives for enterprise clients.</p>
        </div>
      </div>
    </div>
  );
};

// Elegant Template Preview
export const ElegantTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 font-['Georgia',serif] shadow-md">
      
      {/* Header Section with light blue background */}
      <div className="text-center mb-6 p-5 bg-slate-100 rounded-xl border border-slate-200">
        <h1 className="text-gray-800 m-0 text-[26px] font-normal tracking-wide uppercase">Sophia Williams</h1>
        <div className="w-[60px] h-[2px] bg-indigo-500 mx-auto my-2.5" />
        <p className="text-indigo-500 mt-2 mb-0 text-sm font-medium uppercase tracking-wide">Brand Strategist</p>
        <div className="flex justify-center flex-wrap gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={12} />sophia@brand.co</span>
          <span className="flex items-center gap-1.5"><Phone size={12} />+1 (555) 234-5678</span>
          <span className="flex items-center gap-1.5"><MapPin size={12} />Los Angeles, CA</span>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><Linkedin size={12} />linkedin.com/in/sophia</span>
        </div>
      </div>
      
      {/* Expertise / Summary - Left aligned */}
      <div className="mb-5">
        <h2 className="text-indigo-500 text-sm mb-3 mt-0 font-medium uppercase tracking-wide flex items-center gap-2">
          <Star size={14} />
          Expertise
        </h2>
        <p className="text-gray-600 leading-relaxed m-0 text-sm italic">
          Strategic thinker with 8+ years crafting brand narratives that resonate with audiences.
        </p>
      </div>
      
      {/* Experience - Left aligned */}
      <div>
        <h2 className="text-indigo-500 text-sm mb-3 mt-0 font-medium uppercase tracking-wide">Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-medium italic">Senior Brand Strategist</h3>
            <span className="text-gray-500 text-xs">2019 - Present</span>
          </div>
          <p className="text-indigo-500 my-0.5 text-[13px] font-medium">Creative Agency • Los Angeles</p>
          <p className="text-gray-600 m-0 text-[13px]">• Developed brand strategies for Fortune 500 clients</p>
        </div>
      </div>
    </div>
  );
};

// Tech Template Preview
export const TechTemplatePreview: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-cyan-50 to-sky-100 p-6 rounded-2xl font-['SF_Pro_Display',Arial,sans-serif] border border-cyan-500 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-8 -right-8 w-28 h-28 bg-gradient-to-br from-cyan-500 to-teal-500 opacity-10 rounded-full" />
      
      <div className="relative">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full mb-3 shadow-sm">
          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
          <span className="text-xs text-emerald-500 font-semibold">AVAILABLE FOR OPPORTUNITIES</span>
        </div>
        
        <h1 className="text-gray-900 m-0 text-[28px] font-extrabold">David Kim</h1>
        <p className="text-cyan-600 mt-1 mb-0 text-base font-bold">DevOps Engineer</p>
        
        <div className="flex flex-wrap gap-4 mt-3 text-[12px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={12} />david.kim@tech.io</span>
          <span className="flex items-center gap-1.5"><MapPin size={12} />Seattle, WA</span>
        </div>
      </div>
      
      {/* Technical Profile */}
      <div className="bg-white p-4 rounded-xl mt-4 mb-3 shadow-sm">
        <h2 className="text-cyan-600 text-sm mb-2 mt-0 font-bold uppercase tracking-wide flex items-center gap-1.5">
          <User size={14} />
          Technical Profile
        </h2>
        <p className="text-gray-600 leading-relaxed m-0 text-[13px]">
          Infrastructure specialist with expertise in cloud platforms, CI/CD, and container orchestration.
        </p>
      </div>
      
      {/* Tech Stack */}
      <div className="bg-white p-4 rounded-xl mb-3 shadow-sm">
        <h2 className="text-cyan-600 text-sm mb-2 mt-0 font-bold uppercase tracking-wide">Tech Stack</h2>
        <div className="flex flex-wrap gap-2">
          {['AWS', 'Kubernetes', 'Docker', 'Terraform', 'Python'].map(tech => (
            <span key={tech} className="bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-full text-xs font-medium border border-cyan-200">{tech}</span>
          ))}
        </div>
      </div>
      
      {/* Experience */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-cyan-600 text-sm mb-2 mt-0 font-bold uppercase tracking-wide">Engineering Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[14px] m-0 font-semibold">Senior DevOps Engineer</h3>
            <span className="text-gray-400 text-[11px] font-medium">2020 - Present</span>
          </div>
          <p className="text-cyan-600 my-0.5 text-[12px] font-medium">CloudTech Inc.</p>
          <p className="text-gray-500 m-0 text-[12px]">• Reduced deployment time by 70% through automation</p>
        </div>
      </div>
    </div>
  );
};

// Startup Template Preview
export const StartupTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-2xl font-['Arial',sans-serif] border border-orange-500 shadow-md relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-5 -right-5 w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-400 opacity-10 rounded-full" />
      
      <div className="relative">
        {/* Header with profile picture */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-gray-800 m-0 text-[24px] font-extrabold uppercase">Michael Johnson</h1>
            <p className="text-orange-500 mt-1 mb-0 text-base font-bold uppercase">Startup Founder & CEO</p>
            <div className="flex flex-wrap gap-3 mt-3 text-[12px] text-gray-500">
              <span className="flex items-center gap-1.5"><Mail size={12} />michael@startup.io</span>
              <span className="flex items-center gap-1.5"><Phone size={12} />+1 (555) 123-4567</span>
              <span className="flex items-center gap-1.5"><MapPin size={12} />San Francisco, CA</span>
            </div>
            <div className="flex gap-3 mt-1 text-[12px] text-gray-500">
              <span className="flex items-center gap-1.5"><Linkedin size={12} />linkedin.com/in/mjohnson</span>
            </div>
          </div>
          {/* Profile Picture Placeholder */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 border-2 border-orange-200 flex items-center justify-center text-orange-400 text-xs flex-shrink-0">
            Photo
          </div>
        </div>
        
        {/* Mission Statement */}
        <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500 mb-4">
          <h2 className="text-orange-600 text-sm mb-2 mt-0 font-bold flex items-center gap-1.5">
            <Star size={14} />
            Mission Statement
          </h2>
          <p className="text-gray-700 leading-relaxed m-0 text-[13px]">
            Serial entrepreneur with 3 successful exits, passionate about building products that solve real problems.
          </p>
        </div>
        
        {/* Experience */}
        <div>
          <h2 className="text-orange-500 text-sm mb-2 mt-0 font-bold">Ventures</h2>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <h3 className="text-gray-800 text-[14px] m-0 font-semibold">Founder & CEO</h3>
              <span className="text-gray-400 text-[11px]">2021 - Present</span>
            </div>
            <p className="text-orange-500 my-0.5 text-[12px] font-medium">TechVenture Labs • San Francisco</p>
            <p className="text-gray-600 m-0 text-[12px]">• Raised $5M Series A, grew team to 25 employees</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Consulting Template Preview
export const ConsultingTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 font-['Helvetica',Arial,sans-serif] shadow-md">
      {/* Header - Split layout */}
      <div className="flex justify-between items-start mb-6 pb-5 border-b-2 border-gray-100">
        <div>
          <h1 className="text-gray-800 m-0 text-[26px] font-semibold">Jennifer Clark</h1>
          <p className="text-teal-600 mt-1 mb-0 text-base font-semibold">Management Consultant</p>
          <p className="text-gray-500 mt-1 mb-0 text-sm">Strategic Business Professional</p>
        </div>
        <div className="text-right text-[12px] text-gray-600 space-y-1">
          <div className="flex items-center justify-end gap-1.5"><Mail size={12} />j.clark@consulting.com</div>
          <div className="flex items-center justify-end gap-1.5"><Phone size={12} />+1 (555) 234-5678</div>
          <div className="flex items-center justify-end gap-1.5"><MapPin size={12} />Boston, MA</div>
          <div className="flex items-center justify-end gap-1.5"><Linkedin size={12} />linkedin.com/in/jclark</div>
        </div>
      </div>
      
      {/* Core Competencies */}
      <div className="mb-5">
        <h2 className="text-teal-600 text-sm mb-3 mt-0 font-semibold uppercase tracking-wide flex items-center gap-2">
          <Star size={14} />
          Core Competencies
        </h2>
        <p className="text-gray-700 leading-relaxed m-0 text-[13px] text-justify">
          Strategic advisor with 12+ years at top-tier consulting firms, specializing in digital transformation and operational excellence.
        </p>
      </div>
      
      {/* Experience */}
      <div>
        <h2 className="text-teal-600 text-sm mb-3 mt-0 font-semibold uppercase tracking-wide">Professional Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[14px] m-0 font-semibold">Principal Consultant</h3>
            <span className="text-gray-400 text-[11px]">2019 - Present</span>
          </div>
          <p className="text-teal-600 my-0.5 text-[12px] font-medium">McKinsey & Company • Boston</p>
          <p className="text-gray-600 m-0 text-[12px]">• Led $50M+ digital transformation initiatives</p>
        </div>
      </div>
    </div>
  );
};

// Medical Template Preview
export const MedicalTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 font-['Arial',sans-serif] shadow-md border border-emerald-500 rounded-lg">
      {/* Header - Centered with profile picture */}
      <div className="text-center mb-5 pb-4 border-b border-gray-200">
        {/* Profile Picture Placeholder */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 border-2 border-emerald-200 mx-auto mb-3 flex items-center justify-center text-emerald-400 text-xs">
          Photo
        </div>
        <h1 className="text-gray-800 m-0 text-[24px] font-bold">Dr. Sarah Mitchell</h1>
        <p className="text-emerald-600 mt-1 mb-1 text-base font-semibold">Cardiologist, MD, FACC</p>
        <p className="text-gray-500 text-sm m-0">Healthcare Excellence • Patient-Centered Care</p>
        <div className="flex justify-center flex-wrap gap-4 mt-3 text-[12px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={12} />dr.mitchell@hospital.org</span>
          <span className="flex items-center gap-1.5"><Phone size={12} />+1 (555) 123-4567</span>
          <span className="flex items-center gap-1.5"><MapPin size={12} />Boston, MA</span>
        </div>
        <div className="flex justify-center gap-4 mt-1 text-[12px] text-gray-500">
          <span className="flex items-center gap-1.5"><Linkedin size={12} />linkedin.com/in/drmitchell</span>
        </div>
      </div>
      
      {/* Medical Expertise Box */}
      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 mb-4">
        <h2 className="text-emerald-600 text-sm mb-2 mt-0 font-bold flex items-center gap-1.5">
          <User size={14} />
          Medical Expertise
        </h2>
        <p className="text-gray-700 leading-relaxed m-0 text-[13px]">
          Board-certified cardiologist with 15+ years of experience in interventional procedures and patient care excellence.
        </p>
      </div>
      
      {/* Experience */}
      <div>
        <h2 className="text-emerald-600 text-sm mb-2 mt-0 font-bold">Clinical Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[14px] m-0 font-semibold">Chief of Cardiology</h3>
            <span className="text-gray-400 text-[11px]">2018 - Present</span>
          </div>
          <p className="text-emerald-600 my-0.5 text-[12px] font-medium">Massachusetts General Hospital</p>
          <p className="text-gray-600 m-0 text-[12px]">• Performed 500+ interventional procedures annually</p>
        </div>
      </div>
    </div>
  );
};

// Finance Template Preview
export const FinanceTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl font-['Segoe_UI',Arial,sans-serif] border-2 border-violet-600 shadow-md relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-purple-500" />
      <div className="mb-6 mt-2">
        <h1 className="text-gray-800 m-0 text-[26px] font-bold">Robert Chen</h1>
        <p className="text-violet-600 mt-2 mb-0 text-base font-semibold">Investment Banking Analyst</p>
        <div className="flex flex-wrap gap-4 mt-3 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={14} />r.chen@finance.com</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} />New York, NY</span>
        </div>
      </div>
      <div className="mb-5">
        <h2 className="text-violet-600 text-base mb-2 mt-0 font-semibold">Summary</h2>
        <p className="text-gray-600 leading-relaxed m-0 text-sm">
          Finance professional with expertise in M&A, valuation, and financial modeling.
        </p>
      </div>
      <div>
        <h2 className="text-violet-600 text-base mb-3 mt-0 font-semibold">Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-semibold">Senior Analyst</h3>
            <span className="text-gray-500 text-xs">2020 - Present</span>
          </div>
          <p className="text-violet-600 my-0.5 text-[13px] font-medium">Goldman Sachs • New York</p>
          <p className="text-gray-600 m-0 text-[13px]">• Executed $2B+ in M&A transactions</p>
        </div>
      </div>
    </div>
  );
};

// Marketing Template Preview
export const MarketingTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl font-['Arial',sans-serif] border-l-[6px] border-pink-600 shadow-md">
      <div className="mb-6">
        <h1 className="text-gray-800 m-0 text-[26px] font-bold">Amanda Torres</h1>
        <p className="text-pink-600 mt-2 mb-0 text-base font-semibold">Digital Marketing Director</p>
        <div className="flex flex-wrap gap-4 mt-3 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={14} />amanda@marketing.co</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} />Los Angeles, CA</span>
        </div>
      </div>
      <div className="bg-pink-50 p-4 rounded-lg mb-5 border-l-4 border-pink-500">
        <h2 className="text-pink-700 text-base mb-2 mt-0 font-semibold">Summary</h2>
        <p className="text-gray-700 leading-relaxed m-0 text-sm">
          Growth-focused marketer with 10+ years driving customer acquisition and brand awareness.
        </p>
      </div>
      <div>
        <h2 className="text-pink-600 text-base mb-3 mt-0 font-semibold">Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-semibold">VP of Marketing</h3>
            <span className="text-gray-500 text-xs">2019 - Present</span>
          </div>
          <p className="text-pink-600 my-0.5 text-[13px] font-medium">BrandCo • Los Angeles</p>
          <p className="text-gray-600 m-0 text-[13px]">• Grew social following from 10K to 500K+</p>
        </div>
      </div>
    </div>
  );
};

// Data Template Preview
export const DataTemplatePreview: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-sky-50 to-cyan-50 p-6 rounded-2xl font-['SF_Pro_Display',Arial,sans-serif] border border-cyan-500 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative mb-6">
        <h1 className="text-gray-800 m-0 text-[26px] font-bold">Chris Park</h1>
        <p className="text-cyan-600 mt-2 mb-0 text-base font-semibold">Data Scientist</p>
        <div className="flex flex-wrap gap-4 mt-3 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={14} />chris@data.io</span>
          <span className="flex items-center gap-1.5"><MapPin size={14} />Seattle, WA</span>
        </div>
      </div>
      <div className="mb-5">
        <h2 className="text-cyan-600 text-base mb-2 mt-0 font-semibold">Expertise</h2>
        <div className="flex flex-wrap gap-2">
          {['Machine Learning', 'Python', 'TensorFlow', 'SQL'].map(skill => (
            <span key={skill} className="bg-white text-cyan-700 px-2.5 py-1 rounded-full text-xs font-medium border border-cyan-200">{skill}</span>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-cyan-600 text-base mb-3 mt-0 font-semibold">Experience</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-semibold">Senior Data Scientist</h3>
            <span className="text-gray-500 text-xs">2021 - Present</span>
          </div>
          <p className="text-cyan-600 my-0.5 text-[13px] font-medium">Amazon • Seattle</p>
          <p className="text-gray-600 m-0 text-[13px]">• Built ML models improving recommendations by 35%</p>
        </div>
      </div>
    </div>
  );
};

// Nonprofit Template Preview
export const NonprofitTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-8 font-['Helvetica_Neue',Arial,sans-serif] shadow-none max-w-full">
      <div className="mb-8">
        <h1 className="text-black m-0 text-[32px] font-medium">Maya Johnson</h1>
        <p className="text-gray-600 mt-2 mb-0 text-lg">Nonprofit Executive Director</p>
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
          <span>maya@nonprofit.org</span>
          <span>•</span>
          <span>Washington, DC</span>
        </div>
      </div>
      <div className="mb-8">
        <h2 className="text-black text-sm mb-4 mt-0 font-medium uppercase tracking-wide">Mission Statement</h2>
        <p className="text-gray-700 leading-relaxed m-0 text-sm">
          Dedicated leader with 15+ years advancing social equity through strategic program development.
        </p>
      </div>
      <div>
        <h2 className="text-black text-sm mb-4 mt-0 font-medium uppercase tracking-wide">Experience</h2>
        <div className="mb-5">
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-black text-base m-0 font-medium">Executive Director</h3>
            <span className="text-gray-500 text-xs">2018 - Present</span>
          </div>
          <p className="text-gray-700 my-0.5 text-sm">Community Impact Foundation</p>
          <p className="text-gray-600 m-0 text-sm leading-relaxed">Grew annual budget from $2M to $8M while expanding programs to 50+ communities.</p>
        </div>
      </div>
    </div>
  );
};

// Academic Template Preview
export const AcademicTemplatePreview: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-lg font-['Times_New_Roman',serif] shadow-md">
      <div className="text-center mb-8 pb-5 border-b border-gray-200">
        <h1 className="text-gray-800 m-0 text-[28px] font-normal tracking-wide">Dr. Elizabeth Harper</h1>
        <p className="text-violet-500 mt-2 mb-0 text-base font-medium">Associate Professor of Cognitive Psychology</p>
        <p className="text-gray-500 mt-1.5 mb-0 text-sm italic">PhD, Harvard University • Research Fellow, MIT</p>
        <div className="flex justify-center gap-5 mt-4 text-[13px] text-gray-500">
          <span className="flex items-center gap-1.5"><Mail size={14} />e.harper@university.edu</span>
          <span className="flex items-center gap-1.5">ORCID: 0000-0002-1825-0097</span>
        </div>
      </div>
      <div className="mb-6">
        <h2 className="text-violet-500 text-base mb-3 mt-0 font-semibold uppercase tracking-wide border-b border-gray-200 pb-1">Research Interests</h2>
        <p className="text-gray-700 leading-relaxed m-0 text-sm text-justify">
          Cognitive neuroscience of memory formation, computational models of learning, and neural mechanisms underlying decision-making processes.
        </p>
      </div>
      <div className="mb-6">
        <h2 className="text-violet-500 text-base mb-3 mt-0 font-semibold uppercase tracking-wide border-b border-gray-200 pb-1">Academic Positions</h2>
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h3 className="text-gray-800 text-[15px] m-0 font-semibold italic">Associate Professor</h3>
            <span className="text-gray-500 text-[13px] font-medium">2020 - Present</span>
          </div>
          <p className="text-violet-500 my-0.5 text-sm font-medium">Department of Psychology, Stanford University</p>
          <p className="text-gray-600 m-0 text-[13px]">• Principal Investigator, $2.5M NIH grant on memory consolidation</p>
        </div>
      </div>
      <div className="text-[13px]">
        <div>
          <h3 className="text-violet-500 text-sm mb-2 mt-0 font-semibold uppercase tracking-wide">Education</h3>
          <p className="text-gray-600 m-0 leading-relaxed">PhD Psychology, Harvard (2015)<br/>MA Psychology, Yale (2011)</p>
        </div>
      </div>
    </div>
  );
};

export default {
  ModernTemplatePreview,
  CreativeTemplatePreview,
  ProfessionalBlueTemplatePreview,
  ExecutiveTemplatePreview,
  BoldTemplatePreview,
  MinimalTemplatePreview,
  ElegantTemplatePreview,
  TechTemplatePreview,
  StartupTemplatePreview,
  ConsultingTemplatePreview,
  MedicalTemplatePreview,
  FinanceTemplatePreview,
  MarketingTemplatePreview,
  DataTemplatePreview,
  NonprofitTemplatePreview,
  AcademicTemplatePreview
};
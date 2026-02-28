import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faSpinner,
  faPalette,
  faFloppyDisk,
  faCircleExclamation,
  faCircleCheck,
  faTrash,
  faCloudArrowUp,
  faEye,
} from '@fortawesome/sharp-light-svg-icons';
import { useBrand } from './BrandContext';
import { firebaseService } from './services/firebase_service';

interface BrandProfileProps {
  isOpen: boolean;
  onClose: () => void;
  collegeId: string;
  onBrandUpdate?: () => void;
}

export default function BrandProfile({ isOpen, onClose, collegeId, onBrandUpdate }: BrandProfileProps) {
  const brand = useBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [instituteName, setInstituteName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F46E5');
  const [secondaryColor, setSecondaryColor] = useState('#7C3AED');
  const [accentColor, setAccentColor] = useState('#EC4899');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAnimatedIn, setIsAnimatedIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => { requestAnimationFrame(() => setIsAnimatedIn(true)); });
    } else {
      setIsAnimatedIn(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && collegeId) {
      loadBrandProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, collegeId]);

  const loadBrandProfile = async () => {
    if (!collegeId) {
      setError('No college selected. Please ensure you have a college assigned.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const profile = await firebaseService.getBrandProfile(collegeId);
      if (profile) {
        setInstituteName(profile.collegeName || '');
        setPrimaryColor(profile.primaryColor || '#4F46E5');
        setSecondaryColor(profile.secondaryColor || '#7C3AED');
        setAccentColor(profile.accentColor || '#EC4899');
        setLogoUrl(profile.instituteLogo || null);
        setLogoPreview(profile.instituteLogo || null);
      }
    } catch (err) {
      console.error('Error loading brand profile:', err);
      setError('Failed to load brand profile.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    if (file.size > 1024 * 1024) { setError('Logo must be less than 1MB'); return; }
    setLogoFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isValidHex = (hex: string) => /^#([0-9A-Fa-f]{6})$/.test(hex);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (!instituteName.trim()) { setError('Institute name is required'); return; }
    if (instituteName.trim().length > 40) { setError('Name must be 40 characters or less'); return; }
    if (!isValidHex(primaryColor)) { setError('Invalid primary color hex'); return; }
    if (!isValidHex(secondaryColor)) { setError('Invalid secondary color hex'); return; }
    if (!isValidHex(accentColor)) { setError('Invalid accent color hex'); return; }

    setIsSaving(true);
    try {
      let uploadedLogoUrl = logoUrl;
      if (logoFile) {
        uploadedLogoUrl = await firebaseService.uploadInstituteLogo(collegeId, logoFile);
        if (!uploadedLogoUrl) { setError('Failed to upload logo.'); setIsSaving(false); return; }
      }
      const result = await firebaseService.updateBrandProfile(collegeId, {
        instituteLogo: uploadedLogoUrl || '',
        collegeName: instituteName.trim(),
        primaryColor,
        secondaryColor,
        accentColor,
      });
      if (result) {
        setSuccess('Brand profile saved!');
        setLogoUrl(uploadedLogoUrl);
        setLogoFile(null);
        if (onBrandUpdate) onBrandUpdate();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to save. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ zIndex: 999999, opacity: isAnimatedIn ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-2 top-2 bottom-2 w-[calc(100%-16px)] max-w-[35rem] bg-white shadow-2xl overflow-hidden rounded-2xl flex flex-col transition-all duration-300 ease-out"
        style={{
          zIndex: 1000000,
          transform: isAnimatedIn ? 'translateX(0)' : 'translateX(100%)',
          opacity: isAnimatedIn ? 1 : 0,
        }}
      >
        {/* ── Header ── */}
        <div
          className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
          style={{ background: brand.gradients.primary }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 border border-white/20" style={{ background: 'rgba(255,255,255,0.18)' }}>
              <FontAwesomeIcon icon={faPalette} className="text-lg" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Brand Profile</h2>
              <p className="text-[11px] text-white/70">Customize institute branding</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors">
            <FontAwesomeIcon icon={faXmark} className="text-white" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${brand.colors.primary}10` }}>
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xl" style={{ color: brand.colors.primary }} />
              </div>
              <p className="text-xs text-gray-400">Loading brand profile…</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">

              {/* ── Status toasts ── */}
              {success && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-emerald-600 text-[10px]" />
                  </div>
                  <span className="text-[12px] font-medium text-emerald-700">{success}</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100">
                  <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <FontAwesomeIcon icon={faCircleExclamation} className="text-red-500 text-[10px]" />
                  </div>
                  <span className="text-[12px] font-medium text-red-600">{error}</span>
                </div>
              )}

              {/* ══════════ CARD 1 – Identity ══════════ */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden" style={{ background: 'linear-gradient(160deg, #fafafa 0%, #fff 100%)' }}>
                <div className="px-4 py-2.5 border-b border-gray-100/80">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Institute Identity</p>
                </div>
                <div className="p-4 space-y-4">
                  {/* Logo Upload */}
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800 mb-2">Institute Logo</p>
                    {logoPreview ? (
                      /* After upload - show preview */
                      <div className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 bg-white">
                        <div className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                          <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-700 truncate">{logoFile?.name || 'Institute logo'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">128 × 128px recommended</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all"
                            style={{ background: `${primaryColor}0c`, color: primaryColor, border: `1px solid ${primaryColor}20` }}
                          >
                            Change
                          </button>
                          <button onClick={handleRemoveLogo} className="px-2 py-1.5 text-[11px] rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-all">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Before upload - drag & drop zone */
                      <div
                        className="rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 bg-white cursor-pointer transition-all group"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('!border-blue-300', '!bg-blue-50/30'); }}
                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('!border-blue-300', '!bg-blue-50/30'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('!border-blue-300', '!bg-blue-50/30');
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                            handleLogoSelect(fakeEvent);
                          }
                        }}
                      >
                        <div className="flex flex-col items-center py-6 gap-2">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                            style={{ background: `${primaryColor}10` }}
                          >
                            <FontAwesomeIcon icon={faCloudArrowUp} className="text-lg" style={{ color: `${primaryColor}90` }} />
                          </div>
                          <div className="text-center">
                            <p className="text-[13px] font-semibold text-gray-700">Click to upload or drag and drop</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">PNG, JPG, SVG · Max 1MB · Displays at 128×128px</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoSelect} className="hidden" />
                  </div>

                  <div className="border-t border-dashed border-gray-100" />

                  {/* Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[13px] font-semibold text-gray-800">Institute Name</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: instituteName.length > 35 ? '#fef2f2' : `${primaryColor}08`,
                          color: instituteName.length > 35 ? '#ef4444' : `${primaryColor}80`,
                        }}
                      >{instituteName.length}/40</span>
                    </div>
                    <input
                      type="text" value={instituteName}
                      onChange={(e) => { if (e.target.value.length <= 40) { setInstituteName(e.target.value); setError(null); } }}
                      maxLength={40} placeholder="Enter institute name"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-900 bg-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                      style={{ '--tw-ring-color': `${brand.colors.primary}35` } as React.CSSProperties}
                    />
                  </div>
                </div>
              </div>

              {/* ══════════ CARD 2 – Colors ══════════ */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden" style={{ background: 'linear-gradient(160deg, #fafafa 0%, #fff 100%)' }}>
                <div className="px-4 py-2.5 border-b border-gray-100/80">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brand Colors</p>
                </div>
                <div className="p-4 space-y-4">
                  {/* Primary */}
                  {[
                    { label: 'Primary Color', value: primaryColor, setter: setPrimaryColor },
                    { label: 'Secondary Color', value: secondaryColor, setter: setSecondaryColor },
                    { label: 'Accent Color', value: accentColor, setter: setAccentColor },
                  ].map((color, idx) => (
                    <div key={color.label}>
                      {idx > 0 && <div className="border-t border-dashed border-gray-100 mb-4" />}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-[5px] shadow-sm border border-black/5" style={{ backgroundColor: color.value }} />
                        <p className="text-[13px] font-semibold text-gray-800">{color.label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 font-mono text-[13px] font-semibold">#</span>
                          <input type="text"
                            value={color.value.replace('#', '').toUpperCase()}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9A-Fa-f]/g, '').substring(0, 6);
                              color.setter('#' + v); setError(null);
                            }}
                            maxLength={6}
                            className="w-full px-3 py-2.5 pl-7 border border-gray-200 rounded-xl text-[13px] text-gray-900 font-mono uppercase bg-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                            style={{ '--tw-ring-color': `${brand.colors.primary}35` } as React.CSSProperties}
                          />
                        </div>
                        <label className="relative cursor-pointer flex-shrink-0">
                          <input type="color" value={color.value}
                            onChange={(e) => { color.setter(e.target.value); setError(null); }}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                          <div className="w-10 h-10 rounded-xl shadow-sm border border-black/5 hover:shadow-md transition-shadow"
                            style={{ background: `linear-gradient(135deg, ${color.value}, ${color.value}cc)` }} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══════════ CARD 3 – Preview ══════════ */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden" style={{ background: 'linear-gradient(160deg, #fafafa 0%, #fff 100%)' }}>
                <div className="px-4 py-2.5 border-b border-gray-100/80 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faEye} className="text-gray-300 text-[10px]" />
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Preview</p>
                </div>

                <div className="p-4 space-y-3">
                  {/* Mini header bar */}
                  <div className="rounded-xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor} 50%, ${accentColor})` }}>
                    <div className="px-3.5 py-3 flex items-center gap-3">
                      {logoPreview ? (
                        <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center p-0.5 border border-white/10">
                          <img src={logoPreview} alt="Logo" className="w-7 h-7 object-contain" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
                          <span className="text-white font-bold text-sm">{instituteName ? instituteName.charAt(0).toUpperCase() : 'E'}</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-[13px] leading-tight">EXAMINERS</h3>
                        <p className="text-[10px] text-white/60 truncate">{instituteName || 'Institute Name'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sample elements */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button className="px-3.5 py-1.5 rounded-lg text-white text-[11px] font-bold shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                      Primary
                    </button>
                    <button className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold"
                      style={{ border: `1.5px solid ${primaryColor}30`, color: primaryColor, background: `${primaryColor}05` }}>
                      Secondary
                    </button>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: `${accentColor}15`, color: accentColor }}>
                      Accent
                    </span>
                    <div className="flex-1 h-1.5 rounded-full ml-1" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, ${accentColor})` }} />
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 border-t border-gray-100">
          <div className="px-5 py-3 flex gap-3">
            <button onClick={onClose} disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-[13px] hover:bg-gray-50 transition-all disabled:opacity-50">
              Close
            </button>
            <button onClick={handleSave} disabled={isSaving || isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              style={{ background: brand.gradients.primary }}>
              {isSaving ? (
                <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /><span>Saving…</span></>
              ) : (
                <><FontAwesomeIcon icon={faFloppyDisk} /><span>Save Changes</span></>
              )}
            </button>
          </div>
          <div className="border-t border-gray-100 px-5 py-2 text-center">
            <span className="text-[10px] text-gray-300 uppercase tracking-wider">Brand Profile • {collegeId}</span>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
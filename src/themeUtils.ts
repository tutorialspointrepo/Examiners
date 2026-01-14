// themeUtils.ts
// Utility to detect subdomain and return appropriate college theme

import { collegeThemes, generateBrandTheme, type BrandTheme } from './BrandContext';

/**
 * Extract subdomain from hostname
 * Examples:
 *   lpu.tutorialspoint.com → 'lpu'
 *   dps.tutorialspoint.com → 'dps'
 *   lpu.localhost → 'lpu'
 *   localhost → 'default'
 *   tutorialspoint.com → 'default'
 */
export const getSubdomain = (): string => {
  const hostname = window.location.hostname;
  
  // For localhost or IP addresses WITHOUT subdomain, return default
  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return 'default';
  }
  
  // Split hostname by dots
  const parts = hostname.split('.');
  
  // If hostname has subdomain (e.g., lpu.tutorialspoint.com or lpu.localhost)
  // parts = ['lpu', 'tutorialspoint', 'com'] (3 parts)
  // parts = ['lpu', 'localhost'] (2 parts)
  if (parts.length >= 2) {  // Changed from >= 3 to >= 2 to support lpu.localhost
    const subdomain = parts[0];
    
    // Check if this subdomain matches any of our college themes
    if (collegeThemes[subdomain]) {
      return subdomain;
    }
  }
  
  // If no subdomain or unrecognized subdomain, return default
  return 'default';
};

/**
 * Get college theme based on subdomain
 * This is the main function to use for automatic theme detection
 */
export const getThemeFromSubdomain = (): BrandTheme => {
  const subdomain = getSubdomain();
  const themeConfig = collegeThemes[subdomain] || collegeThemes['default'];
  
  return generateBrandTheme(
    themeConfig.color,
    themeConfig.name,
    subdomain
  );
};

/**
 * Get college info from subdomain
 * Returns basic college information without generating full theme
 */
export const getCollegeInfo = () => {
  const subdomain = getSubdomain();
  const themeConfig = collegeThemes[subdomain] || collegeThemes['default'];
  
  return {
    collegeId: subdomain,
    collegeName: themeConfig.name,
    color: themeConfig.color,
    subdomain: subdomain
  };
};

/**
 * Debug function to log current theme info
 * Useful for development and troubleshooting
 */
export const debugTheme = () => {
  const subdomain = getSubdomain();
  const themeConfig = collegeThemes[subdomain] || collegeThemes['default'];
  
  console.log('🎨 Theme Debug Info:');
  console.log('  Hostname:', window.location.hostname);
  console.log('  Detected Subdomain:', subdomain);
  console.log('  College Name:', themeConfig.name);
  console.log('  Primary Color:', themeConfig.color);
  console.log('  Available Themes:', Object.keys(collegeThemes));
};

/**
 * Check if current subdomain is valid/recognized
 */
export const isValidSubdomain = (): boolean => {
  const subdomain = getSubdomain();
  return subdomain in collegeThemes;
};

/**
 * Get list of all available college themes
 */
export const getAvailableThemes = () => {
  return Object.entries(collegeThemes).map(([id, config]) => ({
    id,
    name: config.name,
    color: config.color
  }));
};
import { createContext, useContext, useEffect, type ReactNode } from 'react';

export interface BrandColors {
  primary: string;      // Main brand color (e.g., '#4F46E5' for indigo)
  secondary: string;    // Secondary color (usually lighter/darker variant)
  accent: string;       // Accent color for highlights
}

export interface BrandTheme {
  colors: BrandColors;
  gradients: {
    primary: string;    // Gradient for logos, buttons
    secondary: string;  // Secondary gradient
    header: string;     // Gradient for headers
    card: string;       // Gradient for cards
    background: string; // Background gradient
  };
  collegeName: string;
  collegeId: string;
  instituteLogo?: string;  // Logo URL from Firestore
}

// Helper function to generate theme from brand colors
// If secondaryColor/accentColor provided (from Firestore), use them directly.
// Otherwise fall back to hardcoded colorSchemes lookup.
export const generateBrandTheme = (
  primaryColor: string,
  collegeName: string,
  collegeId: string,
  secondaryColor?: string,
  accentColor?: string
): BrandTheme => {
  // Hardcoded fallback schemes (used when Firestore brand profile is not set)
  const getColorVariants = (baseColor: string): BrandColors => {
    const colorSchemes: { [key: string]: BrandColors } = {
    // Indigo/Purple (Default EXAMINERS)
    '#4F46E5': {
      primary: '#4F46E5',
      secondary: '#7C3AED',
      accent: '#EC4899'
    },
    // Blue
    '#3B82F6': {
      primary: '#3B82F6',
      secondary: '#2563EB',
      accent: '#06B6D4'
    },
    // Green
    '#10B981': {
      primary: '#10B981',
      secondary: '#059669',
      accent: '#14B8A6'
    },
    // Orange (Sunrise)
    '#F97316': {
      primary: '#F97316',
      secondary: '#EA580C',
      accent: '#FB923C'
    },
    // LPU Orange
    '#FF6B35': {
      primary: '#FF6B35',
      secondary: '#FB923C',
      accent: '#FBBF24'
    },
    // SGT University Navy Blue
    '#4d9beaff': {
      primary: '#1382f0ff',
      secondary: '#0671dcff',
      accent: '#ec9448ff'
    },
    // Red
    '#EF4444': {
      primary: '#EF4444',
      secondary: '#DC2626',
      accent: '#F87171'
    },
    // Pink
    '#EC4899': {
      primary: '#EC4899',
      secondary: '#DB2777',
      accent: '#F472B6'
    },
    // Teal
    '#14B8A6': {
      primary: '#14B8A6',
      secondary: '#0D9488',
      accent: '#2DD4BF'
    },
    // Yellow/Amber
    '#F59E0B': {
      primary: '#F59E0B',
      secondary: '#D97706',
      accent: '#FBBF24'
    },
  };

    return colorSchemes[baseColor] || colorSchemes['#4F46E5'];
  };

  // If all 3 colors provided from Firestore, use them directly
  // Otherwise fall back to hardcoded lookup
  const colors: BrandColors = (secondaryColor && accentColor)
    ? { primary: primaryColor, secondary: secondaryColor, accent: accentColor }
    : getColorVariants(primaryColor);

  return {
    colors,
    gradients: {
      primary: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.accent} 100%)`,
      secondary: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.accent} 100%)`,
      header: `linear-gradient(to right, ${colors.primary}, ${colors.secondary})`,
      card: `linear-gradient(135deg, ${colors.primary}10 0%, ${colors.secondary}10 100%)`,
      background: `linear-gradient(to bottom right, ${colors.primary}08, ${colors.secondary}08, ${colors.accent}08)`
    },
    collegeName,
    collegeId
  };
};

// Default theme (EXAMINERS brand)
const defaultTheme: BrandTheme = generateBrandTheme('#4F46E5', 'EXAMINERS', 'default');

const BrandContext = createContext<BrandTheme>(defaultTheme);

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within BrandProvider');
  }
  return context;
};

interface BrandProviderProps {
  children: ReactNode;
  theme: BrandTheme;
}

export const BrandProvider = ({ children, theme }: BrandProviderProps) => {
  useEffect(() => {
    console.log('🎨 [BrandProvider] Theme updated:', {
      primary: theme.colors.primary,
      collegeName: theme.collegeName,
      collegeId: theme.collegeId
    });
  }, [theme]);
  
  return (
    <BrandContext.Provider value={theme}>
      {children}
    </BrandContext.Provider>
  );
};

// Updated college themes with SGT University
export const collegeThemes: { [key: string]: { color: string; name: string; secondary?: string; accent?: string } } = {
  'default': { color: '#4F46E5', name: 'EXAMINERS' },
  'lpu': { color: '#FF6B35', name: 'Lovely Professional University' },
  'sgt': { color: '#4d9beaff', name: 'SGT University' }, // 🆕 Deep Navy Blue with Orange/Yellow accents
  'dps': { color: '#3B82F6', name: 'Delhi Public School' },
  'greenwood': { color: '#10B981', name: 'Greenwood Academy' },
  'sunrise': { color: '#F97316', name: 'Sunrise International' },
  'royal': { color: '#EC4899', name: 'Royal College' },
  'techno': { color: '#14B8A6', name: 'Techno Institute' },
};
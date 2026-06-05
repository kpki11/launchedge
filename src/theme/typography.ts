// src/theme/typography.ts
// Fonts: Cormorant Garamond (display), DM Sans (body), JetBrains Mono (code/badges)
// Load fonts via useFonts() in App.tsx

export const Typography = {
  displayXL:  { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 36, lineHeight: 44 },
  displayL:   { fontFamily: 'CormorantGaramond_500Medium',   fontSize: 28, lineHeight: 36 },
  displayM:   { fontFamily: 'CormorantGaramond_400Regular',  fontSize: 22, lineHeight: 30 },
  headingL:   { fontFamily: 'DMSans_600SemiBold',  fontSize: 20, lineHeight: 28 },
  headingM:   { fontFamily: 'DMSans_500Medium',    fontSize: 17, lineHeight: 24 },
  headingS:   { fontFamily: 'DMSans_500Medium',    fontSize: 15, lineHeight: 22 },
  bodyL:      { fontFamily: 'DMSans_400Regular',   fontSize: 16, lineHeight: 24 },
  bodyM:      { fontFamily: 'DMSans_400Regular',   fontSize: 14, lineHeight: 22 },
  bodyS:      { fontFamily: 'DMSans_400Regular',   fontSize: 13, lineHeight: 20 },
  label:      { fontFamily: 'DMSans_500Medium',    fontSize: 12, lineHeight: 18, letterSpacing: 0.5 },
  labelCaps:  { fontFamily: 'DMSans_500Medium',    fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  mono:       { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, lineHeight: 18 },
};

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const Radius = {
  sm: 6, md: 10, lg: 14, xl: 20, full: 999,
};

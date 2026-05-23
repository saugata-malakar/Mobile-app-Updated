/** Section 10 palette — doctor web dashboard */
export const colours = {
  primary: '#1A3A5C',
  secondary: '#2463AE',
  success: '#0D6B55',
  warning: '#E67E00',
  danger: '#7B1818',
  background: '#F4F8FC',
  card: '#FFFFFF',
  text: '#0F0F0F',
  muted: '#5A5A5A',
  border: '#D4D9E0',
  highlightGreen: '#E8F3DC',
  highlightAmber: '#FEF3E2',
  highlightRed: '#FBE8E8',
  bannerGreenText: '#234F09',
  bannerAmberText: '#7A3B00',
  bannerRedText: '#7B1818',
};

export const alertBanner = {
  RED: { bg: colours.highlightRed, text: colours.bannerRedText, border: '#C0392B', icon: '✕' },
  AMBER: { bg: colours.highlightAmber, text: colours.bannerAmberText, border: colours.warning, icon: '⚠' },
  GREEN: { bg: colours.highlightGreen, text: colours.bannerGreenText, border: '#27500A', icon: '✓' },
};

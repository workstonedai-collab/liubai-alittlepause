export const theme = Object.freeze({ background: '#f6f7f2', paper: '#fffefa', ink: '#293d35',
  green: '#3c5848', muted: '#687463', line: '#dfe5d7' });
export const moodPalette = Object.freeze([
  { color: '#c5cfdd', line: '#6e7e91' }, { color: '#d6ccdf', line: '#8d7899' },
  { color: '#e9dfb9', line: '#a79865' }, { color: '#c8d6b7', line: '#7e9567' },
  { color: '#edc8a7', line: '#b28c65' },
].map(Object.freeze));
export const layout = Object.freeze({ spacing: [4, 8, 12, 16, 24, 32], radius: 10,
  minimumViewport: 320, mobileNavigationHeight: 72, reducedMotion: true });
export const webVariables = Object.freeze({ background: '--bg', paper: '--paper', ink: '--ink',
  green: '--green', muted: '--muted', line: '--line' });
// Web and extension share these values. Native adapters may translate them;
// they do not inherit browser glass or animation effects automatically.
export const interaction = Object.freeze({ pressDuration: '120ms', stateDuration: '180ms',
  overlayDuration: '220ms', easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)', pressScale: '0.985',
  targetSize: '44px', focusRing: '#6b875c', surfaceFloating: '#f3f6ee',
  surfaceGlass: 'rgba(247, 249, 243, 0.9)', borderFloating: 'rgba(126, 148, 119, 0.28)',
  shadowFloating: '0 5px 18px rgba(41, 61, 53, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.8)' });
export const interactionWebVariables = Object.freeze({ pressDuration: '--duration-press',
  stateDuration: '--duration-state', overlayDuration: '--duration-overlay', easing: '--ease-ui',
  pressScale: '--press-scale', targetSize: '--target-size', focusRing: '--focus-ring',
  surfaceFloating: '--surface-floating', surfaceGlass: '--surface-glass',
  borderFloating: '--border-floating', shadowFloating: '--shadow-floating' });
// Other platforms translate semantic tokens in their own adapters.
export function themeVariables(value = theme) {
  return Object.fromEntries([
    ...Object.entries(webVariables).map(([key, variable]) => [variable, value[key]]),
    ...Object.entries(interactionWebVariables).map(([key, variable]) => [variable, interaction[key]]),
  ]);
}

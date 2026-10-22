export { makeAIRequest, mockAI } from '../../packages/core/ai.js';
// Default is off. The web dialog opts into a local mock for one selected entry only.
export const AI_FEATURE = Object.freeze({ enabled: false, mode: 'mock', transport: null });

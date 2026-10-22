import { theme, moodPalette } from '../packages/design-tokens/index.js';
import { TAG_IDS } from '../packages/data-contract/index.js';
export { messages, translate } from '../packages/content/index.js';
export const CONFIG = { name: '留白 · A Little Pause', theme, moods: moodPalette, tags: [...TAG_IDS] };

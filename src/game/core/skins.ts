/** A comet skin: body, halo glow, and trail colour. Earned, never bought. */
export interface Skin {
  id: string;
  name: string;
  body: string;
  glow: string;
  trail: string;
}

export const SKINS: Skin[] = [
  { id: 'aurora', name: 'Aurora', body: '#4de1c1', glow: '#4de1c1', trail: '#4de1c1' },
  { id: 'ember', name: 'Ember', body: '#ff8a4d', glow: '#ff6a2a', trail: '#ffb457' },
  { id: 'rose', name: 'Rose', body: '#ff7a90', glow: '#ff4f74', trail: '#ffa7b8' },
  { id: 'violet', name: 'Violet', body: '#a98bff', glow: '#7c5cff', trail: '#c9b7ff' },
  { id: 'ice', name: 'Ice', body: '#7fd8ff', glow: '#3fb6ff', trail: '#bff0ff' },
  { id: 'lime', name: 'Lime', body: '#b6ff5a', glow: '#8ae000', trail: '#d8ff9a' },
  { id: 'gold', name: 'Gold', body: '#ffd45a', glow: '#ffb400', trail: '#ffe89a' },
  { id: 'magenta', name: 'Magenta', body: '#ff5ad4', glow: '#ff00b4', trail: '#ff9ae8' },
  { id: 'azure', name: 'Azure', body: '#5a8cff', glow: '#2a5cff', trail: '#9ab7ff' },
  { id: 'mint', name: 'Mint', body: '#5affa0', glow: '#00e070', trail: '#9affca' },
  { id: 'crimson', name: 'Crimson', body: '#ff5a5a', glow: '#ff0000', trail: '#ff9a9a' },
  { id: 'sun', name: 'Solar', body: '#ffe14d', glow: '#ff9d00', trail: '#fff0a0' },
  { id: 'plasma', name: 'Plasma', body: '#d45aff', glow: '#a000ff', trail: '#e8a0ff' },
  { id: 'ghost', name: 'Wisp', body: '#eaf1ff', glow: '#a8c4ff', trail: '#ffffff' },
];

export const DEFAULT_SKIN = SKINS[0] as Skin;

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? DEFAULT_SKIN;
}

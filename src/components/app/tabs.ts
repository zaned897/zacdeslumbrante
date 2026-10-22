// PROTO: enrutado por hash para no meter un router todavía. /#3d sigue abriendo la ciudad 3D.
export type AppTab = 'chat' | '3d' | 'pet' | 'badges' | 'plans';

const HASH_BY_TAB: Record<AppTab, string> = {
  chat: '',
  '3d': '#3d',
  pet: '#mascota',
  badges: '#insignias',
  plans: '#planes',
};

export function tabFromHash(hash: string): AppTab {
  const found = (Object.keys(HASH_BY_TAB) as AppTab[]).find(
    (tab) => HASH_BY_TAB[tab] !== '' && HASH_BY_TAB[tab] === hash,
  );
  return found ?? 'chat';
}

export function goToTab(tab: AppTab) {
  const hash = HASH_BY_TAB[tab];
  if (hash) {
    window.location.hash = hash;
  } else {
    // Quita el hash sin dejar un "#" colgando ni recargar.
    history.pushState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

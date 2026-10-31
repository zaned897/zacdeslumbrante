// PROTO: enrutado por hash para no meter un router todavía. La ciudad 3D es el inicio (#111); /#3d sigue abriéndola.
export type AppTab = 'chat' | '3d' | 'pet' | 'badges' | 'plans' | 'team';

const HASH_BY_TAB: Record<AppTab, string> = {
  '3d': '',
  pet: '#mascota',
  chat: '#chat',
  badges: '#insignias',
  plans: '#planes',
  team: '#equipo',
};

// Enlaces viejos que siguen funcionando.
const HASH_ALIASES: Record<string, AppTab> = { '#3d': '3d' };

export function tabFromHash(hash: string): AppTab {
  const found = (Object.keys(HASH_BY_TAB) as AppTab[]).find(
    (tab) => HASH_BY_TAB[tab] !== '' && HASH_BY_TAB[tab] === hash,
  );
  return found ?? HASH_ALIASES[hash] ?? '3d';
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

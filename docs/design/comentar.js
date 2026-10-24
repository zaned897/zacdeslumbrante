// Botón «Comentar» del sitio de diseño (zacdes-diseno en Render).
// El sitio es estático: no guarda comentarios. Cada botón abre una issue de GitHub
// con la plantilla «Comentario de diseño» y la sección ya llenada; Claude la convierte en un PR [sketch].
(() => {
  const REPO = 'zaned897/zacdeslumbrante';
  if (navigator.webdriver || location.hostname.endsWith('claude.ai')) return; // ni en capturas ni en la copia de claude.ai

  const issueUrl = (title, anchor) => {
    const u = new URL(`https://github.com/${REPO}/issues/new`);
    u.searchParams.set('template', 'diseno.yml');
    u.searchParams.set('title', `[diseño] ${title}`.slice(0, 120));
    u.searchParams.set('seccion', location.origin + location.pathname + (anchor ? `#${anchor}` : ''));
    return u.href;
  };

  const css = document.createElement('style');
  css.textContent = `
    .dz-comentar { font: 600 13px/1 system-ui, sans-serif; color: var(--cantera, #9A3412); background: var(--papel, #fff);
      border: 1px solid currentColor; border-radius: 999px; padding: 7px 12px; text-decoration: none; white-space: nowrap; }
    .dz-comentar:hover, .dz-comentar:focus-visible { background: var(--cantera, #9A3412); color: var(--papel, #fff); }
    .dz-comentar--seccion { align-self: flex-start; }
    .dz-comentar--flota { position: fixed; right: 16px; bottom: 16px; z-index: 50; box-shadow: 0 4px 14px rgb(0 0 0 / .18); }`;
  document.head.append(css);

  const make = (title, anchor, cls) => {
    const a = document.createElement('a');
    a.className = `dz-comentar ${cls}`;
    a.href = issueUrl(title, anchor);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = anchor ? '💬 Comentar esta sección' : '💬 Comentar';
    a.title = 'Abre una issue en GitHub con esta sección ya indicada';
    return a;
  };

  // Una por sección con id (las mismas hojas que compara design-shots.mjs).
  for (const el of document.querySelectorAll('.block[id], main > section[id]')) {
    if (el.querySelector('.block')) continue;
    const title = (el.querySelector('h2, h3')?.textContent || el.id).trim().replace(/\s+/g, ' ');
    const btn = make(title, el.id, 'dz-comentar--seccion');
    const head = el.querySelector('.block-head') || el.querySelector('h2, h3')?.parentElement || el;
    head.append(btn);
  }
  document.body.append(make(document.title || 'Adelanto', '', 'dz-comentar--flota'));
})();

// Modo comentario del sitio de diseño (zacdes-diseno en Render), al estilo del artefacto de claude.ai (#100).
// 💬 activa el modo: al pasar el cursor se resalta el elemento; clic → escribe el comentario → se envía.
// Destino: si el <script> trae data-api (zacdes-api), POST {api}/design-comments, que crea la issue;
// si no, abre una issue de GitHub ya llenada (plantilla diseno.yml). Los pines enviados se guardan en este navegador.
(() => {
  const REPO = 'zaned897/zacdeslumbrante';
  if (navigator.webdriver || location.hostname.endsWith('claude.ai')) return; // ni en capturas ni en la copia de claude.ai
  const API = document.currentScript?.dataset.api?.replace(/\/$/, '') || '';
  const PAGE = location.pathname;
  const STORE = `dz-comentarios:${PAGE}`;

  // ---- utilidades -------------------------------------------------------
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } };
  const save = (list) => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { /* sin almacenamiento: los pines duran la visita */ } };
  const clean = (s, n) => (s || '').trim().replace(/\s+/g, ' ').slice(0, n);

  // Selector estable: el ancestro más cercano con id + ruta nth-of-type.
  function selectorOf(el) {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
      if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
      const same = [...(n.parentElement?.children || [])].filter((c) => c.tagName === n.tagName);
      parts.unshift(same.length > 1 ? `${n.tagName.toLowerCase()}:nth-of-type(${same.indexOf(n) + 1})` : n.tagName.toLowerCase());
    }
    return parts.join(' > ');
  }
  const sectionOf = (el) => el.closest('.block[id], main > section[id], section[id], [id]');
  const describe = (el) => {
    const sec = sectionOf(el);
    const title = clean(sec?.querySelector('h2, h3')?.textContent || sec?.id || document.title, 80);
    return { selector: selectorOf(el), anchor: sec?.id || '', section: title, text: clean(el.innerText || el.getAttribute('alt') || '', 160) };
  };

  // ---- UI en shadow DOM (no choca con los estilos de la página) ----------
  const host = document.createElement('div');
  host.setAttribute('data-dz', '');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font: 14px/1.4 system-ui, -apple-system, sans-serif; }
    .hl { position: fixed; pointer-events: none; z-index: 2147483000; border: 2px solid #C2410C; background: rgb(194 65 12 / .08); border-radius: 4px; display: none; }
    .tag { position: absolute; top: -24px; left: -2px; background: #C2410C; color: #fff; font-size: 12px; padding: 2px 6px; border-radius: 4px; white-space: nowrap; max-width: 70vw; overflow: hidden; text-overflow: ellipsis; }
    .fab { position: fixed; right: 16px; bottom: 16px; z-index: 2147483001; border: 0; border-radius: 999px; padding: 12px 16px; background: #9A3412; color: #fff; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgb(0 0 0 / .25); }
    .fab[aria-pressed="true"] { background: #1C1917; }
    .bar { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); z-index: 2147483001; background: #1C1917; color: #fff; padding: 8px 14px; border-radius: 999px; display: none; max-width: calc(100vw - 32px); text-align: center; }
    .pop { position: fixed; z-index: 2147483002; width: min(340px, calc(100vw - 32px)); background: #FFFBF5; color: #1C1917; border: 1px solid #D6CFC4; border-radius: 12px; padding: 12px; box-shadow: 0 10px 30px rgb(0 0 0 / .25); display: none; }
    .pop p { margin: 0 0 8px; color: #57534E; font-size: 12px; }
    .pop textarea, .pop input { width: 100%; border: 1px solid #D6CFC4; border-radius: 8px; padding: 8px; background: #fff; color: inherit; }
    .pop textarea { min-height: 96px; resize: vertical; }
    .pop input { margin-top: 6px; }
    .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
    .row button { border: 1px solid #9A3412; border-radius: 8px; padding: 7px 12px; cursor: pointer; background: #fff; color: #9A3412; font-weight: 600; }
    .row button.primary { background: #9A3412; color: #fff; }
    .row button:disabled { opacity: .5; cursor: default; }
    .msg { margin-top: 8px; font-size: 12px; }
    .pin { position: absolute; z-index: 2147483000; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50% 50% 50% 4px; background: #C2410C; color: #fff; font-size: 12px; font-weight: 700; display: grid; place-items: center; border: 2px solid #fff; cursor: pointer; box-shadow: 0 2px 6px rgb(0 0 0 / .3); }
    @media (prefers-color-scheme: dark) {
      .pop { background: #1F1A16; color: #F2ECE1; border-color: #3A312A; }
      .pop p { color: #B8AFA4; }
      .pop textarea, .pop input { background: #171310; border-color: #3A312A; }
      .row button { background: transparent; color: #F59E6B; border-color: #F59E6B; }
      .row button.primary { background: #F59E6B; color: #1C1917; }
    }
  </style>
  <div class="hl"><span class="tag"></span></div>
  <div class="bar">Toca o haz clic en lo que quieras comentar · Esc para salir</div>
  <div class="pins"></div>
  <form class="pop" novalidate>
    <p class="where"></p>
    <textarea name="texto" required placeholder="¿Qué cambiarías aquí? Describe lo que ves y lo que propones."></textarea>
    <input name="autor" placeholder="Tu nombre o usuario de GitHub (opcional)" maxlength="60">
    <div class="row"><button type="button" class="cancel">Cancelar</button><button class="primary">Enviar</button></div>
    <div class="msg" role="status"></div>
  </form>
  <button class="fab" aria-pressed="false" title="Comentar una parte de esta página">💬 Comentar</button>`;

  const $ = (s) => root.querySelector(s);
  const hl = $('.hl'), tag = $('.tag'), bar = $('.bar'), pop = $('.pop'), fab = $('.fab'), pinsEl = $('.pins');
  let on = false, target = null, picked = null;

  const boxTo = (el) => {
    const r = el.getBoundingClientRect();
    Object.assign(hl.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    tag.textContent = describe(el).section;
  };
  const isOurs = (el) => el === host || host.contains(el);

  function setMode(v) {
    on = v; fab.setAttribute('aria-pressed', String(v)); fab.textContent = v ? '✕ Salir' : '💬 Comentar';
    bar.style.display = v ? 'block' : 'none';
    document.documentElement.style.cursor = v ? 'crosshair' : '';
    if (!v) { hl.style.display = 'none'; pop.style.display = 'none'; picked = null; }
  }

  function openPop(el) {
    picked = el; boxTo(el);
    const d = describe(el);
    $('.where').textContent = `Sobre: ${d.section}${d.text ? ` · «${d.text.slice(0, 60)}»` : ''}`;
    $('.msg').textContent = '';
    const r = el.getBoundingClientRect();
    const w = Math.min(340, innerWidth - 32);
    pop.style.display = 'block';
    pop.style.left = `${Math.max(16, Math.min(r.left, innerWidth - w - 16))}px`;
    const below = r.bottom + 8, h = pop.offsetHeight;
    pop.style.top = `${below + h < innerHeight ? below : Math.max(16, r.top - h - 8)}px`;
    pop.querySelector('textarea').focus();
  }

  // ---- eventos de selección ----------------------------------------------
  document.addEventListener('mousemove', (e) => {
    if (!on || picked) return;
    const el = e.target;
    if (isOurs(el) || el === document.documentElement || el === document.body) return;
    target = el; boxTo(el);
  }, true);
  document.addEventListener('click', (e) => {
    if (!on || isOurs(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    if (!picked) openPop(e.target);
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && on) setMode(false); });
  addEventListener('scroll', () => { if (picked) boxTo(picked); else if (on && target) boxTo(target); }, { passive: true });
  fab.addEventListener('click', () => setMode(!on));
  $('.cancel').addEventListener('click', () => { picked = null; pop.style.display = 'none'; });

  // ---- envío --------------------------------------------------------------
  const issueUrl = (d, texto, autor) => {
    const u = new URL(`https://github.com/${REPO}/issues/new`);
    u.searchParams.set('template', 'diseno.yml');
    u.searchParams.set('title', `[diseño] ${d.section}: ${clean(texto, 60)}`.slice(0, 120));
    u.searchParams.set('seccion', location.origin + PAGE + (d.anchor ? `#${d.anchor}` : ''));
    u.searchParams.set('elemento', d.selector);
    u.searchParams.set('comentario', texto + (autor ? `\n\n— ${autor}` : ''));
    return u.href;
  };

  pop.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = clean(pop.texto.value, 2000), autor = clean(pop.autor.value, 60);
    if (!texto || !picked) { $('.msg').textContent = 'Escribe tu comentario.'; return; }
    const d = describe(picked);
    const btn = pop.querySelector('.primary'); btn.disabled = true;
    let url = '';
    try {
      if (API) {
        const res = await fetch(`${API}/design-comments`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: PAGE, url: location.href.split('#')[0], anchor: d.anchor, section: d.section, selector: d.selector, elementText: d.text, comment: texto, author: autor, viewport: { width: innerWidth, height: innerHeight } }),
        });
        if (!res.ok) throw new Error(String(res.status));
        url = (await res.json()).issueUrl || '';
      } else {
        url = issueUrl(d, texto, autor);
        open(url, '_blank', 'noopener');
      }
      const list = load(); list.push({ selector: d.selector, comment: texto, url, at: Date.now() }); save(list);
      pop.reset(); pop.style.display = 'none'; picked = null;
      renderPins();
      bar.textContent = API ? '¡Enviado! Se creó la issue. Sigue comentando o Esc para salir.' : 'Termina de enviarlo en la pestaña de GitHub. Esc para salir.';
    } catch {
      $('.msg').textContent = 'No se pudo enviar. Intenta de nuevo en un momento.';
    } finally { btn.disabled = false; }
  });

  // ---- pines --------------------------------------------------------------
  function renderPins() {
    pinsEl.innerHTML = '';
    load().forEach((c, i) => {
      let el; try { el = document.querySelector(c.selector); } catch { el = null; }
      if (!el) return;
      const r = el.getBoundingClientRect();
      const a = document.createElement(c.url ? 'a' : 'span');
      a.className = 'pin'; a.textContent = String(i + 1); a.title = c.comment;
      if (c.url) { a.href = c.url; a.target = '_blank'; a.rel = 'noopener'; }
      a.style.left = `${r.right + scrollX - 6}px`; a.style.top = `${r.top + scrollY + 6}px`;
      pinsEl.append(a);
    });
  }
  pinsEl.style.cssText = 'position:absolute;left:0;top:0';
  addEventListener('load', renderPins); addEventListener('resize', renderPins);
  renderPins();
})();

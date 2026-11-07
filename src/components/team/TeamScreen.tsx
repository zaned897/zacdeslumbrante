import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Github, Globe, Instagram, Linkedin, Twitter, type LucideIcon } from 'lucide-react';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../data/i18n';
import {
  COLLABORATOR_AREAS,
  Collaborator,
  CollaboratorArea,
  SAMPLE_COLLABORATORS,
  SocialNetwork,
} from '../../data/collaborators';

const NETWORK_ICONS: Record<SocialNetwork, LucideIcon> = {
  github: Github,
  instagram: Instagram,
  linkedin: Linkedin,
  x: Twitter,
  web: Globe,
};

interface TeamScreenProps {
  language: Language;
}

/** Pestaña Equipo (#116, propuesta E): las personas del taller, filtradas por área, con su perfil y sus redes. */
export const TeamScreen: React.FC<TeamScreenProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const [people, setPeople] = useState<Collaborator[] | null>(null);
  const [isMock, setIsMock] = useState(true);
  const [area, setArea] = useState<CollaboratorArea | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/py/colaboradores', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { collaborators: Collaborator[]; _mock?: boolean }) => {
        setPeople(data.collaborators);
        setIsMock(data._mock ?? false);
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return;
        // PROTO: sin la API (Python apagado o #115 sin fusionar) se usan las mismas personas de ejemplo.
        setPeople(SAMPLE_COLLABORATORS);
        setIsMock(true);
      });
    return () => controller.abort();
  }, []);

  // Al entrar o salir de un perfil, arriba de nuevo.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [openId]);

  const networkName = (n: SocialNetwork) =>
    ({ github: 'GitHub', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X', web: t.teamWeb })[n];
  const areaName = (a: CollaboratorArea) => t[`teamArea_${a}`];
  const visible = (people ?? []).filter((p) => area === null || p.area === area);
  const open = people?.find((p) => p.id === openId);

  const demoBadge = isMock && (
    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-terracota rounded">{t.demoBadge}</span>
  );

  const socialLink = (s: Collaborator['socials'][number], name: string) => {
    const Icon = NETWORK_ICONS[s.network];
    return (
      <a
        key={s.url}
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${networkName(s.network)} · ${name}`}
        className="grid w-8 h-8 place-items-center rounded-full bg-caliza text-cantera hover:bg-cita focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera"
      >
        <Icon className="w-4 h-4" />
      </a>
    );
  };

  return (
    <div ref={scroller} className="h-full overflow-y-auto bg-papel">
      <header
        className="px-4 pb-4 bg-gradient-to-b from-[#9A3412] to-[#7C2D12] text-white"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="mx-auto max-w-lg flex flex-col gap-1">
          {open ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label={t.teamBack}
                className="grid w-9 h-9 place-items-center rounded-xl bg-white text-[#9A3412] shadow cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              {demoBadge}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-extrabold">{t.teamTitle}</h1>
                {demoBadge}
              </div>
              <small className="text-xs opacity-85">{t.teamSubtitle}</small>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-4">
        {people === null ? (
          <p className="py-8 text-center text-sm text-tenue" aria-busy="true">
            {t.teamLoading}
          </p>
        ) : open ? (
          <article className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <span
                className="grid w-20 h-20 place-items-center rounded-full text-2xl font-extrabold text-white"
                style={{ background: open.color }}
                aria-hidden="true"
              >
                {open.initials}
              </span>
              <h2 className="text-xl font-extrabold">{open.name}</h2>
              <small className="text-xs text-tenue">
                {areaName(open.area)} · {open.role[language]}
              </small>
              <p className="text-sm leading-snug">{open.bio[language]}</p>
              {open.contributions.length > 0 && (
                <ul className="flex flex-wrap justify-center gap-1.5" aria-label={t.teamContributions}>
                  {open.contributions.map((c) => (
                    <li key={c.es} className="rounded-full bg-cita px-2.5 py-1 text-xs font-semibold text-cantera">
                      {c[language]}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {open.socials.length > 0 ? (
              <ul className="flex flex-col gap-2" aria-label={t.teamNetworks}>
                {open.socials.map((s) => {
                  const Icon = NETWORK_ICONS[s.network];
                  return (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-linea bg-superficie px-3 py-2.5 hover:border-cantera focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera"
                      >
                        <span className="grid w-8 h-8 place-items-center rounded-full bg-caliza text-cantera">
                          <Icon className="w-4 h-4" />
                        </span>
                        <b className="text-sm">{networkName(s.network)}</b>
                        <small className="ml-auto truncate text-xs text-tenue">{s.handle}</small>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-center text-xs text-tenue">{t.teamNoSocials}</p>
            )}
          </article>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Una sola fila que se desliza, como en el diseño; sin barra de scroll. */}
            <div
              className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label={t.teamFilters}
            >
              {[null, ...COLLABORATOR_AREAS].map((a) => {
                const on = a === area;
                return (
                  <button
                    key={a ?? 'all'}
                    type="button"
                    onClick={() => setArea(a)}
                    aria-pressed={on}
                    className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera ${
                      on ? 'border-cantera bg-cantera text-sobre-cantera' : 'border-linea bg-superficie text-carbon hover:bg-caliza'
                    }`}
                  >
                    {a === null ? `${t.teamAll} · ${people.length}` : areaName(a)}
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-tenue">{t.teamEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visible.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-3xl border border-linea bg-superficie p-2.5 pr-3"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(p.id)}
                      aria-label={t.teamOpenProfile.replace('{name}', p.name)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cantera"
                    >
                      <span
                        className="grid w-11 h-11 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white"
                        style={{ background: p.color }}
                        aria-hidden="true"
                      >
                        {p.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15px] font-bold leading-snug">{p.name}</b>
                        <small className="block truncate text-[11px] text-tenue">
                          {areaName(p.area)} · {p.role[language]}
                        </small>
                      </span>
                      {p.socials.length === 0 && <ChevronRight className="w-4 h-4 shrink-0 text-tenue" />}
                    </button>
                    {p.socials.length > 0 && (
                      <span className="flex shrink-0 gap-1">{p.socials.map((s) => socialLink(s, p.name))}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

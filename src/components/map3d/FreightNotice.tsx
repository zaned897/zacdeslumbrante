import React, { useEffect, useState } from 'react';
import type { Language } from '../../types';
import type { FreightState, SceneEngine } from '../../types/scene3d';
import { TRANSLATIONS } from '../../data/i18n';
import { TrainCard } from './TrainCard';

// El silbato se comparte entre instancias (el aviso del mapa y la tarjeta del menú radial, #310).
let whistleOn = false;
let whistleAudio: AudioContext | null = null;
const whistleListeners = new Set<(on: boolean) => void>();
function setWhistle(on: boolean) {
  whistleOn = on;
  for (const l of whistleListeners) l(on);
}

/**
 * Aviso del tren de maqueta. `settings` muestra los ajustes (mostrar tren, silbato) y `notices` los
 * avisos de paso; desde #310 los ajustes viven en el menú radial y los avisos en el mapa.
 */
export function FreightNotice({ engine, language, hidden, inline = false, settings = true, notices = true }: {
  engine: SceneEngine | null; language: Language; hidden: boolean; inline?: boolean; settings?: boolean; notices?: boolean;
}) {
  const t = TRANSLATIONS[language];
  const [state, setState] = useState<FreightState>('unavailable');
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('zacatecas-freight') !== 'off'; } catch { return true; }
  });
  const [sound, setSound] = useState(whistleOn);
  useEffect(() => {
    whistleListeners.add(setSound);
    return () => { whistleListeners.delete(setSound); };
  }, []);
  useEffect(() => {
    engine?.setFreightEnabled?.(enabled);
    try { localStorage.setItem('zacatecas-freight', enabled ? 'on' : 'off'); } catch { /* Session setting still works. */ }
  }, [engine, enabled]);
  useEffect(() => {
    const read = () => setState(engine?.getFreightState?.() ?? 'unavailable');
    read(); const timer = window.setInterval(read, 250);
    return () => window.clearInterval(timer);
  }, [engine]);
  useEffect(() => {
    if (hidden) engine?.stopFreightFollowing?.();
  }, [engine, hidden]);
  useEffect(() => {
    const context = whistleAudio;
    if (!notices || !sound || hidden || state !== 'warning' || !context || context.state !== 'running') return;
    // PROTO: quiet synthesized whistle, no external recording or autoplay.
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = 440;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, context.currentTime + 0.15);
    gain.gain.linearRampToValueAtTime(0, context.currentTime + 1);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 1);
    return () => { oscillator.disconnect(); gain.disconnect(); };
  }, [state, sound, hidden, notices]);
  if (hidden || state === 'unavailable') return null;
  const button = 'rounded-full bg-[#9A3412] px-3 py-1.5 text-xs font-semibold text-white';
  return (
    <aside aria-label={t.freightSettings} className={inline ? "text-stone-900" : "absolute left-3 right-3 top-36 z-20 mx-auto max-w-sm text-stone-900"}>
      {settings && <details open={!notices || undefined} className="rounded-xl border border-stone-200 bg-[#FBF9F5] p-2 text-xs shadow-sm">
        <summary className="cursor-pointer">{t.freightSettings}</summary>
        <p className="my-2">{t.trainModelRandomNote}</p>
        <label className="flex items-center gap-2 py-1"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />{t.freightEnabled}</label>
        <label className="flex items-center gap-2 py-1"><input type="checkbox" checked={sound} onChange={async e => {
          const on = e.target.checked;
          if (on) {
            try { whistleAudio ??= new AudioContext(); await whistleAudio.resume(); }
            catch (error) { console.warn('[freight] Whistle unavailable', error); return; }
          }
          setWhistle(on);
        }} />{t.freightSound}</label>
      </details>}
      {/* La región viva queda montada siempre, para que los lectores de pantalla anuncien el cambio. */}
      {notices && <p role="status" className="sr-only">
        {state === 'warning' ? t.freightWarning : state === 'parked' ? t.freightParked
          : state === 'running' || state === 'following' ? t.freightPassing : ''}
      </p>}
      {notices && (state === 'warning' || state === 'running' || state === 'following' || state === 'parked') && (
        <div className="mt-2 rounded-xl border border-stone-200 bg-[#FBF9F5] p-3 shadow-md">
          <p aria-hidden="true" className="text-sm font-semibold">{state === 'warning' ? t.freightWarning : state === 'parked' ? t.freightParked : t.freightPassing}</p>
          <p className="my-2 text-xs text-stone-600">{t.trainModelRandomNote}</p>
          {state === 'warning' && <button type="button" className={button} onClick={() => engine?.watchFreight?.(false)}>{t.freightWatch}</button>}
          {state === 'running' && <button type="button" className={button} onClick={() => engine?.watchFreight?.(true)}>{t.freightFollow}</button>}
          {state === 'following' && <button type="button" className={button} onClick={() => engine?.stop()}>{t.freightStop}</button>}
        </div>
      )}
      {notices && state === 'following' && <div className="mt-2 max-h-[35dvh] overflow-y-auto"><TrainCard train="linea-a" language={language} showActions={false} onClose={() => engine?.stop()} /></div>}
    </aside>
  );
}

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { ChatContainer } from './components/ChatContainer';
import { GoogleMapsPanel } from './components/GoogleMapsPanel';
import { KnowledgeBaseModal } from './components/KnowledgeBaseModal';
import { ItineraryModal } from './components/ItineraryModal';
import { AppHeader } from './components/app/AppHeader';
import { BottomTabBar } from './components/app/BottomTabBar';
import { BadgesScreen } from './components/app/BadgesScreen';
import { PlansScreen } from './components/app/PlansScreen';
import { PetScreen } from './components/pet/PetScreen';
import { AppTab, goToTab, tabFromHash } from './components/app/tabs';
import { Onboarding, shouldShowOnboarding } from './components/app/Onboarding';
import { Language, ChatMessage, Place, KnowledgeBaseURL } from './types';
import { getStoredKnowledgeBase, saveStoredKnowledgeBase, resetKnowledgeBase } from './data/knowledgeBase';
import { ZACATECAS_PLACES } from './data/places';
import { activeSeason } from './data/seasons';

// El motor 3D (three.js / Cesium) pesa: solo se descarga al abrir la pestaña.
const Map3DView = lazy(() => import('./components/Map3DView').then((m) => ({ default: m.Map3DView })));

export default function App() {
  // Localization: default es (es-MX)
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('zacatecas_lang') as Language) || 'es';
  });

  // Pestaña activa (barra inferior), sincronizada con el hash de la URL
  const [tab, setTab] = useState<AppTab>(() => tabFromHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setTab(tabFromHash(window.location.hash));
      // Map3DView guarda su propio idioma; al volver, adopta el último elegido.
      const stored = localStorage.getItem('zacatecas_lang') as Language | null;
      if (stored) setLanguage(stored);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const [showOnboarding, setShowOnboarding] = useState<boolean>(shouldShowOnboarding);

  // UI Panels state
  const [isMapOpen, setIsMapOpen] = useState<boolean>(() => {
    return window.innerWidth >= 1280;
  });
  const [mapSplitRatio, setMapSplitRatio] = useState<'50-50' | 'full'>('50-50');

  // Modals state
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
  const [isItineraryModalOpen, setIsItineraryModalOpen] = useState(false);
  const [initialItineraryId, setInitialItineraryId] = useState<string | undefined>(undefined);

  // Knowledge base state (26 official URLs)
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseURL[]>(() => {
    return getStoredKnowledgeBase();
  });

  // Places and Map spatial selection
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [highlightedPlaceIds, setHighlightedPlaceIds] = useState<string[]>([]);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem('zacatecas_chat_history_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Temporada activa (#75): tiñe chat y hojas con su acento vía CSS
  const season = activeSeason(new Date());
  useEffect(() => {
    const root = document.documentElement;
    if (season) {
      root.dataset.temporada = season.id;
      root.style.setProperty('--temporada', season.accent);
    } else {
      delete root.dataset.temporada;
      root.style.removeProperty('--temporada');
    }
  }, [season?.id, season?.accent]);

  // Sync language with localStorage and html lang attribute
  useEffect(() => {
    localStorage.setItem('zacatecas_lang', language);
    document.documentElement.lang = language;
  }, [language]);

  // Sync messages with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('zacatecas_chat_history_v1', JSON.stringify(messages));
    } catch (e) {
      console.warn('Storage quota limit reached:', e);
    }
  }, [messages]);

  // Handle Knowledge Base modifications
  const handleToggleUrl = (id: string) => {
    const updated = knowledgeBase.map((item) =>
      item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
    );
    setKnowledgeBase(updated);
    saveStoredKnowledgeBase(updated);
  };

  const handleAddCustomUrl = (title: string, url: string) => {
    const newItem: KnowledgeBaseURL = {
      id: `custom-${Date.now()}`,
      title,
      url,
      category: 'custom',
      isEnabled: true,
      lastVerified: new Date().toISOString().split('T')[0],
      description: 'Fuente externa añadida manualmente por el usuario.',
    };
    const updated = [newItem, ...knowledgeBase];
    setKnowledgeBase(updated);
    saveStoredKnowledgeBase(updated);
  };

  const handleResetKnowledgeBase = () => {
    const defaultList = resetKnowledgeBase();
    setKnowledgeBase(defaultList);
  };

  // Chat Send & Streaming Logic via SSE
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };

      const assistantMsgId = `assistant-${Date.now()}`;
      const placeholderAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, placeholderAssistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const activeUrls = knowledgeBase
          .filter((k) => k.isEnabled)
          .map((k) => k.url);

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text.trim(),
            history: messages.slice(-6),
            language,
            activeKnowledgeUrls: activeUrls,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedContent = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);

            if (dataStr === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (Array.isArray(parsed.sources)) {
                // Fragmentos recuperados de la base de conocimientos: numerados igual que las citas [n] del texto
                const citations = (parsed.sources as { n: number; title: string; url: string; fetchedAt: string }[])
                  .sort((a, b) => a.n - b.n)
                  .map((s) => ({ title: s.title, url: s.url, verificationDate: s.fetchedAt }));
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, citations } : m))
                );
              } else if (parsed.chunk) {
                accumulatedContent += parsed.chunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: accumulatedContent, isStreaming: true }
                      : m
                  )
                );
              } else if (parsed.error) {
                accumulatedContent += `\n\n⚠️ ${parsed.error}`;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: accumulatedContent, isError: true }
                      : m
                  )
                );
              }
            } catch {
              // Raw string chunk fallback
              accumulatedContent += dataStr;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: accumulatedContent, isStreaming: true }
                    : m
                )
              );
            }
          }
        }

        // Finalize message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );

        // Check for spatial mentions to highlight on map
        const foundPlaceIds = ZACATECAS_PLACES.filter(
          (p) =>
            accumulatedContent.toLowerCase().includes(p.nameEs.toLowerCase()) ||
            accumulatedContent.toLowerCase().includes(p.name.toLowerCase()) ||
            (p.puebloMagico && accumulatedContent.toLowerCase().includes(p.puebloMagico.toLowerCase()))
        ).map((p) => p.id);

        if (foundPlaceIds.length > 0) {
          setHighlightedPlaceIds(foundPlaceIds);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          console.log('Stream aborted by user');
        } else {
          console.error('Chat stream error:', err);
          const errText =
            language === 'es'
              ? '\n\n⚠️ Hubo un error de conexión al consultar el asistente. Por favor intenta de nuevo.'
              : '\n\n⚠️ Connection error while reaching the assistant. Please try again.';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + errText, isStreaming: false, isError: true }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, knowledgeBase, language, messages]
  );

  // Desde Planes o Insignias: manda la pregunta y vuelve al chat para ver la respuesta.
  const handleAskFromElsewhere = (prompt: string) => {
    goToTab('chat');
    handleSendMessage(prompt);
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  // Map interaction handlers
  const handlePlaceClick = (place: Place) => {
    setSelectedPlace(place);
    if (!isMapOpen) {
      setIsMapOpen(true);
    }
  };

  const handleAskAboutPlace = (place: Place) => {
    const prompt =
      language === 'es'
        ? `Cuéntame sobre ${place.nameEs}: su historia documentada, su horario actual (${place.schedule}), costo de acceso (${place.fee}) y leyendas populares asociadas.`
        : `Tell me about ${place.name}: its documented history, current schedule (${place.schedule}), admission fee (${place.fee}), and cultural legends associated with it.`;
    handleSendMessage(prompt);
  };

  const handleHighlightPlacesOnMap = (placeIds: string[]) => {
    // El mapa 2D vive en la pestaña de chat
    goToTab('chat');
    setHighlightedPlaceIds(placeIds);
    if (placeIds.length > 0) {
      const first = ZACATECAS_PLACES.find((p) => p.id === placeIds[0]);
      if (first) {
        setSelectedPlace(first);
      }
    }
    if (!isMapOpen) {
      setIsMapOpen(true);
    }
  };

  // Clear chat
  const handleClearChat = () => {
    const confirmText =
      language === 'es'
        ? '¿Deseas reiniciar la conversación?'
        : 'Do you want to reset the conversation?';
    if (window.confirm(confirmText)) {
      setMessages([]);
      localStorage.removeItem('zacatecas_chat_history_v1');
    }
  };

  // Export chat transcript
  const handleExportChat = () => {
    if (messages.length === 0) return;
    const lines = messages.map((m) => {
      const role = m.role === 'user' ? 'USUARIO' : 'ASISTENTE ZACATECAS';
      const time = new Date(m.timestamp).toLocaleString();
      return `[${time}] ${role}:\n${m.content}\n----------------------------------------\n`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Zacatecas_Deslumbrante_Transcript_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleLanguage = () => setLanguage((prev) => (prev === 'es' ? 'en' : 'es'));

  return (
    <div className="h-dvh w-full overflow-hidden bg-papel text-carbon font-sans">
      {tab === '3d' ? (
        // La vista 3D se encaja arriba de la barra inferior: su raíz mide h-dvh y aquí se ajusta al hueco.
        <div className="relative w-full overflow-hidden h-[calc(100dvh-var(--tabbar-h))] [&>div]:!h-full">
          <Suspense fallback={<div className="h-full w-full bg-stone-900" aria-busy="true" />}>
            <Map3DView />
          </Suspense>
        </div>
      ) : (
        <div className="h-full flex flex-col" style={{ paddingBottom: 'var(--tabbar-h)' }}>
          {tab === 'chat' && (
            <>
              <AppHeader
                language={language}
                season={season ? { name: season.name[language], accent: season.accent } : undefined}
                onToggleLanguage={toggleLanguage}
                isMapOpen={isMapOpen}
                onToggleMap={() => setIsMapOpen((prev) => !prev)}
              />
              <div className="flex-1 min-h-0 flex overflow-hidden relative">
                <ChatContainer
                  language={language}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onStopStreaming={handleStopStreaming}
                  isStreaming={isStreaming}
                  onPlaceClick={handlePlaceClick}
                  onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                  knowledgeBase={knowledgeBase}
                  onOpen3d={() => goToTab('3d')}
                  onOpenPlans={() => goToTab('plans')}
                />
                <GoogleMapsPanel
                  isOpen={isMapOpen}
                  onClose={() => setIsMapOpen(false)}
                  language={language}
                  selectedPlace={selectedPlace}
                  highlightedPlaceIds={highlightedPlaceIds}
                  onPlaceSelect={setSelectedPlace}
                  onAskAboutPlace={handleAskAboutPlace}
                  splitRatio={mapSplitRatio}
                  onToggleSplitRatio={() =>
                    setMapSplitRatio((prev) => (prev === '50-50' ? 'full' : '50-50'))
                  }
                />
              </div>
            </>
          )}

          {tab === 'pet' && (
            <div className="flex-1 min-h-0">
              <PetScreen language={language} onGoExplore={() => goToTab('3d')} />
            </div>
          )}

          {tab === 'badges' && (
            <div className="flex-1 min-h-0">
              <BadgesScreen language={language} onGoExplore={() => goToTab('3d')} />
            </div>
          )}

          {tab === 'plans' && (
            <div className="flex-1 min-h-0">
              <PlansScreen
                language={language}
                knowledgeBase={knowledgeBase}
                onOpenItinerary={(id) => {
                  setInitialItineraryId(id);
                  setIsItineraryModalOpen(true);
                }}
                onAskTheme={handleAskFromElsewhere}
                onOpenKnowledgeModal={() => setIsKnowledgeModalOpen(true)}
                onClearChat={handleClearChat}
                onExportChat={handleExportChat}
                hasMessages={messages.length > 0}
              />
            </div>
          )}
        </div>
      )}

      <BottomTabBar language={language} active={tab} onSelect={goToTab} />

      {showOnboarding && (
        <Onboarding language={language} onToggleLanguage={toggleLanguage} onDone={() => setShowOnboarding(false)} />
      )}

      {/* Modals */}
      <KnowledgeBaseModal
        isOpen={isKnowledgeModalOpen}
        onClose={() => setIsKnowledgeModalOpen(false)}
        language={language}
        knowledgeBase={knowledgeBase}
        onToggleUrl={handleToggleUrl}
        onAddCustomUrl={handleAddCustomUrl}
        onResetDefault={handleResetKnowledgeBase}
      />

      <ItineraryModal
        isOpen={isItineraryModalOpen}
        onClose={() => setIsItineraryModalOpen(false)}
        language={language}
        initialItineraryId={initialItineraryId}
        onSelectItineraryPrompt={handleAskFromElsewhere}
        onHighlightPlacesOnMap={handleHighlightPlacesOnMap}
      />
    </div>
  );
}

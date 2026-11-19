import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { sourceLine } from './src/server/sourceDates.ts';
import { ZACATECAS_PLACES } from './src/data/places.ts';
import { synthesizeKnowledgeResponse } from './src/server/groundingSynthesizer.ts';
import { deducePlan, planFallbackText, planInstruction, planLine } from './src/server/planHints.ts';
import {
  citation,
  corpusSize,
  displayTitle,
  promptContext,
  searchKnowledge,
  type KnowledgeHit,
} from './src/server/knowledgeSearch.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Initialize Gemini SDK with User-Agent header as required
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Último fallo de Gemini, visible en /api/health sin abrir los logs de Render (#105).
let lastGeminiError: { message: string; at: string } | null = null;
function recordGeminiError(model: string, err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  const safe = apiKey ? raw.split(apiKey).join('***') : raw;
  // Gemini anida JSON escapado; se aplana para que quepa legible en una línea.
  const flat = safe.replace(/(\\+n|\s)+/g, ' ').replace(/\\+"/g, '"');
  const message = `${model}: ${flat}`.slice(0, 300);
  lastGeminiError = { message, at: new Date().toISOString() };
  console.warn(`Gemini falló (${message})`);
}

// API Routes
app.get('/api/places', (_req, res) => {
  res.json(ZACATECAS_PLACES);
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey && apiKey.length > 5),
    corpusChunks: corpusSize(),
    lastGeminiError,
    time: new Date().toISOString(),
  });
});

// Modo breve del chat (#158): se agrega al final de las instrucciones del modelo.
const BRIEF_INSTRUCTION = `
MODO BREVE (ACTIVO):
Responde en 2 o 3 líneas como máximo (unas 60 palabras), sin encabezados ni viñetas, con el dato más útil para la pregunta.
En este modo no uses las etiquetas [HISTORIA DOCUMENTADA], [LEYENDA CULTURAL] ni [RECOMENDACIÓN PRÁCTICA]; si mencionas una leyenda, dilo en la misma frase («según la leyenda…»).
Conserva siempre una cita de la fuente en el formato indicado y la línea [LUGARES: …] al final.
Si hace falta más detalle, el usuario tocará «Ampliar» y recibirá la respuesta completa.`;

/** Respaldo breve con fragmentos: lo más relevante de la mejor fuente, en dos frases y con su cita. */
function briefExcerpt(hit: KnowledgeHit, language: 'es' | 'en'): string {
  const sentences = hit.chunk.text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]?/g) ?? [hit.chunk.text];
  let text = sentences.slice(0, 2).join('').trim();
  if (text.length > 240) text = `${text.slice(0, 237).trimEnd()}…`;
  const intro = language === 'en'
    ? 'The AI model is not available; this is what the official source says:'
    : 'El modelo de IA no está disponible; esto dice la fuente oficial:';
  return `${intro}\n[1] ${text}\n[Fuente: ${citation(hit.chunk)}]`;
}

// Proxy hacia la API Python (FastAPI): /api/py/<ruta> → PY_API_URL/<ruta>
const PY_API_URL = (process.env.PY_API_URL || 'http://localhost:8000').replace(/\/$/, '');
app.all('/api/py/*', async (req, res) => {
  const target = PY_API_URL + req.originalUrl.replace(/^\/api\/py/, '');
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        ...(hasBody ? { 'content-type': req.get('content-type') || 'application/json' } : {}),
        // Sesión de cuentas (#53): FastAPI valida el token; Express solo lo reenvía.
        ...(req.get('authorization') ? { authorization: req.get('authorization') as string } : {}),
      },
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.type(type);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(503).json({ error: 'python api offline' });
  }
});

// Real-Time Streaming Chat Endpoint via Server-Sent Events (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const { message, history = [], language = 'es', activeKnowledgeUrls = [] } = req.body;
  // Modo breve (#158): 2 o 3 líneas con su fuente; «Ampliar» repite la pregunta con brief: false.
  const brief = req.body?.brief === true;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let isClientConnected = true;
  res.on('close', () => {
    isClientConnected = false;
  });

  const sendEvent = (data: Record<string, unknown> | string) => {
    if (typeof data === 'string') {
      res.write(`data: ${data}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const lang: 'es' | 'en' = language === 'en' ? 'en' : 'es';
  // Un paseo (#278) nunca cae al itinerario improvisado: sin Gemini, la línea [PLAN: …] sale por reglas.
  const plan = deducePlan(message);

  /** Envía un texto de respaldo en trozos, como si se escribiera. */
  const streamText = async (text: string) => {
    const words = text.split(/(\s+)/);
    for (let i = 0; i < words.length; i += 3) {
      if (!isClientConnected) break;
      sendEvent({ chunk: words.slice(i, i + 3).join('') });
      await new Promise((r) => setTimeout(r, 8));
    }
  };

  if (!apiKey && plan) {
    await streamText(planFallbackText(plan, lang));
    sendEvent('[DONE]');
    res.end();
    return;
  }

  if (!apiKey) {
    sendEvent({
      chunk: language === 'es'
        ? '⚠️ Clave de Gemini API no configurada en las variables de entorno del servidor. Por favor verifica la clave en la configuración.'
        : '⚠️ Gemini API key is not configured in server environment. Please check settings.',
    });
    sendEvent('[DONE]');
    res.end();
    return;
  }

  try {
    // Fragmentos reales de las fuentes activas (corpus de services/kb); vacío si no hay corpus.
    const hits = searchKnowledge(message, 4, activeKnowledgeUrls);
    // Un paseo no lleva citas: las fuentes no le corresponden.
    if (hits.length > 0 && !plan) {
      sendEvent({
        sources: hits.map((h, i) => ({
          n: i + 1,
          title: displayTitle(h.chunk),
          url: h.chunk.url,
          fetchedAt: h.chunk.fetchedAt.slice(0, 10),
        })),
      });
    }
    const retrievedText = hits.length > 0
      ? `
FRAGMENTOS RECUPERADOS DE LAS FUENTES OFICIALES (de la última ingesta):
${promptContext(hits)}

Basa tu respuesta primero en estos fragmentos y cítalos con su número y URL, p. ej. [1] (https://...). Cada fragmento trae la fecha de revisión de su fuente («Revisado AAAA-MM-DD»): úsala tal cual en la cita. Lo que no esté en ellos y venga de tu conocimiento general, márcalo como tal; si el dato no aparece, aplica el protocolo de brecha de datos.`
      : '';

    // Cada fuente con su fecha de última revisión (#83), para que la cita diga la fecha real.
    const urlsText = (activeKnowledgeUrls.length > 0
      ? activeKnowledgeUrls
      : ['https://www.zacatecastravel.com/', 'https://whc.unesco.org/en/list/676/', 'https://culturazac.gob.mx/', 'https://www.inah.gob.mx/']
    ).map((u: string) => sourceLine(u)).join('\n');

    const systemInstruction = `
Eres "Zacatecas Deslumbrante Prototype", el Asistente Oficial Conversacional y Guía Espacial del Estado de Zacatecas (México).
Tu misión es brindar información fidedigna, accesible y enriquecedora sobre atractivos turísticos, museos, zonas arqueológicas, el estatus de Patrimonio de la Humanidad UNESCO del Centro Histórico (1993, Criterios ii y iv), los 7 Pueblos Mágicos (Jerez, Sombrerete, Pinos, Guadalupe, Nochistlán, Teúl de González Ortega y Villanueva), festivales culturales, gastronomía típica, horarios y tarifas de acceso.

IDIOMA:
El usuario ha seleccionado el idioma: ${language === 'en' ? 'ENGLISH (en-US)' : 'SPANISH (es-MX)'}.
Responde TOTALMENTE en ese idioma seleccionado con tono curatorial, hospitalario, riguroso y claro.

REGLAS CRÍTICAS DE DISTINCIÓN (OBLIGATORIAS):
Debes clasificar y distinguir de manera explícita en tu respuesta entre:
1. [HISTORIA DOCUMENTADA]: Hechos históricos documentados, fechas, arquitectura, registros de archivos, catalogaciones del INAH y la UNESCO.
2. [LEYENDA CULTURAL]: Tradiciones orales, leyendas virreinales, folclor (ej. Callejón del Beso de Zacatecas, La Piedra Negra, Las Tres Cruces, El Espejo de Sor Juana), aclarando explícitamente que pertenecen al acervo legendario y no a la historia verificada.
3. [RECOMENDACIÓN PRÁCTICA]: Consejos logísticos para turistas, guías de turistas, hoteleros y estudiantes (horarios, mejor hora para fotografía, vestimenta para la altitud a 2,490m s.n.m., calzado para cantera empedrada, cómo combinar mina y teleférico).

BASE DE CONOCIMIENTO (RAG GROUNDING):
Evalúa y sustenta tus respuestas en los siguientes portales oficiales activos:
${urlsText}
${retrievedText}

CITAS DE FUENTES Y FECHA DE REVISIÓN:
Al final o de forma intercalada, cita cada fuente que usaste con su nombre y SU fecha de revisión, tal como aparece en la lista de fuentes o en el fragmento (no inventes ni redondees fechas):
[Fuente: <nombre de la fuente> · Revisado <AAAA-MM-DD>]
Ejemplo: [Fuente: Museos de Zacatecas — Red Turística · Revisado 2026-10-15]
Si una fuente dice «sin fecha de revisión», escríbelo así en la cita.

PROTOCOLO DE BRECHA DE DATOS (MISSING DATA PROTOCOL):
Si un dato específico (horario extraordinario, tarifa reciente no reportada o evento inédito) no está documentado en los portales oficiales de la base de conocimiento, declara de forma explícita la brecha:
"Dato no disponible en los registros oficiales consultados; por favor verifique directamente en [dominio oficial]."

METADATOS ESPACIALES PARA EL MAPA:
Al final de tu respuesta, en una línea separada, incluye los identificadores de lugares de Zacatecas que mencionaste para que el mapa interactivo los enfoque automáticamente:
[LUGARES: catedral-zacatecas, cerro-de-la-bufa, mina-el-eden, teleferico-zacatecas, museo-rafael-coronel, museo-pedro-coronel, museo-felguerez, museo-francisco-goitia, plaza-armas, teatro-calderon, acueducto-el-cubo, la-quemada, jerez-pueblo-magico, sombrerete-pueblo-magico, guadalupe-pueblo-magico, pinos-pueblo-magico] (solo los que correspondan al tema).

${planInstruction(language === 'en' ? 'en' : 'es')}
${brief ? BRIEF_INSTRUCTION : ''}
`.trim();

    // Prepare contents with conversation history
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add up to 6 previous messages for context
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Add the current user query
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Call Gemini streaming API with resilient model fallback
    const callStream = async (model: string) => {
      try {
        return await ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
      } catch (err) {
        recordGeminiError(model, err);
        throw err;
      }
    };

    /** Respaldo sin Gemini. Devuelve false si el fallo no tiene respaldo y hay que reportarlo. */
    const respondWithFallback = async (err: unknown): Promise<boolean> => {
      const msg = err instanceof Error ? err.message : String(err);
      const isBusy = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('timed out');
      // Con fragmentos reales o un paseo, cualquier fallo de Gemini (p. ej. llave inválida) cae al respaldo.
      if (!isBusy && hits.length === 0 && !plan) return false;
      console.warn(`Gemini no disponible (${msg.slice(0, 120)}): respondiendo con el respaldo...`);
      // Con fragmentos reales, el respaldo los muestra tal cual en vez del texto escrito a mano.
      const synthesizedText = plan
        ? planFallbackText(plan, lang)
        : hits.length > 0
        ? brief
          ? briefExcerpt(hits[0], lang)
          : [
              lang === 'en'
                ? 'The AI model is not available right now. These are the most relevant excerpts from the official sources:'
                : 'El modelo de IA no está disponible en este momento. Estos son los fragmentos más relevantes de las fuentes oficiales:',
              ...hits.map((h, i) => `[${i + 1}] ${h.chunk.text}\n[Fuente: ${citation(h.chunk)}]`),
            ].join('\n\n')
        : synthesizeKnowledgeResponse({ message, history, language: lang, activeKnowledgeUrls, brief });
      await streamText(synthesizedText);
      sendEvent('[DONE]');
      res.end();
      return true;
    };

    // Margen para el primer fragmento de Gemini: en Render free (0.1 CPU) 4 s es poco.
    let responseStream;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('503 Stream request timed out')), 15000);
      });
      // Try gemini-3.8-flash first, then gemini-3.1-flash-lite
      responseStream = await Promise.race([
        callStream('gemini-3.8-flash').catch(() => callStream('gemini-3.1-flash-lite')),
        timeoutPromise,
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timed out')) recordGeminiError('timeout', err);
      if (await respondWithFallback(err)) return;
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // Un fallo a mitad del flujo (#278): sin texto enviado, cae al respaldo;
    // con texto a medias y un paseo, cierra con la línea [PLAN: …] para que la tarjeta salga igual.
    let sentText = false;
    try {
      for await (const chunk of responseStream) {
        if (!isClientConnected) break;
        const text = chunk.text;
        if (text) {
          sentText = true;
          sendEvent({ chunk: text });
        }
      }
    } catch (err: unknown) {
      recordGeminiError('stream', err);
      if (!sentText && (await respondWithFallback(err))) return;
      if (!plan) throw err;
      sendEvent({ chunk: `\n${planLine(plan)}` });
    }

    sendEvent('[DONE]');
    res.end();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown streaming error';
    console.error('Error in /api/chat/stream:', errorMsg);
    sendEvent({
      error: language === 'es'
        ? `Error al generar la respuesta: ${errorMsg}`
        : `Error generating response: ${errorMsg}`,
    });
    sendEvent('[DONE]');
    res.end();
  }
});

// Vite middleware in dev or static files in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zacatecas Deslumbrante server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

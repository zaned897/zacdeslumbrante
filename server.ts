import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ZACATECAS_PLACES } from './src/data/places.ts';
import { synthesizeKnowledgeResponse } from './src/server/groundingSynthesizer.ts';
import { citation, displayTitle, promptContext, searchKnowledge } from './src/server/knowledgeSearch.ts';

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

// API Routes
app.get('/api/places', (_req, res) => {
  res.json(ZACATECAS_PLACES);
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey && apiKey.length > 5),
    time: new Date().toISOString(),
  });
});

// Real-Time Streaming Chat Endpoint via Server-Sent Events (SSE)
app.post('/api/chat/stream', async (req, res) => {
  const { message, history = [], language = 'es', activeKnowledgeUrls = [] } = req.body;

  if (!message || typeof message !== 'string') {
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
    if (hits.length > 0) {
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

Basa tu respuesta primero en estos fragmentos y cítalos con su número y URL, p. ej. [1] (https://...). Lo que no esté en ellos y venga de tu conocimiento general, márcalo como tal; si el dato no aparece, aplica el protocolo de brecha de datos.`
      : '';

    const urlsText = activeKnowledgeUrls.length > 0
      ? activeKnowledgeUrls.map((u: string) => `• ${u}`).join('\n')
      : 'https://www.zacatecastravel.com/\nhttps://whc.unesco.org/en/list/676/\nhttps://culturazac.gob.mx/\nhttps://www.inah.gob.mx/';

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

CITAS DE FUENTES Y VERIFICACIÓN:
Al final o de forma intercalada, cita las fuentes oficiales correspondientes e incluye siempre la fecha de verificación:
Formato de ejemplo:
[Fuente: Portal Oficial Zacatecas Travel / INAH · Verificado Octubre 2026]

PROTOCOLO DE BRECHA DE DATOS (MISSING DATA PROTOCOL):
Si un dato específico (horario extraordinario, tarifa reciente no reportada o evento inédito) no está documentado en los portales oficiales de la base de conocimiento, declara de forma explícita la brecha:
"Dato no disponible en los registros oficiales consultados; por favor verifique directamente en [dominio oficial]."

METADATOS ESPACIALES PARA EL MAPA:
Al final de tu respuesta, en una línea separada, incluye los identificadores de lugares de Zacatecas que mencionaste para que el mapa interactivo los enfoque automáticamente:
[LUGARES: catedral-zacatecas, cerro-de-la-bufa, mina-el-eden, teleferico-zacatecas, museo-rafael-coronel, museo-pedro-coronel, museo-felguerez, museo-francisco-goitia, plaza-armas, teatro-calderon, acueducto-el-cubo, la-quemada, jerez-pueblo-magico, sombrerete-pueblo-magico, guadalupe-pueblo-magico, pinos-pueblo-magico] (solo los que correspondan al tema).

ITINERARIOS:
Si el usuario solicita un plan o itinerario de viaje, etiquétalo siempre como:
${language === 'en' ? '"Suggested Itinerary (Open Decision)"' : '"Itinerario Sugerido (Decisión Abierta)"'}.
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
      return await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
    };

    let responseStream;
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('503 Stream request timed out')), 4000)
      );
      // Try gemini-3.8-flash first, then gemini-3.1-flash-lite
      responseStream = await Promise.race([
        callStream('gemini-3.8-flash').catch(() => callStream('gemini-3.1-flash-lite')),
        timeoutPromise,
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isBusy = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('timed out');
      // Con fragmentos reales, cualquier fallo de Gemini (p. ej. llave inválida) cae al respaldo.
      if (isBusy || hits.length > 0) {
        console.warn(`Gemini no disponible (${msg.slice(0, 120)}): respondiendo con el respaldo...`);
        // Con fragmentos reales, el respaldo los muestra tal cual en vez del texto escrito a mano.
        const synthesizedText = hits.length > 0
          ? [
              language === 'en'
                ? 'The AI model is not available right now. These are the most relevant excerpts from the official sources:'
                : 'El modelo de IA no está disponible en este momento. Estos son los fragmentos más relevantes de las fuentes oficiales:',
              ...hits.map((h, i) => `[${i + 1}] ${h.chunk.text}\n[Fuente: ${citation(h.chunk)}]`),
            ].join('\n\n')
          : synthesizeKnowledgeResponse({
              message,
              history,
              language: language === 'en' ? 'en' : 'es',
              activeKnowledgeUrls,
            });

        // Stream synthesized chunks in real-time typewriter effect
        const words = synthesizedText.split(/(\s+)/);
        for (let i = 0; i < words.length; i += 3) {
          if (!isClientConnected) break;
          const chunk = words.slice(i, i + 3).join('');
          sendEvent({ chunk });
          await new Promise((r) => setTimeout(r, 8));
        }

        sendEvent('[DONE]');
        res.end();
        return;
      } else {
        throw err;
      }
    }

    for await (const chunk of responseStream) {
      if (!isClientConnected) break;
      const text = chunk.text;
      if (text) {
        sendEvent({ chunk: text });
      }
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

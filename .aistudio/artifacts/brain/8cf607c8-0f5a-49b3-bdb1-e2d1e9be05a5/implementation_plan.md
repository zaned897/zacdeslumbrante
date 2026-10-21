# Zacatecas Deslumbrante Prototype — AI Assistant & Spatial Guide

A high-performance, responsive single-page web application featuring "Zacatecas Deslumbrante Prototype": an official bilingual conversational assistant and spatial guide that delivers verified historical knowledge, cultural legends, museum directories, UNESCO heritage insights, Pueblos Mágicos guides, and travel itineraries grounded in official governmental and cultural repositories.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The clarifying questions answered in Phase 1 have established three core architectural decisions:
>
> 1. **Workspace Layout**: Balanced 50/50 split container when Google Maps is opened, with quick toggle buttons for Full-Screen Map, Map Collapse, and Split View. The collapsible left navigation panel operates independently without overlapping.
> 2. **Initial Quick-Start Presets**: A comprehensive exploration set covering the UNESCO Historic Centre, Pueblos Mágicos (Jerez, Sombrerete, Pinos, Guadalupe, Nochistlán, Teúl), Mining Heritage & Cable Car (Mina El Edén & Teleférico), and Gastronomy/Mezcal culture.
> 3. **Distinction Tag System**: Dedicated color-coded badge tags for **Documented History** (amber/bronze stone), **Cultural Legend** (amethyst/violet), and **Local Recommendation** (emerald/terracotta), accompanied by source attribution chips and "Last Checked" verification timestamps.

---

### 1. Overview & Core Concept

- **What It Does**: Zacatecas Deslumbrante Prototype acts as an official cultural and tourist conversational companion. It streams answers chunk-by-chunk using the Gemini API, evaluates user questions against 26 preloaded official Knowledge Base domains (UNESCO, INAH, SECTUR, Zacatecas Travel, SIC Cultura, Archivo General), displays inline citations with verification dates, marks locations on an interactive Google Map with rich InfoWindows, and generates customizable suggested itineraries.
- **Target Audience & Persona**: National and international travelers, local residents, licensed tour guides, hotel concierges, travel agents, and academic researchers/students looking for rigorously verified facts, opening hours, entrance fees, and cultural narratives.
- **Key Value**: Eliminates traveler uncertainty by cleanly separating verified archival history from folkloric legends, providing real-time geocoded spatial awareness, and ensuring missing information triggers an explicit transparent gap protocol.

---

### 2. User Experience & Visual Design

#### Visual Identity & Theme
- **Domain Aesthetic**: Institutional and curatorial elegance inspired by Zacatecan colonial architecture—quarried pink cantera stone (*cantera rosa*), warm limestone paper (`#FBF9F5`, `#F5EFEB`), dark colonial iron charcoal (`#1C1917`, `#292524`), silver bullion accents (`#94A3B8`, `#CBD5E1`), and rich terracotta highlights (`#9A3412`).
- **Typography & Hierarchy**:
  - *Headings & Display*: High-contrast editorial serif (**Playfair Display** / **Fraunces**) delivering curatorial prestige and cultural gravity.
  - *Prose & Conversational Text*: Clear contemporary sans-serif (**Plus Jakarta Sans**) calibrated for effortless reading across long-form guides.
  - *Data & Timestamps*: Clean tabular numerals (**IBM Plex Mono** / `font-mono tabular-nums`).
- **Zero-Pill Discipline & Anti-Slop Principles**:
  - No candy badges or floating status scorecards.
  - Metadata rendered as quiet, elegant typography with dot separators (`·`).
  - Distinctions (History, Legend, Tip) rendered as refined, unboxed status banners or micro-pills with clear semantic typography and icons.
  - Clean hairline borders (`border-stone-200 dark:border-stone-800`) with warm paper elevations.

#### Key User Flows & Workspace Layout
1. **Three-Panel Orchestrated Workspace**:
   - **Collapsible Left Sidebar**: Knowledge Base manager (26 official URLs with toggle switches, counter, and custom URL adder), Preset Explore Themes, Itinerary Generator drawer trigger, Language toggle (`ES` / `EN`), and Session Transcript actions. Collapses to an unobtrusive 48px rail or expands to 320px with smooth CSS transitions.
   - **Central Chat Stream Canvas**: Spacious conversation history with message actions (copy, view on map, cite verification), dynamic typewriter streaming output, quick suggestion chips, and an accessible message composer.
   - **Collapsible Right Map Panel**: Google Maps container with customized warm silver styling, responsive 50/50 split or 100% full-screen mode, interactive custom pins for discussed attractions, and automatic highlighting of walking-distance clusters.
2. **Dynamic Bilingual Localization**:
   - Immediate toggle between Spanish (`es-MX`, default) and English (`en-US`).
   - Translates every button, placeholder, empty state, itinerary tag, category label, and AI system instruction prompt.
3. **Knowledge Base & Grounding Visibility**:
   - The user can inspect the active 26 sources, add custom links, or disable specific sites.
   - Every AI response clearly formats inline source references: `[Fuente: zacatecastravel.com · Verificado Octubre 2026]`.
4. **Suggested Itinerary Drawer (Open Decision)**:
   - 1-Day Historic Centre Express ("Joyas Virreinales y Panorámicas").
   - 2-Day Pueblos Mágicos & Mining Route.
   - 3-Day Archaeology & Contemporary Art Circuit (La Quemada, Felguérez, Pedro Coronel).
   - Generates interactive map markers for each itinerary stop with step-by-step visit order.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full-Stack Architecture (Node.js/Express Server + React Client)**
  - *Chosen Approach*: Implement an Express backend (`server.ts`) running concurrently with Vite, exposing `/api/chat/stream` (SSE) and `/api/places` endpoints.
  - *Why*: In strict accordance with the `@google/genai` guidelines, the Gemini API key and SDK must remain server-side only. Streaming SSE chunks enables real-time typewriter output to the browser without exposing secrets.
  - *Alternatives Considered*: Client-side SDK calls were rejected because exposing `GEMINI_API_KEY` to the browser is strictly prohibited.
- **Decision 2: Hybrid Google Maps & Interactive SVG / Canvas Fallback Mode**
  - *Chosen Approach*: Initialize Google Maps via Google Maps JavaScript API using `import.meta.env.VITE_MAPS_API_KEY`. If the key is not yet provisioned or unavailable in the environment, the map container transitions seamlessly into an interactive high-resolution canvas/SVG map with real GPS coordinates, pin tooltips, and cluster bounding.
  - *Why*: Guarantees zero blank screen errors or unhandled script failures while providing full Google Maps features when the key is active.
- **Decision 3: Structured Metadata Extraction in Streaming Responses**
  - *Chosen Approach*: Server-side prompt engineering instructs Gemini to format responses with clear semantic delineation tags (`[HISTORIA]`, `[LEYENDA]`, `[RECOMENDACION]`, `[LUGARES: ...]`, `[FUENTES: ...]`). The frontend streaming parser strips and converts these markers into visual UI components (color-coded distinction tags, interactive map focus chips, source citation cards).
  - *Why*: Allows seamless streaming while still parsing out rich spatial coordinates and category classifications.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER APPLICATION (REACT 19)                  │
├───────────────────┬──────────────────────────────────┬─────────────────┤
│ COLLAPSIBLE       │ CHAT STREAMING CONTAINER         │ COLLAPSIBLE     │
│ NAVIGATION PANEL  │                                  │ GOOGLE MAPS     │
│ (Left: 0px/320px) │ • Real-Time Stream Receiver (SSE)│ (Right: 0%/50%/ │
│                   │ • Distinction Badges             │  100% Split)    │
│ • Language Toggle │   (History / Legend / Tip)       │                 │
│   (es-MX / en-US) │ • Inline Source Citations        │ • Google Maps JS│
│ • 26-URL KB Admin │ • Missing Data Gap Protocol      │   API Loader    │
│ • Theme Presets   │ • Suggested Itineraries          │ • Custom Cantera│
│ • Itinerary Modal │ • Input Bar & Quick Prompts      │   Rosa Markers  │
│ • Clear/Export    │ • "View on Map" Action Buttons   │ • InfoWindows   │
│   Transcript      │                                  │ • Nearby Radius │
└─────────┬─────────┴─────────────────┬────────────────┴─────────┬───────┘
          │                           │                          │
          │                           │ SSE Stream (/api/chat)   │
          ▼                           ▼                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       EXPRESS BACKEND (server.ts)                      │
│                                                                        │
│ • POST /api/chat/stream: Gemini 3.8 Flash Streaming Engine             │
│   - Ingests active Knowledge Base URL list & User Question             │
│   - Enforces Distinction Rules & Grounding Guidelines                  │
│   - Server-Sent Events (SSE) writer forwarding text chunks             │
│ • GET /api/places: Geocoded directory of Zacatecas monuments,          │
│   museums, archaeological sites, and Pueblos Mágicos                   │
│ • Vite static file serving & dev middleware proxy                      │
└─────────────────────────────────────┬──────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES / APIS                        │
│                                                                        │
│ • @google/genai (Gemini 3.8 Flash with urlContext & Search Grounding)  │
│ • Google Maps JavaScript API (Geocoding, Custom Markers, InfoWindows)  │
│ • 26 Official Zacatecas Heritage & Tourism Knowledge Base Portals      │
└────────────────────────────────────────────────────────────────────────┘
```

#### Data Entities & Local Storage State
- `KnowledgeBaseURL`: `{ id: string, title: string, url: string, category: 'tourism' | 'unesco' | 'museums' | 'archives' | 'archaeology', isEnabled: boolean, lastVerified: string }`
- `ChatMessage`: `{ id: string, role: 'user' | 'assistant', content: string, timestamp: number, distinctions?: { type: 'history' | 'legend' | 'recommendation', text: string }[], citations?: { title: string, url: string, verificationDate: string }[], placesMentioned?: string[], isStreaming?: boolean }`
- `Place`: `{ id: string, name: string, nameEs: string, category: string, lat: number, lng: number, address: string, schedule: string, fee: string, highlights: string[], puebloMagico?: string }`
- `UserSettings`: `{ language: 'es' | 'en', mapExpanded: boolean, mapSplitRatio: '50-50' | 'full', leftPanelOpen: boolean }`

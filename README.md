# Rueda Inteligente 🚴

App de entrenamiento ciclista con IA. Analiza tus rodadas GPX de Strava, genera planes semanales y detecta duplicados automáticamente.

---

## Deploy en GitHub + Vercel (sin instalar nada)

### PASO 1 — Crear repositorio en GitHub

1. Ve a **github.com** e inicia sesión (o crea cuenta gratis)
2. Clic en el botón verde **"New"** (esquina superior izquierda)
3. Nombre del repositorio: `rueda-inteligente`
4. Déjalo en **Public**
5. Clic en **"Create repository"**

### PASO 2 — Subir los archivos

1. En la página del repositorio vacío, busca el enlace **"uploading an existing file"**
2. Arrastra TODA la carpeta del proyecto al área de carga
3. En el campo de abajo escribe: `primer commit`
4. Clic en **"Commit changes"**

### PASO 3 — Conectar con Vercel

1. Ve a **vercel.com** e inicia sesión con tu cuenta de GitHub
2. Clic en **"Add New Project"**
3. Selecciona el repositorio `rueda-inteligente`
4. Vercel detecta automáticamente Vite — no cambies nada
5. **ANTES de dar Deploy**, expande **"Environment Variables"** y agrega:
   - Nombre: `GROQ_API_KEY`
   - Valor: tu API key de Groq (obtén una gratis en console.groq.com → API Keys)
6. Clic en **"Deploy"**

### PASO 4 — Obtener API key de Groq (gratis)

1. Ve a **console.groq.com**
2. Crea cuenta (gratis, sin tarjeta)
3. Ve a **"API Keys"** → **"Create API Key"**
4. Copia la key y pégala en Vercel como se indica arriba

---

## Estructura del proyecto

```
rueda-inteligente/
├── api/
│   └── analyze.js        ← Backend serverless (guarda la API key segura)
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── IABox.jsx
│   │   └── ZoneBars.jsx
│   ├── hooks/
│   │   ├── useStore.js   ← Estado global + localStorage
│   │   ├── useIA.js      ← Llamadas a la IA + prompts
│   │   └── useGPX.js     ← Parser de archivos GPX
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Registrar.jsx ← Importa GPX + detecta duplicados
│   │   ├── Plan.jsx
│   │   ├── Historial.jsx
│   │   ├── Graficas.jsx
│   │   ├── Suplementos.jsx
│   │   └── Perfil.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Características

- Importa archivos .gpx de Strava (drag & drop)
- Detecta rodadas duplicadas automáticamente
- Análisis IA con Llama 3.3 via Groq (gratis)
- API key guardada en servidor (nunca expuesta)
- Zonas de FC calculadas automáticamente
- Plan semanal generado por IA con base científica
- Suplementación integrada en análisis
- Gráficas de progreso (velocidad, FC, carga, zonas)
- Borrar rodadas con confirmación
- 100% responsive (móvil y desktop)

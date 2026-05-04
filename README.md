# Gestor Universitario

Sistema web personal para organizar notas, transcripciones y tareas universitarias con análisis de IA.

## Características

- **Materias y Encuentros** — Estructura jerárquica: Materias → Encuentros → Notas rápidas
- **Importación de Transcripciones** — Arrastra archivos `.txt`/`.html`, pega texto, o carga desde Google Drive. Limpieza automática de HTML
- **Análisis con IA** — Resúmenes, conceptos clave, preguntas de estudio y flashcards generados por Google Gemini (gratis)
- **Tareas Pendientes** — Lista de tareas por materia con estados (pendiente/completada)
- **Exportación** — Exporta encuentros individuales o toda la materia en JSON, TXT o Markdown
- **Backup/Restauración** — Descarga y restaura backups completos en JSON
- **Copiado Rápido** — Copia transcripciones y notas al portapapeles con un clic
- **Persistencia JSON** — Los datos se guardan automáticamente en `data/data.json`
- **Despliegue en Render** — Listo para deploy público gratuito

## Instalación Local

```bash
git clone https://github.com/torresingenieriadev/gestor_universitario.git
cd gestor_universitario
python run.py
```

Abre tu navegador en **http://127.0.0.1:5000**

## Configurar IA (Opcional)

Sin API key funciona con análisis local. Para IA real con Google Gemini:

1. Ve a [Google AI Studio](https://aistudio.google.com/apikey)
2. Crea una API key gratuita (sin tarjeta de crédito)
3. Crea un archivo `.env` en la carpeta del proyecto:

```
GEMINI_API_KEY=AIzaSyTuKeyAqui
```

Reinicia el servidor y la pestaña "Análisis IA" usará Gemini automáticamente.

## Despliegue en Render (URL Pública)

1. Crear cuenta en [render.com](https://render.com)
2. Haz clic en **New** → **Web Service**
3. Conecta tu repo de GitHub: `torresingenieriadev/gestor_universitario`
4. Configura:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Environment Variables:**
     - `GEMINI_API_KEY` = tu key de Google AI Studio
5. Haz clic en **Create Web Service**
6. En ~2 minutos tendrás una URL pública como `https://gestor-universitario.onrender.com`

> **Nota:** El plan gratuito de Render reinicia el servidor tras 15 min de inactividad y el filesystem es efímero. Usa el botón **Exportar Datos** para descargar tu backup y **Restaurar Backup** para subirlo después de un reinicio.

## Estructura del Proyecto

```
gestor_universitario/
├── app.py                # Backend Flask (API REST + IA)
├── run.py                # Launcher local (auto-instala dependencias)
├── requirements.txt      # Dependencias Python
├── render.yaml           # Config de despliegue en Render
├── .env.example          # Plantilla de variables de entorno
├── data/
│   └── data.json         # Almacenamiento (se crea automáticamente)
├── templates/
│   └── index.html        # Frontend SPA
└── static/
    ├── style.css         # Estilos
    └── script.js         # Lógica del frontend
```

## Guía de Uso

| Acción | Cómo |
|--------|------|
| Crear materia | Botón **+** en la barra lateral |
| Importar transcripción | Dentro de un encuentro → **Importar Transcripción** |
| Análisis con IA | Pestaña **Análisis IA** → Seleccionar transcripción y tipo |
| Exportar | Pestaña **Exportar** → Elige formato y descarga |
| Backup completo | Botón **Exportar Datos** en la barra lateral |
| Restaurar backup | Botón **Restaurar Backup** en la barra lateral |

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Python / Flask / Gunicorn |
| Frontend | HTML / CSS / JavaScript |
| IA | Google Gemini 2.5 Flash (API gratuita) |
| Almacenamiento | JSON local |
| Deploy | Render (gratuito) |

## Licencia

MIT
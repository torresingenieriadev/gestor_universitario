# Gestor Universitario

Sistema web personal para organizar notas, transcripciones y tareas universitarias con análisis de IA.

## Características

- **Materias y Encuentros** — Estructura jerárquica: Materias → Encuentros → Notas rápidas
- **Importación de Transcripciones** — Arrastra archivos `.txt`/`.html`, pega texto. Limpieza automática de HTML
- **Análisis con IA** — Resúmenes, conceptos clave, preguntas de estudio y flashcards con Google Gemini (gratis)
- **Tareas Pendientes** — Lista de tareas por materia con estados
- **Exportación** — JSON, TXT o Markdown
- **Backup/Restauración** — Descarga y restaura backups completos
- **Datos en tu navegador** — Todo se guarda en localStorage (privado, sin servidor)

## Instalación Local

```bash
git clone https://github.com/torresingenieriadev/gestor_universitario.git
cd gestor_universitario
python run.py
```

Abre **http://127.0.0.1:5000**

## Configurar IA (Opcional)

Sin API key funciona con análisis local básico. Para IA real:

1. Ve a [Google AI Studio](https://aistudio.google.com/apikey)
2. Crea una API key gratuita
3. Crea un archivo `.env` en la carpeta del proyecto:

```
GEMINI_API_KEY=AIzaSyTuKeyAqui
```

## Despliegue en Vercel (URL Pública)

1. Crear cuenta en [vercel.com](https://vercel.com)
2. Importar el repo `torresingenieriadev/gestor_universitario`
3. Framework: **Other**
4. Build Command: `pip install -r requirements.txt`
5. Output Directory: dejar vacío
6. Environment Variables:
   - `GEMINI_API_KEY` = tu key de Google AI Studio
7. Deploy

Tu app estará en `https://gestor-universitario.vercel.app`

> **Nota:** Los datos se almacenan en el navegador del usuario (localStorage). Cada dispositivo tiene sus propios datos. Usa Exportar/Restaurar para mover datos entre dispositivos.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Python / Flask (Vercel Serverless) |
| Frontend | HTML / CSS / JavaScript |
| IA | Google Gemini 2.5 Flash |
| Almacenamiento | localStorage (navegador) |

## Licencia

MIT
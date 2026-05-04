# Gestor Universitario

Sistema web personal para organizar notas, transcripciones y tareas universitarias con análisis de IA.

## Características

- **Materias y Encuentros** — Estructura jerárquica: Materias → Encuentros → Notas rápidas
- **Importación de Transcripciones** — Arrastra archivos `.txt`/`.html`, pega texto, o carga desde Google Drive. Limpieza automática de HTML
- **Análisis con IA** — Resúmenes, conceptos clave, preguntas de estudio y flashcards generados por Google Gemini (gratis)
- **Tareas Pendientes** — Lista de tareas por materia con estados (pendiente/completada)
- **Exportación** — Exporta encuentros individuales o toda la materia en JSON, TXT o Markdown
- **Copiado Rápido** — Copia transcripciones y notas al portapapeles con un clic
- **Persistencia JSON** — Los datos se guardan automáticamente en `data/data.json`
- **100% Local** — Sin base de datos externa, todo corre en tu máquina

## Requisitos

- Python 3.10 o superior
- Navegador moderno (Chrome, Firefox, Edge)

## Instalación Rápida

```bash
# Clonar el repositorio
git clone https://github.com/torresingenieriadev/gestor_universitario.git
cd gestor_universitario

# Ejecutar (instala dependencias automáticamente)
python run.py
```

Abre tu navegador en **http://127.0.0.1:5000**

## Configurar IA (Opcional)

El análisis funciona sin IA con un motor local básico. Para análisis real con Google Gemini:

1. Ve a [Google AI Studio](https://aistudio.google.com/apikey)
2. Crea una API key gratuita (sin tarjeta de crédito)
3. Crea un archivo `.env` en la carpeta del proyecto:

```
GEMINI_API_KEY=AIzaSyTuKeyAqui
```

Reinicia el servidor y la pestaña "Análisis IA" usará Gemini automáticamente.

## Estructura del Proyecto

```
gestor_universitario/
├── app.py                # Backend Flask (API REST)
├── run.py                # Launcher (auto-instala dependencias)
├── requirements.txt      # Dependencias Python
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

### Crear una Materia
1. Haz clic en **+** en la barra lateral
2. Escribe el nombre (ej: "Cálculo Diferencial")

### Importar una Transcripción
1. Entra a un encuentro
2. Haz clic en **Importar Transcripción**
3. Arrastra un archivo `.txt`/`.html` o pega el texto
4. Previsualiza el texto limpio y haz clic en **Guardar en este encuentro**

### Análisis con IA
1. Selecciona una materia → pestaña **Análisis IA**
2. Elige una transcripción y el tipo de análisis
3. Gemini generará el resultado automáticamente

### Exportar
1. Pestaña **Exportar** dentro de una materia
2. Selecciona los encuentros y el formato (JSON/TXT/Markdown)
3. Descarga el archivo

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Backend | Python / Flask |
| Frontend | HTML / CSS / JavaScript |
| IA | Google Gemini 2.5 Flash (API gratuita) |
| Almacenamiento | JSON local |

## Licencia

MIT
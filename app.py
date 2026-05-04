import os
import json
import uuid
import re
import requests
from flask import Flask, render_template, request, jsonify
from html.parser import HTMLParser

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "data.json")

try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    load_dotenv(env_path)
except ImportError:
    pass

HF_API_KEY = os.environ.get("HF_API_KEY", "").strip()
HF_CLIENT = None

if HF_API_KEY:
    try:
        from huggingface_hub import InferenceClient
        HF_CLIENT = InferenceClient(token=HF_API_KEY)
    except ImportError:
        pass


class HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = False
        if tag in ("p", "br", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"):
            self.text.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.text.append(data)

    def get_text(self):
        return "".join(self.text)


def clean_html(raw_html):
    stripper = HTMLStripper()
    stripper.feed(raw_html)
    text = stripper.get_text()

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" +", " ", text)
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(line for line in lines if line)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def load_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        save_data({"subjects": []})
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/data", methods=["GET"])
def get_data():
    return jsonify(load_data())


@app.route("/api/subjects", methods=["POST"])
def create_subject():
    data = load_data()
    subject = {
        "id": str(uuid.uuid4()),
        "name": request.json.get("name", "").strip(),
        "sessions": [],
    }
    data["subjects"].append(subject)
    save_data(data)
    return jsonify(subject), 201


@app.route("/api/subjects/<subject_id>", methods=["PUT"])
def update_subject(subject_id):
    data = load_data()
    for subject in data["subjects"]:
        if subject["id"] == subject_id:
            subject["name"] = request.json.get("name", "").strip()
            save_data(data)
            return jsonify(subject)
    return jsonify({"error": "Materia no encontrada"}), 404


@app.route("/api/subjects/<subject_id>", methods=["DELETE"])
def delete_subject(subject_id):
    data = load_data()
    data["subjects"] = [s for s in data["subjects"] if s["id"] != subject_id]
    save_data(data)
    return jsonify({"ok": True})


@app.route("/api/subjects/<subject_id>/sessions", methods=["POST"])
def create_session(subject_id):
    data = load_data()
    for subject in data["subjects"]:
        if subject["id"] == subject_id:
            session = {
                "id": str(uuid.uuid4()),
                "title": request.json.get("title", "").strip(),
                "notes": request.json.get("notes", "").strip(),
                "transcript": request.json.get("transcript", "").strip(),
            }
            subject["sessions"].append(session)
            save_data(data)
            return jsonify(session), 201
    return jsonify({"error": "Materia no encontrada"}), 404


@app.route("/api/subjects/<subject_id>/sessions/<session_id>", methods=["PUT"])
def update_session(subject_id, session_id):
    data = load_data()
    for subject in data["subjects"]:
        if subject["id"] == subject_id:
            for session in subject["sessions"]:
                if session["id"] == session_id:
                    session["title"] = request.json.get("title", session["title"]).strip()
                    session["notes"] = request.json.get("notes", session["notes"]).strip()
                    session["transcript"] = request.json.get("transcript", session["transcript"]).strip()
                    save_data(data)
                    return jsonify(session)
    return jsonify({"error": "No encontrado"}), 404


@app.route("/api/subjects/<subject_id>/sessions/<session_id>", methods=["DELETE"])
def delete_session(subject_id, session_id):
    data = load_data()
    for subject in data["subjects"]:
        if subject["id"] == subject_id:
            subject["sessions"] = [s for s in subject["sessions"] if s["id"] != session_id]
            save_data(data)
            return jsonify({"ok": True})
    return jsonify({"error": "No encontrado"}), 404


@app.route("/api/clean-html", methods=["POST"])
def clean_html_endpoint():
    raw = request.json.get("html", "")
    cleaned = clean_html(raw)
    return jsonify({"cleaned": cleaned})


@app.route("/api/import", methods=["POST"])
def import_transcript():
    raw = ""
    if "file" in request.files:
        file = request.files["file"]
        raw = file.read().decode("utf-8", errors="ignore")
    else:
        raw = request.json.get("text", "")

    cleaned = clean_html(raw)
    return jsonify({"cleaned": cleaned})


@app.route("/api/data", methods=["PUT"])
def save_full_data():
    data = request.json
    if data and "subjects" in data:
        save_data(data)
        return jsonify({"ok": True})
    return jsonify({"error": "Datos inválidos"}), 400


@app.route("/api/analyze", methods=["POST"])
def analyze_transcript():
    transcript = request.json.get("transcript", "")
    analysis_type = request.json.get("type", "summary")

    if not transcript:
        return jsonify({"error": "No hay transcripción para analizar"}), 400

    if HF_CLIENT:
        return _hf_analyze(transcript, analysis_type)
    return jsonify({
        "result": _local_result(transcript, analysis_type)
        + "\n\n---\nModo offline. No se detecto HF_API_KEY.\n"
        + "Crea un archivo .env con: HF_API_KEY=hf_tu_token"
    })


@app.route("/api/status", methods=["GET"])
def api_status():
    if not HF_CLIENT:
        return jsonify({"hf_configured": False, "msg": "Libreria huggingface-hub no disponible. Ejecuta: pip install huggingface-hub"})

    models = [
        "google/flan-t5-base",
        "google/flan-t5-small",
        "microsoft/DialoGPT-medium",
        "distilgpt2",
    ]
    results = []

    for model in models:
        try:
            result = HF_CLIENT.text_generation("Di hola", model=model, max_new_tokens=5)
            if result:
                return jsonify({"hf_configured": True, "status": "ok", "model": model, "msg": "Hugging Face conectado"})
        except Exception as e:
            results.append(f"{model}: {str(e)[:150]}")
            continue

    return jsonify({
        "hf_configured": True,
        "status": "error",
        "msg": "Ningun modelo respondio.",
        "errors": results,
    })


def _hf_analyze(transcript, analysis_type):
    prompts = {
        "summary": (
            "Eres un asistente academico. Genera un resumen ejecutivo en espanol del siguiente texto de clase universitaria. "
            "Incluye: 1) Idea principal, 2) Puntos clave (en vinetas), 3) Conclusion breve.\n\nTEXTO:\n{text}\n\nRESUMEN:"
        ),
        "keywords": (
            "Extrae los 10 conceptos o terminos clave mas importantes del siguiente texto academico en espanol. "
            "Para cada concepto escribe una breve definicion basada en el contexto.\n\nTEXTO:\n{text}\n\nCONCEPTOS:"
        ),
        "questions": (
            "Genera 5 preguntas de estudio en espanol basadas en este texto de clase. Incluye respuesta.\n\nTEXTO:\n{text}\n\nPREGUNTAS:"
        ),
        "flashcards": (
            "Crea 5 tarjetas de estudio en espanol. Formato: FRENTE: concepto | REVERSO: definicion.\n\nTEXTO:\n{text}\n\nTARJETAS:"
        ),
    }

    prompt_template = prompts.get(analysis_type, prompts["summary"])
    max_chars = 3500
    truncated = transcript[:max_chars]

    full_prompt = prompt_template.format(text=truncated)
    models = ["google/flan-t5-large", "google/flan-t5-base", "google/flan-t5-small"]
    last_error = ""

    for model in models:
        try:
            result = HF_CLIENT.text_generation(
                full_prompt,
                model=model,
                max_new_tokens=500,
                temperature=0.3,
            )
            if result and len(result.strip()) > 10:
                return jsonify({"result": result.strip()})
            last_error = f"{model}: respuesta vacia"
        except Exception as e:
            last_error = f"{model}: {str(e)[:120]}"
            continue

    return jsonify({
        "result": _local_result(transcript, analysis_type)
        + f"\n\n[IA no disponible: {last_error}]"
    })


def _local_result(transcript, analysis_type):
    transcript_lower = transcript.lower()

    if analysis_type == "summary":
        word_count = len(transcript.split())
        sentences = [s.strip() for s in transcript.replace("\n", " ").split(".") if s.strip()]
        first_sentences = ". ".join(sentences[:3]) + "." if len(sentences) >= 3 else ". ".join(sentences) + "."
        result = (
            f"RESUMEN EJECUTIVO (local)\n{'='*50}\n\n"
            f"Extensión: {word_count} palabras | {len(sentences)} oraciones\n\n"
            f"Introducción:\n{first_sentences}\n\n"
            f"Ideas principales detectadas:\n"
        )
        keywords = ["concepto", "teoría", "ejemplo", "importante", "fórmula", "ecuación",
                     "definición", "propiedad", "función", "método", "resultado", "análisis",
                     "problema", "solución", "conclusión", "proceso", "sistema", "principio"]
        found = [f"  - '{kw}' aparece {transcript_lower.count(kw)} veces" for kw in keywords if transcript_lower.count(kw) > 0]
        result += "\n".join(found[:10]) if found else "  - Analiza el texto completo."
        return result

    elif analysis_type == "keywords":
        words = re.findall(r'\b[a-záéíóúñ]{4,}\b', transcript_lower)
        from collections import Counter
        stopwords = {"para", "como", "esta", "este", "esto", "más", "que", "por", "con",
                     "los", "las", "del", "una", "tiene", "entre", "hace", "ser", "son",
                     "sobre", "cada", "puede", "también", "todo", "pero", "muy", "hay",
                     "así", "han", "fue", "era", "sin", "nos", "ese", "esa", "eso", "allí"}
        filtered = [w for w in words if w not in stopwords]
        top = Counter(filtered).most_common(15)
        result = "CONCEPTOS CLAVE (local)\n" + "="*50 + "\n\n"
        for word, count in top:
            result += f"  {word}: {count} menciones\n"
        result += f"\nPalabras analizadas: {len(filtered)}"
        return result

    elif analysis_type == "questions":
        sentences_list = [s.strip() for s in transcript.replace("\n", " ").split(".") if len(s.strip()) > 20]
        result = "PREGUNTAS DE ESTUDIO (local)\n" + "="*50 + "\n\n"
        templates = [
            "¿Cuál es el concepto principal de: {}?",
            "¿Cómo se define {}?",
            "¿Qué relación existe entre {} y el tema central?",
            "Explica con tus palabras: {}",
            "¿Qué ejemplos ilustran {}?",
        ]
        keywords_found = []
        for kw in ["concepto", "teoría", "método", "función", "sistema", "proceso", "análisis",
                    "problema", "resultado", "principio", "ley", "fórmula", "ecuación", "modelo"]:
            if kw in transcript_lower:
                idx = transcript_lower.index(kw)
                start = max(0, idx - 30)
                end = min(len(transcript), idx + 60)
                keywords_found.append((kw, transcript[start:end].strip()))
        if keywords_found:
            for i, (kw, _) in enumerate(keywords_found[:8]):
                result += f"{i+1}. {templates[i % len(templates)].format(kw)}\n"
        else:
            for i, sent in enumerate(sentences_list[:5]):
                words_in_sent = sent.split()
                if len(words_in_sent) > 3:
                    result += f"{i+1}. ¿Qué significa \"{' '.join(words_in_sent[:4])}...\"?\n"
        return result

    elif analysis_type == "flashcards":
        sentences_list = [s.strip() for s in transcript.replace("\n", " ").split(".") if len(s.strip()) > 25]
        result = "TARJETAS DE ESTUDIO (local)\n" + "="*50 + "\n\n"
        cards = []
        for i, sent in enumerate(sentences_list[:8]):
            words_list = sent.split()
            if len(words_list) > 4:
                cards.append(f"Tarjeta {i+1}:\n  FRENTE: {' '.join(words_list[:4])}...\n  REVERSO: {sent}\n")
        result += "\n".join(cards) if cards else "No se encontraron suficientes oraciones."
        return result

    return "Tipo de análisis no soportado."


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)

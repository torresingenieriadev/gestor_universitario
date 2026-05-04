import os
import re
import json
import requests as requests_lib
from flask import Flask, render_template, request, jsonify, send_from_directory
from html.parser import HTMLParser

app = Flask(__name__, static_folder="static", template_folder="templates")

try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    load_dotenv(env_path)
except ImportError:
    pass

HF_API_KEY = os.environ.get("HF_API_KEY", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()

AI_SETTINGS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ai_settings.json")


def load_ai_settings():
    try:
        with open(AI_SETTINGS_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"provider": "gemini", "api_key": ""}


def save_ai_settings(settings):
    with open(AI_SETTINGS_PATH, "w") as f:
        json.dump(settings, f)


def get_active_api_key():
    settings = load_ai_settings()
    provider = settings.get("provider", "gemini")
    key = settings.get("api_key", "").strip()
    if key:
        return provider, key
    if provider == "gemini" and GEMINI_API_KEY:
        return "gemini", GEMINI_API_KEY
    if provider == "deepseek" and DEEPSEEK_API_KEY:
        return "deepseek", DEEPSEEK_API_KEY
    if HF_API_KEY:
        return "hf", HF_API_KEY
    return None, None


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
    text = re.sub(r"Copiar enlace en esta transcripción\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"Copy link to this transcript\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\d{1,2}:\d{2}\s*", "", text)
    for word in ["eh", "Eh", "EH", "ay", "Ay", "AY", "mm", "mM", "Mm", "MM", "uy", "Uy", "UY", "ah", "Ah", "AH"]:
        text = re.sub(r"\b" + re.escape(word) + r"\b", "", text)
    text = re.sub(r" +", " ", text)
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(line for line in lines if line)
    return text.strip()


def gemini_call(prompt, api_key, max_tokens=4000):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.3},
    }
    resp = requests_lib.post(url, json=payload, timeout=60)
    if resp.status_code == 200:
        data = resp.json()
        candidate = data["candidates"][0]
        text = candidate["content"]["parts"][0]["text"]
        finish = candidate.get("finishReason", "")
        if finish == "MAX_TOKENS":
            text += "\n\n[Respuesta cortada por longitud.]"
        return text
    raise Exception(f"Gemini HTTP {resp.status_code}: {resp.text[:200]}")


def deepseek_call(prompt, api_key, max_tokens=4000):
    url = "https://api.deepseek.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
    resp = requests_lib.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code == 200:
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    raise Exception(f"DeepSeek HTTP {resp.status_code}: {resp.text[:200]}")


def hf_call(model, prompt, api_key, max_tokens=500, temperature=0.3):
    url = f"https://api-inference.huggingface.co/models/{model}"
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {"inputs": prompt, "parameters": {"max_new_tokens": max_tokens, "temperature": temperature, "return_full_text": False}}
    resp = requests_lib.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("generated_text", "")
    raise Exception(f"HF HTTP {resp.status_code}")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/clean-html", methods=["POST"])
def clean_html_endpoint():
    raw = request.json.get("html", "")
    return jsonify({"cleaned": clean_html(raw)})


@app.route("/api/import", methods=["POST"])
def import_transcript():
    raw = ""
    if "file" in request.files:
        raw = request.files["file"].read().decode("utf-8", errors="ignore")
    else:
        raw = request.json.get("text", "")
    return jsonify({"cleaned": clean_html(raw)})


@app.route("/api/analyze", methods=["POST"])
def analyze_transcript():
    transcript = request.json.get("transcript", "")
    analysis_type = request.json.get("type", "summary")

    if not transcript:
        return jsonify({"error": "No hay transcripcion"}), 400

    provider, api_key = get_active_api_key()

    if provider == "gemini":
        return _gemini_analyze(transcript, analysis_type, api_key)
    if provider == "deepseek":
        return _deepseek_analyze(transcript, analysis_type, api_key)
    if provider == "hf":
        return _hf_analyze(transcript, analysis_type, api_key)
    return jsonify({"result": _local_result(transcript, analysis_type) + "\n\n---\nModo offline. Configura una API key en Ajustes > IA."})


def _gemini_analyze(transcript, analysis_type, api_key):
    base_instruction = (
        "Eres un asistente academico experto. El texto es una TRANSCRIPCION AUTOMATICA de una clase en vivo. "
        "Tiene muletillas (\"profe\", \"hola\", \"listo\", \"bueno\", \"eh\"), interrupciones, correcciones entre profesor y alumnos, "
        "errores de voz a texto y frases conversacionales. IGNORA todo eso y EXTRAE SOLO el contenido academico. "
        "No incluyas saludos, despedidas ni conversacion social.\n\n"
    )
    prompts = {
        "summary": base_instruction + "Crea un RESUMEN ACADEMICO en espanol. Incluye SIEMPRE: 1) TEMA PRINCIPAL en una oracion, 2) PUNTOS CLAVE con viñetas (mín 5), 3) CONCLUSION breve. Responde COMPLETO.\n\nTRANSCRIPCION:\n{text}\n\nRESUMEN ACADEMICO:",
        "keywords": base_instruction + "Extrae los 10 CONCEPTOS CLAVE academicos de este texto. Para CADA concepto: nombre + definicion breve. Formato numerado 1 al 10. Responde COMPLETO.\n\nTRANSCRIPCION:\n{text}\n\nCONCEPTOS CLAVE:",
        "questions": base_instruction + "Genera 5 PREGUNTAS DE ESTUDIO en espanol basadas en el contenido academico. Cada pregunta con su respuesta. Responde COMPLETO.\n\nTRANSCRIPCION:\n{text}\n\nPREGUNTAS DE ESTUDIO:",
        "flashcards": base_instruction + "Crea 5 TARJETAS DE ESTUDIO en espanol del contenido academico. Formato: FRENTE: concepto/pregunta | REVERSO: definicion/respuesta. Responde COMPLETO.\n\nTRANSCRIPCION:\n{text}\n\nTARJETAS DE ESTUDIO:",
        "study_plan": base_instruction + "Crea un PLAN DE ESTUDIO de 3 dias en espanol basado en este contenido. Para cada dia: tema a estudiar, actividades concretas, tiempo estimado. Formato claro y practico.\n\nTRANSCRIPCION:\n{text}\n\nPLAN DE ESTUDIO:",
    }
    prompt = prompts.get(analysis_type, prompts["summary"])
    full_prompt = prompt.format(text=transcript[:20000])
    try:
        result = gemini_call(full_prompt, api_key, max_tokens=4000)
        return jsonify({"result": result.strip()})
    except Exception as e:
        return jsonify({"result": _local_result(transcript, analysis_type) + f"\n\n[Error Gemini: {str(e)[:150]}]"})


def _deepseek_analyze(transcript, analysis_type, api_key):
    base_instruction = (
        "Eres un asistente academico experto. El texto es una TRANSCRIPCION AUTOMATICA de una clase en vivo. "
        "Tiene muletillas, interrupciones, errores de voz a texto y frases conversacionales. "
        "IGNORA todo eso y EXTRAE SOLO el contenido academico.\n\n"
    )
    prompts = {
        "summary": base_instruction + "Crea un RESUMEN ACADEMICO en espanol. Incluye: 1) TEMA PRINCIPAL, 2) PUNTOS CLAVE (min 5), 3) CONCLUSION.\n\nTRANSCRIPCION:\n{text}\n\nRESUMEN:",
        "keywords": base_instruction + "Extrae 10 CONCEPTOS CLAVE con definicion breve. Formato numerado.\n\nTRANSCRIPCION:\n{text}\n\nCONCEPTOS:",
        "questions": base_instruction + "Genera 5 PREGUNTAS DE ESTUDIO con respuesta.\n\nTRANSCRIPCION:\n{text}\n\nPREGUNTAS:",
        "flashcards": base_instruction + "Crea 5 TARJETAS. Formato: FRENTE: concepto | REVERSO: definicion.\n\nTRANSCRIPCION:\n{text}\n\nTARJETAS:",
        "study_plan": base_instruction + "Crea un PLAN DE ESTUDIO de 3 dias basado en este contenido.\n\nTRANSCRIPCION:\n{text}\n\nPLAN:",
    }
    prompt = prompts.get(analysis_type, prompts["summary"])
    full_prompt = prompt.format(text=transcript[:20000])
    try:
        result = deepseek_call(full_prompt, api_key, max_tokens=4000)
        return jsonify({"result": result.strip()})
    except Exception as e:
        return jsonify({"result": _local_result(transcript, analysis_type) + f"\n\n[Error DeepSeek: {str(e)[:150]}]"})


def _hf_analyze(transcript, analysis_type, api_key):
    prompts = {
        "summary": "Resume este texto en espanol. Idea principal, puntos clave, conclusion.\n\nTEXTO:\n{text}\n\nRESUMEN:",
        "keywords": "Extrae 10 conceptos clave con definicion breve.\n\nTEXTO:\n{text}\n\nCONCEPTOS:",
        "questions": "Genera 5 preguntas de estudio con respuesta.\n\nTEXTO:\n{text}\n\nPREGUNTAS:",
        "flashcards": "Crea 5 flashcards. FRENTE: concepto | REVERSO: definicion.\n\nTEXTO:\n{text}\n\nTARJETAS:",
    }
    prompt = prompts.get(analysis_type, prompts["summary"])
    full_prompt = prompt.format(text=transcript[:3500])
    for model in ["google/flan-t5-large", "google/flan-t5-base", "google/flan-t5-small"]:
        try:
            result = hf_call(model, full_prompt, api_key)
            if result and len(result.strip()) > 10:
                return jsonify({"result": result.strip()})
        except Exception:
            continue
    return jsonify({"result": _local_result(transcript, analysis_type) + "\n\n[HF no disponible.]"})


def _local_result(transcript, analysis_type):
    t = transcript.lower()
    if analysis_type == "summary":
        wc = len(transcript.split())
        sents = [s.strip() for s in transcript.replace("\n", " ").split(".") if s.strip()]
        first = ". ".join(sents[:3]) + "." if len(sents) >= 3 else ". ".join(sents) + "."
        kws = ["concepto", "teoria", "ejemplo", "importante", "formula", "ecuacion",
               "definicion", "propiedad", "funcion", "metodo", "resultado", "analisis",
               "problema", "solucion", "conclusion", "proceso", "sistema", "principio"]
        found = [f"  - '{k}' aparece {t.count(k)} veces" for k in kws if t.count(k) > 0]
        return f"RESUMEN (local)\n{'='*40}\nPalabras: {wc}\n\n{first}\n\nIdeas:\n" + ("\n".join(found[:8]) if found else "Sin detecciones")
    elif analysis_type == "keywords":
        words = re.findall(r'\b[a-záéíóúñ]{4,}\b', t)
        from collections import Counter
        sw = {"para","como","esta","este","esto","mas","que","por","con","los","las","del","una","tiene","entre","hace","ser","son","sobre","cada","puede","tambien","todo","pero","muy","hay","asi","han","fue","era","sin","nos","ese","esa","eso","alli"}
        filtered = [w for w in words if w not in sw]
        return "CONCEPTOS (local)\n" + "\n".join(f"  {w}: {c}" for w, c in Counter(filtered).most_common(10))
    elif analysis_type == "questions":
        return "PREGUNTAS (local)\nGenera preguntas de estudio basandote en el texto."
    elif analysis_type == "flashcards":
        return "TARJETAS (local)\nCrea tarjetas de estudio basandote en el texto."
    return "Analisis local completado."


@app.route("/api/ai-settings", methods=["GET"])
def get_ai_settings():
    settings = load_ai_settings()
    provider, _ = get_active_api_key()
    return jsonify({
        "provider": settings.get("provider", "gemini"),
        "configured": provider is not None,
        "providers": [
            {"id": "gemini", "name": "Google Gemini", "free": True, "url": "https://aistudio.google.com/apikey"},
            {"id": "deepseek", "name": "DeepSeek (China)", "free": True, "url": "https://platform.deepseek.com/api_keys"},
            {"id": "hf", "name": "Hugging Face", "free": True, "url": "https://huggingface.co/settings/tokens"},
        ],
    })


@app.route("/api/ai-settings", methods=["POST"])
def save_ai_settings_endpoint():
    data = request.json
    provider = data.get("provider", "gemini")
    api_key = data.get("api_key", "").strip()
    settings = {"provider": provider, "api_key": api_key}
    save_ai_settings(settings)
    return jsonify({"ok": True})


@app.route("/api/ai-test", methods=["POST"])
def test_ai_connection():
    data = request.json
    provider = data.get("provider", "gemini")
    api_key = data.get("api_key", "").strip()
    try:
        if provider == "gemini":
            gemini_call("Responde solo OK", api_key, max_tokens=5)
        elif provider == "deepseek":
            deepseek_call("Responde solo OK", api_key, max_tokens=5)
        elif provider == "hf":
            hf_call("google/flan-t5-small", "Responde solo OK", api_key, max_tokens=10)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)[:200]}), 400


@app.route("/api/status", methods=["GET"])
def api_status():
    provider, api_key = get_active_api_key()
    info = {"active_provider": provider}
    if provider == "gemini" and api_key:
        try:
            gemini_call("Hola", api_key, max_tokens=5)
            info["gemini"] = {"status": "ok", "model": "gemini-2.5-flash"}
        except Exception as e:
            info["gemini"] = {"status": "error", "msg": str(e)[:150]}
    if provider == "deepseek" and api_key:
        try:
            deepseek_call("Hola", api_key, max_tokens=5)
            info["deepseek"] = {"status": "ok", "model": "deepseek-chat"}
        except Exception as e:
            info["deepseek"] = {"status": "error", "msg": str(e)[:150]}
    if provider == "hf" and api_key:
        info["hf"] = {"status": "configured", "key": api_key[:8] + "..."}
    if not provider:
        info["msg"] = "Sin API keys. Configura una en Ajustes > IA."
    return jsonify(info)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)

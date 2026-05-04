import sys
import subprocess
import os

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    try:
        import flask
        import dotenv
    except ImportError:
        print("Instalando dependencias...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "--quiet"])
        print("Dependencias instaladas.")

    try:
        from dotenv import load_dotenv
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        load_dotenv(env_path)
    except ImportError:
        pass

    from app import app

    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    hf_key = os.environ.get("HF_API_KEY", "")
    print("\n" + "=" * 50)
    print("  Gestor Universitario")
    print("=" * 50)
    print(f"  IA: {'Gemini' if gemini_key else 'HF' if hf_key else 'Solo local'}")
    print(f"  URL: http://127.0.0.1:5000")
    print("=" * 50 + "\n")

    app.run(debug=True, host="127.0.0.1", port=5000)

if __name__ == "__main__":
    main()
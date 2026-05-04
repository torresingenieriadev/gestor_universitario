import sys
import subprocess
import os

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    try:
        import flask
        import requests
        import huggingface_hub
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
    app.run(debug=True, host="127.0.0.1", port=5000)

if __name__ == "__main__":
    main()

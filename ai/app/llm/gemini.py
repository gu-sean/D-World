
import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()


def generate_json(instructions: str, payload: dict) -> dict:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "").strip()

    if not api_key or api_key.startswith("여기에"):
        raise RuntimeError("GEMINI_API_KEY가 설정되지 않았습니다.")

    if not model:
        raise RuntimeError("GEMINI_MODEL이 설정되지 않았습니다.")

    client = genai.Client(
    api_key=api_key,
    http_options=types.HttpOptions(
        api_version="v1beta",
        timeout=30000,
    ),
)

    try:
        response = client.models.generate_content(
            model=model,
            contents=(
                instructions
                + "\n\n입력 데이터(JSON):\n"
                + json.dumps(payload, ensure_ascii=False)
            ),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=4096,
                
            ),
        )

        if not response.text:
            raise RuntimeError("Gemini 응답이 비어 있습니다.")

        result = json.loads(response.text)

        if not isinstance(result, dict):
            raise RuntimeError("Gemini가 JSON 객체를 반환하지 않았습니다.")

        return result

    finally:
        client.close()

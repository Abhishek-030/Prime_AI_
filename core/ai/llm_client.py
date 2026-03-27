import requests
import json 
import re

class LLMClient: 
    def __init__(self, model="qwen2.5-coder:1.5b"):
        self.model=model
        self.url="http://localhost:11434/api/generate"

    def generate(self, prompt: str) -> dict: 
        try:
            response=requests.post(
            self.url, 
            json={
                "model":self.model, 
                "prompt":prompt, 
                "stream":False
            }, 
            timeout=60
            )

            raw_output=response.json().get("response", "").strip()
            # print("LLM raw o/p: ", raw_output)

            json_match=re.search(r"\{.*\}",raw_output,re.DOTALL)
            if not json_match:
                raise ValueError("No json found")
            json_str=json_match.group(0)
            return json.loads(json_str)
            
        except Exception as e:
            print("LLM error : ", e)
            return{
                "intent":"Unknownnn", 
                "params":"{}", 
                "confidence":0.0
            }
        # except json.JSONDecodeError:
            

# ─── Code Generation Client ──────────────────────────────────────────────────

class CodeLLMClient:
    """
    Dedicated client for code generation using qwen2.5-coder:7b.
    Streams tokens back as a generator so the frontend gets output
    with minimum latency (first token appears almost immediately).
    """

    CODE_ONLY_PREFIX = (
        "You are a code generator. Output ONLY raw source code with NO explanations, "
        "NO markdown, NO backticks, NO comments unless they are part of the code itself. "
        "Start the code immediately.\n\nTask: "
    )

    CHAT_PREFIX = (
        "You are Prime AI, a friendly and intelligent personal assistant. "
        "Respond naturally, helpfully and concisely. "
        "Always vary your wording — never repeat the same phrasing twice.\n\nUser: "
    )

    def __init__(self):
        self.model = "qwen2.5-coder:7b"
        self.url = "http://localhost:11434/api/generate"

    def stream_reply(self, user_message: str):
        """
        Streaming general chat using qwen2.5-coder:1.5b (small & fast).
        Already loaded by intent detector so first token is near-instant.
        """
        full_prompt = self.CHAT_PREFIX + user_message + "\nPrime AI:"
        try:
            with requests.post(
                self.url,
                json={
                    "model": "qwen2.5-coder:1.5b",
                    "prompt": full_prompt,
                    "stream": True,
                    "options": {
                        "temperature": 0.9,
                        "top_p": 0.95,
                        "repeat_penalty": 1.3,
                    },
                },
                stream=True,
                timeout=120,
            ) as resp:
                resp.raise_for_status()
                for raw_line in resp.iter_lines():
                    if raw_line:
                        try:
                            data = json.loads(raw_line.decode("utf-8"))
                            token = data.get("response", "")
                            if token:
                                yield token
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            print("stream_reply error:", e)
            yield "Sorry, I couldn't connect. Make sure Ollama is running with qwen2.5-coder:1.5b."

    def stream_code(self, user_prompt: str):
        """
        Generator that yields decoded text chunks as they stream from Ollama.
        Usage:
            for chunk in client.stream_code("write bubble sort in python"):
                print(chunk, end="", flush=True)
        """
        full_prompt = self.CODE_ONLY_PREFIX + user_prompt
        try:
            with requests.post(
                self.url,
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": True,
                },
                stream=True,
                timeout=120,
            ) as resp:
                resp.raise_for_status()
                for raw_line in resp.iter_lines():
                    if raw_line:
                        try:
                            data = json.loads(raw_line.decode("utf-8"))
                            token = data.get("response", "")
                            if token:
                                yield token
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            print("CodeLLMClient stream error:", e)
            yield f"\n# Error: {e}"
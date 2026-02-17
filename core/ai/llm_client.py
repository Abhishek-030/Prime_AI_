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
            
from core.ai.llm_client import LLMClient 

class IntentDetector:

    def __init__(self):
        self.llm=LLMClient()

    def detect(self, text: str) -> dict:
        # cleaned_text = text.strip().lower()
        cleaned_text = text.strip()

        # Temporary placeholder (rule-based)
        # if "open" in cleaned_text:
        #     return {
        #         "intent": "OPEN_APP",
        #         "params": {},
        #         "confidence": 0.5
        #     }
        
        prompt=self.build_prompt(cleaned_text)
        # Updated threshold: 
        command=self.llm.generate(prompt)

        if command.get("confidence",0)<0.6:
            return {
                "intent": "UNKNOWN",
                "params": {},
                "confidence": 0.0
            }
        
        return command
        # return self.llm.generate(prompt)

        # return {
        #     "intent": "UNKNOWN",
        #     "params": {},
        #     "confidence": 0.0
        # }
    
    def build_prompt(self, user_input:str)->str: 
        return f"""
You are a strict JSON classifier.

Respond ONLY with valid JSON.
Do NOT add explanations.
Do NOT use markdown.
Do NOT wrap in backticks.

Supported intents:
OPEN_APP
User wants to open an application or program.
Examples:
- open chrome
- launch vscode
- open vs code
- start calculator
- open file explorer
- open windows explorer
- open whatsapp
- Help me organize my files by date and type

CREATE_DIR
User wants to create a folder/directory.
Examples:
- create folder notes
- make a directory called projects

SYSTEM_INFO
User wants system information like CPU, RAM, disk usage.
Examples:
- system info
- show memory usage
- cpu usage
- Check my system health and suggest optimizations

If input does not match, return UNKNOWN.

User input: "{user_input}"

Return EXACTLY in this format:

For OPEN_APP:
{{
  "intent": "OPEN_APP",
  "params": {{
    "app": ""
  }},
  "confidence": 0.0
}}

For CREATE_DIR:
{{
  "intent": "CREATE_DIR",
  "params": {{
    "name": "",
    "path": ""
  }},
  "confidence": 0.0
}}

For SYSTEM_INFO:
{{
  "intent": "SYSTEM_INFO",
  "params": {{}},
  "confidence": 0.0
}}

For UNKNOWN:
{{
  "intent": "UNKNOWN",
  "params": {{}},
  "confidence": 0.0
}}
"""
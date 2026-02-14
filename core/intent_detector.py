from ai.llm_client import LLMClient 

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
- start calculator

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

If input does not match, return UNKNOWN.

User input: "{user_input}"

Return EXACTLY in this format:

{{
  "intent": "INTENT_NAME",
  "params":{{
      "name":"",
      "path":""
  }}
  "confidence": 0.0
}}
"""
#   "params": {{}},

# You are a command classifier. 

# Return ONLY valid JSON. 
# Do not explain anything. 

# Supported intents: 
# - OPEN_APP
# - CREATE_DIR
# - SYSTEM_INFO
# - UNKNOWN

# User input:"{user_input}"

# Return format: 
# {{
#   "intent":"<INTENT_NAME>", 
#   "params":{{}}, 
#   "confidence":0.0
# }}
# """
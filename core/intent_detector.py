class IntentDetector:
    def detect(self, text: str) -> dict:
        cleaned_text = text.strip().lower()

        # Temporary placeholder (rule-based)
        if "open" in cleaned_text:
            return {
                "intent": "OPEN_APP",
                "params": {},
                "confidence": 0.5
            }

        return {
            "intent": "UNKNOWN",
            "params": {},
            "confidence": 0.0
        }

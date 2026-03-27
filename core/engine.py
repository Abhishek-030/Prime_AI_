from core.intent_detector import IntentDetector
from core.command_router import CommandRouter
from core.ai.llm_client import CodeLLMClient

class Engine:
    def __init__(self):
        self.intent_detector = IntentDetector()
        self.router = CommandRouter()
        self.code_client = CodeLLMClient()

    def run(self, text: str) -> str:
        """Legacy sync path — only used for commands now."""
        command = self.intent_detector.detect(text)
        return self.router.route(command)

    def stream_run(self, text: str):
        """
        Always a generator. Commands yield their result as one chunk.
        Unknown intents stream tokens from qwen2.5-coder:1.5b (fast).
        """
        command = self.intent_detector.detect(text)
        intent = command.get("intent", "UNKNOWN")

        if intent in ("UNKNOWN", "Unknownnn"):
            yield from self.code_client.stream_reply(text)
        else:
            # Command result is instant — emit as single chunk
            result = self.router.route(command)
            yield result

    def generate_code(self, prompt: str):
        """Returns a streaming generator of code tokens from qwen2.5-coder:7b."""
        return self.code_client.stream_code(prompt)
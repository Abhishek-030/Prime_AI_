from core.intent_detector import IntentDetector
from core.command_router import CommandRouter

class Engine:
    def __init__(self):
        self.intent_detector = IntentDetector()
        self.router = CommandRouter()

    def run(self, text: str) -> str:
        command = self.intent_detector.detect(text)
        result = self.router.route(command)
        return result
class CommandRouter:
    def route(self, command: dict) -> str:
        intent = command.get("intent")

        if intent == "OPEN_APP":
            return "Opening application (stub)"

        return "Sorry, I didn't understand that command."

class CommandRouter:
    def route(self, command: dict) -> str:
        intent = command.get("intent")

        # if intent == "OPEN_APP":
        #     return "Opening application (stub)"

        return intent
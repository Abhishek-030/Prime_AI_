from core.filesystem.directory_manager import DirectoryManager
from core.system.system_info import SystemInfo
from core.system.app_launcher import AppLauncher

class CommandRouter:
    def route(self, command: dict) -> str:
        intent = command.get("intent")
        params=command.get("params", {})

        if intent=="CREATE_DIR":
            return DirectoryManager.create_directory(
                name=params.get("name", ""),
                path=params.get("path", "")
            )
        
        if intent=="SYSTEM_INFO":
            return SystemInfo.get_info()
        
        if intent=="OPEN_APP":
            return AppLauncher.launch(
                app_name=params.get("app","")
            )

        return f"I'm not sure how to handle that request (intent: {intent}). Try asking me to open an app, create a folder, or check system info."
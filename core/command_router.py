from filesystem.directory_manager import DirectoryManager
from system.system_info import SystemInfo
from system.app_launcher import AppLauncher

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

        # if intent == "OPEN_APP":
        #     return "Opening application (stub)"

        return intent
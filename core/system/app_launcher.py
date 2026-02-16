import subprocess 

class AppLauncher: 

    CHROME_EXE=r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    APP_MAP={
        "chrome":[CHROME_EXE, "--profile-directory=Default"], 
        "calculator":"calc"
    }

    @staticmethod
    def launch(app_name: str)->str: 

        try:
            app_name=app_name.lower()

            if app_name not in AppLauncher.APP_MAP: 
                return f"Application '{app_name}' not recognized."
            
            subprocess.Popen(AppLauncher.APP_MAP[app_name])

            return f"Lauching {app_name}"
        
        except Exception as e: 
            return f"Error Launching app: {str(e)}"
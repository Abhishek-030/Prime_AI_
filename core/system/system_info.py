import psutil
import platform

class SystemInfo: 

    @staticmethod
    def get_info()->str: 
        try: 
            cpu_usage=psutil.cpu_percent(interval=1)
            memory=psutil.virtual_memory()
            disk=psutil.disk_usage("/")

            os_name=platform.system()
            os_version=platform.version()

            return (
                f"Operating System: {os_name}\n"
                f"OS Version: {os_version}\n"
                f"CPU usage: {cpu_usage}%\n"
                f"RAM usage: {memory.percent}% "
                f"({round(memory.used / (1024**3), 2)}GB /"
                f"{round(memory.total /(1024**3), 2)}GB)\n"
                f"Disk Usage: {disk.percent}% "
                f"({round(disk.used / (1024**3), 2)}GB /"
                f"{round(disk.total / (1024**3), 2)}GB)"
            )
        except Exception as e: 
            return f"Error retrieving system information : {str(e)}"
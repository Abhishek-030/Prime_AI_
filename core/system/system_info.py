import psutil
import platform

class SystemInfo:

    @staticmethod
    def get_info() -> str:
        try:
            cpu_usage = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()

            # Use platform-aware disk path — Windows needs "C:\", Unix uses "/"
            disk_path = "C:\\" if platform.system() == "Windows" else "/"
            disk = psutil.disk_usage(disk_path)

            os_name = platform.system()
            os_version = platform.version()

            mem_used  = round(memory.used  / (1024**3), 2)
            mem_total = round(memory.total / (1024**3), 2)
            disk_used  = round(disk.used  / (1024**3), 2)
            disk_total = round(disk.total / (1024**3), 2)

            return (
                f"Here's your system health report:\n"
                f"• OS: {os_name} ({os_version[:40]})\n"
                f"• CPU Usage: {cpu_usage}%\n"
                f"• RAM: {memory.percent}% used ({mem_used} GB / {mem_total} GB)\n"
                f"• Disk (C:\\): {disk.percent}% used ({disk_used} GB / {disk_total} GB)"
            )

        except Exception as e:
            return f"Error retrieving system information: {str(e)}"
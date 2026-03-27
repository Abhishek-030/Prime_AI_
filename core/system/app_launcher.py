"""
AppLauncher  –  launches apps and FORCES them to appear on the main screen.

Windows 10/11 blocks background processes from calling SetForegroundWindow
directly (it just flashes the taskbar instead).  The fix is AttachThreadInput:
  1. Get the current foreground window's thread ID
  2. Attach our thread to it
  3. Now SetForegroundWindow works  (Windows thinks we own the foreground)
  4. Detach
"""

import ctypes
import ctypes.wintypes
import threading
import time
import os

# ── Win32 constants ──────────────────────────────────────────────────────────
SW_RESTORE       = 9   # Restore if minimised / maximised → normal + bring front
SW_SHOW          = 5   # Show in current size + position, activate
SW_SHOWMAXIMIZED = 3   # Show maximised
SW_SHOWNORMAL    = 1   # Restore and show normally

# ── Win32 DLL references ─────────────────────────────────────────────────────
user32   = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# EnumWindows callback signature
WNDENUMPROC = ctypes.WINFUNCTYPE(
    ctypes.c_bool,
    ctypes.wintypes.HWND,
    ctypes.wintypes.LPARAM,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _pid_of_hwnd(hwnd: int) -> int:
    pid = ctypes.wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value


def _exe_of_pid(pid: int) -> str:
    """Return the lowercase basename of the .exe for the given pid."""
    try:
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        h = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not h:
            return ""
        buf  = ctypes.create_unicode_buffer(260)
        size = ctypes.wintypes.DWORD(260)
        ctypes.windll.kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size))
        kernel32.CloseHandle(h)
        return os.path.basename(buf.value).lower()
    except Exception:
        return ""


def _force_foreground(hwnd: int) -> None:
    """
    Force `hwnd` to appear on the main screen using the AttachThreadInput trick.
    This bypasses Windows 10/11 focus-stealing protection.
    """
    # Get thread IDs
    fg_hwnd    = user32.GetForegroundWindow()
    fg_tid     = user32.GetWindowThreadProcessId(fg_hwnd, None)
    our_tid    = kernel32.GetCurrentThreadId()

    # Attach our message queue to the foreground thread
    if fg_tid and fg_tid != our_tid:
        user32.AttachThreadInput(our_tid, fg_tid, True)

    # Restore if minimised, then raise to foreground
    user32.ShowWindow(hwnd, SW_RESTORE)
    user32.BringWindowToTop(hwnd)
    user32.SetForegroundWindow(hwnd)

    # Detach
    if fg_tid and fg_tid != our_tid:
        user32.AttachThreadInput(our_tid, fg_tid, False)


def _find_hwnds_by_exe(exe_lower: str) -> list:
    """Return a list of visible top-level window handles belonging to exe_lower."""
    found = []

    def _cb(hwnd, _):
        # must be a visible, non-child window with a title
        if not user32.IsWindowVisible(hwnd):
            return True
        if user32.GetParent(hwnd) != 0:
            return True
        pid  = _pid_of_hwnd(hwnd)
        name = _exe_of_pid(pid)
        if name == exe_lower:
            found.append(hwnd)
        return True

    user32.EnumWindows(WNDENUMPROC(_cb), 0)
    return found


def _launch_then_focus(shell_exe: str, params, focus_exe: str) -> None:
    """
    Background thread:
      1. Launch via ShellExecuteW (SW_SHOWNORMAL – most compatible)
      2. Poll every 500 ms for up to 8 s waiting for the window to appear
      3. Force it to the foreground with AttachThreadInput
    """
    # ShellExecuteW  — SW_SHOWNORMAL is the safest; we bring it front ourselves
    ctypes.windll.shell32.ShellExecuteW(
        None, "open", shell_exe, params, None, SW_SHOWNORMAL
    )

    # Poll for the window to appear (up to ~8 seconds)
    deadline = time.time() + 8.0
    hwnd = None
    while time.time() < deadline:
        time.sleep(0.5)
        hwnds = _find_hwnds_by_exe(focus_exe)
        if hwnds:
            hwnd = hwnds[0]
            break

    if hwnd:
        print(f"[AppLauncher] Found window {hwnd:#x} for {focus_exe} – forcing foreground")
        _force_foreground(hwnd)
    else:
        print(f"[AppLauncher] WARNING: No window found for {focus_exe} after 8 s")


# ── Main class ───────────────────────────────────────────────────────────────

class AppLauncher:

    CHROME_EXE   = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    VSCODE_EXE   = r"C:\Users\ASUS\AppData\Local\Programs\Microsoft VS Code\Code.exe"
    WHATSAPP_URI = r"shell:AppsFolder\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App"

    # canonical_key → (shell_exe,  focus_exe_name,    params)
    APP_MAP = {
        "chrome":             (CHROME_EXE,    "chrome.exe",              "--start-maximized --profile-directory=Default"),
        "calculator":         ("calc",         "applicationframehost.exe", None),  # Win10/11 calc host
        "vscode":             (VSCODE_EXE,    "code.exe",                None),
        "vs code":            (VSCODE_EXE,    "code.exe",                None),
        "visual studio code": (VSCODE_EXE,    "code.exe",                None),
        "visual studio":      (VSCODE_EXE,    "code.exe",                None),
        "code":               (VSCODE_EXE,    "code.exe",                None),
        "file explorer":      ("explorer.exe","explorer.exe",            None),
        "explorer":           ("explorer.exe","explorer.exe",            None),
        "windows explorer":   ("explorer.exe","explorer.exe",            None),
        "files":              ("explorer.exe","explorer.exe",            None),
        "whatsapp":           ("explorer.exe","whatsapp.exe",            WHATSAPP_URI),
    }

    KEYWORD_MAP = [
        ("visual studio code", "vs code"),
        ("visual studio",      "vs code"),
        ("vscode",             "vs code"),
        ("vs code",            "vs code"),
        ("vs-code",            "vs code"),
        ("v s code",           "vs code"),
        ("code editor",        "vs code"),
        ("text editor",        "vs code"),
        ("code",               "vs code"),
        ("studio",             "vs code"),
        ("calculator",         "calculator"),
        ("calc",               "calculator"),
        ("file explorer",      "file explorer"),
        ("windows explorer",   "file explorer"),
        ("explorer",           "file explorer"),
        ("files",              "file explorer"),
        ("chrome",             "chrome"),
        ("browser",            "chrome"),
        ("google chrome",      "chrome"),
        ("whatsapp",           "whatsapp"),
    ]

    DISPLAY_NAMES = {
        "vs code":       "VS Code",
        "calculator":    "Calculator",
        "file explorer": "File Explorer",
        "chrome":        "Chrome",
        "whatsapp":      "WhatsApp",
    }

    @staticmethod
    def launch(app_name: str) -> str:
        try:
            name = app_name.lower().strip()
            print(f"[AppLauncher] Requested: '{app_name}'  → normalized: '{name}'")

            # 1. Exact match
            canonical = name if name in AppLauncher.APP_MAP else None

            # 2. Keyword / partial match
            if canonical is None:
                for keyword, mapped in AppLauncher.KEYWORD_MAP:
                    if keyword in name:
                        canonical = mapped
                        break

            if canonical is None:
                return (
                    f"Sorry, I don't know how to open '{app_name}'. "
                    "Try saying: open chrome, open calculator, open VS Code, open file explorer, or open WhatsApp."
                )

            shell_exe, focus_exe, params = AppLauncher.APP_MAP[canonical]
            display = AppLauncher.DISPLAY_NAMES.get(canonical, canonical.title())
            print(f"[AppLauncher] Launching {display}  shell={shell_exe}  focus={focus_exe}")

            # Run in a daemon thread so Flask response is returned immediately
            t = threading.Thread(
                target=_launch_then_focus,
                args=(shell_exe, params, focus_exe),
                daemon=True,
            )
            t.start()

            return f"Launching {display}."

        except Exception as e:
            print(f"[AppLauncher] Exception: {e}")
            return f"Error launching app: {e}"

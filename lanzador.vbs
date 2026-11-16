' Abre Minecraft Animator: arranca el servidor local sin ventana y abre el navegador.
Set sh = CreateObject("WScript.Shell")
carpeta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = carpeta
sh.Run "python servidor.py 8790", 0, False
WScript.Sleep 1200
sh.Run "http://127.0.0.1:8790/", 1, False

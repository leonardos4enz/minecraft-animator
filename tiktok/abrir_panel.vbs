' Abre el panel de TikToks del día: arranca el servidor del animador sin ventana (si no estaba) y abre el panel en el navegador.
Set sh = CreateObject("WScript.Shell")
fso = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
raiz = CreateObject("Scripting.FileSystemObject").GetParentFolderName(fso)
sh.CurrentDirectory = raiz

encendido = False
On Error Resume Next
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "GET", "http://127.0.0.1:8790/api/tiktok/estado", False
http.Send
If Err.Number = 0 Then
  If http.Status = 200 Then encendido = True
End If
On Error GoTo 0

If Not encendido Then
  sh.Run "python servidor.py 8790", 0, False
  WScript.Sleep 1500
End If
sh.Run "http://127.0.0.1:8790/tiktok/panel.html", 1, False

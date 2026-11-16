# Minecraft Animator: instrucciones para Claude

Responde en español. El humano (Leo) hace videos de Minecraft con su personaje LTezla.

## Antes de tocar nada
- Guía del programa para agentes: **`AGENTE.md`**. Contiene los comandos, los mobs, los efectos y, al final, **"Cómo hacer
  un video completo de principio a fin"**, que es el método a seguir para cualquier video nuevo.
- Ejemplo completo y aprobado: **`agente/creeper/`** (el corto "El creeper era un cerdo"). Cópialo a `agente/<video>/`
  como plantilla. Su `ledger.md` cuenta qué falló en cada ronda; léelo antes de empezar.

## Videos musicales (notas = bloques musicales)
- Guía y plantilla: **`agente/orquesta/README.md`** ("Rush E en bloques"). Cópiala a `agente/<video>/`. Leo pide los renders
  completos en **calidad baja** hasta confirmar el final (`borrador.py`); el final con `final.py`.

## TikToks
- Para TikToks (vertical, en serie) usa la máquina: **`TIKTOK.md`** y `python tiktok/maquina.py`. Mismas reglas de
  calidad que abajo, con el control automático de `revisar` y una ronda corta de críticos por video.

## Reglas que el humano pidió
- **Videos musicales: sólo canciones sin derechos de autor** (dominio público o tradicionales), con un MIDI o una
  partitura libre, o escrita por nosotros. Nada con sello o editora (19 oct 2026: se abortó "BbY WOW").
- **Nunca abras ventanas visibles.** `herramientas/agente.py` abre sola la página del agente *sin ventana* (headless)
  al primer comando. No uses `--ventana`, salvo que Leo pida mirar: le aparece encima de lo que está haciendo.
- Para reiniciar la página en exportaciones largas: `agente.py --reiniciar` (no abre ventana). `--cerrar` la cierra.
  Las dos sólo tocan el navegador con el perfil `agente/navegador/`, nunca el Edge de Leo.
- No uses la página del humano (`http://127.0.0.1:8790/`) para trabajar, ni abras sus proyectos desde la página del
  agente: el último que guarda gana. `abrir` carga cada video del agente en su propio proyecto
  `proyectos/agente-<nombre>.json`.
- El servidor (`python servidor.py`, puerto 8790) se arranca con la vista previa `animator` de `.claude/launch.json`.

## Calidad (lo mínimo antes de entregar)
- Lo que se dice o se escribe en pantalla sale de un `facts.json` con la frase exacta de la fuente y su URL.
- El audio va primero (voces verificadas con Whisper, beats con librosa) y los cortes caen en beats.
- Render por tramos con `ensamblar.py`; mezcla con `mezcla.py`: −14 LUFS, true peak ≤ −1 dBTP, y además una versión
  sólo música.
- Ronda de críticos con **subagentes nuevos** (lectura sin sonido, técnico, director + verificación de datos) hasta "ship".
  Cada ronda se anota con números en `ledger.md`.
- Entregables en `Videos/`. Nada se borra de verdad: los proyectos van a `proyectos/papelera/`.

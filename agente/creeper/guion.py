"""Guion y pedidos de audio de "El creeper era un cerdo" (lo comparten creeper_audio.py y creeper.py).
Cada línea de voz tiene dos tomas: A = eleven_v3 (con etiquetas de emoción) y B = eleven_multilingual_v2 (sin etiquetas).
La toma elegida queda en ELEGIDAS (la decide creeper_audio.py elegir, con Whisper y la duración)."""

VOZ = "wXojZ3FhzsE0AumH6Oym"          # la voz de LTezla en los cortos anteriores (continuidad del personaje)

# id: (texto v3, texto v2) — cada frase sale de facts.json (ver la columna "hechos")
LINEAS = {
    "L1": ("[whispers] Este cerdo... esconde un secreto.", "Este cerdo... esconde un secreto."),
    "L2": ("[curious] Cuando Minecraft era nuevo, Notch quiso programar un cerdo.", "Cuando Minecraft era nuevo, Notch quiso programar un cerdo."),
    "L3": ("Pero confundió el alto... [surprised] ¡con el ancho!", "Pero confundió el alto... ¡con el ancho!"),
    "L4": ("[gasps] ¡Y el cuerpo quedó parado!", "¡Y el cuerpo quedó parado!"),
    "L5": ("[nervous] Y como te seguía con la mirada... le pareció súper creepy. Y se lo quedó.", "Y como te seguía con la mirada... le pareció súper creepy. Y se lo quedó."),
    "L6": ("[curious] ¿Y el verde? Quizás... camuflaje.", "¿Y el verde? Quizás... camuflaje."),
    "L7": ("[mischievously] A un amigo se le ocurrió... ¿y si explota?", "A un amigo se le ocurrió... ¿y si explota?"),
    "L8": ("Así nació el creeper. [laughs] De un error.", "Así nació el creeper. De un error."),
}

MUSICA = ("Playful mysterious orchestral comedy cue for a short animated story, 100 bpm, soft pizzicato strings and "
          "celesta tiptoeing intro, curious and sneaky, building suspense with ticking woodwinds, a tense rising string "
          "tremolo, then a full stop, then a bright bouncy upbeat finale with brass and drums, ending on a short final sting", 40)

SFX = {
    "oink": ("cute pig oink grunt, single short snort", 1.0),
    "glitch": ("short digital glitch stutter, retro computer error blip", 0.8),
    "crujido": ("cartoon wooden creak and bone crack, quick stretch pop", 1.2),
    "levanta": ("comedic stretchy rubber boing rising up, springy", 1.0),
    "pixeles": ("soft magical sparkle shimmer with tiny pixel ticks, cascading", 2.5),
    "hojas": ("rustling leaves bush, something hiding in foliage", 1.5),
    "siseo": ("creeper style fuse hiss, sizzling long hiss building", 2.0),
    "explosion": ("big blocky explosion boom with debris, deep impact, game style", 2.5),
    "whoosh": ("soft quick whoosh transition, airy", 0.7),
    "pop": ("bright cartoon bubble pop click, short punchy, game interface", 0.5),
    "mareo": ("cartoon dizzy daze, little birds tweeting and soft ear ringing", 1.6),
    "idea": ("light bulb idea ding, sparkly chime", 0.8),
    "pasos": ("cartoon quick scurry footsteps on grass running away", 1.0),
}

ELEGIDAS = {}   # id → "A" | "B" (lo llena elegir)

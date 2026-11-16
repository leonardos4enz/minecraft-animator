"""Planificador de cámaras de "La orquesta de bloques": tomas cortas con perspectivas variadas que muestran lo que suena.

Leo (borrador v3): "las escenas duran mucho en la misma posición", "el dron no se siente como dron; que vuele entre los
bloques que se generan, alternando con la cámara", "la cámara marea (sube y baja mucho)", "faltan cambios de
perspectiva" y "¿tienes algo que te diga si un bloque sale en la escena vertical o no?".

- visibles(): proyecta cada nota que está sonando con la misma cámara del motor (posicionCamara + perspectiva de fov 38°,
  cuadro 9:16) y cuenta cuántas caen dentro del cuadro (sin la franja de arriba donde va el contador).
- planear(): parte una sección en tomas de 3–5.5 s con los cortes en notas reales; cada toma prueba ángulos y
  distancias de su estilo y se queda con la que más notas muestra, sin chocar, y distinta de la toma anterior.
- Movimiento sin mareo: lineal y suave (órbita de 15–40°, empuje ±15 %, elevación fija); sólo el FPV se ladea.
"""
import math

V_FOV = 38.0
ASPECTO = 9 / 16
TAN_V = math.tan(math.radians(V_FOV / 2))
TAN_H = TAN_V * ASPECTO
ARRIBA_LIBRE = 0.62          # la parte de arriba del cuadro (y > 0.62 de la mitad) la tapa el contador


def camara(az, el, dist, ty, mx, mz):
    a, e = math.radians(az), math.radians(el)
    c = (mx + math.sin(a) * math.cos(e) * dist, ty + math.sin(e) * dist, mz + math.cos(a) * math.cos(e) * dist)
    f = (mx - c[0], ty - c[1], mz - c[2]); n = math.sqrt(sum(v * v for v in f)) or 1; f = tuple(v / n for v in f)
    r = (f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0)            # f × arriba
    n = math.sqrt(sum(v * v for v in r)) or 1; r = tuple(v / n for v in r)
    u = (r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0])
    return c, f, r, u


def en_cuadro(p, cam):
    c, f, r, u = cam
    d = (p[0] - c[0], p[1] - c[1], p[2] - c[2])
    z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]
    if z < 0.5:
        return False
    x = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / (z * TAN_H)
    y = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / (z * TAN_V)
    return abs(x) < 0.92 and -0.95 < y < ARRIBA_LIBRE


def visibles(puntos, cam):
    if not puntos:
        return None
    return sum(en_cuadro(p, cam) for p in puntos) / len(puntos)


# estilos de toma: rango de az relativo (para buscar), elevación, distancia (× la que encuadra las notas), órbita (°),
# empuje (factor de distancia al final), margen de colisión, ladeo (FPV)
ESTILOS = {
    "orbita":  dict(els=(22, 30), dist=(1.0, 1.25), orbita=(28, 40), empuje=0.9, margen=2.0, ladeo=0),
    "lateral": dict(els=(12, 18), dist=(0.9, 1.1), orbita=(8, 14), empuje=1.0, margen=1.6, ladeo=0, lado=True),
    "alto":    dict(els=(46, 54), dist=(1.2, 1.4), orbita=(15, 22), empuje=0.85, margen=2.5, ladeo=0),
    "ras":     dict(els=(5, 8), dist=(0.7, 0.85), orbita=(10, 18), empuje=0.8, margen=1.2, ladeo=0),
    "fpv":     dict(els=(10, 14), dist=(0.6, 0.75), orbita=(45, 70), empuje=0.8, margen=1.1, ladeo=9, fpv=True),
}
ROTACION = ["orbita", "fpv", "lateral", "alto", "fpv", "ras"]

#!/usr/bin/env python3
"""
Prozeduraler Generator fuer ein game-taugliches Low-Poly-Modell eines
RS6 Avant (C8-Proportionen). Ausgabe: rs6_avant.glb (glTF 2.0 binary).

Stil: "realistisch-kantig" - echte Abmessungen und Proportionen, aber
bewusst facettierte Flaechen mit Flat-Shading, damit das Auto in eine
eher kantige / low-poly Umgebung passt.

Koordinaten (glTF-Konvention): Y = oben, +Z = vorne, Einheit = Meter.
Ursprung = Mitte zwischen den Achsen auf dem Boden.

Aufruf:  python3 build_rs6.py [--paint r,g,b] [--out datei.glb]
         (Farbe als sRGB 0..1, Standard: Nardo-Grau)
"""
import argparse
import json
import math
import struct

import numpy as np

# --------------------------------------------------------------------------
# Abmessungen (Meter)
# --------------------------------------------------------------------------
WHEEL_R = 0.365           # 285/30 R22
TIRE_W = 0.285
WHEEL_X = 0.83            # halbe Spurweite
AXLE_F = 1.51             # Vorderachse z
AXLE_R = -1.42            # Hinterachse z  (Radstand 2.93 m)
ARCH_R = 0.44             # Radlauf-Radius
LINER_X = 0.64            # Radhaus-Innenwand

# --------------------------------------------------------------------------
# Materialien
# --------------------------------------------------------------------------
def srgb_to_lin(c):
    return [((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c]


def make_materials(paint_srgb):
    return {
        "Paint":      dict(color=srgb_to_lin(paint_srgb), metal=0.0, rough=0.32, clearcoat=True),
        "Glass":      dict(color=srgb_to_lin([0.03, 0.035, 0.04]), metal=0.0, rough=0.12),
        "TrimGloss":  dict(color=srgb_to_lin([0.04, 0.04, 0.045]), metal=0.2, rough=0.18),
        "TrimMatte":  dict(color=srgb_to_lin([0.05, 0.05, 0.05]), metal=0.0, rough=0.75),
        "Underbody":  dict(color=srgb_to_lin([0.03, 0.03, 0.03]), metal=0.0, rough=0.9),
        "Grille":     dict(color=srgb_to_lin([0.10, 0.10, 0.11]), metal=0.5, rough=0.35),
        "HeadLight":  dict(color=srgb_to_lin([0.9, 0.95, 1.0]), metal=0.0, rough=0.2,
                           emissive=[1.0, 1.0, 1.0]),
        "LightLens":  dict(color=srgb_to_lin([0.10, 0.11, 0.14]), metal=0.5, rough=0.06),
        "TailLight":  dict(color=srgb_to_lin([0.75, 0.02, 0.02]), metal=0.0, rough=0.25,
                           emissive=[0.8, 0.0, 0.0]),
        "Plate":      dict(color=srgb_to_lin([0.92, 0.92, 0.90]), metal=0.0, rough=0.5),
        "Exhaust":    dict(color=srgb_to_lin([0.25, 0.25, 0.27]), metal=1.0, rough=0.3),
        "Tire":       dict(color=srgb_to_lin([0.07, 0.07, 0.07]), metal=0.0, rough=0.92),
        "Rim":        dict(color=srgb_to_lin([0.46, 0.47, 0.49]), metal=0.85, rough=0.30),
        "RimInner":   dict(color=srgb_to_lin([0.08, 0.08, 0.09]), metal=0.6, rough=0.5),
        "BrakeDisc":  dict(color=srgb_to_lin([0.45, 0.45, 0.46]), metal=1.0, rough=0.45),
        "Caliper":    dict(color=srgb_to_lin([0.75, 0.05, 0.04]), metal=0.2, rough=0.35),
    }


# --------------------------------------------------------------------------
# Mesh-Sammler
# --------------------------------------------------------------------------
class MeshBuilder:
    def __init__(self):
        self.tris = {}  # material -> list of (a,b,c)

    def tri(self, mat, a, b, c):
        a, b, c = np.asarray(a, float), np.asarray(b, float), np.asarray(c, float)
        if np.linalg.norm(np.cross(b - a, c - a)) < 1e-9:
            return
        self.tris.setdefault(mat, []).append((a, b, c))

    def quad(self, mat, a, b, c, d):
        self.tri(mat, a, b, c)
        self.tri(mat, a, c, d)

    def poly(self, mat, pts, center=None):
        pts = [np.asarray(p, float) for p in pts]
        c = np.mean(pts, axis=0) if center is None else np.asarray(center, float)
        for i in range(len(pts)):
            self.tri(mat, c, pts[i], pts[(i + 1) % len(pts)])

    def tri_oriented(self, mat, a, b, c, away_from):
        """Dreieck so orientieren, dass die Normale vom Punkt away_from weg zeigt."""
        a, b, c = np.asarray(a, float), np.asarray(b, float), np.asarray(c, float)
        n = np.cross(b - a, c - a)
        if np.dot(n, (a + b + c) / 3 - away_from) < 0:
            b, c = c, b
        self.tri(mat, a, b, c)

    def convex(self, mat, faces):
        """Konvexer Koerper aus einer Liste von Polygon-Flaechen (Punktlisten)."""
        allp = np.array([p for f in faces for p in f], float)
        ctr = allp.mean(axis=0)
        for f in faces:
            f = [np.asarray(p, float) for p in f]
            for i in range(1, len(f) - 1):
                self.tri_oriented(mat, f[0], f[i], f[i + 1], ctr)

    def hexa(self, mat, p):
        """8 Punkte: p[0..3] Vorderflaeche, p[4..7] Rueckflaeche (gleiche Reihenfolge)."""
        f = [[p[0], p[1], p[2], p[3]], [p[4], p[5], p[6], p[7]],
             [p[0], p[1], p[5], p[4]], [p[1], p[2], p[6], p[5]],
             [p[2], p[3], p[7], p[6]], [p[3], p[0], p[4], p[7]]]
        self.convex(mat, f)

    def box(self, mat, lo, hi):
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        self.hexa(mat, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
                        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)])

    def slab(self, mat, quad4, depth):
        q = [np.asarray(p, float) for p in quad4]
        d = np.asarray(depth, float)
        self.hexa(mat, q + [p + d for p in q])

    def prism(self, mat, ring, offset):
        """Konvexes Prisma: Ring (Punktliste) + Verschiebung."""
        ring = [np.asarray(p, float) for p in ring]
        off = np.asarray(offset, float)
        top = [p + off for p in ring]
        faces = [ring, top]
        n = len(ring)
        for i in range(n):
            j = (i + 1) % n
            faces.append([ring[i], ring[j], top[j], top[i]])
        self.convex(mat, faces)


def mirror_x(p):
    return np.array([-p[0], p[1], p[2]])


def both_sides(fn):
    """Ruft fn(s) fuer s=+1 und s=-1 (Seitenvorzeichen) auf."""
    for s in (1.0, -1.0):
        fn(s)


# --------------------------------------------------------------------------
# Karosserie als Querschnitt-Loft
# --------------------------------------------------------------------------
# Spalten: z, yf(Boden), wbot, yrk(Schweller), wm(max Breite), ym,
#          wbl(Gurtlinie), ybl, wwin(Fensteroberkante), ywin, wr(Dachkante), yr, yc(Dachmitte)
KEYS = [
    (2.50, .26, .66, .32, .80, .55, .74, .70, .50, .72, .22, .73, .73),
    (2.44, .20, .78, .27, .92, .62, .86, .78, .58, .80, .26, .81, .815),
    (2.15, .15, .84, .24, .965, .70, .89, .85, .60, .88, .28, .89, .90),
    (1.51, .13, .86, .24, .975, .74, .90, .90, .62, .935, .30, .945, .955),
    (0.95, .13, .86, .24, .955, .74, .905, .97, .64, 1.00, .32, 1.01, 1.02),
    (0.90, .13, .86, .24, .955, .74, .905, .975, .80, .985, .72, .995, 1.00),
    (0.02, .13, .86, .24, .945, .74, .90, 1.00, .70, 1.36, .62, 1.42, 1.44),
    (-0.95, .13, .86, .24, .945, .74, .895, 1.02, .70, 1.37, .63, 1.425, 1.445),
    (-1.88, .13, .86, .24, .965, .75, .88, 1.04, .69, 1.36, .61, 1.42, 1.44),
    (-2.20, .16, .84, .26, .94, .76, .84, 1.03, .62, 1.09, .54, 1.11, 1.12),
    (-2.40, .22, .80, .30, .91, .74, .80, 1.00, .58, 1.02, .50, 1.025, 1.03),
    (-2.49, .28, .74, .34, .85, .72, .74, .95, .55, .97, .45, .975, .98),
]
KEYS_Z = np.array([k[0] for k in KEYS])


def params_at(z):
    # KEYS absteigend in z -> fuer np.interp umdrehen
    zs = KEYS_Z[::-1]
    cols = np.array([k[1:] for k in KEYS])[::-1]
    return [float(np.interp(z, zs, cols[:, i])) for i in range(cols.shape[1])]


ARCH_ANGLES = [-90, -58, -22, 22, 58, 90]   # wenige Stationen -> eckiger Radlauf


def arch_info(z):
    """(ist_im_Radlauf, Radlauf-Oberkante y, Achse) fuer Station z."""
    for wz in (AXLE_F, AXLE_R):
        d = (wz - z) / ARCH_R
        if abs(d) <= 1.0 + 1e-9:
            a = math.asin(max(-1.0, min(1.0, d)))
            ya = WHEEL_R + ARCH_R * min(math.cos(a), 0.93) * 1.0
            return True, ya, wz
    return False, None, None


def profile(z, arch_override=None):
    yf, wbot, yrk, wm, ym, wbl, ybl, wwin, ywin, wr, yr, yc = params_at(z)
    in_arch, ya, _ = arch_info(z)
    if arch_override is not None:
        in_arch = arch_override
        if in_arch:
            ya = WHEEL_R
    if in_arch:
        wm = max(wm, 0.975)                 # ausgestellte Kotfluegel
        ym_ = min(max(ym, ya + 0.06), ybl - 0.03)
        pts = [(0, yf), (LINER_X, yf), (LINER_X, ya), (wm - 0.03, ya),
               (wm, ya + 0.025), (wm, ym_), (wbl, ybl), (wwin, ywin), (wr, yr), (0, yc)]
    else:
        pts = [(0, yf), (LINER_X, yf), (LINER_X, yf), (wbot, yf),
               (wm - 0.03, yrk), (wm, ym), (wbl, ybl), (wwin, ywin), (wr, yr), (0, yc)]
    return pts, in_arch


def interval_materials(z0, z1, arch0, arch1):
    """Material je Segment s0..s8 fuer den Abschnitt zwischen zwei Stationen."""
    zm = 0.5 * (z0 + z1)
    step = abs(z0 - z1) < 1e-6
    m = ["Underbody", "Underbody", "Underbody", "TrimGloss", "Paint", "Paint",
         "Paint", "Paint", "Paint"]
    if arch0 and arch1:
        m[3] = "Paint"            # Radlauf-Kante in Wagenfarbe
    if step:
        m[3] = "Underbody"
        m[4] = "Underbody"
    if 0.90 < zm < 0.95:                         # Wasserkasten
        m[6], m[7], m[8] = "Paint", "TrimMatte", "TrimMatte"
    elif 0.02 < zm < 0.90:                       # Windschutzscheibe
        m[6] = "Glass" if zm < 0.56 else "Paint"
        m[7] = "TrimGloss"
        m[8] = "Glass"
    elif -1.88 < zm < 0.02:                      # Kabine
        m[6] = "Glass"
        if -0.90 < zm < -0.78 or -1.64 < zm < -1.56:
            m[6] = "TrimGloss"                   # B-/C-Saeule
        m[7] = "TrimGloss"
    elif -2.20 < zm < -1.88:                     # Heckscheibe
        m[6] = "Glass"
        m[7] = "TrimGloss"
        m[8] = "Glass"
    return m


def build_body(mb):
    zs = set(KEYS_Z.tolist()) | {0.56, -0.78, -0.90, -1.56, -1.64, 1.20, -0.40, 0.30}
    stations = []  # (z, pts, in_arch)
    for wz in (AXLE_F, AXLE_R):
        for a in ARCH_ANGLES:
            zs.add(round(wz - ARCH_R * math.sin(math.radians(a)), 6))
    zs = sorted(zs, reverse=True)
    # Stationen innerhalb eines Radlaufs, die zu nahe an der Kante liegen, entfernen
    for z in zs:
        in_arch, _, wz = arch_info(z)
        on_edge = in_arch and abs(abs(z - wz) - ARCH_R) < 1e-6
        if on_edge:
            front_edge = z > wz
            p_norm, _ = profile(z, arch_override=False)
            p_arch, _ = profile(z, arch_override=True)
            if front_edge:
                stations.append((z, p_norm, False))
                stations.append((z, p_arch, True))
            else:
                stations.append((z, p_arch, True))
                stations.append((z, p_norm, False))
        else:
            p, ia = profile(z)
            stations.append((z, p, ia))

    def P(st, i, side):
        x, y = st[1][i]
        return np.array([side * x, y, st[0]])

    nseg = len(stations[0][1]) - 1
    for k in range(len(stations) - 1):
        s0, s1 = stations[k], stations[k + 1]
        mats = interval_materials(s0[0], s1[0], s0[2], s1[2])
        for s in range(nseg):
            a, b = P(s0, s, 1), P(s1, s, 1)
            c, d = P(s1, s + 1, 1), P(s0, s + 1, 1)
            mb.quad(mats[s], a, b, c, d)
            mb.quad(mats[s], mirror_x(a), mirror_x(d), mirror_x(c), mirror_x(b))

    # Front- und Heckflaeche
    for st, facing in ((stations[0], 1), (stations[-1], -1)):
        right = [P(st, i, 1) for i in range(nseg + 1)]
        left = [mirror_x(p) for p in right[::-1][1:-1]]
        ring = right + left
        clean = [ring[0]]
        for p in ring[1:]:
            if np.linalg.norm(p - clean[-1]) > 1e-6:
                clean.append(p)
        ctr = np.mean(clean, axis=0)
        n = len(clean)
        for i in range(n):
            a, b = clean[i], clean[(i + 1) % n]
            if facing > 0:
                mb.tri("Paint", ctr, a, b)
            else:
                mb.tri("Paint", ctr, b, a)
    return stations


# --------------------------------------------------------------------------
# Anbauteile
# --------------------------------------------------------------------------
def hexagon(cx, cy, z, r, n=6, rot=0.0, sx=1.0, sy=1.0):
    return [(cx + sx * r * math.cos(rot + 2 * math.pi * i / n),
             cy + sy * r * math.sin(rot + 2 * math.pi * i / n), z) for i in range(n)]


def build_front(mb):
    zf = 2.50
    # Singleframe-Grill (Achteck)
    g = [(-0.40, 0.62), (0.40, 0.62), (0.52, 0.52), (0.46, 0.30),
         (0.30, 0.25), (-0.30, 0.25), (-0.46, 0.30), (-0.52, 0.52)]
    mb.prism("TrimGloss", [(x, y, zf - 0.01) for x, y in g], (0, 0, 0.025))
    # Wabengitter
    for row in range(4):
        for col in range(-4, 5):
            cx = col * 0.1 + (0.05 if row % 2 else 0.0)
            cy = 0.315 + row * 0.075
            if abs(cx) > 0.44 - (0.0 if 0 < row < 3 else 0.06):
                continue
            mb.prism("Grille", hexagon(cx, cy, zf + 0.015, 0.032, 6, math.pi / 6, 1.0, 0.85),
                     (0, 0, 0.012))
    # Kennzeichen (leer)
    mb.box("Plate", (-0.26, 0.33, zf + 0.025), (0.26, 0.44, zf + 0.035))

    def side(s):
        # Lufteinlaesse seitlich (Trapez)
        mb.slab("TrimMatte", [(s * 0.56, 0.47, zf + 0.012), (s * 0.78, 0.50, zf + 0.012),
                              (s * 0.74, 0.30, zf + 0.012), (s * 0.54, 0.29, zf + 0.012)],
                (0, 0, -0.03))
        # Lamelle im Einlass
        mb.slab("Paint", [(s * 0.55, 0.40, zf + 0.02), (s * 0.77, 0.415, zf + 0.02),
                          (s * 0.765, 0.39, zf + 0.02), (s * 0.55, 0.375, zf + 0.02)],
                (0, 0, -0.03))
        # Scheinwerfer: Gehaeuse/Linse, LED-Tagfahrlicht oben + Matrix-Segmente
        def out(p, d):
            """Punkt p um d nach aussen schieben (vorne +z, an der Ecke schraeg)."""
            x, y, z = p
            t = min(1.0, max(0.0, (abs(x) - 0.70) / 0.18))
            n = np.array([s * t * 0.8, 0.0, 1.0 - 0.4 * t])
            return tuple(np.array(p) + d * n / np.linalg.norm(n))
        lens = [(s * 0.44, 0.700, zf), (s * 0.86, 0.780, 2.432),
                (s * 0.90, 0.685, 2.395), (s * 0.50, 0.612, zf)]
        mb.hexa("LightLens", [out(p, 0.022) for p in lens] + [out(p, -0.05) for p in lens])
        drl = [(s * 0.45, 0.694, zf), (s * 0.85, 0.772, 2.438),
               (s * 0.855, 0.754, 2.430), (s * 0.46, 0.678, zf)]
        mb.hexa("HeadLight", [out(p, 0.03) for p in drl] + [out(p, 0.0) for p in drl])
        for i in range(5):     # vertikale LED-Segmente
            t = i / 4.0
            x = 0.52 + t * 0.26
            y = 0.660 + t * 0.065
            z = zf - (max(0.0, x - 0.70) / 0.18) * 0.06
            seg = [(s * x, y, z), (s * (x + 0.024), y + 0.005, z),
                   (s * (x + 0.028), y - 0.040, z), (s * (x + 0.004), y - 0.045, z)]
            mb.hexa("HeadLight", [out(p, 0.030) for p in seg] + [out(p, 0.0) for p in seg])
    both_sides(side)
    # Frontsplitter
    mb.hexa("TrimGloss", [(-0.74, 0.25, 2.54), (0.74, 0.25, 2.54), (0.74, 0.21, 2.55),
                          (-0.74, 0.21, 2.55),
                          (-0.80, 0.25, 2.30), (0.80, 0.25, 2.30), (0.80, 0.18, 2.30),
                          (-0.80, 0.18, 2.30)])


def build_rear(mb):
    zr = -2.49

    def side(s):
        # Rueckleuchten (Rueckseite + um die Ecke)
        mb.slab("TailLight", [(s * 0.30, 0.935, zr - 0.012), (s * 0.73, 0.945, zr - 0.012),
                              (s * 0.74, 0.83, zr - 0.012), (s * 0.36, 0.85, zr - 0.012)],
                (0, 0, 0.03))
        mb.hexa("TailLight", [
            (s * 0.73, 0.945, zr - 0.012), (s * 0.81, 0.99, -2.40), (s * 0.83, 0.88, -2.37),
            (s * 0.74, 0.83, zr - 0.012),
            (s * 0.71, 0.945, zr + 0.03), (s * 0.79, 0.99, -2.37), (s * 0.81, 0.88, -2.34),
            (s * 0.72, 0.83, zr + 0.03)])
        # dunkles Innenelement + leuchtende Kontur
        mb.slab("LightLens", [(s * 0.40, 0.915, zr - 0.016), (s * 0.68, 0.922, zr - 0.016),
                              (s * 0.685, 0.86, zr - 0.016), (s * 0.43, 0.872, zr - 0.016)],
                (0, 0, 0.01))
        # Endrohre (oval, 10-eckig)
        cx, cy = s * 0.56, 0.315
        ring = hexagon(cx, cy, zr + 0.10, 0.085, 10, 0.0, 1.0, 0.55)
        mb.prism("Exhaust", ring, (0, 0, -0.17))
        mb.prism("Underbody", hexagon(cx, cy, zr - 0.071, 0.07, 10, 0.0, 1.0, 0.5), (0, 0, -0.002))
        # Reflektor
        mb.box("TailLight", (s * 0.74 - 0.05, 0.495, zr - 0.045), (s * 0.74 + 0.05, 0.52, zr - 0.03))
    both_sides(side)
    # Verbindungsleiste zwischen den Leuchten
    mb.box("TrimGloss", (-0.36, 0.885, zr - 0.012), (0.36, 0.925, zr + 0.01))
    # Kennzeichen
    mb.box("Plate", (-0.26, 0.62, zr - 0.012), (0.26, 0.73, zr + 0.002))
    # Stossfaenger-Kante (Charakterlinie)
    mb.hexa("Paint", [(-0.84, 0.56, zr - 0.035), (0.84, 0.56, zr - 0.035), (0.86, 0.46, zr - 0.04),
                      (-0.86, 0.46, zr - 0.04),
                      (-0.86, 0.58, -2.30), (0.86, 0.58, -2.30), (0.88, 0.46, -2.30), (-0.88, 0.46, -2.30)])
    # Diffusor mit Finnen
    mb.hexa("TrimGloss", [(-0.72, 0.42, zr - 0.02), (0.72, 0.42, zr - 0.02),
                          (0.70, 0.24, zr - 0.05), (-0.70, 0.24, zr - 0.05),
                          (-0.72, 0.42, zr + 0.06), (0.72, 0.42, zr + 0.06),
                          (0.70, 0.20, -2.25), (-0.70, 0.20, -2.25)])
    for x in (-0.30, -0.15, 0.0, 0.15, 0.30):
        mb.box("TrimMatte", (x - 0.012, 0.22, zr - 0.06), (x + 0.012, 0.30, -2.30))


def build_side(mb):
    def side(s):
        # Aussenspiegel
        mb.hexa("TrimGloss", [
            (s * 0.86, 1.00, 0.80), (s * 1.06, 1.03, 0.74), (s * 1.06, 1.13, 0.74), (s * 0.86, 1.10, 0.80),
            (s * 0.86, 1.00, 0.62), (s * 1.05, 1.02, 0.62), (s * 1.05, 1.12, 0.64), (s * 0.86, 1.09, 0.64)])
        mb.hexa("HeadLight", [   # Blinker im Spiegel
            (s * 0.98, 1.02, 0.772), (s * 1.06, 1.035, 0.742), (s * 1.06, 1.045, 0.742), (s * 0.98, 1.03, 0.772),
            (s * 0.98, 1.02, 0.76), (s * 1.05, 1.035, 0.73), (s * 1.05, 1.045, 0.73), (s * 0.98, 1.03, 0.76)])
        # Dachreling
        mb.hexa("TrimGloss", [
            (s * 0.54, 1.425, 0.00), (s * 0.60, 1.425, 0.00), (s * 0.60, 1.465, -0.10), (s * 0.54, 1.465, -0.10),
            (s * 0.54, 1.425, -1.92), (s * 0.59, 1.425, -1.92), (s * 0.59, 1.465, -1.82), (s * 0.54, 1.465, -1.82)])
        # Tuergriffe
        for z in (0.22, -0.72):
            mb.box("TrimGloss", (s * 0.905 if s > 0 else -0.935, 0.90, z - 0.08),
                   (0.935 if s > 0 else -0.905, 0.925, z + 0.08))
        # Seitenschweller-Blende
        mb.hexa("TrimGloss", [
            (s * 0.93, 0.27, 1.05), (s * 0.965, 0.25, 1.05), (s * 0.965, 0.15, 1.05), (s * 0.90, 0.15, 1.05),
            (s * 0.93, 0.27, -0.96), (s * 0.965, 0.25, -0.96), (s * 0.965, 0.15, -0.96), (s * 0.90, 0.15, -0.96)])
        # Radhaus-Innenschale
        for wz in (AXLE_F, AXLE_R):
            mb.box("Underbody", (s * LINER_X - 0.01, 0.10, wz - ARCH_R),
                   (s * LINER_X + 0.01, WHEEL_R + ARCH_R, wz + ARCH_R))
    both_sides(side)
    # Dachspoiler
    mb.hexa("TrimGloss", [(-0.60, 1.405, -1.84), (0.60, 1.405, -1.84), (0.60, 1.445, -1.84), (-0.60, 1.445, -1.84),
                          (-0.58, 1.37, -2.04), (0.58, 1.37, -2.04), (0.58, 1.39, -2.04), (-0.58, 1.39, -2.04)])
    # Haifischflossen-Antenne
    mb.hexa("TrimGloss", [(-0.03, 1.44, -1.55), (0.03, 1.44, -1.55), (0.015, 1.50, -1.68), (-0.015, 1.50, -1.68),
                          (-0.035, 1.44, -1.76), (0.035, 1.44, -1.76), (0.02, 1.455, -1.76), (-0.02, 1.455, -1.76)])


def build_calipers(mb):
    """Bremssaettel sitzen fest an der Karosserie (drehen nicht mit)."""
    for wz, ang in ((AXLE_F, math.radians(150)), (AXLE_R, math.radians(30))):
        for s in (1.0, -1.0):
            cx = s * WHEEL_X
            pts = []
            for r in (0.16, 0.235):
                for a in (ang - 0.42, ang + 0.42):
                    pts.append((r * math.sin(a), r * math.cos(a)))
            # pts in (dz, dy): Reihenfolge innen-a0, innen-a1, aussen-a0, aussen-a1
            order = [0, 1, 3, 2]
            front = [(cx + s * 0.035, WHEEL_R + pts[i][1], wz + pts[i][0]) for i in order]
            back = [(cx - s * 0.05, WHEEL_R + pts[i][1], wz + pts[i][0]) for i in order]
            mb.hexa("Caliper", front + back)


# --------------------------------------------------------------------------
# Rad (eigene Node, dreht um die lokale X-Achse, Aussenseite = +X)
# --------------------------------------------------------------------------
def build_wheel(mb, n=20):
    hw = TIRE_W / 2
    def rp(r, x, a):
        return np.array([x, r * math.cos(a), r * math.sin(a)])
    # Reifen (Lathe), Normalen weg vom Querschnitt-Zentrum
    prof = [(0.272, -hw + 0.008), (0.335, -hw), (0.358, -hw + 0.018), (WHEEL_R, -hw + 0.05),
            (WHEEL_R, hw - 0.05), (0.358, hw - 0.018), (0.335, hw), (0.272, hw - 0.008)]
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        am = 0.5 * (a0 + a1)
        core = rp(0.318, 0.0, am)
        for j in range(len(prof) - 1):
            (r0, x0), (r1, x1) = prof[j], prof[j + 1]
            a, b, c, d = rp(r0, x0, a0), rp(r0, x0, a1), rp(r1, x1, a1), rp(r1, x1, a0)
            mb.tri_oriented("Tire", a, b, c, core)
            mb.tri_oriented("Tire", a, c, d, core)
    # Felgenbett (Innenseite sichtbar -> Normale zur Achse)
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        r = 0.274
        a, b = rp(r, -hw + 0.01, a0), rp(r, -hw + 0.01, a1)
        c, d = rp(r, hw - 0.02, a1), rp(r, hw - 0.02, a0)
        for t in ((a, b, c), (a, c, d)):
            # zur Achse zeigen: "weg" von einem Punkt ausserhalb
            outside = rp(1.0, 0.0, 0.5 * (a0 + a1))
            mb.tri_oriented("RimInner", t[0], t[1], t[2], outside)
        # Felgenhorn aussen (Ring)
        xo = hw - 0.012
        ring_in, ring_out = 0.248, 0.282
        mb.convex("Rim", [
            [rp(ring_in, xo, a0), rp(ring_out, xo, a0), rp(ring_out, xo, a1), rp(ring_in, xo, a1)],
            [rp(ring_in, xo - 0.03, a0), rp(ring_out, xo - 0.03, a0), rp(ring_out, xo - 0.03, a1),
             rp(ring_in, xo - 0.03, a1)],
            [rp(ring_out, xo, a0), rp(ring_out, xo, a1), rp(ring_out, xo - 0.03, a1), rp(ring_out, xo - 0.03, a0)],
            [rp(ring_in, xo, a0), rp(ring_in, xo, a1), rp(ring_in, xo - 0.03, a1), rp(ring_in, xo - 0.03, a0)],
            [rp(ring_in, xo, a0), rp(ring_out, xo, a0), rp(ring_out, xo - 0.03, a0), rp(ring_in, xo - 0.03, a0)],
            [rp(ring_in, xo, a1), rp(ring_out, xo, a1), rp(ring_out, xo - 0.03, a1), rp(ring_in, xo - 0.03, a1)],
        ])
    # Bremsscheibe
    disc = [rp(0.205, -0.035, 2 * math.pi * i / 18) for i in range(18)]
    mb.prism("BrakeDisc", disc, (0.028, 0, 0))
    # 5 Doppelspeichen (konkav: Nabe tiefer als Felgenrand)
    for k in range(5):
        for off in (-0.13, 0.13):
            th = 2 * math.pi * k / 5 + off
            d = np.array([0, math.cos(th), math.sin(th)])
            t = np.array([0, -math.sin(th), math.cos(th)])
            r1, r2 = 0.075, 0.255
            w1, w2 = 0.020, 0.030
            xf1, xf2 = hw - 0.055, hw - 0.018
            dep = 0.035
            # Innen-Ende leicht zur Mitte des Paars geneigt (Y-Form)
            tilt = -np.sign(off) * 0.012
            p_in = d * r1 + t * tilt
            p_out = d * r2
            front = [np.array([xf1, 0, 0]) + p_in - t * w1, np.array([xf1, 0, 0]) + p_in + t * w1,
                     np.array([xf2, 0, 0]) + p_out + t * w2, np.array([xf2, 0, 0]) + p_out - t * w2]
            back = [p - np.array([dep, 0, 0]) for p in front]
            mb.hexa("Rim", front + back)
    # Nabe
    mb.prism("Rim", [rp(0.085, hw - 0.075, 2 * math.pi * i / 10) for i in range(10)], (0.03, 0, 0))
    mb.prism("RimInner", [rp(0.035, hw - 0.046, 2 * math.pi * i / 6) for i in range(6)], (0.006, 0, 0))


# --------------------------------------------------------------------------
# glTF / GLB Export
# --------------------------------------------------------------------------
class GLTF:
    def __init__(self, mats):
        self.bin = bytearray()
        self.gltf = {"asset": {"version": "2.0", "generator": "build_rs6.py"},
                     "scene": 0, "scenes": [{"name": "Scene", "nodes": []}],
                     "nodes": [], "meshes": [], "materials": [], "accessors": [],
                     "bufferViews": [], "buffers": [],
                     "extensionsUsed": ["KHR_materials_clearcoat", "KHR_materials_emissive_strength"]}
        self.mat_index = {}
        for name, m in mats.items():
            mat = {"name": name, "pbrMetallicRoughness": {
                "baseColorFactor": list(m["color"]) + [1.0],
                "metallicFactor": m["metal"], "roughnessFactor": m["rough"]}}
            ext = {}
            if m.get("emissive"):
                mat["emissiveFactor"] = m["emissive"]
                ext["KHR_materials_emissive_strength"] = {"emissiveStrength": 2.0}
            if m.get("clearcoat"):
                ext["KHR_materials_clearcoat"] = {"clearcoatFactor": 1.0, "clearcoatRoughnessFactor": 0.05}
            if ext:
                mat["extensions"] = ext
            self.mat_index[name] = len(self.gltf["materials"])
            self.gltf["materials"].append(mat)

    def _view(self, data, target):
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += data
        self.gltf["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(data),
                                         "target": target})
        return len(self.gltf["bufferViews"]) - 1

    def _acc(self, arr, ctype, typ, target, minmax=False):
        v = self._view(arr.tobytes(), target)
        acc = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            acc["min"] = arr.min(axis=0).tolist()
            acc["max"] = arr.max(axis=0).tolist()
        self.gltf["accessors"].append(acc)
        return len(self.gltf["accessors"]) - 1

    def add_mesh(self, name, mb):
        prims = []
        tri_count = 0
        for mat, tris in mb.tris.items():
            P = np.array([[t[0], t[1], t[2]] for t in tris], dtype=np.float32)  # (n,3,3)
            N = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
            N /= np.linalg.norm(N, axis=1, keepdims=True)
            N = np.repeat(N[:, None, :], 3, axis=1)
            # Box-Projektion UVs (1 UV-Einheit = 1 m)
            ax = np.argmax(np.abs(N[:, 0, :]), axis=1)
            uv = np.zeros((P.shape[0], 3, 2), np.float32)
            for k, (u, v) in enumerate(((2, 1), (0, 2), (0, 1))):
                sel = ax == k
                uv[sel, :, 0] = P[sel][:, :, u]
                uv[sel, :, 1] = P[sel][:, :, v]
            pos = P.reshape(-1, 3).astype(np.float32)
            nor = N.reshape(-1, 3).astype(np.float32)
            uvs = uv.reshape(-1, 2).astype(np.float32)
            idx = np.arange(pos.shape[0], dtype=np.uint32)
            ctype = 5125
            if pos.shape[0] < 65535:
                idx = idx.astype(np.uint16)
                ctype = 5123
            prims.append({
                "attributes": {"POSITION": self._acc(pos, 5126, "VEC3", 34962, True),
                               "NORMAL": self._acc(nor, 5126, "VEC3", 34962),
                               "TEXCOORD_0": self._acc(uvs, 5126, "VEC2", 34962)},
                "indices": self._acc(idx, ctype, "SCALAR", 34963),
                "material": self.mat_index[mat]})
            tri_count += len(tris)
        self.gltf["meshes"].append({"name": name, "primitives": prims})
        return len(self.gltf["meshes"]) - 1, tri_count

    def add_node(self, node, parent=None):
        self.gltf["nodes"].append(node)
        i = len(self.gltf["nodes"]) - 1
        if parent is None:
            self.gltf["scenes"][0]["nodes"].append(i)
        else:
            self.gltf["nodes"][parent].setdefault("children", []).append(i)
        return i

    def save(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.gltf["buffers"] = [{"byteLength": len(self.bin)}]
        js = json.dumps(self.gltf, separators=(",", ":")).encode()
        while len(js) % 4:
            js += b" "
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A))
            f.write(js)
            f.write(struct.pack("<II", len(self.bin), 0x004E4942))
            f.write(self.bin)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paint", default="0.45,0.47,0.48", help="Lackfarbe sRGB r,g,b (0..1)")
    ap.add_argument("--out", default="rs6_avant.glb")
    args = ap.parse_args()
    paint = [float(v) for v in args.paint.split(",")]

    body = MeshBuilder()
    build_body(body)
    build_front(body)
    build_rear(body)
    build_side(body)
    build_calipers(body)
    wheel = MeshBuilder()
    build_wheel(wheel)

    g = GLTF(make_materials(paint))
    body_mesh, tb = g.add_mesh("Body", body)
    wheel_mesh, tw = g.add_mesh("Wheel", wheel)
    root = g.add_node({"name": "RS6_Avant"})
    g.add_node({"name": "Body", "mesh": body_mesh}, root)
    yaw180 = [0.0, 1.0, 0.0, 0.0]   # Quaternion: 180 Grad um Y -> Aussenseite zeigt nach -X
    for name, x, z in (("Wheel_FL", WHEEL_X, AXLE_F), ("Wheel_FR", -WHEEL_X, AXLE_F),
                       ("Wheel_RL", WHEEL_X, AXLE_R), ("Wheel_RR", -WHEEL_X, AXLE_R)):
        node = {"name": name, "mesh": wheel_mesh, "translation": [x, WHEEL_R, z]}
        if x < 0:
            node["rotation"] = yaw180
        g.add_node(node, root)
    g.save(args.out)
    print(f"{args.out}: Karosserie {tb} Dreiecke, Rad {tw} Dreiecke, gesamt {tb + 4 * tw}")


if __name__ == "__main__":
    main()

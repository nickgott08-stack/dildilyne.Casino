#!/usr/bin/env python3
"""
Prozeduraler Generator fuer ein game-taugliches Low-Poly-Modell eines
Mittelmotor-Ferrari (Proportionen angelehnt an den 296 GTB).
Ausgabe: ferrari_296.glb (glTF 2.0 binary).

Gleicher Stil wie das RS6-Modell: echte Abmessungen, facettierte Flaechen,
Flat-Shading. Nutzt MeshBuilder / GLTF-Export / Rad aus ../rs6/build_rs6.py.

Koordinaten: Y = oben, +Z = vorne, Meter. Ursprung = Boden, Mitte Radstand.

Aufruf:  python3 build_ferrari.py [--paint r,g,b] [--caliper r,g,b] [--out datei.glb]
"""
import argparse
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "rs6"))
import build_rs6 as base  # noqa: E402
from build_rs6 import MeshBuilder, GLTF, srgb_to_lin, mirror_x, both_sides, hexagon  # noqa: E402

# --------------------------------------------------------------------------
# Abmessungen (Meter) - L 4.57, B 1.96, H 1.19, Radstand 2.60
# --------------------------------------------------------------------------
# (Name, z, Radradius, Reifenbreite, Spur/2, Radlauf-Radius, Radhaus-Innenwand x)
AXLES = {
    "F": dict(z=1.20, r=0.330, w=0.245, x=0.83, arch=0.40, liner=0.66),   # 245/35 R20
    "R": dict(z=-1.40, r=0.354, w=0.305, x=0.82, arch=0.42, liner=0.62),  # 305/35 R20
}

# Spalten: z, yf, wbot, yrk, wm, ym, wbl, ybl, wwin, ywin, wr, yr, yc
KEYS = [
    (2.25, .14, .70, .18, .80, .36, .74, .44, .45, .46, .20, .465, .465),
    (2.18, .11, .82, .15, .90, .42, .86, .55, .50, .56, .22, .555, .55),
    (1.85, .10, .86, .14, .965, .52, .91, .70, .58, .66, .25, .62, .61),
    (1.20, .10, .86, .14, .975, .58, .93, .78, .60, .74, .28, .70, .69),
    (0.75, .10, .86, .14, .96, .60, .91, .79, .62, .76, .30, .75, .75),
    (0.70, .10, .86, .14, .96, .60, .91, .795, .80, .78, .72, .785, .79),
    (-0.15, .10, .86, .14, .93, .58, .86, .84, .66, 1.12, .56, 1.17, 1.185),
    (-0.70, .10, .86, .14, .95, .60, .84, .86, .64, 1.10, .54, 1.15, 1.165),
    (-0.95, .10, .86, .14, .97, .62, .90, .84, .62, 1.00, .50, 1.04, 1.05),
    (-1.40, .10, .86, .14, .98, .64, .94, .84, .58, .88, .45, .89, .89),
    (-2.05, .12, .84, .16, .95, .64, .90, .83, .55, .84, .40, .84, .84),
    (-2.25, .16, .80, .20, .90, .62, .84, .80, .50, .81, .35, .81, .81),
    (-2.31, .20, .74, .24, .84, .60, .78, .77, .45, .775, .30, .775, .775),
]
KEYS_Z = np.array([k[0] for k in KEYS])
Z_FRONT, Z_REAR = KEYS[0][0], KEYS[-1][0]
ARCH_ANGLES = [-90, -58, -22, 22, 58, 90]


def make_materials(paint, caliper):
    m = base.make_materials(paint)
    m["Caliper"] = dict(color=srgb_to_lin(caliper), metal=0.2, rough=0.35)
    m["Rim"] = dict(color=srgb_to_lin([0.32, 0.33, 0.35]), metal=0.85, rough=0.3)
    m["Paint"]["rough"] = 0.25
    return m


def params_at(z):
    zs = KEYS_Z[::-1]
    cols = np.array([k[1:] for k in KEYS])[::-1]
    return [float(np.interp(z, zs, cols[:, i])) for i in range(cols.shape[1])]


def arch_info(z):
    for ax in AXLES.values():
        d = (ax["z"] - z) / ax["arch"]
        if abs(d) <= 1.0 + 1e-9:
            a = math.asin(max(-1.0, min(1.0, d)))
            return True, ax["r"] + ax["arch"] * min(math.cos(a), 0.93), ax
    return False, None, None


def profile(z, arch_override=None):
    yf, wbot, yrk, wm, ym, wbl, ybl, wwin, ywin, wr, yr, yc = params_at(z)
    in_arch, ya, ax = arch_info(z)
    if arch_override is not None:
        in_arch = arch_override
        if in_arch:
            ya = ax["r"]
    liner = ax["liner"] if ax else 0.64
    if in_arch:
        wm = max(wm, 0.975)
        ym_ = min(max(ym, ya + 0.06), ybl - 0.03)
        return [(0, yf), (liner, yf), (liner, ya), (wm - 0.03, ya), (wm, ya + 0.025),
                (wm, ym_), (wbl, ybl), (wwin, ywin), (wr, yr), (0, yc)]
    return [(0, yf), (liner, yf), (liner, yf), (wbot, yf), (wm - 0.03, yrk),
            (wm, ym), (wbl, ybl), (wwin, ywin), (wr, yr), (0, yc)]


def interval_materials(z0, z1, arch0, arch1):
    zm = 0.5 * (z0 + z1)
    m = ["Underbody", "Underbody", "Underbody", "TrimGloss", "Paint", "Paint",
         "Paint", "Paint", "Paint"]
    if arch0 and arch1:
        m[3] = "Paint"
    if abs(z0 - z1) < 1e-6:
        m[3] = m[4] = "Underbody"
    if 0.70 < zm < 0.75:                         # Wasserkasten
        m[7] = m[8] = "TrimMatte"
    elif -0.15 < zm < 0.70:                      # Windschutzscheibe
        m[6] = "Glass" if zm < 0.30 else "Paint"
        m[7] = "TrimGloss"
        m[8] = "Glass"
    elif -0.95 < zm < -0.15:                     # Kabine
        m[6] = "Glass"
    elif -1.60 < zm < -0.95:                     # Motorabdeckung (Glas)
        m[7] = "TrimGloss"
        m[8] = "Glass"
    return m


def surf(z, u, side=1.0):
    """Punkt + Aussennormale auf der Karosserie bei Station z, Profilparameter u (0..9)."""
    pts = profile(z, arch_override=False)
    i = min(int(u), len(pts) - 2)
    t = u - i
    (x0, y0), (x1, y1) = pts[i], pts[i + 1]
    p = np.array([side * (x0 + t * (x1 - x0)), y0 + t * (y1 - y0), z])
    n = np.array([side * (y1 - y0), -(x1 - x0), 0.0])
    n /= np.linalg.norm(n) + 1e-12
    return p, n


def decal(mb, mat, corners, side, lift=0.012, depth=0.03, nu=4, nz=2):
    """Flaches Anbauteil auf der Karosserie. corners = [(z0,u_a), (z0,u_b), (z1,u_b'), (z1,u_a')].
    Wird in kleine Kacheln unterteilt, damit es der (konvexen) Karosserie folgt."""
    (z0, a0), (_, b0), (z1, b1), (_, a1) = corners

    def at(v, w):
        z = z0 + w * (z1 - z0)
        a, b = a0 + w * (a1 - a0), b0 + w * (b1 - b0)
        return z, a + v * (b - a)
    for i in range(nu):
        for j in range(nz):
            q = [at(i / nu, j / nz), at((i + 1) / nu, j / nz),
                 at((i + 1) / nu, (j + 1) / nz), at(i / nu, (j + 1) / nz)]
            front, back = [], []
            for z, u in q:
                p, n = surf(z, u, side)
                front.append(p + n * lift)
                back.append(p - n * depth)
            mb.hexa(mat, front + back)


def build_body(mb):
    zs = set(KEYS_Z.tolist()) | {0.30, -0.40, 1.95, -1.60, 2.05}
    for ax in AXLES.values():
        for a in ARCH_ANGLES:
            zs.add(round(ax["z"] - ax["arch"] * math.sin(math.radians(a)), 6))
    stations = []
    for z in sorted(zs, reverse=True):
        in_arch, _, ax = arch_info(z)
        if in_arch and abs(abs(z - ax["z"]) - ax["arch"]) < 1e-6:
            pn, pa = profile(z, False), profile(z, True)
            if z > ax["z"]:
                stations += [(z, pn, False), (z, pa, True)]
            else:
                stations += [(z, pa, True), (z, pn, False)]
        else:
            stations.append((z, profile(z), in_arch))

    def P(st, i):
        x, y = st[1][i]
        return np.array([x, y, st[0]])

    nseg = len(stations[0][1]) - 1
    for k in range(len(stations) - 1):
        s0, s1 = stations[k], stations[k + 1]
        mats = interval_materials(s0[0], s1[0], s0[2], s1[2])
        for s in range(nseg):
            a, b, c, d = P(s0, s), P(s1, s), P(s1, s + 1), P(s0, s + 1)
            mb.quad(mats[s], a, b, c, d)
            mb.quad(mats[s], mirror_x(a), mirror_x(d), mirror_x(c), mirror_x(b))

    for st, facing in ((stations[0], 1), (stations[-1], -1)):
        right = [P(st, i) for i in range(nseg + 1)]
        ring = right + [mirror_x(p) for p in right[::-1][1:-1]]
        clean = [ring[0]]
        for p in ring[1:]:
            if np.linalg.norm(p - clean[-1]) > 1e-6:
                clean.append(p)
        ctr = np.mean(clean, axis=0)
        for i in range(len(clean)):
            a, b = clean[i], clean[(i + 1) % len(clean)]
            mb.tri("Paint", ctr, a, b) if facing > 0 else mb.tri("Paint", ctr, b, a)


def build_front(mb):
    zf = Z_FRONT
    # Zentraler Lufteinlass mit Querstreben
    mb.slab("TrimGloss", [(-0.50, 0.37, zf + 0.012), (0.50, 0.37, zf + 0.012),
                          (0.42, 0.17, zf + 0.012), (-0.42, 0.17, zf + 0.012)], (0, 0, -0.04))
    for y in (0.22, 0.27, 0.32):
        mb.box("Grille", (-0.45 + (0.37 - y) * 0.2, y - 0.008, zf + 0.012),
               (0.45 - (0.37 - y) * 0.2, y + 0.008, zf + 0.022))
    # Mittelsteg ("Bruecke") in Wagenfarbe
    mb.box("Paint", (-0.10, 0.17, zf + 0.012), (0.10, 0.37, zf + 0.03))
    # Frontsplitter
    mb.hexa("TrimGloss", [(-0.72, 0.15, zf + 0.04), (0.72, 0.15, zf + 0.04), (0.72, 0.11, zf + 0.05),
                          (-0.72, 0.11, zf + 0.05),
                          (-0.80, 0.15, 2.00), (0.80, 0.15, 2.00), (0.80, 0.09, 2.00), (-0.80, 0.09, 2.00)])

    def side(s):
        # seitliche Einlaesse
        mb.slab("TrimMatte", [(s * 0.55, 0.36, zf + 0.012), (s * 0.76, 0.38, zf + 0.012),
                              (s * 0.74, 0.18, zf + 0.012), (s * 0.48, 0.17, zf + 0.012)],
                (0, 0, -0.03))
        # Scheinwerfer oben auf der Kotfluegelspitze + LED-Tagfahrlicht
        decal(mb, "LightLens", [(2.17, 5.25), (2.17, 6.25), (1.90, 6.40), (1.90, 5.65)], s,
              lift=0.018, depth=0.04)
        decal(mb, "HeadLight", [(2.165, 5.95), (2.165, 6.15), (1.91, 6.33), (1.91, 6.18)], s,
              lift=0.026, depth=0.0)
        # Haubenschlitze (S-Duct)
        decal(mb, "TrimGloss", [(1.98, 8.15), (1.98, 8.55), (1.72, 8.60), (1.72, 8.20)], s,
              lift=0.01, depth=0.03)
    both_sides(side)


def build_rear(mb):
    zr = Z_REAR

    def side(s):
        # Rueckleuchten: zwei Elemente pro Seite
        for x0, x1 in ((0.30, 0.50), (0.55, 0.76)):
            mb.slab("TailLight", [(s * x0, 0.735, zr - 0.012), (s * x1, 0.74, zr - 0.012),
                                  (s * x1, 0.685, zr - 0.012), (s * x0, 0.69, zr - 0.012)],
                    (0, 0, 0.03))
        # Ecken-Luftauslaesse
        mb.slab("TrimMatte", [(s * 0.62, 0.62, zr - 0.012), (s * 0.80, 0.60, zr - 0.012),
                              (s * 0.78, 0.30, zr - 0.012), (s * 0.66, 0.30, zr - 0.012)],
                (0, 0, 0.03))
    both_sides(side)
    # Heckgitter + zentrales Endrohr (hoch montiert)
    mb.slab("TrimGloss", [(-0.58, 0.64, zr - 0.012), (0.58, 0.64, zr - 0.012),
                          (0.56, 0.40, zr - 0.012), (-0.56, 0.40, zr - 0.012)], (0, 0, 0.03))
    for y in (0.45, 0.50, 0.55, 0.60):
        mb.box("Grille", (-0.54, y - 0.007, zr - 0.02), (0.54, y + 0.007, zr - 0.012))
    mb.prism("Exhaust", hexagon(0.0, 0.52, zr + 0.10, 0.14, 10, 0.0, 1.0, 0.45), (0, 0, -0.17))
    mb.prism("Underbody", hexagon(0.0, 0.52, zr - 0.071, 0.12, 10, 0.0, 1.0, 0.38), (0, 0, -0.002))
    # Kennzeichen
    mb.box("Plate", (-0.26, 0.26, zr - 0.012), (0.26, 0.37, zr + 0.002))
    # Diffusor mit Finnen
    mb.hexa("TrimGloss", [(-0.76, 0.25, zr - 0.03), (0.76, 0.25, zr - 0.03),
                          (0.74, 0.12, zr - 0.07), (-0.74, 0.12, zr - 0.07),
                          (-0.76, 0.25, zr + 0.06), (0.76, 0.25, zr + 0.06),
                          (0.74, 0.10, -2.00), (-0.74, 0.10, -2.00)])
    for x in (-0.45, -0.25, 0.25, 0.45):
        mb.box("TrimMatte", (x - 0.012, 0.11, zr - 0.08), (x + 0.012, 0.22, -2.05))
    # Ducktail-Spoiler-Lippe
    mb.hexa("Paint", [(-0.78, 0.77, zr), (0.78, 0.77, zr), (0.78, 0.81, zr - 0.04), (-0.78, 0.81, zr - 0.04),
                      (-0.80, 0.80, -2.15), (0.80, 0.80, -2.15), (0.80, 0.83, -2.15), (-0.80, 0.83, -2.15)])


def build_side(mb):
    def side(s):
        # grosser Lufteinlass vor dem Hinterrad
        decal(mb, "TrimMatte", [(-0.50, 4.85), (-0.50, 5.55), (-0.93, 6.05), (-0.93, 4.35)], s,
              lift=0.01, depth=0.06)
        # Aussenspiegel
        mb.hexa("Paint", [
            (s * 0.86, 0.80, 0.42), (s * 1.02, 0.83, 0.38), (s * 1.02, 0.92, 0.38), (s * 0.86, 0.89, 0.42),
            (s * 0.86, 0.80, 0.26), (s * 1.01, 0.82, 0.26), (s * 1.01, 0.90, 0.28), (s * 0.86, 0.88, 0.28)])
        mb.box("TrimGloss", (s * 0.84 - 0.02, 0.79, 0.30), (s * 0.84 + 0.02, 0.83, 0.36))
        # Seitenschweller
        zf_, zr_ = AXLES["F"]["z"] - AXLES["F"]["arch"], AXLES["R"]["z"] + AXLES["R"]["arch"]
        mb.hexa("TrimGloss", [
            (s * 0.93, 0.17, zf_), (s * 0.97, 0.15, zf_), (s * 0.97, 0.08, zf_), (s * 0.88, 0.08, zf_),
            (s * 0.93, 0.17, zr_), (s * 0.97, 0.15, zr_), (s * 0.97, 0.08, zr_), (s * 0.88, 0.08, zr_)])
        # Radhaus-Innenschalen
        for ax in AXLES.values():
            mb.box("Underbody", (s * ax["liner"] - 0.01, 0.08, ax["z"] - ax["arch"]),
                   (s * ax["liner"] + 0.01, ax["r"] + ax["arch"], ax["z"] + ax["arch"]))
    both_sides(side)


def build_calipers(mb):
    for ax, ang in ((AXLES["F"], math.radians(150)), (AXLES["R"], math.radians(30))):
        for s in (1.0, -1.0):
            k = ax["r"] / 0.365
            pts = [(r * math.sin(a), r * math.cos(a))
                   for r in (0.16 * k, 0.235 * k) for a in (ang - 0.42, ang + 0.42)]
            order = [0, 1, 3, 2]
            cx = s * ax["x"]
            front = [(cx + s * 0.03, ax["r"] + pts[i][1], ax["z"] + pts[i][0]) for i in order]
            back = [(cx - s * 0.05, ax["r"] + pts[i][1], ax["z"] + pts[i][0]) for i in order]
            mb.hexa("Caliper", front + back)


def build_wheel(ax):
    """Rad aus dem RS6-Generator, auf Radius/Breite dieser Achse skaliert."""
    std = MeshBuilder()
    base.build_wheel(std)
    k_r, k_w = ax["r"] / base.WHEEL_R, ax["w"] / base.TIRE_W
    sc = np.array([k_w, k_r, k_r])
    mb = MeshBuilder()
    for mat, tris in std.tris.items():
        for a, b, c in tris:
            mb.tri(mat, a * sc, b * sc, c * sc)
    return mb


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paint", default="0.80,0.02,0.02", help="Lack sRGB (Standard: Rosso Corsa)")
    ap.add_argument("--caliper", default="0.95,0.78,0.05", help="Bremssattel sRGB (Standard: gelb)")
    ap.add_argument("--out", default="ferrari_296.glb")
    args = ap.parse_args()
    paint = [float(v) for v in args.paint.split(",")]
    caliper = [float(v) for v in args.caliper.split(",")]

    body = MeshBuilder()
    build_body(body)
    build_front(body)
    build_rear(body)
    build_side(body)
    build_calipers(body)

    g = GLTF(make_materials(paint, caliper))
    g.gltf["asset"]["generator"] = "build_ferrari.py"
    body_mesh, tb = g.add_mesh("Body", body)
    wf_mesh, twf = g.add_mesh("Wheel_Front", build_wheel(AXLES["F"]))
    wr_mesh, twr = g.add_mesh("Wheel_Rear", build_wheel(AXLES["R"]))
    root = g.add_node({"name": "Ferrari_296"})
    g.add_node({"name": "Body", "mesh": body_mesh}, root)
    for name, key, mesh, sgn in (("Wheel_FL", "F", wf_mesh, 1), ("Wheel_FR", "F", wf_mesh, -1),
                                 ("Wheel_RL", "R", wr_mesh, 1), ("Wheel_RR", "R", wr_mesh, -1)):
        ax = AXLES[key]
        node = {"name": name, "mesh": mesh, "translation": [sgn * ax["x"], ax["r"], ax["z"]]}
        if sgn < 0:
            node["rotation"] = [0.0, 1.0, 0.0, 0.0]
        g.add_node(node, root)
    g.save(args.out)
    print(f"{args.out}: Karosserie {tb} Dreiecke, Raeder {twf}/{twr}, gesamt {tb + 2 * twf + 2 * twr}")


if __name__ == "__main__":
    main()

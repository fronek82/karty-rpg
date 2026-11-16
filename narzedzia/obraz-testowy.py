"""Generuje obrazek testowy: czarna litera „F” na białym tle (niesymetryczna – obrót
i odbicie od razu widać w porównaniu PDF↔SVG).

Użycie: python3 narzedzia/obraz-testowy.py testy/zasoby/litera-f.png
Własny rysunek projektu – licencja jak kod (MIT).
"""
import sys

from PIL import Image, ImageDraw

K = 4  # obraz w wyższej rozdzielczości – bez rozmycia przy powiększeniu w teście
obraz = Image.new("RGB", (160 * K, 120 * K), "white")
d = ImageDraw.Draw(obraz)
for r in [(10, 10, 40, 110), (10, 10, 140, 35), (10, 55, 100, 75)]:
    d.rectangle([v * K for v in r], fill="black")
obraz.convert("1").save(sys.argv[1], optimize=True)

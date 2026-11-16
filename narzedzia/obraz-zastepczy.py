"""Generuje neutralny obrazek zastępczy (piktogram „obraz”) dla pakietów szablonów.

Użycie: python3 narzedzia/obraz-zastepczy.py <plik.png>
Własny rysunek projektu – licencja jak kod (MIT).
"""
import sys

from PIL import Image, ImageDraw

BOK = 512
KOLOR = (190, 190, 190, 255)
GRUBOSC = 16

obraz = Image.new("RGBA", (BOK, BOK), (0, 0, 0, 0))
d = ImageDraw.Draw(obraz)
m = 64
d.rounded_rectangle((m, m, BOK - m, BOK - m), radius=36, outline=KOLOR, width=GRUBOSC)
# Góry i słońce.
d.line([(m + 30, 360), (190, 220), (270, 300), (330, 250), (BOK - m - 30, 360)], fill=KOLOR, width=GRUBOSC, joint="curve")
d.ellipse((300, 130, 370, 200), outline=KOLOR, width=GRUBOSC)
obraz.save(sys.argv[1], optimize=True)

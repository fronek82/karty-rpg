"""Zmniejsza zrzuty ekranu instrukcji: paleta 256 kolorów, bez zmiany rozmiaru obrazu.

Uruchom po `ZRZUTY_INSTRUKCJI=1 npx playwright test testy/zrzuty-instrukcji.spec.ts`:
    python3 narzedzia/kwantyzuj-zrzuty.py
Wymaga Pillow (pip install pillow). Pliki są nadpisywane; rozmiar w pikselach zostaje.
"""

from pathlib import Path

from PIL import Image

KATALOG = Path(__file__).resolve().parent.parent / "public" / "instrukcja-zrzuty"

for plik in sorted(KATALOG.glob("*/*.png")):
    przed = plik.stat().st_size
    obraz = Image.open(plik).convert("RGB")
    paleta = obraz.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    paleta.save(plik, optimize=True)
    print(f"{plik.relative_to(KATALOG)}: {przed // 1024} KB -> {plik.stat().st_size // 1024} KB")

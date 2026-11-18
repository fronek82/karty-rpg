# Karty RPG – instrukcje dla agentów (Codex i inni)

Przed pracą przeczytaj `CLAUDE.md`. `SPEC.md` opisuje aplikację i jej architekturę. Aktualny plan oraz następny etap wskazuje sekcja „Gdzie co jest” w `CLAUDE.md`.

- Pliki `.claude/agents/` opisują role specjalistów projektu. Przed pracą nad danym obszarem przeczytaj odpowiedni plik. Przy delegowaniu przekaż subagentowi stosowne instrukcje z tego pliku.
- Przed zgłoszeniem etapu do scalenia zleć niezależny przegląd subagentowi według `.claude/agents/recenzent.md`. Jeśli subagenci są niedostępni, przeprowadź przegląd samodzielnie i odnotuj to w PR.
- Scalenie PR należy do właściciela repozytorium. W opisie PR podaj zakres etapu, wyniki sprawdzeń, uwagi z przeglądu i sposób ich rozwiązania, nowe decyzje z sekcji 9 planu oraz instrukcję ręcznego sprawdzenia zmian.
- Aktualizuj `CLAUDE.md` w zakresie bieżącego i następnego etapu, gdy wymaga tego plan.
- Aktualizuj wzorce Playwright `*-chromium-linux.png` tylko w zakresie świadomie zmienionego wyglądu. Wymień zmienione pliki i uzasadnienie w PR. Wzorce kart, arkuszy i przykładów generowanych przez silnik aktualizuj wyłącznie wtedy, gdy plan etapu wprost przewiduje zmianę danego wyniku.

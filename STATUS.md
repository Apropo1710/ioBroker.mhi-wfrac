# Projektstatus – ioBroker.mhi-wfrac

Stand: 2026-11-11

## Ziel und Arbeitsweise

- Weiterentwicklung des bestehenden Adapters im Fork `Apropo1710/ioBroker.mhi-wfrac`.
- Kein eigenständiger Neuadapter.
- Original `hacki11/ioBroker.mhi-wfrac` bleibt unangetastet; geeignete Änderungen sollen später per Pull Request angeboten werden.
- Funktionierende Funktionen nicht ohne belegten Grund verändern.
- Änderungen klein, nachvollziehbar und getestet halten.
- Protokollkodierung und Gerätebefehle bis zur Verfügbarkeit echter Geräte nur analysieren, nicht experimentell verändern.
- Gerätewerte, Timer, Zeitsteuerung und Wochenpläne später anhand realer Geräte untersuchen.

## Repository-Stand

- Fork: https://github.com/Apropo1710/ioBroker.mhi-wfrac
- Original: https://github.com/hacki11/ioBroker.mhi-wfrac
- Ausgangsbranch: `main`
- Ausgangscommit: `4480e4e42b73b134eaa9ce552501c7cdeffcfe1e`
- Adapterversion: `2.3.0`
- Am 2026-11-11 verglichene Fork- und Original-`main`-Branches: identischer Commit und identischer Git-Baum (70 Einträge).
- Entwicklungsbranch angelegt: `dev/stability-error-handling`, aus Fork-`main`.
- Diese Statusdatei wird als erster Commit des Entwicklungsbranches angelegt.

## Projektstruktur (erfasst)

- `main.js`: Adapter-Lifecycle, Geräteverwaltung, Polling, Datenpunkte, HTTP-Kommunikation
- `lib/Device.js`: Gerätemodell und Instanzen der Status-/Coder-Klassen
- `lib/AirconStat.js`: internes Modell der Klimaanlagenwerte
- `lib/AirconStatCoder.js`: Statusdekodierung und Befehls-/Base64-Kodierung
- `admin/`: Konfiguration, Übersetzungen und Grafik
- `test/`: Integrationstest-Einstieg, Paketprüfung und Mocha-Setup
- `main.test.js`: derzeit nur Dummy-Test, keine echte Adapter-Funktionsprüfung
- `.github/workflows/test-and-release.yml`: CI-Prüfungen und tagbasierter Release-/Deploy-Ablauf
- `.devcontainer/`: Entwicklungscontainer
- Weitere Konfigurations-/Qualitätsdateien: ESLint, Prettier, TypeScript-Konfiguration, Dependabot

## Vorhandene npm-Skripte

- `npm test`: `test:js` und `test:package`
- `npm run test:js`: Mocha-JavaScript-Tests
- `npm run test:package`: ioBroker-Paketdateiprüfung
- `npm run test:integration`: separater Integrationstest-Einstieg; nicht Bestandteil von `npm test`
- `npm run check`: TypeScript-Prüfung der JavaScript-Dateien
- `npm run lint`: ESLint

Die Skripte und Testdateien wurden im Repository eingesehen. Ein lokaler Testlauf wurde in dieser Bestandsaufnahme nicht durchgeführt. Im Fork waren zum Prüfzeitpunkt keine GitHub-Actions-Runs gelistet.

## Untersuchungs- und Verbesserungsbereiche

### Priorität 1 – Stabilität und Fehlerbehandlung

Noch zu untersuchen und mit Tests abzusichern:

1. Polling-Schleife: Verhalten bei unerwarteten Fehlern; sicherstellen, dass ein Fehler nicht dauerhaft weitere Aktualisierungen verhindert.
2. HTTP-/Axios-Fehler: Fehlerklassen, Timeouts, Verbindungsabbrüche, HTTP-Status und ungültige Antworten differenziert behandeln.
3. Retry-Verhalten: globale Retry-Konfiguration wiederholt derzeit grundsätzlich Fehler, auch bei POST. Idempotenz und Auswirkungen vor jeder Änderung prüfen.
4. Geräte-Onlinezustand und `info.connection`: konsistente Zustandsübergänge bei mehreren Geräten und fehlgeschlagenen Abfragen prüfen.
5. Asynchrone State-Änderungen und Shutdown: unbehandelte Promise-Rejections und sauberes Beenden untersuchen.
6. Registrierung/Erkennung von HTTP und HTTPS: Fehlerpfade und Antwortvalidierung testen.

### Priorität 2 – Testbasis

- Dummy-Test in `main.test.js` durch echte, gezielte Tests ersetzen.
- Netzwerkzugriffe in Tests mocken; keine Klimaanlage für Basistests voraussetzen.
- Fehlerfälle und Mehrgeräteverhalten abdecken.
- Paket-, Lint-, TypeScript- und Integrationstests getrennt ausführen und Ergebnisse dokumentieren.

### Zurückgestellt – Protokoll und Gerätefunktionen

- `lib/AirconStatCoder.js` nur statisch analysieren, bis echte Geräte und belastbare Referenzwerte vorhanden sind.
- Keine Änderungen an Base64-/Byte-/CRC-Kodierung oder Gerätebefehlen ohne reproduzierbare Tests.
- Später echte Gerätewerte, Timer, Zeitsteuerung und Wochenpläne erfassen und untersuchen.

## Erste statische Beobachtungen (noch keine bestätigten Bugs)

- Der Polling-Ablauf in `main.js` ruft Geräte nacheinander ab und plant den nächsten Lauf erst nach Abschluss der Runde. Eine ungefangene Ausnahme könnte daher den nächsten Lauf verhindern.
- `axios-retry` wird global mit einer sehr breiten Retry-Bedingung konfiguriert; die Folgen für POST-Kommandos müssen gezielt geprüft werden.
- `main.test.js` ist ein Dummy-Test und testet keine Adapterfunktion.
- `test/integration.js` startet die ioBroker-Integrationstests separat.
- Der Decoder greift auf positionsbasierte Bytewerte zu; Eingabelängen und Antwortstruktur sind als Schutz-/Testbereich zu prüfen. Decoderänderungen bleiben bis zu echten Referenzdaten zurückgestellt.

Diese Punkte sind Prüfhypothesen, keine bereits bestätigten Fehler.

## Änderungsprotokoll

### 2026-11-11 – Bestandsaufnahme

- Fork und Original geprüft; beide `main`-Branches waren identisch.
- Vollständigen Git-Baum mit 70 Einträgen erfasst.
- Entwicklungsbranch `dev/stability-error-handling` aus `main` erstellt.
- Projektstruktur, npm-Skripte, Test-Einstiegspunkte und CI-Workflow gesichtet.
- Noch keine Änderungen am Laufzeitcode und keine Protokolländerungen vorgenommen.

## Nächste Schritte

1. Diese Datei auf `dev/stability-error-handling` committen.
2. Testumgebung installieren/ausführen und Baseline-Ergebnisse festhalten.
3. Polling und Fehlerpfade in `main.js` detailliert prüfen.
4. Kleine, isolierte Tests für Fehlerfälle ergänzen.
5. Erst nach grüner Baseline die erste eng begrenzte Stabilitätskorrektur umsetzen und dokumentieren.

## Pull-Request- und Release-Regeln

- Entwicklungsarbeit erfolgt auf Feature-/Arbeitsbranches, nicht direkt auf `main`.
- Commits erhalten aussagekräftige Nachrichten; jede Verhaltensänderung nennt Grund und Test.
- Vor einem PR: Branch mit aktuellem Fork-`main` vergleichen, Tests ausführen, `STATUS.md` aktualisieren und Änderungen auf unbeabsichtigte Protokoll-/Funktionsänderungen prüfen.
- PR-Ziel für Rückgaben an das Upstream-Projekt ist `hacki11/ioBroker.mhi-wfrac:main`; zunächst als Draft/Review anbieten.
- Keine Versionsnummer erhöhen und keinen Release-Tag setzen, solange kein abgestimmter Release ansteht.

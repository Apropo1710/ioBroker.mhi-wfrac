# Projektstatus – ioBroker.mhi-wfrac

## Wiederanmeldung mehrerer Geräte
- Fehler während eines einzelnen Wiederanmeldeversuchs werden pro konfiguriertem Endpunkt abgefangen und protokolliert.
- Weitere aktivierte Geräte werden im selben Retry-Durchlauf weiter geprüft und können sich unabhängig wieder anmelden.
- Ein Regressionstest deckt ab, dass ein fehlschlagender erster Endpunkt einen danach erreichbaren zweiten nicht blockiert.
- CI für Commit steht aus.


## Shutdown-Fehlerbehandlung
- Shutdown-Cleanup wird pro Gerät isoliert: Ein fehlgeschlagenes Offline-Update verhindert nicht mehr die Bereinigung weiterer Geräte.
- Fehler beim Löschen des Polling-Timers und beim Zurücksetzen von `info.connection` werden separat protokolliert.
- Der ioBroker-Shutdown-Callback wird genau einmal und außerhalb der Cleanup-Fehlerbehandlung aufgerufen.
- Zwei Regressionstests decken Teilausfälle und Callback-Verhalten ab. CI für Commit steht aus.


## Konfigurationsänderungen und State-Publishing
- Die Adapterinstanz verarbeitet ihre Konfiguration beim Start (`ready`). Änderungen an IP oder Aktivierung werden nach dem von ioBroker vorgesehenen Instanzneustart übernommen; ein eigener Laufzeit-Konfigurationshandler ist nicht erforderlich.
- State-Publishing-Fehler werden von Geräte-Kommunikationsfehlern getrennt und setzen ein erreichbares Gerät nicht offline. Regressionstest vorhanden.
- Die macOS-CI-Pause bleibt vorübergehend bestehen; Ubuntu/Windows Node 22/24 und Lint sind aktiv.


## Geprüfter Entwicklungsstand – Decoderfehler im Polling
- Polling-Fehlerzähler wird erst zurückgesetzt, nachdem `acCoder.fromBase64()` erfolgreich abgeschlossen wurde.
- Zuvor wurde der Zähler bei formal erfolgreicher HTTP-/Geräteantwort vor dem Decoder zurückgesetzt. Decoder-Ausnahmen konnten dadurch die Offline-Schwelle von drei Fehlern nie erreichen.
- Zwei Regressionstests decken wiederholte Decoderfehler und erfolgreiche Erholung ab.
- Keine Decoder-/Protokolllogik geändert; nur die Position des Zähler-Resets.
- CI für Commit steht aus; macOS bleibt vorübergehend pausiert.


## Geprüfter Entwicklungsstand – State-Initialisierung
- Fehler beim Anlegen/Aktualisieren der ioBroker-States während des Starts oder einer späteren Geräte-Wiederregistrierung markieren das physisch erreichbare Gerät nicht mehr fälschlich offline.
- Fehler werden separat protokolliert; die Initialisierung weiterer Geräte und das Polling laufen weiter.
- Zwei Regressionstests decken Start und Wiederregistrierung ab.
- CI für Commit steht aus; macOS bleibt vorübergehend pausiert.


## Geprüfter Entwicklungsstand – optionale Kontoaktualisierung
- Fehler bei `update_account_info()` setzen ein bereits erfolgreich erkanntes/registriertes Gerät nicht mehr offline.
- Die optionale Metadatenaktualisierung protokolliert den Fehler separat; echte Erkennungs- und Kommunikationsfehler behalten ihre bisherige Fehlerbehandlung.
- Regressionstest deckt ab, dass das Gerät online bleibt und `errorHandler()` nicht aufgerufen wird.
- CI für diesen Commit steht aus. macOS bleibt wie vereinbart vorübergehend pausiert.


## Geprüfter Entwicklungsstand – CI-Pause macOS
- Build #71 (Run `43483508724`) nach Retry des einzigen abgebrochenen Jobs vollständig erfolgreich: Lint, Ubuntu/Windows Node 22/24 sowie macOS Intel Node 22/24 grün.
- BambuLab Build #176 (Run `43484902511`) ebenfalls vollständig erfolgreich; beide macOS-Jobs wurden dort ohne Workflowänderung erfolgreich ausgeführt.
- Auf Nutzerwunsch werden macOS-Tests im Mitsubishi-Workflow vorübergehend für einige Tage pausiert. Ubuntu und Windows mit Node 22/24 sowie Lint bleiben aktiv. macOS ist ausdrücklich nicht dauerhaft entfernt; Wiedereinführung nach Beobachtungsphase.
- Deploy benötigt während der Pause nur Lint und Ubuntu/Windows-Testgruppe.
- Nächster Lauf prüft die reduzierte CI-Matrix. Keine lokale Tests behauptet.

## Geprüfter Entwicklungsstand – State-Publishing-Fehler
- Fehler beim Schreiben von ioBroker-States führen nicht mehr dazu, dass ein erreichbares Klimagerät als offline markiert wird.
- `setIOBStates()` protokolliert den tatsächlichen Publishing-Fehler inklusive Aircon-Status und lässt den Gerätestatus unverändert. Echte Kommunikationsfehler laufen weiterhin über `errorHandler()`.
- Regressionstest aktualisiert: Gerät bleibt online, `errorHandler()` wird nicht aufgerufen und der Fehler wird protokolliert.
- CI für Commit steht aus; keine lokale Testausführung.


## Geprüfter Entwicklungsstand – 13.11.2026 (macOS-Queue-Workaround)
- Build #69 (Run `43477654128`) abgeschlossen mit failure: Lint sowie Ubuntu/Windows Node 22/24 erfolgreich; beide `macos-15-intel`-Jobs wurden nach 15:01 Minuten queued ohne gestartete Steps cancelled. Keine Testfehler.
- Vergleichbare öffentliche Meldungen dokumentieren denselben Runner-Akquisitionsfehler sowohl auf ARM als auch Intel. GitHub Status dokumentiert Actions-Störungen am 9. und 11. November 2026; insbesondere Queue-/Scheduler-Probleme sind als plausible Ursache belegt, aber die individuelle Ursache dieses Runs bleibt unbestätigt.
- Workflow geändert: Ubuntu/Windows bleiben in der parallelen Matrix; macOS wurde in einen separaten Job verschoben und die beiden Node-Versionen werden mit `max-parallel: 1` nacheinander auf dem bereits einmal erfolgreich getesteten `macos-15-intel` ausgeführt. So wird nur eine macOS-Runner-Zuteilung gleichzeitig angefordert.
- Deploy wartet jetzt auf beide Testjobs. Keine Änderung am Adaptercode oder an der Pflichtabdeckung (weiterhin 6 Kombinationen).
- Nächster CI-Lauf soll zeigen, ob die serielle Anforderung die Zuteilung stabilisiert.

## Geprüfter Entwicklungsstand – 13.11.2026 (Polling-Fehlertoleranz)
- Build #68 (Run `43475768037`) vollständig erfolgreich: Lint und alle sechs Matrixkombinationen, einschließlich macOS 15 Intel Node 22/24.
- Ergänzt: Ein Gerät wird nach Polling-Fehlern erst nach drei aufeinanderfolgenden fehlgeschlagenen Abfragen offline gesetzt. Die ersten zwei Fehler bleiben Debug-Meldungen; der Offline-Fehler wird beim Erreichen der Schwelle einmalig protokolliert. Weitere Ausfälle erzeugen keine wiederholten Fehlerlogs.
- Ein erfolgreicher Poll setzt den Zähler zurück und protokolliert nach einer Offline-Phase die Wiedererreichbarkeit. Benutzerinitiierte Schreibfehler und State-Publishing-Fehler bleiben unverändert sofortige Fehler.
- Drei Regressionstests decken Toleranz, Schwelle/Einmal-Log und Wiederherstellung ab. Die Schwelle ist zunächst fest auf drei Polls gesetzt; keine zusätzliche Admin-Einstellung.
- CI für diese Änderung steht aus.

## Geprüfter Entwicklungsstand – 13.11.2026 (Axios-Retry-Konfiguration)
- Build #66 (Run `43473235619`) vollständig erfolgreich: Lint und alle sechs Kombinationen Ubuntu/Windows/macOS 15 Intel mit Node 22/24.
- Der konkrete Axios-Retry-Fehler aus Original-PR #39 wurde behoben: normale Requests erhalten keinen lokalen `axios-retry`-Override mehr und behalten die globale Read-only-Retry-Regel; nur explizite Geräteerkennungs-Probes setzen `retries: 0`.
- Zwei Regressionstests prüfen den normalen Request sowie `disableRetry: true`; zusätzlich wird die globale Retry-Konfiguration mit vier Versuchen abgesichert.
- Keine Änderung an Geräteprotokoll, Payloads oder Schreib-Retry-Regeln. CI für diesen Commit steht aus.

## Geprüfter Entwicklungsstand – 13.11.2026 (macOS-Runner-Wechsel)
- Build #65 (Run `43470020808`) nach erfolgreichem Lint und vier erfolgreichen Linux-/Windows-Jobs fehlgeschlagen: Beide macOS-Jobs (`macos-latest`, Node 22 und 24) blieben queued und wurden ohne gestartete Steps cancelled.
- Ursache ist die wiederholt ausbleibende Zuteilung der `macos-latest`-Runner; keine Testfehler. Die GitHub-Runner-Dokumentation ordnet `macos-latest` aktuell macOS 26 ARM64 zu und führt `macos-15-intel` als verfügbaren Intel/x64-Runner.
- Pflichtmatrix bleibt bei sechs Kombinationen und Node 22/24; macOS wird vorerst explizit über `macos-15-intel` statt `macos-latest` ausgeführt. Damit testen wir macOS weiterhin, zunächst aber auf Intel statt Apple Silicon.
- Änderung wird mit neuem Build geprüft; später erneut bewerten, ob ARM64/macOS-latest wieder zuverlässig verfügbar ist.

## Geprüfter Entwicklungsstand – 13.11.2026 (CI-Workflow-Robustheit)
- Build #64 (Run `43466212800`) nach gezieltem Retry des einzigen abgebrochenen Jobs vollständig erfolgreich (Run attempt 2); alle sechs Matrixkombinationen sowie Lint erfolgreich.
- Der erste Versuch von `adapter-tests (22.x, macos-latest)` wurde nach 15 Minuten abgebrochen, ohne dass ein Testfehler vorlag. Der gezielte Job-Retry lief anschließend erfolgreich durch.
- Matrix-Härtung aktiv: `fail-fast: false` und `timeout-minutes: 30`; alle sechs Pflichtkombinationen bleiben erhalten.
- Concurrency-Gruppe ist jetzt auf `${{ github.workflow }}-${{ github.ref }}` umgestellt, damit unterschiedliche Workflows auf demselben Branch sich nicht gegenseitig abbrechen.

## Geprüfter Entwicklungsstand – 13.11.2026
- Fork: `Apropo1710/ioBroker.mhi-wfrac`; Original `hacki11/ioBroker.mhi-wfrac` bleibt unangetastet.
- Aktiver Entwicklungsbranch: `dev/stability-error-handling`; letzter erfolgreich CI-geprüfter Adapterstand: `4017d519b47eff0d9227f28cb4fe1c0845e8fa0f`; nachfolgende Dokumentations- und Teständerungen werden mit Build #63 geprüft.
- Adapterversion laut `package.json`: **2.3.0**; kein Release erstellt.
- Letzter vollständig erfolgreicher Pflichtlauf: „Test and Release“ #62 (Run `43417634254`) für Commit `4017d519b47eff0d9227f28cb4fe1c0845e8fa0f`; Lint sowie alle sechs Kombinationen aus Ubuntu, Windows und macOS mit Node 22/24 waren erfolgreich.
- Reine Markdown- und `docs/`-Änderungen werden künftig bereits am Push-Trigger ignoriert; gemischte Commits mit Codeänderungen lösen weiterhin die CI aus. `[skip ci]` wird nicht mehr benötigt.
- macOS wurde während einer GitHub-Actions-Störung vorübergehend aus der Matrix genommen. Da die Plattformrunner inzwischen wieder funktionieren und der Nutzer die Wiederaufnahme ausdrücklich bestätigt hat, wird macOS mit Node 22 und 24 wieder in die Pflichtmatrix aufgenommen.
- Die vollständige CI-Matrix Linux/Windows/macOS mit Node 22/24 ist mit Build #62 erfolgreich bestätigt.
- Keine Mitsubishi-Hardwaretests möglich/bestätigt: Klimaanlage noch nicht installiert, Adapter noch nicht produktiv eingerichtet.
- Die aktuelle Adapterkorrektur verhindert doppelte Registrierungen derselben IP und das Überschreiben bereits registrierter Geräte bei kollidierender `airconId`; drei Regressionstests decken diese Fälle ab.
- Die CI-Aufräumarbeiten filtern reine Markdown-/`docs/`-Änderungen bereits am Push-Trigger und entfernen den alten Auto-Merge-Dependabot-Workflow aus dem Fork-`main`; das Original bleibt unverändert.

Stand: 2026-11-13

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
- Entwicklungsbranch: `dev/stability-error-handling`, aus Fork-`main`.
- `STATUS.md` wurde als erster Commit dieses Entwicklungsbranches angelegt.

## Arbeitsplanung

- Hardwareabhängige Prüfungen und offene Gerätefragen stehen gesammelt in [TODO.md](./TODO.md). Diese Liste wird ergänzt, sobald bei der statischen Analyse neue Punkte auffallen, die erst mit installierter Anlage verifiziert werden können.

## Projektstruktur (erfasst)

- `main.js`: Adapter-Lifecycle, Geräteverwaltung, Polling, Datenpunkte, HTTP-Kommunikation
- `lib/Device.js`: Gerätemodell und Instanzen der Status-/Coder-Klassen
- `lib/AirconStat.js`: internes Modell der Klimaanlagenwerte
- `lib/AirconStatCoder.js`: Statusdekodierung und Befehls-/Base64-Kodierung
- `admin/`: Konfiguration, Übersetzungen und Grafik
- `test/`: Integrationstest-Einstieg, Paketprüfung und Mocha-Setup
- `main.test.js`: gezielte Mocha-Tests für State-Handling, Polling, Shutdown und abgelehnte Geräteantworten
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

Die Skripte und Testdateien wurden im Repository eingesehen. Die Tests laufen über GitHub Actions im internen Draft-PR #1. Ein lokaler Testlauf wurde nicht durchgeführt.

## Untersuchungs- und Verbesserungsbereiche

### Priorität 1 – Stabilität und Fehlerbehandlung

Noch zu untersuchen und mit Tests abzusichern:

1. Polling-Schleife: Verhalten bei unerwarteten Fehlern; sicherstellen, dass ein Fehler nicht dauerhaft weitere Aktualisierungen verhindert.
2. HTTP-/Axios-Fehler: Fehlerklassen, Timeouts, Verbindungsabbrüche, HTTP-Status und ungültige Antworten differenziert behandeln. Geräte-Antworten müssen zusätzlich auf den fachlichen `result`-Code geprüft werden.
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
- `axios-retry` 4.5.0 ist global mit `retries: 4`, linearer Verzögerung (2/4/6/8 Sekunden), `shouldResetTimeout: true` und `retryCondition: _error => true` konfiguriert. Damit werden alle von Axios als Fehler behandelten Antworten wiederholt – auch HTTP-4xx und POST-Anfragen. Die Bibliothek würde standardmäßig nur Netzwerkfehler oder 5xx bei idempotenten HTTP-Methoden wiederholen; die benutzerdefinierte Bedingung hebt diese Einschränkung auf.
- `detectDeviceConnection()` prüft `response.result === 0`; die regulären Lese-/Schreibpfade prüften bislang dagegen nur `ret.error === ""`. Dieser Wert wird in `_postConnection()` nicht verändert, sodass fachliche Gerätefehler unbemerkt bleiben konnten.
- Die vier aufgerufenen API-Kommandos sind `getDeviceInfo`, `getAirconStat`, `updateAccountInfo` und `setAirconStat`. Die ersten beiden lesen Daten; `updateAccountInfo` schreibt feste Kontodaten; `setAirconStat` überträgt den vollständigen Klimaanlagenstatus. Ob eine Wiederholung von `setAirconStat` auf Geräteebene garantiert nebenwirkungsfrei ist, ist ohne Protokolldokumentation oder reales Gerät nicht belegt.
- Wegen `shouldResetTimeout: true` gilt das 5-Sekunden-Timeout pro Versuch. Bei vier Wiederholungen und den aktuellen Wartezeiten kann ein einzelner HTTP-Aufruf im Fehlerfall deutlich länger als fünf Sekunden blockieren. Die Retry-Konfiguration wird deshalb nicht ohne gezielte Tests und Bewertung der Schreibbefehle geändert.
- `main.test.js` enthält gezielte Mocha-Tests für State-Handling, Polling, Shutdown und abgelehnte Geräteantworten.
- `test/integration.js` startet die ioBroker-Integrationstests separat.
- Der Decoder greift auf positionsbasierte Bytewerte zu; Eingabelängen und Antwortstruktur sind als Schutz-/Testbereich zu prüfen. Decoderänderungen bleiben bis zu echten Referenzdaten zurückgestellt.

Diese Punkte sind Prüfhypothesen, keine bestätigten Fehler.

## Änderungsprotokoll

### 2026-11-13 – State-Publishing-Fehler mit Regressionstest abgesichert

- Neuer Test prüft, dass ein Fehler beim Schreiben eines ioBroker-States über `setIOBStates()` abgefangen und an den Geräte-Errorhandler weitergegeben wird.
- Bereits vorhandener Test bestätigt, dass ein Fehler bei einem Gerät die Polling-Verarbeitung weiterer Geräte nicht stoppt.
- Keine Änderung am Adapter-Laufzeitcode; Verhalten wird gezielt abgesichert.


### 2026-11-13 – Laufzeit-Konfigurationsänderungen geprüft

- Adapterkonfiguration wird in `onReady()` über `this.config` gelesen und die Geräte werden dort registriert.
- Nach dem ioBroker-Instanzmodell werden Änderungen der Instanzkonfiguration durch Neustart der Instanz übernommen; `ready` wird erneut ausgeführt und liest die aktualisierte Konfiguration.
- Ein zusätzlicher Laufzeit-Konfigurationshandler ist daher nicht erforderlich und wurde nicht implementiert.
- Keine Codeänderung.


### 2026-11-13 – CI-Ergebnis und Registrierungsabsicherung

- Build #62 (Run `43417634254`) vollständig erfolgreich: Lint und alle sechs OS-/Node-Kombinationen.
- Doppelte IP-Registrierung wird übersprungen; doppelte Geräte-ID überschreibt keinen vorhandenen Eintrag; doppelte konfigurierte IPs zählen als ein Endpunkt.
- Drei Regressionstests ergänzt. Keine Protokoll- oder Hardwarebefehle geändert.
- Reine Markdown-/`docs/`-Änderungen lösen dank `paths-ignore` keinen Testlauf aus.
- Alter Auto-Merge-Dependabot-Workflow aus Fork-`main` entfernt; Build #61 erfolgreich.


### 2026-11-13 – Geräteerkennung gegen doppelte IPs und Geräte-IDs absichern

- Die Registrierung überspringt eine IP-Adresse, die bereits einem registrierten Gerät zugeordnet ist.
- Meldet eine andere IP eine bereits verwendete `airconId`, wird der vorhandene Geräteeintrag nicht überschrieben. Der Konflikt wird protokolliert und die neue Adresse erhält eine verzögerte erneute Prüfung.
- Mehrere aktivierte Konfigurationseinträge mit derselben IP zählen für `info.connection` nur als ein physischer Endpunkt.
- Drei Regressionstests ergänzen die doppelte IP-, doppelte Geräte-ID- und Verbindungszähler-Prüfung.
- Keine Änderung an Geräteprotokoll, Kodierung oder Befehlen.


### 2026-11-13 – Reine Dokumentationsänderungen aus CI ausschließen

- `paths-ignore` filtert reine Markdown- und `docs/`-Änderungen bereits beim Push-Trigger.
- Gemischte Commits mit Code-/Konfigurationsänderungen starten weiterhin die vollständige CI-Matrix.
- Die `[skip ci]`-Bedingungen aus den Jobs entfernt; keine speziellen Commit-Nachrichten mehr nötig.
- Die Workflowänderung selbst wird mit der vollständigen Pflichtmatrix geprüft.


### 2026-11-11 – Hardwareabhängige TODO-Liste angelegt

- Neue `TODO.md` trennt Aufgaben ohne Hardware von Prüfungen, die erst mit einer installierten Mitsubishi-Heavy-Anlage möglich sind.
- Aufgenommen: API-Referenzantworten, Decoder-/Paketlängenvalidierung, Modell-/Firmwarevarianten, Schreib-/Rücklesetests, Timeout-Verhalten, Langzeit-/Mehrgerätebetrieb sowie Timer und Wochenpläne.
- Die positionsbasierten Bytezugriffe im Decoder sind ausdrücklich als Prüfpunkt und nicht als bestätigter Bug markiert.
- `STATUS.md` verweist auf die neue TODO-Liste.

### 2026-11-11 – Geräteinitialisierung bei Fehlern voneinander entkoppelt

- Bei der Adapterinitialisierung konnte ein Fehler beim Anlegen der ioBroker-Datenpunkte eines Geräts die Initialisierung aller nachfolgenden Geräte abbrechen und verhindern, dass der normale Polling-Zyklus gestartet wird.
- Fehler werden jetzt pro Gerät behandelt. Weitere Geräte werden weiterhin initialisiert und der Polling-Zyklus wird anschließend gestartet.
- Regressionstest ergänzt: Das erste Gerät schlägt bei der State-Initialisierung fehl; das zweite wird trotzdem initialisiert und Polling startet.
- Keine Änderung an Gerätekommunikation oder Protokoll.

### 2026-11-11 – Vorherigen Gerätestatus vor Schreibänderung sichern

- Bei der Prüfung des Schreibfehlerpfads ist aufgefallen, dass der bisherige Wert erst nach der Mutation gespeichert wurde. Dadurch konnte ein abgelehnter Schreibbefehl den nicht bestätigten neuen Wert im internen Modell belassen.
- Die Sicherung des bisherigen Feldwerts erfolgt jetzt vor der Änderung. Bei negativer Geräteantwort wird genau dieser bestätigte Wert wiederhergestellt.
- Der vorhandene Regressionstest „restores the last confirmed value when a device rejects a state write“ deckt diesen Fehlerpfad ab.
- Keine Änderung an Geräteprotokoll, Kodierung, CRC oder HTTP-Verhalten.

### 2026-11-11 – Polling und Schreibbefehle je Gerät serialisiert

- Der Polling-Zyklus und manuelle State-Schreibvorgänge verwendeten bislang getrennte Abläufe. Dadurch konnte eine Statusabfrage parallel zu einem Schreibbefehl laufen und dessen lokales Gerätemodell mit einem älteren Gerätestatus überschreiben.
- Polling-Abfrage und anschließende ioBroker-State-Aktualisierung laufen jetzt ebenfalls in derselben per `airconId` geführten Queue wie Schreibbefehle.
- Ein Test hält einen Schreibbefehl gezielt offen und prüft, dass das Polling desselben Geräts erst danach beginnt.
- Geräte bleiben untereinander unabhängig. Keine Änderung an Geräteprotokoll, Kodierung, CRC oder HTTP-Retry-Verhalten.
- CI-Prüfung für diesen Commit steht noch aus.


### 2026-11-11 – Unnötigen Dependabot-Automerge-Workflow entfernt

- Der Workflow `.github/workflows/automerge-dependabot.yml` wurde aus dem Fork entfernt. Er reagierte auf `pull_request_target`-Ereignisse bei jedem PR-Update, wurde bei eigenen Commits aber wegen der Bedingung `github.actor == 'dependabot[bot]'` nur als „skipped“ angezeigt.
- Der Workflow `Test and Release` bleibt unverändert und ist weiterhin die maßgebliche CI für Pushes auf `main` und `dev/**`.
- CI-Lauf für Commit `4eca406` vollständig erfolgreich: Lint sowie Linux/Windows mit Node 22.x und 24.x. macOS bleibt vorübergehend ausgesetzt.
- Keine Änderung an Adapter-Laufzeitcode oder Release-/Deploy-Konfiguration.


### 2026-11-11 – ioBroker-Schreibzustände nur nach bestätigtem Gerätebefehl aktualisieren

- `sendDataToDevice()` fing Fehler bisher intern ab und gab keinen Erfolgsstatus zurück. `setStateVal()` rief danach trotzdem `setIOBStates()` auf und bestätigte damit den gewünschten Wert in ioBroker, obwohl das Gerät den Schreibbefehl abgelehnt haben konnte.
- `sendDataToDevice()` liefert jetzt `true` nur nach erfolgreicher Geräteantwort und Dekodierung zurück, andernfalls `false`.
- `setStateVal()` aktualisiert die bestätigten ioBroker-States nur noch bei erfolgreicher Übertragung. Bei Fehlern bleiben die bisherigen bestätigten Werte erhalten; `errorHandler()` markiert das Gerät weiterhin offline.
- Zwei Tests decken erfolgreiche und abgelehnte Schreibantworten ab.
- Code-Commit `34b46ca`, Test-Commit `7c977bf`. Auf ausdrücklichen Wunsch ist macOS vorübergehend aus der CI-Matrix entfernt; Linux und Windows bleiben die Pflichtprüfungen (Workflow-Commit `ce27005`). macOS soll nach Klärung der Runner-Warteschlange wieder aufgenommen werden. CI-Ergebnis für den neuen Stand steht noch aus.
### 2026-11-11 – CI-Fehler bei Command-Queue formatiert

- CI-Lauf für Commit `b97279c` schlug in ESLint/Prettier fehl: 43 Formatierungsfehler im neu ergänzten `setStateVal()`-Queue-Block. Die Adaptertests wurden deshalb übersprungen.
- Den Queue-Block an die Prettier-Formatierung des Projekts angepasst (Commit `57da42b`). Funktionale Logik dabei nicht verändert.
- Zusätzlich den doppelten Push-/Pull-Request-CI-Trigger entfernt (Commit `14fc7c7`), da beide Events dieselbe komplette Matrix starteten. Pushes auf `main` und `dev/**` bleiben aktiv.
- `STATUS.md` selbst wurde nach dieser Korrektur bereits mit Commit `30f15f3` aktualisiert. Der neue CI-Lauf für `57da42b` steht noch aus.
### 2026-11-11 – Doppelte CI-Läufe reduziert

- Der Workflow startete für jeden Commit auf `dev/**` sowohl einen Push-Lauf als auch einen Pull-Request-Lauf. Beide führten dieselbe Lint-Prüfung und sechs Plattform-/Node-Testjobs aus und konkurrierten um Runner.
- Den `pull_request`-Trigger entfernt. Pushes auf `main` und `dev/**` bleiben die maßgebliche CI-Ausführung; dadurch wird pro Commit im Entwicklungsbranch nur ein vollständiger Lauf gestartet.
- Der interne Draft-PR bleibt als Review-/Vergleichsansicht bestehen. Es wird kein PR an das Originalprojekt erstellt.
- Workflow-Commit `14fc7c7`; CI-Ergebnis für die Workflow-Änderung steht noch aus.
### 2026-11-11 – Schreibbefehle pro Gerät serialisiert

- Mehrere ioBroker-State-Änderungen konnten bisher parallel `setStateVal()` ausführen. Dadurch konnten mehrere `setAirconStat`-POSTs gleichzeitig laufen und ihre Antworten in nicht garantierter Reihenfolge den lokalen Gerätestatus überschreiben.
- Neue `deviceCommandQueues` serialisiert Änderungen je `airconId`: Ein Schreibvorgang einschließlich Antwortverarbeitung und Aktualisierung der ioBroker-States wird abgeschlossen, bevor der nächste Schreibvorgang desselben Geräts startet.
- Unterschiedliche Geräte bleiben voneinander unabhängig und können weiterhin parallel bzw. nacheinander im normalen Polling verarbeitet werden.
- Ein zusätzlicher Test simuliert zwei überlappende Änderungen desselben Geräts und prüft die Reihenfolge der übertragenen Zustände sowie die Bereinigung der Queue.
- Code-Commit `8b46092`, Test-Commit `08cf387`; CI-Ergebnis steht noch aus.
### 2026-11-11 – Wiederanmeldung nicht erreichbarer Geräte

- Geräte, deren Registrierung beim Adapterstart fehlschlägt, werden nicht in `this.devices` aufgenommen und wurden bisher deshalb nie erneut erkannt.
- Neue Methode `retryMissingDevices()`: prüft aktivierte Konfigurationseinträge, die noch keinem registrierten Gerät zugeordnet sind, und versucht die Registrierung erneut.
- Wiederholungsabstand nach fehlgeschlagener Registrierung: fünf Minuten, damit bei ausgeschalteten Geräten nicht bei jedem Polling-Durchlauf Fehler protokolliert werden.
- Bei erfolgreicher späterer Registrierung werden die ioBroker-Datenpunkte initialisiert; der normale Polling-Durchlauf kann das Gerät anschließend abfragen.
- Drei Tests decken erneuten Registrierungsversuch, Einhaltung des Fünf-Minuten-Abstands und Initialisierung nach erfolgreicher Wiederanmeldung ab.
- Code-Commit `275241a`, Test-Commit `b83cec1`; CI-Ergebnis steht noch aus.
### 2026-11-11 – Verbindungsstatus ohne aktivierte Geräte korrigiert

- `updateConnectionInfo()` meldete bisher `info.connection = true`, wenn kein Gerät aktiviert war: 0 aktivierte Geräte entsprach 0 Online-Geräten.
- Die Bedingung verlangt jetzt mindestens ein aktiviertes Gerät und eine exakte Übereinstimmung zwischen aktivierten und online registrierten Geräten.
- Vier Tests ergänzen die Fälle: kein Gerät aktiviert, nur ein Teil online, alle online sowie Ausfall eines einzelnen Geräts bei mehreren Geräten.
- Code-Commit `ced7817`, Test-Commit `61998d2`; GitHub-Actions-Prüfung steht noch aus.
### 2026-11-11 – Retry-Regeln für HTTP-Kommandos eingeschränkt

- Die bisherige globale Retry-Bedingung wiederholte jeden Axios-Fehler, auch permanente HTTP-4xx-/501-Fehler und schreibende POST-Kommandos.
- Neue Retry-Prüfung: Wiederholungen sind ausschließlich für `getDeviceInfo` und `getAirconStat` erlaubt, also für lesende Gerätekommandos.
- Bei diesen Lese-Kommandos werden Netzwerkfehler/Timeouts ohne HTTP-Antwort sowie HTTP 408, 425, 429, 500, 502, 503 und 504 wiederholt. Permanente Fehler wie HTTP 400 und 501 werden nicht wiederholt.
- `updateAccountInfo` und `setAirconStat` werden bewusst nicht automatisch wiederholt, weil es Schreibbefehle sind und eine erneute Übertragung nach Timeout sonst einen möglicherweise bereits ausgeführten Vorgang duplizieren könnte.
- Zwei Tests ergänzen die Retry-Prüfung: transiente Lese-Fehler werden zugelassen; Schreibbefehle, unbekannte Kommandos, fehlerhafte Requestdaten und permanente HTTP-Fehler werden abgewiesen.
- Änderungen in `main.js` und `main.test.js`; CI-Ergebnis steht noch aus.
### 2026-11-11 – Retry-Verhalten analysiert

- Die vorherige globale `axios-retry`-Konfiguration wiederholte pauschal alle Axios-Fehler bis zu viermal; die konkrete Einschränkung ist im Änderungsprotokoll dokumentiert.
- Die vier verwendeten Befehle wurden nach Funktion eingeordnet: `getDeviceInfo` und `getAirconStat` lesen; `updateAccountInfo` schreibt Kontoeinstellungen; `setAirconStat` überträgt den gewünschten Gesamtstatus.
- Die Wiederholung von `setAirconStat` könnte nach einem Timeout einen bereits ausgeführten Schreibvorgang erneut senden. Ob das Gerät diesen Befehl garantiert idempotent verarbeitet, ist derzeit nicht belegt.
- Ergänzende externe WF-RAC-Referenz (Reverse Engineering mit getrennt ausgewiesenen Evidenzstufen `[FW]`/`[HW]`) beschreibt die lokalen Endpunkte: `getDeviceInfo`, `getAirconStat`, `setAirconStat` und `updateAccountInfo`. Sie bestätigt, dass Antworten `result` und `contents` enthalten und dass `setAirconStat` den neuen Statusblob zurückliefert. Das stützt die Antwortvalidierung; es belegt aber nicht, dass ein wiederholtes `setAirconStat` in jedem möglichen Befehlsfall nebenwirkungsfrei ist.
- Ein dokumentierter Fremdprojekt-Fall zeigt außerdem HTTP 501 (`Not supported this command`) bei `setAirconStat`; ein solcher permanenter Fehler wird von der aktuellen pauschalen Retry-Bedingung ebenfalls erneut gesendet. Das ist ein klarer Grund, permanente Client-/Featurefehler künftig von transienten Transportfehlern zu unterscheiden.
- Die Retry-Regeln sind inzwischen auf lesende Kommandos beschränkt und durch Unit-Tests abgedeckt. Die reale Gerätekommunikation und die Auswirkungen auf Hardware müssen nach Installation weiterhin beobachtet werden.

### 2026-11-11 – Geräteantworten fachlich validieren

- Neue zentrale Prüfung `assertSuccessfulResponse()` ergänzt: Eine Geräteantwort gilt nur bei vorhandenem Response-Objekt und `result === 0` als erfolgreich.
- Registrierung, Account-Aktualisierung sowie Lese- und Schreibbefehle prüfen jetzt den fachlichen Result-Code.
- `getAirconStat` und `setAirconStat` prüfen zusätzlich, ob eine nichtleere `contents.airconStat` vorhanden ist, bevor der Decoder aufgerufen wird.
- Optionale Firmware-/Statusmetadaten werden mit sicheren Standardwerten übernommen, damit fehlende optionale Felder nicht die gesamte Statusaktualisierung abbrechen.
- Drei Tests ergänzen die Abweisung von fehlerhaften Result-Codes und stellen sicher, dass bei abgelehnten Lese-/Schreibbefehlen keine Statusdekodierung erfolgt.
- Die globale Retry-Strategie wurde bewusst noch nicht verändert: Alle Befehle verwenden POST; Wiederholungen könnten Gerätebefehle doppelt ausführen. Idempotenz und API-Verhalten müssen vor einer Änderung geklärt werden.
- Der erste CI-Lauf für diese Änderung scheiterte an acht ESLint-Fehlern (`prefer-template`). Die Stellen wurden auf Template-Strings umgestellt (Commit `8c3de84`).
- Im nachfolgenden CI-Lauf #11 sind `check-and-lint` sowie fünf der sechs Plattform-/Node-Testjobs erfolgreich. Nur `adapter-tests (24.x, macos-latest)` steht beim letzten Abruf noch in der Warteschlange; der Workflow ist daher noch nicht vollständig abgeschlossen.

### 2026-11-11 – Polling und Shutdown abgesichert

- `update()` fängt unerwartete Fehler je Gerät ab. Ein Fehler bei einem Gerät verhindert damit nicht mehr die Aktualisierung weiterer registrierter Geräte.
- Fehler bei der Aktualisierung von `info.connection` werden separat protokolliert, damit sie den Polling-Zyklus nicht abbrechen.
- Der Adapter setzt beim Shutdown `unloading`; ein noch laufender Polling-Durchlauf plant danach keinen neuen Timer mehr.
- Zwei Tests ergänzen `main.test.js`: Fortsetzung bei Fehler eines Geräts und kein erneutes Scheduling nach `onUnload()`.
- Keine Änderung an HTTP-Aufrufen, Retry-Konfiguration, Datenformaten oder Gerätebefehlen.
- Tests sind noch nicht ausgeführt. GitHub Actions meldet für den Fork weiterhin null Workflow-Runs; die Ursache ist über den verfügbaren Lesezugriff nicht geklärt.

### 2026-11-11 – Erste Stabilitätskorrektur

- `setStateVal()` prüft jetzt, ob die zugehörige Geräteinstanz noch registriert ist. Veraltete oder nicht mehr zuordenbare State-Änderungen werden mit einer Warnung ignoriert, statt beim Zugriff auf das Gerätemodell einen TypeError auszulösen.
- `onStateChange()` fängt Fehler aus der asynchronen Verarbeitung ab und protokolliert sie mit der betroffenen Datenpunkt-ID.
- Dummy-Test in `main.test.js` durch gezielte Tests für beide Fehlerpfade ersetzt.
- CI-Workflow so erweitert, dass Pushes auf `dev/**` ebenfalls die vorhandenen Prüfungen auslösen.
- Die CI ist über GitHub Actions aktiv. Pushes auf `dev/**` und Pull-Request-Ereignisse starten die Prüfungen.

### 2026-11-11 – Bestandsaufnahme

- Fork und Original geprüft; beide `main`-Branches waren identisch.
- Vollständigen Git-Baum mit 70 Einträgen erfasst.
- Entwicklungsbranch `dev/stability-error-handling` aus `main` erstellt.
- Projektstruktur, npm-Skripte, Test-Einstiegspunkte und CI-Workflow gesichtet.
- `STATUS.md` als erster Commit angelegt.
- Noch keine Änderungen am Laufzeitcode und keine Protokolländerungen vorgenommen.

### 2026-11-11 – Gerätemodell nach abgelehntem Schreibbefehl zurücksetzen

- Bei einem fehlgeschlagenen Schreibbefehl wird das zuvor bestätigte Feld in `device.airconStat` wiederhergestellt. Damit bleibt nicht nur der ioBroker-State, sondern auch das interne Gerätemodell auf dem letzten bestätigten Stand.
- Erfolgreiche Schreibvorgänge behalten das vom Gerät zurückgelieferte Statusmodell.
- Ein gezielter Test prüft die Wiederherstellung und dass bei abgelehntem Schreibbefehl keine States bestätigt publiziert werden.
- Keine Änderung an Protokollformat, Kodierung, CRC oder HTTP-Retry-Verhalten.
- CI-Prüfung für diesen Commit steht noch aus.

## Nächste Schritte

1. Nach Wiederaufnahme von macOS den nächsten vollständigen CI-Lauf für alle sechs Plattform-/Node-Kombinationen abwarten und dokumentieren.
2. HTTP-/Axios-Transportfehler, Timeout- und Retry-Verhalten getrennt untersuchen; POST-Wiederholungen nur mit belastbarer Idempotenzbewertung ändern.
3. Online-Zustände und `info.connection` bei mehreren Geräten gezielt testen.
4. `npm test`, `npm run check` und `npm run lint` für die nächste Codeänderung in CI auswerten; erst danach die nächste eng begrenzte Stabilitätskorrektur umsetzen.

## Pull-Request- und Release-Regeln

- Entwicklungsarbeit erfolgt auf Feature-/Arbeitsbranches, nicht direkt auf `main`.
- Commits erhalten aussagekräftige Nachrichten; jede Verhaltensänderung nennt Grund und Test.
- Vor einem PR: Branch mit aktuellem Fork-`main` vergleichen, Tests ausführen, `STATUS.md` aktualisieren und Änderungen auf unbeabsichtigte Protokoll-/Funktionsänderungen prüfen.
- PR-Ziel für Rückgaben an das Upstream-Projekt ist `hacki11/ioBroker.mhi-wfrac:main`; zunächst als Draft/Review anbieten.
- Keine Versionsnummer erhöhen und keinen Release-Tag setzen, solange kein abgestimmter Release ansteht.
# Projektstatus – ioBroker.mhi-wfrac

## Geprüfter Entwicklungsstand – 13.11.2026
- Fork: `Apropo1710/ioBroker.mhi-wfrac`; Original `hacki11/ioBroker.mhi-wfrac` bleibt unangetastet.
- Aktiver Entwicklungsbranch: `dev/stability-error-handling`; letzter Code-Commit vor der Dokumentationspflege: `bea3de278e6a68ca556c946fc9be97097202bcb3`. Die aktuelle Branch-Spitze besteht aus den unten genannten Dokumentations-Commits.
- Adapterversion laut `package.json`: **2.3.0**; kein Release erstellt.
- Letzter erfolgreicher Code-/Testlauf: „Test and Release“ #53 (Run `43093340834`) für Code-Commit `bea3de278e6a68ca556c946fc9be97097202bcb3`.
- Der Commit `56e3be59` enthielt ausschließlich Dokumentationsänderungen (`STATUS.md`, neue `TODO.md`). Workflow #54 (Run `43095501406`) für diesen Doku-Commit wurde abgebrochen; daher wird kein erfolgreicher CI-Lauf für diesen Commit behauptet.
- Keine Mitsubishi-Hardwaretests möglich/bestätigt: Klimaanlage noch nicht installiert, Adapter noch nicht produktiv eingerichtet.
- Diese Statuspflege ändert keinen Laufzeitcode und erstellt kein Release.


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

1. Bei der nächsten Codeänderung CI für den neuen Code-Commit vollständig abwarten; letzter erfolgreicher Code-/Teststand ist `bea3de2` (Run #53). Der abgebrochene Lauf #54 betraf ausschließlich Dokumentationsänderungen.
2. HTTP-/Axios-Transportfehler, Timeout- und Retry-Verhalten getrennt untersuchen; POST-Wiederholungen nur mit belastbarer Idempotenzbewertung ändern.
3. Online-Zustände und `info.connection` bei mehreren Geräten gezielt testen.
4. `npm test`, `npm run check` und `npm run lint` für die nächste Codeänderung in CI auswerten; erst danach die nächste eng begrenzte Stabilitätskorrektur umsetzen.

## Pull-Request- und Release-Regeln

- Entwicklungsarbeit erfolgt auf Feature-/Arbeitsbranches, nicht direkt auf `main`.
- Commits erhalten aussagekräftige Nachrichten; jede Verhaltensänderung nennt Grund und Test.
- Vor einem PR: Branch mit aktuellem Fork-`main` vergleichen, Tests ausführen, `STATUS.md` aktualisieren und Änderungen auf unbeabsichtigte Protokoll-/Funktionsänderungen prüfen.
- PR-Ziel für Rückgaben an das Upstream-Projekt ist `hacki11/ioBroker.mhi-wfrac:main`; zunächst als Draft/Review anbieten.
- Keine Versionsnummer erhöhen und keinen Release-Tag setzen, solange kein abgestimmter Release ansteht.

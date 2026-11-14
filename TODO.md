# TODO – ioBroker.mhi-wfrac

## Aktueller Stand – 14.11.2026, nach CI-Run 43566084967

- [x] js-controller-Mindestversion auf `>=7.2.0` festgelegt.
- [x] `@iobroker/adapter-core` auf `^3.4.3` aktualisiert.
- [x] Lockdatei einschließlich der Peer-Abhängigkeiten durch erfolgreichen `npm ci`-Lauf validiert.
- [x] Vollständige aktuelle CI erfolgreich: Check/Lint sowie Ubuntu und Windows mit Node.js 22, 24 und 26 (Run [43566084967](https://github.com/Apropo1710/ioBroker.mhi-wfrac/actions/runs/43566084967)).
- [ ] `npm run check` separat untersuchen; ein früherer Lauf meldete Typfehler in `main.js` und `main.test.js`. Der grüne ioBroker-Check-/Lint-Job ersetzt diesen TypeScript-Check nicht.
- [ ] Verbleibende Softwarefehlerpfade in Registrierung, Polling und State-Verarbeitung gezielt prüfen. Änderungen nur bei konkret reproduzierbarem Fehler und mit Regressionstest.
- [ ] E4048 aus Original-Issue #40 offen halten, bis eine gültige Maintainer-E-Mail für `W0w3` verifiziert ist.
- [x] Branchvergleich durchgeführt: `main` ist geschützt; Entwicklungsarbeit erfolgt ausschließlich auf `dev/stability-error-handling`. Keine Zusammenführung. Der zusätzliche Commit auf `main` entfernt den alten Dependabot-Auto-Merge-Workflow; die Datei ist im aktuellen Entwicklungszweig ebenfalls nicht vorhanden.
- Adapterversion bleibt **2.3.0**. Kein Release, keine Änderung am Originalrepository oder Fork-`main`.
- Fork-PR #1 bleibt als Draft offen und dient nur als CI-Prüfkanal innerhalb des Forks.
- Der zusätzliche Testbranch `dev/test-adapter-core-compat` wurde entfernt; übrig bleiben `main` und `dev/stability-error-handling`.

---

## Abgleich der offenen Original-Issues und PRs – 14.11.2026
- [x] Issue #34 / PR #39: Retry-Fehler und Verbindungsbehandlung im Fork behoben; die Korrekturen umfassen Retry-Konfiguration, Wiederregistrierung, sichere State-Verarbeitung, getrennte State-Publishing-Fehler und serialisierte Gerätezugriffe. Build #86 erfolgreich.
- [x] PR #38: Gerät erst nach drei aufeinanderfolgenden fehlgeschlagenen Polls offline melden; Erholung wird erkannt. Build #86 erfolgreich.
- [x] Issue #35 / PR #37: Node.js 26 geprüft und in Ubuntu-/Windows-Testmatrix aufgenommen; engines.node ist bereits >= 22. Build #85 erfolgreich.
- [x] Issue #40 – E0036: @iobroker/testing auf ^6.3.2 aktualisiert; package-lock.json enthält exakt 6.3.2. npm ci, npm run test:integration (1 passing) und npm run lint erfolgreich im Run 43523169063. Die vollständige Ubuntu-/Windows-Matrix mit Node 22/24/26 war für den vorherigen Commit 6be8872 erfolgreich, nicht erneut für den Paketcommit f709e8d. [ ] E4048 bleibt offen: gültige Maintainer-E-Mail für W0w3 fehlt und wird nicht erfunden. adapter-core-Warnung bleibt zurückgestellt; siehe Abschnitt D.
- [x] PR #43 / Dependabot-Auto-Merge: im Fork nicht anwendbar, da im Entwicklungsbranch kein Auto-Merge-Workflow existiert, den PR #43 aktualisieren müsste. Nicht übernommen; Original bleibt unverändert.
- Keine weiteren Wartungsarbeiten ohne konkreten Bezug zu einem offenen Original-Issue/PR.

## Verbindlicher Arbeitsumfang ab 13.11.2026

- [ ] Offene und relevante Issues/PRs des Originalprojekts sichten und priorisieren.
- [ ] Fehler aus diesen Issues/PRs gezielt im Fork beheben; jede Änderung mit Referenz auf Issue/PR dokumentieren und testen.
- [ ] Korrekturen erst nach erfolgreicher CI als erledigt betrachten.
- Keine davon unabhängigen Paketupdates, CI-/Node-Matrix-Erweiterungen, Optimierungen, Refactorings oder sonstigen Wartungsarbeiten.
- Die unten aufgeführten allgemeinen Wartungs- und Kompatibilitätspunkte sind bis auf Weiteres zurückgestellt. Sie werden nur wieder aufgenommen, wenn sie zur Behebung eines konkreten Issues/PRs zwingend nötig sind.

> **Aktueller Branch-/CI-Stand (14.11.2026):** Paketcommit `f709e8dcc2ae457775d7bf5de923ad6fc91953e7` aktualisiert @iobroker/testing auf 6.3.2. npm ci, Integrationstest und Lint sind für diesen Commit erfolgreich. Die vollständige offizielle Matrix (Ubuntu/Windows, Node 22/24/26) ist für den Vorgängercommit `6be8872355c73b8949a184b2cf0defa7a4f7a8a2` in Run `43523169051` erfolgreich; sie wurde für den Paketcommit nicht erneut ausgelöst. macOS ist auf Nutzerwunsch vorübergehend pausiert.

> **Branchvergleich:** `dev/stability-error-handling` und `main` sind divergent. `main` enthält zusätzlich einen Commit zur Entfernung des alten Dependabot-Auto-Merge-Workflows. Nicht ungeprüft mergen.

> **Aktuelle Protokoll-Testabdeckung:** Build #82 prüft eine aufgezeichnete Statusantwort, Build #83 die Befehlsbytes und Build #84 die CRCs beider Blöcke einer aufgezeichneten echten Schreib-Nutzlast. Das ist Softwaretestabdeckung anhand historischer Daten, kein Hardwaretest und keine vollständige Verifikation aller Betriebsarten.

Stand: 2026-11-14

Diese Liste trennt Arbeiten ohne Hardware von Prüfungen, die erst mit einer installierten und erreichbaren Mitsubishi-Heavy-Anlage belastbar möglich sind. Hardwareabhängige Punkte bleiben offen, bis echte Gerätedaten vorliegen. Keine Protokoll- oder Befehlsänderung allein aufgrund statischer Vermutungen.

- [x] Fehler der optionalen `update_account_info()`-Anfrage von der Geräteerkennung trennen; ein erreichbares Gerät bleibt bei diesem Zusatzfehler online.

## A. Sobald eine echte Anlage installiert und erreichbar ist

### A1 – Referenzdaten und Geräteerkennung
- [ ] Modell, Geräte-ID, MAC-Adresse, AP-Modus und Firmware-Version(en) dokumentieren.
- [ ] Tatsächliche API-Variante (HTTP/HTTPS) und Verhalten der Erkennung prüfen.
- [ ] Beispielantworten von `getDeviceInfo` und `getAirconStat` sichern; Netzwerk-/Gerätekennungen vor Weitergabe anonymisieren.
- [ ] Statusantworten in unterschiedlichen Betriebszuständen erfassen: Aus, Kühlen, Heizen, Lüften, Entfeuchten sowie Auto, soweit unterstützt.
- [ ] Antwortgrößen, Base64-Dekodierung und Paket-/Segmentstruktur anhand echter Antworten dokumentieren.
- [ ] Prüfen, ob Betriebszustände, Modelle oder Firmwarestände unterschiedliche gültige Paketlängen liefern.

### A2 – Decoder und Datenvalidierung
- [ ] `lib/AirconStatCoder.js` mit echten Referenzantworten prüfen, insbesondere positionsbasierte Zugriffe und Berechnung von `dataStart`.
- [ ] Mindestlängen und Strukturbedingungen aus realen gültigen Antworten ableiten; keine willkürliche feste Länge einführen.
- [ ] Tests für zu kurze, abgeschnittene, leere, fehlerhafte und strukturell unplausible Antworten ergänzen.
- [ ] Prüfen, ob unbekannte/optionale Segmente toleriert werden und fehlende Temperatur-/Energie-Extensions sauber behandelt werden.
- [ ] Dekodierte Werte mit Fernbedienung bzw. Geräte-App vergleichen: Temperaturen, Modus, Lüfter, Lamellen, Fehlercode und Energie.
- [ ] Erst nach belegten Referenzfällen Decoderkorrekturen umsetzen und Regressionstests mit anonymisierten Antworten ergänzen.

### A3 – Schreibbefehle und Rücklesen
- [ ] Vor jedem Schreibtest Ausgangszustand erfassen und nur eine Einstellung auf einmal ändern.
- [ ] Ein/Aus, Betriebsmodus, Solltemperatur, Lüfterstufe sowie vertikale/horizontale Luftführung einzeln testen, soweit unterstützt.
- [ ] Nach jedem erfolgreichen `setAirconStat` Antwortstatus und nächste `getAirconStat`-Antwort vergleichen.
- [ ] Prüfen, ob das Gerät Werte normalisiert oder nicht unterstützte Einstellungen zurückweist.
- [ ] Negative Antworten und Timeout-Fälle dokumentieren. Bei Timeout nicht blind erneut schreiben: erst Status abfragen.
- [ ] Prüfen, ob fachliche `result`-Fehler korrekt als fehlgeschlagen behandelt werden.
- [ ] Keine automatischen Wiederholungen schreibender Befehle aktivieren, solange deren Idempotenz nicht belegt ist.

### A4 – Langzeit-, Verbindungs- und Mehrgeräteverhalten
- [ ] Polling über mehrere Stunden/Tage beobachten: Antwortzeiten, Timeouts, Speicher-/CPU-Verhalten und Aktualisierungsintervalle.
- [ ] Anlage während des Pollings ausschalten bzw. Netzwerkverbindung unterbrechen und Wiederanmeldung prüfen.
- [ ] Online-Status, `info.connection` und Datenpunkte bei einem und mehreren Geräten prüfen.
- [ ] Adapter-Neustart bei erreichbarer und nicht erreichbarer Anlage testen.
- [ ] WLAN-/Router-Neustart und IP-Änderung testen; Verhalten der konfigurierten IP dokumentieren.
- [ ] Adapter-Shutdown während einer laufenden Anfrage prüfen; keine neuen Polling-Zyklen nach Shutdown.
- [ ] Bei mehreren Anlagen sicherstellen, dass ein nicht erreichbares Gerät andere Geräte nicht blockiert.

### A5 – Gerätefunktionen, Timer und Zeitpläne
- [ ] Vorhandene Datenpunkte und Funktionen mit dem realen Gerätemodell abgleichen.
- [ ] Timer, Zeitsteuerung und Wochenpläne auflisten und prüfen, welche Funktionen die lokale API tatsächlich anbietet.
- [ ] Zeit-/Timer-Datenpunkte auf Lesbarkeit, Schreibbarkeit, Wertebereiche sowie Zeitzonen-/Sommerzeitverhalten prüfen.
- [ ] Nicht verfügbare Funktionen klar dokumentieren, statt unbelegte Steuerungsmöglichkeiten vorzutäuschen.
- [ ] Änderungen zunächst mit ungefährlichen Zeit-/Sollwerten testen und Rücklesen verifizieren.

## B. Ohne angeschlossene Anlage – laufende Softwarearbeit
- [x] Kurzzeitige Polling-Ausfälle tolerieren: erst nach drei aufeinanderfolgenden fehlgeschlagenen Lese-Polls offline setzen; Erholung zurücksetzen und einmalig melden. Schreibfehler bleiben unverändert.
- [x] State-Publishing- und State-Initialisierungsfehler von Geräte-Kommunikationsfehlern trennen: ioBroker-Schreib-/Initialisierungsfehler protokollieren, aber das erreichbare Gerät nicht offline setzen.
- [x] Axios-Retry-Override korrigieren: normale Requests überschreiben die globale Retry-Konfiguration nicht mehr; `disableRetry: true` setzt weiterhin explizit `retries: 0`. Regressionstests ergänzt.
- [x] Decoder-Ausnahmen zählen korrekt als Polling-Fehler; der Fehlerzähler wird erst nach erfolgreichem Dekodieren zurückgesetzt. Regressionstests für Schwelle und Erholung ergänzt.
- [x] Bereits identifizierte Fehlerpfade mit Regressionstests absichern: Polling, State-Publishing/-Initialisierung, Startregistrierung, geräteweise Wiederanmeldung und Shutdown-Cleanup.
- [ ] Verbleibende unerwartete Fehlerpfade in Registrierung, Polling und State-Verarbeitung weiter prüfen und gezielt testen.
- [x] Doppelte konfigurierte IP-Adressen bzw. doppelte Geräte-IDs absichern: doppelte IPs werden nicht erneut registriert und zählen als ein Endpunkt; kollidierende `airconId`-Werte überschreiben kein bereits registriertes Gerät. Regressionstests ergänzt.
- [x] Laufzeit-Konfigurationsänderungen geprüft: ioBroker-Adapterinstanzen laufen als eigene Prozesse; die Konfiguration wird beim `ready`-Start geladen. Änderungen an der Instanzkonfiguration erfordern den Neustart der Instanz. Daher ist für IP-/Enabled-Änderungen kein zusätzlicher Laufzeit-Event-Handler erforderlich. Bei Änderung während des Betriebs wird die neue Konfiguration nach dem Neustart verarbeitet.
- [x] State-Publishing-Fehler geprüft: Fehler werden separat protokolliert und setzen ein erreichbares Gerät nicht offline; Regressionstest vorhanden.
- [x] Testabdeckung und CI aktuell halten; Ubuntu/Windows mit Node 22/24 und Lint aktiv. macOS ist auf Nutzerwunsch vorübergehend pausiert und nach der Beobachtungsphase wieder aufzunehmen.
- [ ] Den einen zusätzlichen Commit auf Fork-`main` (Entfernung des alten Dependabot-Auto-Merge-Workflows) separat gegen den Entwicklungsbranch prüfen und bewusst übernehmen oder verwerfen; Original nicht ohne Abstimmung ändern.

## C. Vor Release oder Upstream-Pull-Request
- [ ] Hardwareabhängige Punkte bewerten und offene Einschränkungen dokumentieren.
- [ ] `npm test`, `npm run check` und `npm run lint` erfolgreich prüfen.
- [ ] Linux, Windows und macOS mit Node 22/24 erfolgreich prüfen.
- [ ] `STATUS.md` und diese TODO-Liste aktualisieren.
- [ ] Änderungen gegen Fork-`main` prüfen; keine unbeabsichtigten Protokoll-, Konfigurations- oder Datenpunktänderungen.
- [ ] PR an das Original erst nach ausdrücklicher Abstimmung vorbereiten. Kein automatischer Release und keine Versionsanhebung ohne Freigabe.

## Beobachtungen – noch keine bestätigten Fehler
- Der Decoder arbeitet mit festen Bytepositionen. Ob kurze oder abweichende Antworten tatsächlich fehlerhaft durchlaufen, muss anhand realer Antworten und Tests geklärt werden.
- Unterschiede zwischen Gerätemodellen und Firmwareständen sind noch nicht ausreichend durch eigene Hardware-Referenzdaten belegt.
- Die Nebenwirkungsfreiheit wiederholter Schreibbefehle ist nicht belegt; schreibende Requests werden daher nicht automatisch wiederholt.

## D. Zurückgestellte Kompatibilitäts- und Wartungsarbeiten – nicht Teil des aktuellen Auftrags
- [x] Node.js 26 in die Ubuntu-/Windows-Testmatrix aufnehmen; Build #85 vollständig erfolgreich.
- [x] `ioBroker/testing-action-check` auf die veröffentlichte v2.0.1 aktualisieren; Build #86 vollständig erfolgreich, einschließlich Check-/Lint-Job und aller sechs Adapter-Testjobs.
- [x] `@iobroker/testing` auf `^6.3.2` aktualisieren und Lockdatei reproduzierbar regenerieren. Paketcommit `f709e8d`; npm ci, Integrationstest und Lint erfolgreich. Die Bibliothek 6.3.2 verlangt Node.js >=22.19.0; die CI-Matrix verwendet Node 22/24/26. Die vollständige Matrix wurde für den direkten Vorgängercommit erfolgreich ausgeführt, nicht erneut für den Paketcommit.
- [x] `@iobroker/adapter-core` auf 3.4.3 aktualisiert und js-controller-Mindestversion auf >=7.2.0 angehoben. Die Peer-Abhängigkeit `@iobroker/js-controller-common-db >=7.2.2` ist dokumentiert; Installations-/CI-Verifikation des neuen Commits steht noch aus.
- [ ] Veröffentlichte v2-Versionen der Adapter-Test- und Deploy-Actions beobachten; aktuell bleiben beide auf v1.

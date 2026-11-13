# TODO – ioBroker.mhi-wfrac

> **Aktueller CI-/Branchhinweis (13.11.2026):** Aktiver Branch `dev/stability-error-handling`; vor der aktuellen Workflowänderung stand der Branch auf `ca957bb`. Build #59 (Run `43412100181`) ist vollständig erfolgreich: Lint sowie Ubuntu, Windows und macOS jeweils mit Node 22/24. Reine Markdown-/`docs/`-Änderungen werden künftig per `paths-ignore` aus dem CI-Trigger ausgeschlossen; gemischte Commits laufen weiterhin durch die vollständige Matrix.


Stand: 2026-11-13

Diese Liste trennt Arbeiten ohne Hardware von Prüfungen, die erst mit einer installierten und erreichbaren Mitsubishi-Heavy-Anlage belastbar möglich sind. Hardwareabhängige Punkte bleiben offen, bis echte Gerätedaten vorliegen. Keine Protokoll- oder Befehlsänderung allein aufgrund statischer Vermutungen.

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
- [ ] Weitere Fehlerpfade in Registrierung, Polling, State-Publishing und Shutdown mit gemockten Tests abdecken.
- [ ] Doppelte konfigurierte IP-Adressen bzw. doppelte Geräte-IDs untersuchen und erwartetes Verhalten festlegen.
- [ ] Verhalten bei geänderter oder deaktivierter Gerätekonfiguration während der Laufzeit untersuchen.
- [ ] Prüfen, ob Fehler beim Publizieren von ioBroker-States Geräte-/Verbindungsstatus konsistent aktualisieren.
- [x] Testabdeckung und CI aktuell halten; macOS ist wieder in der Pflichtmatrix (Node 22/24); vollständiger Lauf #58 erfolgreich.
- [ ] Dependabot-/Workflow-Reste im Fork und Zielbranch getrennt behandeln; Original nicht ohne Abstimmung ändern.

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

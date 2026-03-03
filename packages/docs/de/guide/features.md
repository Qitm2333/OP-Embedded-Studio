# Funktionen

## Warum OpenPencil

Design-Tools sind ein Lieferkettenproblem. Wenn Ihr Tool proprietär ist, bestimmt der Anbieter, was möglich ist — er kann Ihre Automatisierung über Nacht brechen. OpenPencil ist eine Open-Source-Alternative: MIT-lizenziert, Figma-kompatibel, vollständig lokal und programmierbar.

## Figma .fig-Datei Import & Export

Öffnen und speichern Sie native Figma-Dateien direkt. Der Import dekodiert das vollständige 194-Definitionen-Kiwi-Schema einschließlich NodeChange-Nachrichten mit ~390 Feldern. Der Export kodiert den Szenengraphen zurück in Kiwi-Binärformat mit Zstd-Kompression und Thumbnail-Generierung. Speichern (<kbd>⌘</kbd><kbd>S</kbd>) und Speichern unter (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>) verwenden native OS-Dialoge in der Desktop-App. Die Import/Export-Pipeline unterstützt Round-Trip-Treue.

## Kopieren & Einfügen mit Figma

Knoten in Figma auswählen, <kbd>⌘</kbd><kbd>C</kbd>, zu OpenPencil wechseln, <kbd>⌘</kbd><kbd>V</kbd> — sie erscheinen mit Füllungen, Konturen, Auto-Layout, Text, Eckenradien, Effekten und Vektornetzwerken. Funktioniert auch umgekehrt.

## Vektornetzwerke

Das Stiftwerkzeug verwendet Figmas Vektornetzwerk-Modell — keine einfachen Pfade. Klicken für Eckpunkte, Klicken+Ziehen für Bézier-Kurven mit Tangentengriffen. Offene und geschlossene Pfade werden unterstützt.

## Formwerkzeuge

Die Werkzeugleiste bietet alle grundlegenden Figma-Formwerkzeuge: Rechteck (<kbd>R</kbd>), Ellipse (<kbd>O</kbd>), Linie (<kbd>L</kbd>), Polygon und Stern. Alle Formen unterstützen Füllung, Kontur, Hover-Hervorhebung und Auswahlumriss.

## Auto-Layout

Yoga WASM bietet CSS-Flexbox-Layout. Frames unterstützen:

- **Richtung** — horizontal, vertikal, Umbruch
- **Abstand** — Zwischenraum zwischen Kindern
- **Polsterung** — einheitlich oder pro Seite
- **Ausrichtung** — Start, Mitte, Ende, Zwischenraum
- **Querachse** — Start, Mitte, Ende, Dehnen
- **Kindgröße** — fest, füllen, anpassen

Shift+A schaltet Auto-Layout um oder umschließt ausgewählte Knoten.

## Inline-Textbearbeitung

Canvas-native Textbearbeitung — kein DOM-Textarea-Overlay. Doppelklicken Sie auf einen Textknoten, um den Bearbeitungsmodus zu betreten. Der Canvas rendert einen blinkenden Cursor, blaue Auswahlrechtecke und einen blauen Umriss.

**Schriftart-Auswahl** mit virtuellem Scrollen, Suchfilter und CSS-Schriftvorschau. In Tauri werden Systemschriften über Rusts `font-kit`-Crate aufgelistet.

## Rich-Text-Formatierung

Zeichenweise Formatierung innerhalb eines Textknotens. <kbd>⌘</kbd><kbd>B</kbd> für fett, <kbd>⌘</kbd><kbd>I</kbd> für kursiv, <kbd>⌘</kbd><kbd>U</kbd> für unterstrichen. Rich-Text-Formatierung bleibt bei .fig-Import/Export erhalten.

## Rückgängig/Wiederherstellen

Jede Operation ist rückgängig machbar. Das System verwendet ein Inverse-Command-Muster. <kbd>⌘</kbd><kbd>Z</kbd> macht rückgängig, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> stellt wieder her.

## Fanglinien

Kanten- und Mittenfang mit roten Führungslinien bei ausgerichteten Knoten. Rotationsbewusst.

## Canvas-Lineale

Lineale an den oberen und linken Kanten zeigen Koordinatenskalen. Bei Auswahl eines Knotens werden Position und Koordinaten-Badges angezeigt.

## Farbauswahl & Fülltypen

HSV-Farbauswahl mit Farbton-Schieberegler, Alpha-Schieberegler, Hex-Eingabe und Deckkraftsteuerung. Fülltypen: Vollfarbe, Verlauf (Linear, Radial, Winkel, Diamant) und Bild.

## Ebenen-Panel

Baumansicht der Dokumenthierarchie mit Reka UI Tree-Komponente. Aufklappen/Zuklappen, Ziehen zum Umordnen, Sichtbarkeit pro Knoten umschalten.

## Eigenschafts-Panel

Registerkarten-Oberfläche mit **Design** | **Code** | **KI**-Tabs.

Der **Design**-Tab zeigt kontextsensitive Abschnitte: Darstellung, Füllung, Kontur, Effekte, Typografie, Layout, Position, Export und Seite.

Der **Code**-Tab zeigt JSX-Export der Auswahl. Der **KI**-Tab bietet eine KI-Chat-Oberfläche.

## Gruppieren/Entgruppieren

⌘G gruppiert ausgewählte Knoten. ⇧⌘G entgruppiert.

## Sektionen

Sektionen (<kbd>S</kbd>) sind organisatorische Container auf der obersten Ebene des Canvas.

## Mehrseitige Dokumente

Dokumente unterstützen mehrere Seiten wie Figma. Jede Seite hat einen unabhängigen Viewport-Zustand.

## Hover-Hervorhebung

Knoten werden beim Überfahren mit einem formgerechten Umriss hervorgehoben.

## Komponenten & Instanzen

Erstellen Sie wiederverwendbare Komponenten aus Frames oder Auswahlen (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>). Live-Synchronisation, Override-Unterstützung und Komponenten-Sets (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>).

## Variablen

Design-Token als Variablen mit Sammlungen und Modi. Unterstützt COLOR-Typ mit vollständiger UI, FLOAT/STRING/BOOLEAN definiert. Organisieren Sie Variablen in Sammlungen, definieren Sie Modi (z.B. Hell/Dunkel).

## Bildexport

Ausgewählte Knoten als PNG, JPG oder WEBP exportieren. Skalierung von 0,5× bis 4×, Formatauswahl und Live-Vorschau.

## Kontextmenü

Rechtsklick auf dem Canvas öffnet ein Figma-ähnliches Kontextmenü mit Zwischenablage, Z-Reihenfolge, Gruppierung, Komponenten- und Sichtbarkeitsaktionen.

## Web- & Desktop-App

OpenPencil läuft im Browser unter [app.openpencil.dev](https://app.openpencil.dev). Die Desktop-App verwendet eine Tauri v2-Shell (~5 MB).

## App-Menü (Browser)

Im Browser-Modus bietet eine mit reka-ui Menubar erstellte Menüleiste Zugriff auf alle wichtigen Editor-Aktionen. Sechs Menüs: **Datei**, **Bearbeiten**, **Ansicht**, **Objekt**, **Text**, **Anordnen**.

## Automatisches Speichern

Dateien werden 3 Sekunden nach der letzten Szenenänderung automatisch gespeichert.

## KI-Chat

Integrierter KI-Assistent über den KI-Tab oder <kbd>⌘</kbd><kbd>J</kbd>. Kommuniziert direkt mit OpenRouter. **29 Werkzeuge** für Lesen, Erstellen, Ändern und Organisieren von Design-Elementen. **MCP-Server** für externe KI-Coding-Tools.

## @open-pencil/core & CLI

Die Engine ist in `packages/core/` extrahiert. CLI bietet headless .fig-Dateioperationen:

- `open-pencil info <file>` — Dokumentstatistiken
- `open-pencil tree <file>` — visueller Knotenbaum
- `open-pencil find <file>` — Suche nach Name/Typ
- `open-pencil export <file>` — Rendern als PNG/JPG/WEBP
- `open-pencil eval <file>` — JavaScript mit Figma Plugin API ausführen

Alle Befehle unterstützen `--json` für maschinenlesbare Ausgabe.

## Codequalität

Copy-Paste-Erkennung via jscpd — projektweite Duplikation von 15,6% auf 0,62% reduziert.

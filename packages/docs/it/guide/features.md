# Funzionalità

## Perché OpenPencil

I tool di design sono un problema di catena di fornitura. Quando il tuo strumento è proprietario, il fornitore controlla cosa è possibile. OpenPencil è un'alternativa open-source: licenza MIT, compatibile con Figma, completamente locale e programmabile.

## Import & export file .fig di Figma

Apri e salva file nativi di Figma direttamente. L'import decodifica lo schema completo Kiwi a 194 definizioni. L'export codifica il grafo della scena in formato binario Kiwi con compressione Zstd e generazione thumbnail.

## Copia e incolla con Figma

Seleziona nodi in Figma, <kbd>⌘</kbd><kbd>C</kbd>, passa a OpenPencil, <kbd>⌘</kbd><kbd>V</kbd> — appaiono con riempimenti, contorni, auto-layout, testo, raggi degli angoli, effetti e reti vettoriali. Funziona anche al contrario.

## Reti vettoriali

Lo strumento penna usa il modello di rete vettoriale di Figma. Click per punti angolari, click+trascinamento per curve di Bézier.

## Strumenti forma

Rettangolo (<kbd>R</kbd>), Ellisse (<kbd>O</kbd>), Linea (<kbd>L</kbd>), Poligono e Stella. Tutti supportano riempimento, contorno ed effetti.

## Auto-layout

Yoga WASM fornisce il layout CSS flexbox. Direzione, gap, padding, allineamento e dimensionamento figli. Shift+A attiva/disattiva l'auto-layout.

## Modifica testo inline

Modifica testo nativa nel canvas. Doppio click su un nodo testo per entrare in modalità modifica. Selettore font con scroll virtuale e ricerca.

## Formattazione rich text

Formattazione per carattere: <kbd>⌘</kbd><kbd>B</kbd> grassetto, <kbd>⌘</kbd><kbd>I</kbd> corsivo, <kbd>⌘</kbd><kbd>U</kbd> sottolineato. Preservata nell'import/export .fig.

## Annulla/Ripristina

Ogni operazione è annullabile. Pattern inverse-command. <kbd>⌘</kbd><kbd>Z</kbd> annulla, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> ripristina.

## Guide di snap

Snap ai bordi e al centro con linee guida rosse. Consapevole della rotazione.

## Righelli canvas

Righelli in alto e a sinistra mostrano le scale delle coordinate.

## Selettore colore e tipi di riempimento

Selezione HSV con cursore tonalità, cursore alfa, input hex. Tipi: colore solido, gradiente, immagine.

## Pannello livelli

Vista ad albero della gerarchia del documento. Espandi/comprimi, trascina per riordinare, attiva/disattiva visibilità.

## Pannello proprietà

Tab **Design** | **Codice** | **IA**. Design mostra sezioni contestuali.

## Componenti e istanze

Componenti riutilizzabili con sincronizzazione live, override e set di componenti.

## Variabili

Token di design come variabili con collezioni e modalità. Supporto colore, float, stringa, booleano.

## Export immagini

PNG, JPG, WEBP con scala da 0,5× a 4× e anteprima live.

## Menu contestuale

Click destro per azioni su appunti, ordine Z, raggruppamento, componenti e visibilità.

## App web e desktop

Browser su [app.openpencil.dev](https://app.openpencil.dev). Desktop con Tauri v2 (~5 MB).

## Menu app (browser)

Barra dei menu con reka-ui: File, Modifica, Visualizza, Oggetto, Testo, Disponi.

## Salvataggio automatico

File salvati automaticamente 3 secondi dopo l'ultima modifica.

## Chat IA

Assistente IA integrato con 29 strumenti. Server MCP per strumenti di coding IA esterni.

## @open-pencil/core e CLI

CLI headless: info, tree, find, export, analyze, eval. Tutti i comandi supportano `--json`.

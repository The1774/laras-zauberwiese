// =====================================================
// Bella und die Zauberwiese – zentrale Konfiguration
// -----------------------------------------------------
// Hier können Sprites, Farben, Größen und Spielwerte
// angepasst werden, ohne den restlichen Code zu ändern.
// Sollen später echte PNG-Sprites verwendet werden,
// trägt man hier Bildpfade ein und passt nur die
// Zeichenfunktionen in entities.js / player.js an.
// =====================================================

const KONFIG = {
    // Interne Spielauflösung (wird per CSS passend skaliert)
    BREITE: 960,
    HOEHE: 540,

    // Oberkante des Bodens (der Wiese)
    BODEN_Y: 460,

    // Physik – bewusst sanft eingestellt (für 5 Jahre!)
    SCHWERKRAFT: 0.55,   // wie schnell Bella wieder herunterfällt
    SPRUNGKRAFT: -13.5,  // wie hoch Bella springt
    LAUFTEMPO: 4.0,      // wie schnell Bella läuft

    // Frei-Schwimmen (nur im Wasser-Level mit Flag schwimmen:true):
    // Drücken = auftauchen, loslassen = sanft sinken.
    SCHWIMM_AUFTRIEB: 0.55, // Schub nach oben beim Drücken
    SCHWIMM_SINK: 0.30,     // sanftes Absinken ohne Drücken
    SCHWIMM_MAX: 4.2,       // höchste Auf-/Ab-Geschwindigkeit
    WASSER_OBEN: 80,        // Wasseroberfläche (so weit kann man hoch)

    // Eisrutsche (Level mit eis:true): ab rutschAb geht es automatisch
    // nur noch vorwärts – dann zählt nur noch Springen.
    RUTSCH_TEMPO: 6.6,      // Tempo auf der Rutsche (schneller als Laufen)

    // Unverwundbarkeit nach einem Treffer (in Frames, 60 ≈ 1 Sekunde)
    UNVERWUNDBAR_DAUER: 90,

    // Sternen-Turbo: Nach dem Einsammeln eines Sterns rennt
    // Bella kurz schneller (Dauer in Frames, 240 ≈ 4 Sekunden)
    TURBO_DAUER: 240,
    TURBO_FAKTOR: 1.5,

    MAX_HERZEN: 3, // Standard (Normal); je Schwierigkeit überschrieben

    // ---------- Schwierigkeitsstufen ----------
    // Werden auf dem Startbildschirm gewählt und gespeichert.
    //   herzen      = Start-/Maximal-Herzen
    //   gegnerTempo = Faktor für Lauf-/Flug-Tempo der Gegner
    //   wurfPause   = Faktor für die Pause zwischen Würfen/Tropfen
    //                 (größer = seltener = leichter)
    //   unverwundbar= Faktor für die Schutzzeit nach einem Treffer
    //                 (größer = länger geschützt = leichter)
    SCHWIERIGKEITEN: {
        leicht: { name: 'Leicht', emoji: '🧸', herzen: 5, gegnerTempo: 0.7, wurfPause: 1.5, unverwundbar: 1.4 },
        normal: { name: 'Normal', emoji: '🦄', herzen: 3, gegnerTempo: 1.0, wurfPause: 1.0, unverwundbar: 1.0 },
        schwer: { name: 'Schwer', emoji: '🔥', herzen: 2, gegnerTempo: 1.4, wurfPause: 0.7, unverwundbar: 0.8 }
    },
    SCHWIERIGKEIT_STANDARD: 'normal',

    // Boss-Level (Grummelwolke): So viele Regenbogen-Strahlen muss
    // Bella treffen, dann lacht die Wolke wieder. Bewusst niedrig
    // gehalten – es soll Spaß machen, nicht anstrengen.
    BOSS_TREFFER: 9,

    // Bella kann nur schießen, wenn sie Regenbogen-Energie hat. Energie
    // sammelt sie, indem sie die bunten Funken der Wolke einfängt.
    // So viele Schüsse kann sie maximal "auf Vorrat" haben:
    BOSS_ENERGIE_MAX: 3,

    // Punkte
    PUNKTE_BLUME: 10,
    PUNKTE_STERN: 50,
    PUNKTE_BOSS_TREFFER: 20, // Punkte je Regenbogen-Treffer auf die Wolke
    PUNKTE_LEVEL: 100, // Bonus für ein geschafftes Level

    // ---------- Sprites (Emojis) ----------
    SPRITES: {
        bella: '🦄',
        blumen: ['🌸', '🌷', '🌺'],
        hindernisse: ['🍄', '🌵', '🪨'],
        stern: '⭐',
        herz: '💖',
        ziel: '🌈',
        wolke: '☁️',
        schmetterling: '🦋',
        glitzer: ['✨', '💖', '🌟', '💜'],
        herzVoll: '💗',
        herzLeer: '🤍'
    },

    // Größe (Schriftgröße in Pixel) je Objekt-Typ
    GROESSEN: {
        bella: 52,
        blume: 40,
        hindernis: 44,
        stern: 38,
        herz: 38,
        ziel: 110,
        wolke: 56,
        schmetterling: 28
    },

    // Hitboxen – absichtlich KLEINER als die sichtbaren Sprites,
    // damit Beinahe-Treffer NICHT zählen (kindgerecht!).
    // Nur das Einsammeln ist extra großzügig.
    HITBOX: {
        spieler:     { breite: 26, hoehe: 38 },
        hindernis:   { breite: 24, hoehe: 32 },
        sammel:      { breite: 48, hoehe: 48 },
        ziel:        { breite: 90, hoehe: 150 },
        gegnerBoden: { breite: 26, hoehe: 30 }, // Krabbler & Werfer
        gegnerFlug:  { breite: 30, hoehe: 24 }, // Flatterer
        geschoss:    { breite: 18, hoehe: 18 }  // geworfene Matschbälle
    },

    // ---------- Farben ----------
    FARBEN: {
        lila: '#b388eb',
        pink: '#ff8fcf',
        hellpink: '#ffd6ec',
        sonne: '#ffe066',
        textDunkel: '#7c3aed',

        // Farben des gezeichneten Cartoon-Einhorns (player.js)
        einhorn: {
            outline: '#2b2b3a',        // kräftige dunkle Kontur (Cartoon-Look)
            koerper: '#ffffff',
            koerperSchatten: '#ece5f7', // ferne Beine etwas dunkler (Tiefe)
            huf: '#b59bd6',
            wange: '#ff9ec2',
            nuester: '#ff9ec2',
            maehnePink: '#ff8fbf',
            maehneGold: '#ffd24a',
            maehneBlau: '#6ec6f0',
            maehneLila: '#b388eb',
            hornGelb: '#ffd24a',
            hornPink: '#ff8fb0',
            stern: '#ff9ec2'
        }
    },

    SCHRIFT: "'Fredoka', 'Comic Sans MS', sans-serif",

    // Schlüssel für den gespeicherten Fortschritt (localStorage)
    SPEICHER_SCHLUESSEL: 'bella-zauberwiese-fortschritt'
};

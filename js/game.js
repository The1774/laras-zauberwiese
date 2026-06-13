// =====================================================
// Hauptdatei: Game-Loop, Spielzustände, Kamera,
// Kollisionen, Fortschritt (localStorage) – verbindet
// alle Module miteinander.
//
// Zustände: 'start' | 'spiel' | 'pause' | 'geschafft' | 'nochmal'
// =====================================================

const canvas = document.getElementById('spiel-canvas');
const ctx = canvas.getContext('2d');

// ---------- Gespeicherter Fortschritt ----------

function ladeFortschritt() {
    try {
        const roh = localStorage.getItem(KONFIG.SPEICHER_SCHLUESSEL);
        if (roh) return JSON.parse(roh);
    } catch (e) {
        // localStorage blockiert? Dann einfach ohne Speichern spielen.
    }
    return { freigeschaltet: 1, highscore: 0, schwierigkeit: KONFIG.SCHWIERIGKEIT_STANDARD };
}

// Die aktuell gewählte Schwierigkeitsstufe (Objekt aus KONFIG)
function aktiveSchwierigkeit() {
    return KONFIG.SCHWIERIGKEITEN[spiel.fortschritt.schwierigkeit]
        || KONFIG.SCHWIERIGKEITEN[KONFIG.SCHWIERIGKEIT_STANDARD];
}

function speichereFortschritt() {
    try {
        localStorage.setItem(KONFIG.SPEICHER_SCHLUESSEL, JSON.stringify(spiel.fortschritt));
    } catch (e) { /* siehe oben */ }
}

// ---------- Zentraler Spielzustand ----------

const spiel = {
    zustand: 'start',
    levelNr: 0,
    level: null,      // aktuelle Level-Daten aus LEVELS
    objekte: [],      // Kopien der Level-Objekte (mit "eingesammelt"-Flag)
    plattformen: [],  // schwebende Inseln des aktuellen Levels
    deko: null,       // Wolken, Schmetterlinge, Boden-Schmuck
    partikel: [],
    boss: null,       // nur im Boss-Level gesetzt (Grummelwolke)
    strahlen: [],     // Regenbogen-Strahlen aus Bellas Horn
    tropfen: [],      // graue Grummel-Tropfen der Wolke
    funken: [],       // bunte Energie-Funken zum Einsammeln (Boss-Level)
    geschosse: [],    // Matschbälle der Werfer-Gegner
    bonusHerzen: [],  // Herzen, die die Sonne im Boss-Level fallen lässt
    minibienen: [],   // kleine Helfer-Bienen des Bienen-Bosses
    rutschBegonnen: false, // hat die Eisrutsche schon begonnen?
    kamera: 0,
    punkte: 0,
    blumen: 0,
    herzen: KONFIG.MAX_HERZEN,
    maxHerzen: KONFIG.MAX_HERZEN, // je nach Schwierigkeit (siehe ladeLevel)
    zeit: 0,          // läuft immer weiter (für Animationen)
    fortschritt: ladeFortschritt()
};

const bella = new Bella();

// ---------- Level laden & starten ----------

function ladeLevel(nr) {
    spiel.levelNr = nr;
    spiel.level = LEVELS[nr];
    // Objekte kopieren, damit das Original-Level unverändert bleibt
    spiel.objekte = spiel.level.objekte.map(function (o) {
        return Object.assign({}, o, { eingesammelt: false });
    });
    // Bewegliche Gegner bekommen ihren Lauf-/Flatter-/Wurf-Zustand
    spiel.objekte.forEach(function (o) {
        if (o.typ !== 'gegner') return;
        o.startX = o.x;
        o.basisY = o.y;
        o.richtung = -1; // läuft/fliegt erst nach links (Bella entgegen)
        o.blick = -1;
        o.t = Math.random() * 6;                 // Flatter-Phase
        o.wurfTimer = 70 + Math.random() * 80;   // bis zum ersten Wurf
        // Fledermäuse fliegen schräg los (zufällige Richtung)
        o.vx = Math.random() < 0.5 ? -1 : 1;
        o.vy = Math.random() < 0.5 ? -1 : 1;
    });
    spiel.plattformen = spiel.level.plattformen || [];
    spiel.deko = erzeugeDeko(spiel.level);
    spiel.partikel = [];
    spiel.strahlen = [];
    spiel.tropfen = [];
    spiel.funken = [];
    spiel.geschosse = [];
    spiel.bonusHerzen = [];
    spiel.minibienen = [];
    spiel.rutschBegonnen = false;
    spiel.boss = spiel.level.boss ? erzeugeBoss(spiel.level.bossArt) : null;
    spiel.kamera = 0;
    spiel.punkte = 0;
    spiel.blumen = 0;
    spiel.maxHerzen = aktiveSchwierigkeit().herzen;
    spiel.herzen = spiel.maxHerzen;
    bella.reset();
}

function starteLevel(nr) {
    ladeLevel(nr);
    spiel.zustand = 'spiel';
    UI.zeigeBildschirm(null);
}

function zeigeStartbildschirm() {
    spiel.zustand = 'start';
    UI.baueLevelAuswahl(spiel.fortschritt, function (nr) {
        Sound.init(); Sound.klick();
        starteLevel(nr);
    });
    baueSchwierigkeitsAuswahl();
    UI.zeigeBildschirm('start');
}

// Schwierigkeits-Knöpfe (Leicht/Normal/Schwer) bauen + Auswahl speichern
function baueSchwierigkeitsAuswahl() {
    UI.baueSchwierigkeit(spiel.fortschritt.schwierigkeit || KONFIG.SCHWIERIGKEIT_STANDARD, function (schluessel) {
        Sound.init(); Sound.klick();
        spiel.fortschritt.schwierigkeit = schluessel;
        speichereFortschritt();
        baueSchwierigkeitsAuswahl(); // neu zeichnen, damit die Wahl hervorgehoben ist
    });
}

// ---------- Spiellogik ----------

function aktualisiere(dt) {
    spiel.zeit += dt;

    // Deko und Partikel laufen auch hinter den Menüs weiter (wirkt lebendig)
    if (spiel.deko) aktualisiereDeko(spiel.deko, dt, spiel.level);
    aktualisierePartikel(spiel.partikel, dt);

    // Konfetti-Regen auf dem "Geschafft"-Bildschirm
    if (spiel.zustand === 'geschafft' && Math.random() < 0.25) {
        erzeugePartikel(
            spiel.partikel,
            spiel.kamera + Math.random() * KONFIG.BREITE,
            40 + Math.random() * 200,
            2,
            KONFIG.SPRITES.glitzer
        );
    }

    if (spiel.zustand !== 'spiel') return;

    // Eisrutsche: ab rutschAb geht es automatisch nur noch vorwärts
    const autorennen = !!(spiel.level.eis && bella.x >= spiel.level.rutschAb);

    bella.aktualisiere(dt, Eingabe, spiel.level.laenge, spiel.plattformen, spiel.level.schwebe, spiel.level.schwimmen, autorennen);
    if (spiel.level.schwimmen) pruefeSpalten();

    // Beim ersten Erreichen der Rutsche: Schnee-Wirbel + Sound
    if (autorennen && !spiel.rutschBegonnen) {
        spiel.rutschBegonnen = true;
        erzeugePartikel(spiel.partikel, bella.x, bella.y, 18, ['❄️', '✨', '🌨️', '⭐']);
        Sound.stern();
    }
    // Schnee-Wirbel an den Hufen während der Rutsche
    if (autorennen && bella.amBoden && Math.random() < 0.4) {
        erzeugePartikel(spiel.partikel, bella.x - 22, KONFIG.BODEN_Y - 8, 1, ['❄️', '✨']);
    }

    // Kleine Glitzer-Spur an den Hufen, wenn Bella galoppiert –
    // mit Sternen-Turbo deutlich dichter und sternig
    if (bella.laeuft && bella.amBoden) {
        if (bella.turbo > 0 && Math.random() < 0.35) {
            erzeugePartikel(spiel.partikel, bella.x - 25 * bella.richtung, KONFIG.BODEN_Y - 14, 1, ['⭐', '✨']);
        } else if (Math.random() < 0.1) {
            erzeugePartikel(spiel.partikel, bella.x - 25 * bella.richtung, KONFIG.BODEN_Y - 8, 1, ['✨']);
        }
    }

    // Kamera folgt Bella (Bella steht etwas links der Bildmitte)
    spiel.kamera = Math.max(0, Math.min(
        bella.x - KONFIG.BREITE * 0.35,
        spiel.level.laenge - KONFIG.BREITE
    ));

    if (spiel.boss) aktualisiereBoss(dt);
    // Auch ohne Boss können Strahlen fliegen (z. B. der Sonnen-Strahl,
    // der das Gewitter auflöst)
    else if (spiel.strahlen.length) aktualisiereStrahlen(spiel.strahlen, dt);

    aktualisiereGegner(dt);

    pruefeObjekte();
}

// =====================================================
// Boss-Level: die Grummelwolke
// Bella schießt mit der Sprung-Taste Regenbogen-Strahlen (die von
// selbst auf die Wolke zielen), weicht den grauen Tropfen aus und
// macht die Wolke so Stück für Stück wieder fröhlich.
// =====================================================

function erzeugeBoss(art) {
    return {
        art: art || 'wolke',    // 'wolke' (Grummelwolke) oder 'biene' (Brummel-Biene)
        x: KONFIG.BREITE / 2,
        basisY: 120,            // Mittel-Höhe; schwebt sanft auf und ab
        y: 120,
        richtung: 1,
        tempo: 0.7,
        treffer: 0,
        maxTreffer: KONFIG.BOSS_TREFFER,
        zittern: 0,             // kurzes Wackeln nach einem Treffer
        trefferCooldown: 0,     // ein Strahl = ein Treffer
        tropfenTimer: 90,       // Frames bis zum nächsten grauen Tropfen (Wolke)
        funkeTimer: 70,         // Frames bis zum nächsten Energie-Funken
        herzTimer: 360,         // Frames bis die Sonne ein Herz fallen lässt
        sonneTimer: 0,          // wie lange die Sonne gerade zu sehen ist
        feierTimer: 0,          // Takt für die Feuerwerk-Wellen beim Sieg
        fanfare2: false,        // zweite Sieges-Melodie schon gespielt?
        energie: 0,             // so viele Schüsse hat Bella gerade auf Vorrat
        maxEnergie: KONFIG.BOSS_ENERGIE_MAX,
        warSpringen: false,     // für die "steigende Flanke" der Sprung-Taste
        besiegt: false,
        siegTimer: 0,           // kleine Jubel-Animation, bevor "Geschafft" kommt
        // --- nur Bienen-Boss ---
        stichPhase: 'schweben', // 'schweben' | 'warnung' | 'sturz' | 'zurueck'
        stichTimer: 200,        // Frames bis zum nächsten Pieks-Sturz
        stichT: 0,              // Restdauer der aktuellen Phase
        zielX: KONFIG.BREITE / 2,
        rufTimer: 360           // Frames bis zum nächsten Helfer-Bienen-Ruf
    };
}

function aktualisiereBoss(dt) {
    const boss = spiel.boss;
    const phase = Math.floor(boss.treffer / 3);

    if (boss.zittern > 0) boss.zittern -= dt;
    if (boss.trefferCooldown > 0) boss.trefferCooldown -= dt;

    // ---------- Sieg: ausgiebig feiern, dann "Geschafft" ----------
    if (boss.besiegt) {
        boss.y = boss.basisY + Math.sin(spiel.zeit * 0.18) * 16; // fröhliches Hüpfen
        boss.siegTimer -= dt;

        // Dauer-Konfetti, das von oben über den ganzen Bildschirm rieselt
        if (Math.random() < 0.9) {
            erzeugePartikel(
                spiel.partikel,
                spiel.kamera + Math.random() * KONFIG.BREITE,
                10 + Math.random() * 170,
                2, ['💖', '🌸', '✨', '🌈', '💗', '⭐', '🎉', '💜', '🌟']
            );
        }

        // Feuerwerk-Wellen + Regenbogen-Strahlen-Fächer aus der Wolke
        boss.feierTimer -= dt;
        if (boss.feierTimer <= 0) {
            boss.feierTimer = 20 + Math.random() * 16;

            // Feuerwerk an einer zufälligen Stelle
            const fx = spiel.kamera + 110 + Math.random() * (KONFIG.BREITE - 220);
            const fy = 50 + Math.random() * 190;
            erzeugePartikel(spiel.partikel, fx, fy, 16, ['✨', '🌟', '⭐', '💖', '🌈', '🎉']);

            // Strahlen sprühen rundum aus der jubelnden Wolke
            for (let i = 0; i < 7; i++) {
                const w = -Math.PI / 2 + (i - 3) * 0.32;
                spiel.strahlen.push({
                    x: boss.x, y: boss.y,
                    vx: Math.cos(w) * 9, vy: Math.sin(w) * 9,
                    farbe: i % REGENBOGEN.length, leben: 55, spur: []
                });
            }
            if (Math.random() < 0.5) Sound.sammeln();
        }

        // Zweite Sieges-Fanfare zur Hälfte der Feier
        if (!boss.fanfare2 && boss.siegTimer < 170) {
            boss.fanfare2 = true;
            Sound.sieg();
        }

        aktualisiereStrahlen(spiel.strahlen, dt);

        if (boss.siegTimer <= 0) levelGeschafft();
        return;
    }

    // ---------- Bewegung + Angriff je nach Boss-Art ----------
    if (boss.art === 'biene') aktualisiereBiene(dt, phase);
    else aktualisiereWolke(dt, phase);

    // ---------- Schießen: NUR mit Energie (steigende Flanke der Sprung-Taste) ----------
    // Bella hüpft wie gewohnt; ein Strahl kommt aber nur, wenn sie vorher
    // einen Funken eingefangen hat. So bringt bloßes Drücken nichts.
    if (Eingabe.springen && !boss.warSpringen) {
        if (boss.energie > 0) {
            boss.energie -= 1;
            feuereStrahl();
        } else {
            fehlschuss();
        }
    }
    boss.warSpringen = Eingabe.springen;

    aktualisiereStrahlen(spiel.strahlen, dt);
    pruefeStrahlTreffer();

    // ---------- Bunte Energie-Funken (einsammeln zum Nachladen!) ----------
    boss.funkeTimer -= dt;
    if (boss.funkeTimer <= 0) {
        spiel.funken.push({
            x: boss.x + (Math.random() - 0.5) * 130,
            y: boss.y + 30,
            vx: (Math.random() - 0.5) * 1.2,
            vy: 1.5 + Math.random() * 0.5,
            farbe: Math.floor(Math.random() * REGENBOGEN.length),
            phase: Math.random() * 6
        });
        boss.funkeTimer = 105 + Math.random() * 70;
    }
    aktualisiereFunken(dt);

    // ---------- Ab und zu kommt die Sonne und lässt ein Herz fallen ----------
    if (boss.sonneTimer > 0) boss.sonneTimer -= dt;
    boss.herzTimer -= dt;
    if (boss.herzTimer <= 0) {
        boss.herzTimer = 540 + Math.random() * 300; // ~9–14 Sekunden
        boss.sonneTimer = 150;                        // Sonne ~2,5 s sichtbar
        spiel.bonusHerzen.push({ x: boss.x, y: boss.y - 70, vy: 1.3 });
        Sound.stern(); // heller Hinweis: schau nach oben!
    }
    aktualisiereBonusHerzen(dt);
}

// Grummelwolke: schwebt, wandert und lässt graue Tropfen fallen.
function aktualisiereWolke(dt, phase) {
    const boss = spiel.boss;
    boss.tempo = 0.7 + phase * 0.35;
    boss.x += boss.richtung * boss.tempo * dt;
    if (boss.x < 175) { boss.x = 175; boss.richtung = 1; }
    if (boss.x > KONFIG.BREITE - 175) { boss.x = KONFIG.BREITE - 175; boss.richtung = -1; }
    boss.y = boss.basisY + Math.sin(spiel.zeit * 0.04) * 14;

    boss.tropfenTimer -= dt;
    if (boss.tropfenTimer <= 0) {
        spiel.tropfen.push({
            x: boss.x + (Math.random() - 0.5) * 90,
            y: boss.y + 30,
            vy: 2.0 + Math.random() * 0.6
        });
        boss.tropfenTimer = (100 - phase * 16 + Math.random() * 50) * aktiveSchwierigkeit().wurfPause;
    }
    aktualisiereTropfen(dt);
}

// Brummel-Biene: schwebt, stürzt zum Piksen herab und ruft Helfer-Bienen.
function aktualisiereBiene(dt, phase) {
    const boss = spiel.boss;
    const s = aktiveSchwierigkeit();

    if (boss.stichPhase === 'schweben') {
        boss.tempo = 0.8 + phase * 0.3;
        boss.x += boss.richtung * boss.tempo * dt;
        if (boss.x < 175) { boss.x = 175; boss.richtung = 1; }
        if (boss.x > KONFIG.BREITE - 175) { boss.x = KONFIG.BREITE - 175; boss.richtung = -1; }
        boss.y = boss.basisY + Math.sin(spiel.zeit * 0.05) * 14;

        boss.stichTimer -= dt;
        if (boss.stichTimer <= 0 && Math.abs(boss.x - bella.x) < 600) {
            boss.stichPhase = 'warnung';
            boss.stichT = 32;
        }

    } else if (boss.stichPhase === 'warnung') {
        // über Bella ziehen und zittern (Vorwarnung)
        boss.x += (bella.x - boss.x) * 0.08 * dt;
        boss.y = boss.basisY + Math.sin(spiel.zeit * 0.7) * 4;
        boss.stichT -= dt;
        if (boss.stichT <= 0) boss.stichPhase = 'sturz';

    } else if (boss.stichPhase === 'sturz') {
        // herabstürzen, um zu piksen
        boss.y += 9 * dt;
        boss.x += (bella.x - boss.x) * 0.04 * dt;
        if (bella.unverwundbar <= 0 && pruefeKollision(
            bella.x, bella.y, KONFIG.HITBOX.spieler.breite, KONFIG.HITBOX.spieler.hoehe,
            boss.x, boss.y, 40, 40)) {
            trefferDurchHindernis();
        }
        if (boss.y >= KONFIG.BODEN_Y - 55) boss.stichPhase = 'zurueck';

    } else { // 'zurueck'
        boss.y -= 6 * dt;
        if (boss.y <= boss.basisY) {
            boss.y = boss.basisY;
            boss.stichPhase = 'schweben';
            boss.stichTimer = (190 + Math.random() * 160) * s.wurfPause;
        }
    }

    // Ab und zu kleine Helfer-Bienen rufen (die kurz mithelfen)
    boss.rufTimer -= dt;
    if (boss.rufTimer <= 0) {
        boss.rufTimer = (430 + Math.random() * 240) * s.wurfPause;
        const anzahl = 2 + (phase >= 2 ? 1 : 0);
        for (let i = 0; i < anzahl; i++) {
            spiel.minibienen.push({
                x: boss.x + (Math.random() - 0.5) * 70,
                y: boss.y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 1.4,
                leben: 280 + Math.random() * 120,
                t: Math.random() * 6
            });
        }
        Sound.stern();
    }
    aktualisiereMinibienen(dt, s);
}

// Kleine Helfer-Bienen: schwirren sanft Richtung Bella, piksen bei
// Berührung und verschwinden nach kurzer Zeit wieder.
function aktualisiereMinibienen(dt, s) {
    const hb = KONFIG.HITBOX;
    for (let i = spiel.minibienen.length - 1; i >= 0; i--) {
        const m = spiel.minibienen[i];
        m.t += dt;
        m.vx += (bella.x > m.x ? 1 : -1) * 0.02 * dt;
        m.vy += (bella.y > m.y ? 1 : -1) * 0.02 * dt;
        m.vx = Math.max(-2.2, Math.min(2.2, m.vx));
        m.vy = Math.max(-2.0, Math.min(2.0, m.vy));
        m.x += m.vx * s.gegnerTempo * dt;
        m.y += m.vy * s.gegnerTempo * dt;
        if (m.y < 70) { m.y = 70; m.vy = Math.abs(m.vy); }
        if (m.y > KONFIG.BODEN_Y - 20) { m.y = KONFIG.BODEN_Y - 20; m.vy = -Math.abs(m.vy); }

        if (bella.unverwundbar <= 0 && pruefeKollision(
            bella.x, bella.y, hb.spieler.breite, hb.spieler.hoehe,
            m.x, m.y, 22, 22)) {
            trefferDurchHindernis();
        }

        m.leben -= dt;
        if (m.leben <= 0) {
            erzeugePartikel(spiel.partikel, m.x, m.y, 3, ['✨']);
            spiel.minibienen.splice(i, 1);
        }
    }
}

// Herzen, die die Sonne fallen lässt: einfangen heilt ein Herz,
// verpasst man sie (Boden), sind sie weg.
function aktualisiereBonusHerzen(dt) {
    const hb = KONFIG.HITBOX;
    for (let i = spiel.bonusHerzen.length - 1; i >= 0; i--) {
        const h = spiel.bonusHerzen[i];
        h.y += h.vy * dt;

        if (pruefeKollision(
            bella.x, bella.y, hb.spieler.breite, hb.spieler.hoehe,
            h.x, h.y, 54, 54
        )) {
            spiel.bonusHerzen.splice(i, 1);
            if (spiel.herzen < spiel.maxHerzen) spiel.herzen += 1;
            spiel.punkte += KONFIG.PUNKTE_STERN;
            Sound.extraherz();
            erzeugePartikel(spiel.partikel, h.x, h.y, 10, ['💖', '💗', '✨']);
            continue;
        }

        if (h.y >= KONFIG.BODEN_Y - 6) {
            erzeugePartikel(spiel.partikel, h.x, KONFIG.BODEN_Y - 6, 3, ['💔', '✨']);
            spiel.bonusHerzen.splice(i, 1);
        }
    }
}

// Einen Regenbogen-Strahl aus Bellas Horn abfeuern.
// Der Strahl zielt automatisch auf die Wolke – so klappt es immer.
function feuereStrahl() {
    const boss = spiel.boss;
    const hornX = bella.x + bella.richtung * 25;
    const hornY = bella.y - 58;

    const dx = boss.x - hornX;
    const dy = boss.y - hornY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const tempo = 13;

    spiel.strahlen.push({
        x: hornX, y: hornY,
        vx: dx / dist * tempo,
        vy: dy / dist * tempo,
        farbe: Math.floor(Math.random() * REGENBOGEN.length),
        leben: 90,
        spur: []
    });

    Sound.strahl();
    erzeugePartikel(spiel.partikel, hornX, hornY, 3, ['✨', '🌈']);
}

// Prüft, ob ein Strahl die Wolke trifft.
function pruefeStrahlTreffer() {
    const boss = spiel.boss;
    if (boss.besiegt) return;

    for (let i = spiel.strahlen.length - 1; i >= 0; i--) {
        const s = spiel.strahlen[i];
        if (boss.trefferCooldown <= 0 && Math.hypot(s.x - boss.x, s.y - boss.y) < 60) {
            spiel.strahlen.splice(i, 1);
            trefferAufBoss(s.x, s.y);
        }
    }
}

function trefferAufBoss(x, y) {
    const boss = spiel.boss;
    boss.treffer += 1;
    boss.zittern = 12;
    boss.trefferCooldown = 8;
    spiel.punkte += KONFIG.PUNKTE_BOSS_TREFFER;
    Sound.bossTreffer();
    erzeugePartikel(spiel.partikel, x, y, 10, ['✨', '💖', '🌈', '⭐']);

    if (boss.treffer >= boss.maxTreffer) {
        boss.besiegt = true;
        boss.siegTimer = 320; // ~5,3 Sekunden ausgiebig feiern
        spiel.tropfen = []; // alle fallenden Tropfen verschwinden
        spiel.funken = [];  // ebenso die Energie-Funken
        spiel.bonusHerzen = [];
        spiel.minibienen = [];
        Sound.sieg();
        erzeugePartikel(spiel.partikel, boss.x, boss.y, 46, ['🌈', '💖', '🌸', '✨', '💗', '⭐', '🎉', '🌟']);
    }
}

// Tropfen fallen lassen – trifft einer Bella, kostet das ein Herz
// (gleiche freundliche Behandlung wie ein Hindernis).
function aktualisiereTropfen(dt) {
    const hb = KONFIG.HITBOX;
    for (let i = spiel.tropfen.length - 1; i >= 0; i--) {
        const t = spiel.tropfen[i];
        t.y += t.vy * dt;

        if (pruefeKollision(
            bella.x, bella.y, hb.spieler.breite, hb.spieler.hoehe,
            t.x, t.y, 18, 22
        )) {
            spiel.tropfen.splice(i, 1);
            trefferDurchHindernis();
            continue;
        }

        if (t.y >= KONFIG.BODEN_Y) {
            erzeugePartikel(spiel.partikel, t.x, KONFIG.BODEN_Y - 6, 2, ['💧']);
            spiel.tropfen.splice(i, 1);
        }
    }
}

// Energie-Funken fallen lassen – fängt Bella einen, lädt das ihr Horn
// (eine Energie = ein Schuss). Verpasste Funken zerplatzen am Boden.
function aktualisiereFunken(dt) {
    const boss = spiel.boss;
    const hb = KONFIG.HITBOX;
    for (let i = spiel.funken.length - 1; i >= 0; i--) {
        const f = spiel.funken[i];
        f.x += f.vx * dt;
        f.y += f.vy * dt;

        // Eingefangen? (großzügige Sammel-Hitbox, kindgerecht)
        if (pruefeKollision(
            bella.x, bella.y, hb.spieler.breite, hb.spieler.hoehe,
            f.x, f.y, 54, 54
        )) {
            spiel.funken.splice(i, 1);
            if (boss.energie < boss.maxEnergie) boss.energie += 1;
            spiel.punkte += KONFIG.PUNKTE_BLUME;
            Sound.energie();
            erzeugePartikel(spiel.partikel, f.x, f.y, 8, ['✨', '🌈', '⭐', '💖']);
            continue;
        }

        if (f.y >= KONFIG.BODEN_Y - 6) {
            erzeugePartikel(spiel.partikel, f.x, KONFIG.BODEN_Y - 6, 2, ['✨']);
            spiel.funken.splice(i, 1);
        }
    }
}

// Bella drückt, hat aber keine Energie: nur ein kleines "Pfft"-Wölkchen
// am Horn, damit das Kind merkt "ich brauche erst einen Funken".
function fehlschuss() {
    const hornX = bella.x + bella.richtung * 25;
    const hornY = bella.y - 58;
    erzeugePartikel(spiel.partikel, hornX, hornY, 2, ['💨']);
    Sound.leer();
}

// =====================================================
// Bewegliche Gegner in den Lauf-Leveln
// =====================================================

function aktualisiereGegner(dt) {
    const s = aktiveSchwierigkeit();
    for (const o of spiel.objekte) {
        if (o.typ !== 'gegner') continue;

        if (o.art === 'krabbler' || o.art === 'pinguin') {
            // Watschelt/rutscht zwischen startX ± spanne hin und her
            o.x += o.richtung * (o.tempo || 1.4) * s.gegnerTempo * dt;
            if (o.x < o.startX - o.spanne) { o.x = o.startX - o.spanne; o.richtung = 1; }
            if (o.x > o.startX + o.spanne) { o.x = o.startX + o.spanne; o.richtung = -1; }

        } else if (o.art === 'flieger') {
            // Fliegt seitlich hin und her UND wippt auf und ab
            o.t += dt;
            o.x += o.richtung * (o.tempo || 1.1) * s.gegnerTempo * dt;
            if (o.x < o.startX - o.spanne) { o.x = o.startX - o.spanne; o.richtung = 1; }
            if (o.x > o.startX + o.spanne) { o.x = o.startX + o.spanne; o.richtung = -1; }
            o.y = o.basisY + Math.sin(o.t * 0.06) * (o.amplitude || 22);

        } else if (o.art === 'fledermaus') {
            // Schwirrt frei umher und prallt an den Rändern ihres Bereichs ab
            o.x += o.vx * (o.tempoX || 1.7) * s.gegnerTempo * dt;
            o.y += o.vy * (o.tempoY || 1.2) * s.gegnerTempo * dt;
            if (o.x < o.startX - o.spanneX) { o.x = o.startX - o.spanneX; o.vx = 1; }
            if (o.x > o.startX + o.spanneX) { o.x = o.startX + o.spanneX; o.vx = -1; }
            if (o.y < o.yMin) { o.y = o.yMin; o.vy = 1; }
            if (o.y > o.yMax) { o.y = o.yMax; o.vy = -1; }
            o.richtung = o.vx > 0 ? 1 : -1;

        } else if (o.art === 'werfer') {
            // Schaut Richtung Bella und wirft, wenn sie in der Nähe ist
            o.blick = bella.x >= o.x ? 1 : -1;
            o.wurfTimer -= dt;
            if (o.wurfTimer <= 0 && Math.abs(o.x - bella.x) < 520) {
                wirf(o);
                o.wurfTimer = (110 + Math.random() * 70) * s.wurfPause;
            }
        }
    }

    aktualisiereGeschosse(dt);
}

// Ein Werfer schleudert einen Matschball im Bogen Richtung Bella
function wirf(o) {
    const richtung = bella.x >= o.x ? 1 : -1;
    spiel.geschosse.push({
        x: o.x,
        y: KONFIG.BODEN_Y - 42,
        vx: richtung * (2.2 + Math.random() * 0.7),
        vy: -8.6,            // erst hoch, dann (durch Schwerkraft) wieder runter
        dreh: 0,
        drehTempo: (Math.random() - 0.5) * 0.6
    });
    Sound.wurf();
}

// Matschbälle fliegen im Bogen; sie treffen Bella oder zerplatzen am Boden
function aktualisiereGeschosse(dt) {
    const hb = KONFIG.HITBOX;
    for (let i = spiel.geschosse.length - 1; i >= 0; i--) {
        const g = spiel.geschosse[i];
        g.x += g.vx * dt;
        g.vy += KONFIG.SCHWERKRAFT * dt;
        g.y += g.vy * dt;
        g.dreh += g.drehTempo * dt;

        if (pruefeKollision(
            bella.x, bella.y, hb.spieler.breite, hb.spieler.hoehe,
            g.x, g.y, hb.geschoss.breite, hb.geschoss.hoehe
        )) {
            spiel.geschosse.splice(i, 1);
            trefferDurchHindernis();
            continue;
        }

        // Am Boden zerplatzt oder aus dem Bild geflogen
        if (g.y >= KONFIG.BODEN_Y - 4) {
            erzeugePartikel(spiel.partikel, g.x, KONFIG.BODEN_Y - 6, 3, ['💨']);
            spiel.geschosse.splice(i, 1);
        } else if (g.x < spiel.kamera - 80 || g.x > spiel.kamera + KONFIG.BREITE + 80) {
            spiel.geschosse.splice(i, 1);
        }
    }
}

// Kollisionen zwischen Bella und allen Level-Objekten
function pruefeObjekte() {
    const hb = KONFIG.HITBOX;

    for (const obj of spiel.objekte) {
        if (obj.eingesammelt) continue;
        if (obj.typ === 'spalt') continue; // Spalten werden separat geprüft

        let box;
        if (obj.typ === 'hindernis') box = hb.hindernis;
        else if (obj.typ === 'ziel') box = hb.ziel;
        else if (obj.typ === 'gegner') box = (obj.art === 'flieger' || obj.art === 'fledermaus') ? hb.gegnerFlug : hb.gegnerBoden;
        else box = hb.sammel;

        const trifft = pruefeKollision(
            bella.x, bella.y, hb.spieler.breite, hb.spieler.hoehe,
            obj.x, obj.y, box.breite, box.hoehe
        );
        if (!trifft) continue;

        if (obj.typ === 'blume') {
            obj.eingesammelt = true;
            spiel.blumen += 1;
            spiel.punkte += KONFIG.PUNKTE_BLUME;
            Sound.sammeln();
            erzeugePartikel(spiel.partikel, obj.x, obj.y, 6, KONFIG.SPRITES.glitzer);

        } else if (obj.typ === 'stern') {
            obj.eingesammelt = true;
            spiel.punkte += KONFIG.PUNKTE_STERN;
            bella.turbo = KONFIG.TURBO_DAUER; // Sternen-Turbo: kurz schneller rennen!
            Sound.stern();
            erzeugePartikel(spiel.partikel, obj.x, obj.y, 14, ['⭐', '✨', '🌟']);

        } else if (obj.typ === 'herz') {
            obj.eingesammelt = true;
            if (spiel.herzen < spiel.maxHerzen) spiel.herzen += 1;
            Sound.extraherz();
            erzeugePartikel(spiel.partikel, obj.x, obj.y, 10, ['💖', '💗', '✨']);

        } else if (obj.typ === 'sonne') {
            obj.eingesammelt = true;
            spiel.punkte += KONFIG.PUNKTE_STERN;
            loeseGewitterAuf();

        } else if (obj.typ === 'hindernis' || obj.typ === 'gegner') {
            trefferDurchHindernis();

        } else if (obj.typ === 'ziel') {
            levelGeschafft();
            return;
        }
    }
}

// Korallen-Spalten im Wasser-Level: die Säulen sind feste Wände.
// Ist Bella nicht im Spalt-Fenster, wird sie sanft davor gestoppt –
// sie muss also hoch-/runterschwimmen, um durchzukommen (kein Herz weg).
function pruefeSpalten() {
    const halbBreiteSp = KONFIG.HITBOX.spieler.breite / 2;
    const halbHoeheSp = KONFIG.HITBOX.spieler.hoehe / 2;

    for (const obj of spiel.objekte) {
        if (obj.typ !== 'spalt') continue;

        const halbWand = obj.breite / 2;
        const dx = bella.x - obj.x;
        if (Math.abs(dx) > halbWand + halbBreiteSp) continue;

        // Liegt Bella senkrecht im offenen Spalt?
        const imSpalt = Math.abs(bella.y - obj.gapY) < (obj.gapHeight / 2 - halbHoeheSp);
        if (imSpalt) continue;

        // Sonst: an der Seite, von der sie kommt, herausschieben
        if (dx <= 0) bella.x = obj.x - (halbWand + halbBreiteSp);
        else         bella.x = obj.x + (halbWand + halbBreiteSp);
    }
}

// Bella ist gegen ein Hindernis gelaufen
function trefferDurchHindernis() {
    if (bella.unverwundbar > 0) return; // gerade unverwundbar → nichts passiert

    spiel.herzen -= 1;
    bella.unverwundbar = KONFIG.UNVERWUNDBAR_DAUER * aktiveSchwierigkeit().unverwundbar;
    bella.vy = -6; // kleiner Hopser nach oben als sichtbares Feedback
    bella.amBoden = false;
    Sound.treffer();

    if (spiel.herzen <= 0) {
        spiel.zustand = 'nochmal';
        UI.zeigeBildschirm('nochmal');
    }
}

// Bella hat die Zauber-Sonne eingesammelt: Sie schießt einen Fächer
// aus Regenbogen-Strahlen nach oben, das Gewitter beginnt sich
// aufzulösen und die Sonne geht auf (siehe deko.gewitter.aufloesen).
function loeseGewitterAuf() {
    if (spiel.deko && spiel.deko.gewitter) spiel.deko.gewitter.aufloesen = true;

    const hornX = bella.x + bella.richtung * 25;
    const hornY = bella.y - 58;

    // Strahlen-Fächer schräg nach oben
    for (let i = 0; i < 9; i++) {
        const winkel = -Math.PI / 2 + (i - 4) * 0.14;
        const tempo = 11;
        spiel.strahlen.push({
            x: hornX, y: hornY,
            vx: Math.cos(winkel) * tempo,
            vy: Math.sin(winkel) * tempo,
            farbe: i % REGENBOGEN.length,
            leben: 75,
            spur: []
        });
    }

    erzeugePartikel(spiel.partikel, hornX, hornY, 22, ['🌈', '✨', '☀️', '💛', '⭐']);
    Sound.strahl();
    Sound.sieg();
}

// Mischt zwei #rrggbb-Farben (t = 0 → a, t = 1 → b) und gibt rgb() zurück.
// Wird für das sanfte Aufhellen des Himmels beim Auflösen genutzt.
function mischeFarben(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

// Der Ziel-Regenbogen wurde erreicht
function levelGeschafft() {
    spiel.punkte += KONFIG.PUNKTE_LEVEL;

    // Nächstes Level freischalten + Highscore merken
    spiel.fortschritt.freigeschaltet = Math.max(
        spiel.fortschritt.freigeschaltet,
        Math.min(spiel.levelNr + 2, LEVELS.length)
    );
    spiel.fortschritt.highscore = Math.max(spiel.fortschritt.highscore, spiel.punkte);
    speichereFortschritt();

    Sound.sieg();
    erzeugePartikel(spiel.partikel, bella.x, bella.y - 40, 25, KONFIG.SPRITES.glitzer);

    const istLetztesLevel = spiel.levelNr >= LEVELS.length - 1;
    let bossText = null;
    if (spiel.level.boss) {
        bossText = (spiel.boss && spiel.boss.art === 'biene')
            ? 'Die Brummel-Biene summt jetzt ganz lieb! 🐝🌈<br>Du hast sie mit deinen Regenbogen-Strahlen besänftigt!<br>Punkte: <b>' + spiel.punkte + '</b> ⭐'
            : 'Die Grummelwolke lacht wieder! 🌈<br>Du hast sie mit deinen Regenbogen-Strahlen ganz fröhlich gemacht!<br>Punkte: <b>' + spiel.punkte + '</b> ⭐';
    }
    UI.zeigeGeschafft(spiel.blumen, spiel.punkte, istLetztesLevel, spiel.level.sammelName || 'Blumen 🌸', bossText);
    spiel.zustand = 'geschafft';
    UI.zeigeBildschirm('geschafft');
}

// ---------- Pause & Ton ----------

function pauseUmschalten() {
    if (spiel.zustand === 'spiel') {
        spiel.zustand = 'pause';
        UI.zeigeBildschirm('pause');
    } else if (spiel.zustand === 'pause') {
        spiel.zustand = 'spiel';
        UI.zeigeBildschirm(null);
    }
}

function stummUmschalten() {
    UI.setzeStummKnopf(Sound.stummUmschalten());
}

// ---------- Zeichnen ----------

function zeichneHimmel() {
    let farben = spiel.level
        ? spiel.level.farben
        : { himmelOben: '#e9d5ff', himmelUnten: '#fce7f3' };

    // Boss-Level: Sobald die Wolke besiegt ist, hellt der Himmel auf
    if (spiel.boss && spiel.boss.besiegt && spiel.level.farbenSieg) {
        farben = spiel.level.farbenSieg;
    }

    // Gewitter-Level: Beim Auflösen vom Sturm-Himmel zur Sonne überblenden
    const g = spiel.deko && spiel.deko.gewitter;
    if (g && g.t > 0 && spiel.level.farbenSonne) {
        farben = {
            himmelOben: mischeFarben(spiel.level.farben.himmelOben, spiel.level.farbenSonne.himmelOben, g.t),
            himmelUnten: mischeFarben(spiel.level.farben.himmelUnten, spiel.level.farbenSonne.himmelUnten, g.t)
        };
    }

    const verlauf = ctx.createLinearGradient(0, 0, 0, KONFIG.BODEN_Y);
    verlauf.addColorStop(0, farben.himmelOben);
    verlauf.addColorStop(1, farben.himmelUnten);
    ctx.fillStyle = verlauf;
    ctx.fillRect(0, 0, KONFIG.BREITE, KONFIG.HOEHE);
}

// Dunkelheit über der Nacht-Szene – mit einem hellen Lichtkreis,
// den Bellas Horn dorthin wirft, wo sie gerade hinläuft.
function zeichneNachtLicht() {
    const sx = bella.x - spiel.kamera;

    // Der Lichtkegel liegt etwas VOR Bella (in Laufrichtung),
    // damit man sieht, wo es hingeht
    const lichtX = sx + bella.richtung * 60;
    const lichtY = bella.y - 55;
    const dunkel = ctx.createRadialGradient(lichtX, lichtY, 80, lichtX, lichtY, 320);
    dunkel.addColorStop(0, 'rgba(16, 12, 48, 0)');
    dunkel.addColorStop(1, 'rgba(16, 12, 48, 0.78)');
    ctx.fillStyle = dunkel;
    ctx.fillRect(0, 0, KONFIG.BREITE, KONFIG.HOEHE);

    // Warmes, pulsierendes Glühen direkt an der Hornspitze
    const hornX = sx + bella.richtung * 28;
    const hornY = bella.y - 58;
    const puls = 0.5 + 0.12 * Math.sin(spiel.zeit * 0.15);
    const glut = ctx.createRadialGradient(hornX, hornY, 2, hornX, hornY, 55);
    glut.addColorStop(0, 'rgba(255, 230, 140, ' + puls.toFixed(3) + ')');
    glut.addColorStop(1, 'rgba(255, 230, 140, 0)');
    ctx.fillStyle = glut;
    ctx.fillRect(hornX - 60, hornY - 60, 120, 120);
}

function zeichneBoden() {
    const siegBoden = spiel.boss && spiel.boss.besiegt && spiel.level.farbenSieg;
    let wiese = siegBoden ? spiel.level.farbenSieg.wiese : spiel.level.farben.wiese;

    // Gewitter-Level: nasse Wiese hellt beim Auflösen zu saftigem Grün auf
    const g = spiel.deko && spiel.deko.gewitter;
    if (g && g.t > 0 && spiel.level.farbenSonne) {
        wiese = mischeFarben(spiel.level.farben.wiese, spiel.level.farbenSonne.wiese, g.t);
    }

    ctx.fillStyle = wiese;
    ctx.fillRect(0, KONFIG.BODEN_Y, KONFIG.BREITE, KONFIG.HOEHE - KONFIG.BODEN_Y);

    // Heller Streifen als Wiesen-Oberkante
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(0, KONFIG.BODEN_Y, KONFIG.BREITE, 6);
}

function zeichne() {
    zeichneHimmel();

    if (spiel.level) {
        zeichneHimmelDeko(ctx, spiel.deko, spiel.kamera, spiel.zeit, spiel.level);

        // Boss-Level: Wolke bzw. Biene schwebt am Himmel (+ Bonus-Sonne)
        if (spiel.boss) {
            zeichneBoss(ctx, spiel.boss, spiel.zeit);
            zeichneBonusSonne(ctx, spiel.boss);
        }

        zeichneBoden();
        zeichneBodenDeko(ctx, spiel.deko, spiel.kamera);

        for (const p of spiel.plattformen) {
            zeichnePlattform(ctx, p, spiel.kamera, spiel.level);
        }

        for (const obj of spiel.objekte) {
            if (!obj.eingesammelt) zeichneObjekt(ctx, obj, spiel.kamera, spiel.zeit);
        }

        // Fallende Grummel-Tropfen + bunte Energie-Funken + Bonus-Herzen
        if (spiel.boss) {
            zeichneTropfen(ctx, spiel.tropfen, spiel.kamera);
            zeichneFunken(ctx, spiel.funken, spiel.kamera, spiel.zeit);
            zeichneBonusHerzen(ctx, spiel.bonusHerzen, spiel.kamera, spiel.zeit);
            zeichneMinibienen(ctx, spiel.minibienen, spiel.kamera, spiel.zeit);
        }

        // Geworfene Matschbälle der Werfer-Gegner
        if (spiel.geschosse.length) zeichneGeschosse(ctx, spiel.geschosse, spiel.kamera);

        bella.zeichne(ctx, spiel.kamera, spiel.zeit);
        zeichnePartikel(ctx, spiel.partikel, spiel.kamera);

        // Regenbogen-Strahlen liegen über allem (Boss-Strahlen wie auch
        // der Sonnen-Strahl im Gewitter-Level)
        if (spiel.strahlen.length) zeichneStrahlen(ctx, spiel.strahlen, spiel.kamera);

        // Gewitter-Level: Regen + Blitze, Eis-Level: Schneetreiben
        if (spiel.level.regen || spiel.level.schnee) zeichneRegen(ctx, spiel.deko);

        // Nacht-Level: Dunkelheit + Bellas leuchtendes Horn
        if (spiel.level.nachts) {
            zeichneNachtLicht();
        }

        if (spiel.zustand === 'spiel' || spiel.zustand === 'pause') {
            UI.zeichneHUD(ctx, spiel);
            if (spiel.boss && !spiel.boss.besiegt) {
                UI.zeichneBossLeiste(ctx, spiel.boss);
                UI.zeichneBossEnergie(ctx, spiel.boss);
            }
        }
    }

    // Animierte Bella auf dem Startbildschirm
    if (spiel.zustand === 'start') {
        UI.zeichneVorschau(spiel.zeit);
    }
}

// ---------- Game-Loop ----------

let letzteZeit = 0;

function schleife(zeitstempel) {
    // dt = 1 entspricht einem Frame bei 60 fps; nach Tab-Wechseln
    // wird der Wert begrenzt, damit nichts "springt".
    const dt = Math.min((zeitstempel - letzteZeit) / 16.667, 3);
    letzteZeit = zeitstempel;

    aktualisiere(dt);
    zeichne();
    requestAnimationFrame(schleife);
}

// ---------- Skalierung (responsiv) ----------

function skaliere() {
    const faktor = Math.min(
        window.innerWidth / KONFIG.BREITE,
        window.innerHeight / KONFIG.HOEHE
    );
    document.getElementById('spiel-container').style.transform = 'scale(' + faktor + ')';
}

// ---------- Start ----------

function init() {
    UI.init();

    Eingabe.init({
        beiPause: pauseUmschalten,
        beiStumm: stummUmschalten
    });

    // Menü-Knöpfe verdrahten
    function knopf(id, aktion) {
        document.getElementById(id).addEventListener('click', function () {
            Sound.init();
            Sound.klick();
            aktion();
        });
    }

    // "Spielen" startet das höchste freigeschaltete Level
    knopf('spielen-knopf', function () {
        starteLevel(spiel.fortschritt.freigeschaltet - 1);
    });
    knopf('pause-knopf', pauseUmschalten);
    knopf('mute-knopf', stummUmschalten);
    knopf('weiter-spielen-knopf', pauseUmschalten);
    knopf('pause-menue-knopf', zeigeStartbildschirm);
    knopf('nochmal-knopf', function () { starteLevel(spiel.levelNr); });
    knopf('nochmal-menue-knopf', zeigeStartbildschirm);
    knopf('naechstes-level-knopf', function () {
        if (spiel.levelNr >= LEVELS.length - 1) {
            zeigeStartbildschirm();
        } else {
            starteLevel(spiel.levelNr + 1);
        }
    });

    // Level 1 als hübsche Kulisse hinter dem Startbildschirm laden
    ladeLevel(0);
    zeigeStartbildschirm();

    window.addEventListener('resize', skaliere);
    skaliere();

    requestAnimationFrame(schleife);
}

init();

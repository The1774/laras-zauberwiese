// =====================================================
// Spielobjekte und Effekte:
// - Kollisionsprüfung
// - Glitzer-Partikel (beim Sammeln, Konfetti am Ziel)
// - Deko: Wolken, Schmetterlinge, Boden-Schmuck
// - Zeichnen aller Level-Objekte (Blumen, Hindernisse, …)
// =====================================================

// Prüft, ob sich zwei rechteckige Hitboxen überlappen.
// Alle Angaben beziehen sich auf den MITTELPUNKT der Objekte.
function pruefeKollision(ax, ay, aBreite, aHoehe, bx, by, bBreite, bHoehe) {
    return Math.abs(ax - bx) < (aBreite + bBreite) / 2 &&
           Math.abs(ay - by) < (aHoehe + bHoehe) / 2;
}

// ---------- Partikel (Glitzer & Konfetti) ----------

function erzeugePartikel(liste, x, y, anzahl, emojis) {
    for (let i = 0; i < anzahl; i++) {
        liste.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: -Math.random() * 5 - 1,
            leben: 40 + Math.random() * 25, // Restlebenszeit in Frames
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            groesse: 14 + Math.random() * 12
        });
    }
}

function aktualisierePartikel(liste, dt) {
    for (let i = liste.length - 1; i >= 0; i--) {
        const p = liste[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.12 * dt; // Partikel segeln langsam nach unten
        p.leben -= dt;
        if (p.leben <= 0) liste.splice(i, 1);
    }
}

function zeichnePartikel(ctx, liste, kamera) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of liste) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.leben / 30)); // sanft ausblenden
        ctx.font = Math.round(p.groesse) + 'px ' + KONFIG.SCHRIFT;
        ctx.fillText(p.emoji, p.x - kamera, p.y);
    }
    ctx.globalAlpha = 1;
}

// ---------- Deko (Wolken, Schmetterlinge, Boden-Schmuck) ----------

// Erzeugt die Dekoration für ein Level (einmalig beim Levelstart).
function erzeugeDeko(level) {
    const wolken = [];
    const schmetterlinge = [];
    const boden = [];

    for (let i = 0; i < Math.ceil(level.laenge / 450); i++) {
        wolken.push({
            x: i * 450 + Math.random() * 250,
            y: 40 + Math.random() * 120,
            tempo: 0.15 + Math.random() * 0.2,
            groesse: 38 + Math.random() * 36
        });
    }

    // Tierchen: Schmetterlinge – oder was das Level vorgibt
    // (z. B. Glühwürmchen nachts, Fische unter Wasser)
    const tierArten = Array.isArray(level.tier)
        ? level.tier
        : [level.tier || KONFIG.SPRITES.schmetterling];
    const tierAbstand = level.wasser ? 700 : 1200; // unter Wasser mehr Fische
    for (let i = 0; i < Math.ceil(level.laenge / tierAbstand); i++) {
        schmetterlinge.push({
            x: 600 + i * tierAbstand + Math.random() * 400,
            y: 150 + Math.random() * 200,
            phase: Math.random() * Math.PI * 2,
            emoji: tierArten[i % tierArten.length]
        });
    }

    // Kleine Deko-Emojis, die auf der Wiese stehen (nicht einsammelbar)
    if (level.bodenDeko && level.bodenDeko.length) {
        for (let x = 150; x < level.laenge; x += 200 + Math.random() * 200) {
            boden.push({
                x: x,
                emoji: level.bodenDeko[Math.floor(Math.random() * level.bodenDeko.length)],
                groesse: 22 + Math.random() * 18
            });
        }
    }

    // Funkelnder Sternenhimmel für Nacht-Level
    const nachtSterne = [];
    if (level.nachts) {
        for (let i = 0; i < Math.ceil(level.laenge / 150); i++) {
            nachtSterne.push({
                x: i * 150 + Math.random() * 120,
                y: 15 + Math.random() * 220,
                groesse: 1 + Math.random() * 1.8,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    // Niederschlag (Bildschirm-Koordinaten – fällt unabhängig von der Kamera):
    // Regen (schnelle Striche) oder Schnee (langsam wehende Flocken)
    const regen = [];
    if (level.regen || level.schnee) {
        const anzahl = level.schnee ? 90 : 150;
        for (let i = 0; i < anzahl; i++) {
            regen.push({
                x: Math.random() * (KONFIG.BREITE + 120) - 60,
                y: Math.random() * KONFIG.HOEHE,
                laenge: 9 + Math.random() * 9,
                tempo: level.schnee ? (1.1 + Math.random() * 1.3) : (9 + Math.random() * 6),
                groesse: 2 + Math.random() * 2.5,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    // Gewitter: zählt bis zum nächsten Blitz herunter, "schein" ist
    // die Helligkeit des Aufleuchtens (klingt nach jedem Blitz ab).
    // aufloesen/t steuern das Ende: Sammelt Bella die Zauber-Sonne ein,
    // wird aufloesen=true gesetzt und t läuft 0→1 (Regen verschwindet,
    // Himmel hellt auf, die Sonne geht auf).
    const gewitter = level.gewitter
        ? { naechster: 100 + Math.random() * 180, schein: 0, bolzen: [], aufloesen: false, t: 0 }
        : null;

    return {
        wolken: wolken, schmetterlinge: schmetterlinge, boden: boden,
        nachtSterne: nachtSterne, regen: regen, gewitter: gewitter,
        schnee: !!level.schnee
    };
}

function aktualisiereDeko(deko, dt, level) {
    for (const wolke of deko.wolken) {
        wolke.x -= wolke.tempo * dt; // Wolken ziehen langsam nach links
        // Unter Wasser sind die "Wolken" Luftblasen und steigen auf
        if (level && level.wasser) {
            wolke.y -= wolke.tempo * 3 * dt;
            if (wolke.y < -30) wolke.y = KONFIG.BODEN_Y - 40 + Math.random() * 30;
        }
    }

    // Niederschlag fällt und wird oben neu eingesetzt.
    // Regen: schräg (Wind). Schnee: langsam, mit sanftem Hin- und Herwehen.
    if (deko.regen) {
        for (const r of deko.regen) {
            r.y += r.tempo * dt;
            if (deko.schnee) {
                r.x += Math.sin(r.y * 0.03 + r.phase) * 0.7 * dt;
            } else {
                r.x -= 2.5 * dt;
            }
            if (r.y > KONFIG.HOEHE) {
                r.y = -10;
                r.x = Math.random() * (KONFIG.BREITE + 120) - 60;
            }
            if (r.x < -60) r.x += KONFIG.BREITE + 120;
            if (r.x > KONFIG.BREITE + 60) r.x -= KONFIG.BREITE + 120;
        }
    }

    // Gewitter: Blitze in zufälligen Abständen
    if (deko.gewitter) {
        const g = deko.gewitter;
        if (g.schein > 0) g.schein -= 0.05 * dt;

        // Wird das Gewitter gerade aufgelöst, läuft t sanft auf 1
        if (g.aufloesen && g.t < 1) g.t = Math.min(1, g.t + dt / 90);

        // Neue Blitze nur, solange das Gewitter noch tobt
        if (!g.aufloesen) {
            g.naechster -= dt;
            if (g.naechster <= 0) {
                g.schein = 1;
                g.naechster = 150 + Math.random() * 260;

                // Festen, zackigen Blitz-Pfad erzeugen (von oben nach unten)
                let bx = 120 + Math.random() * (KONFIG.BREITE - 240);
                g.bolzen = [{ x: bx, y: 0 }];
                for (let i = 1; i <= 6; i++) {
                    bx += (Math.random() - 0.5) * 46;
                    g.bolzen.push({ x: bx, y: i / 6 * (KONFIG.BODEN_Y * 0.72) });
                }

                // Donner nur, während wirklich gespielt wird (nicht in Menüs)
                if (typeof spiel !== 'undefined' && spiel.zustand === 'spiel') Sound.donner();
            }
        }
    }
}

// Sonne/Mond + Sternenhimmel + Wolken + Schmetterlinge
// (vor dem Boden zeichnen)
function zeichneHimmelDeko(ctx, deko, kamera, zeit, level) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Funkelnde Sterne am Nachthimmel (mit leichter Parallaxe)
    if (level.nachts && deko.nachtSterne) {
        const sternSpanne = KONFIG.BREITE + 120;
        for (const s of deko.nachtSterne) {
            let sx = (s.x - kamera * 0.3) % sternSpanne;
            if (sx < -60) sx += sternSpanne;
            const funkeln = 0.35 + 0.65 * Math.abs(Math.sin(zeit * 0.05 + s.phase));
            ctx.fillStyle = 'rgba(255, 252, 230, ' + funkeln.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(sx, s.y, s.groesse, 0, Math.PI * 2);
            ctx.fill();
        }
        // Sanfter Lichthof um den Mond
        ctx.fillStyle = 'rgba(255, 250, 210, 0.15)';
        ctx.beginPath();
        ctx.arc(KONFIG.BREITE - 90, 80, 58, 0, Math.PI * 2);
        ctx.fill();
    }

    // Unter Wasser: sanfte Lichtstrahlen, die von oben hereinfallen
    if (level.wasser) {
        const strahlSpanne = KONFIG.BREITE + 300;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        for (let i = 0; i < 4; i++) {
            let bx = (((i * 280 - kamera * 0.2) % strahlSpanne) + strahlSpanne) % strahlSpanne - 150;
            ctx.beginPath();
            ctx.moveTo(bx, 0);
            ctx.lineTo(bx + 110, 0);
            ctx.lineTo(bx + 230, KONFIG.BODEN_Y);
            ctx.lineTo(bx + 70, KONFIG.BODEN_Y);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Himmelskörper (Sonne/Mond/Segelboot/…) bleibt fest am Bildschirm.
    // Im Gewitter-Level wird die Sturmwolke beim Auflösen sanft gegen
    // eine aufgehende Sonne ausgetauscht.
    ctx.font = '64px ' + KONFIG.SCHRIFT;
    if (level.regen && deko.gewitter && deko.gewitter.t > 0) {
        const t = deko.gewitter.t;
        const altA = ctx.globalAlpha;
        ctx.globalAlpha = altA * (1 - t);
        ctx.fillText('⛈️', KONFIG.BREITE - 90, 80);
        ctx.globalAlpha = altA * t;
        ctx.fillText('☀️', KONFIG.BREITE - 90, 80);
        ctx.globalAlpha = altA;
    } else {
        ctx.fillText(level.himmelskoerper, KONFIG.BREITE - 90, 80);
    }

    // Wolken mit Parallaxe (scrollen langsamer als die Welt);
    // nachts nur schemenhaft, unter Wasser sind es Luftblasen
    const wolkeEmoji = level.wolke || KONFIG.SPRITES.wolke;
    const spanne = KONFIG.BREITE + 240;
    const altAlpha = ctx.globalAlpha;
    if (level.nachts) ctx.globalAlpha = altAlpha * 0.4;
    for (const wolke of deko.wolken) {
        let sx = (wolke.x - kamera * 0.4) % spanne;
        if (sx < -120) sx += spanne;
        ctx.font = Math.round(level.wasser ? wolke.groesse * 0.5 : wolke.groesse) + 'px ' + KONFIG.SCHRIFT;
        ctx.fillText(wolkeEmoji, sx, wolke.y);
    }
    ctx.globalAlpha = altAlpha;

    // Tierchen (Schmetterlinge, Glühwürmchen, Fische, …)
    ctx.font = KONFIG.GROESSEN.schmetterling + 'px ' + KONFIG.SCHRIFT;
    for (const tier of deko.schmetterlinge) {
        const sx = tier.x - kamera + Math.sin(zeit * 0.03 + tier.phase) * 30;
        if (sx < -60 || sx > KONFIG.BREITE + 60) continue;
        const sy = tier.y + Math.sin(zeit * 0.08 + tier.phase) * 18;
        ctx.fillText(tier.emoji || KONFIG.SPRITES.schmetterling, sx, sy);
    }
}

// =====================================================
// Schwebende Plattform-Inseln
// p = { x: Mitte, y: Oberkante, breite }
// Bella kann von oben darauf landen (player.js).
// =====================================================
function zeichnePlattform(ctx, p, kamera, level) {
    const sx = p.x - kamera;
    if (sx + p.breite / 2 < -60 || sx - p.breite / 2 > KONFIG.BREITE + 60) return;

    // Farben kann das Level überschreiben (z. B. Korallenbänke
    // unter Wasser); Standard ist die Lavendel-Insel mit Gras
    const farben = (level && level.plattformFarben) || {
        koerper: '#c9b6ec', deckel: '#a7e3a0', halme: '#6fae67'
    };
    const links = sx - p.breite / 2;
    const outline = KONFIG.FARBEN.einhorn.outline;

    ctx.lineJoin = 'round';

    // Insel-Körper (rundlich)
    pfadRundesRechteck(ctx, links, p.y, p.breite, 26, 13);
    ctx.fillStyle = farben.koerper;
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Bewuchs-Streifen auf der Oberseite (Gras bzw. Seegras)
    pfadRundesRechteck(ctx, links + 3, p.y + 2, p.breite - 6, 10, 5);
    ctx.fillStyle = farben.deckel;
    ctx.fill();

    // Kleine Halme als Deko (fest pro Plattform, kein Zufall)
    ctx.strokeStyle = farben.halme;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let gx = links + 18; gx < links + p.breite - 12; gx += 24) {
        ctx.moveTo(gx, p.y + 3);
        ctx.lineTo(gx + 3, p.y - 4);
    }
    ctx.stroke();
}

// Deko-Emojis, die auf dem Boden stehen (nach dem Boden zeichnen)
function zeichneBodenDeko(ctx, deko, kamera) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const teil of deko.boden) {
        const sx = teil.x - kamera;
        if (sx < -60 || sx > KONFIG.BREITE + 60) continue;
        ctx.font = Math.round(teil.groesse) + 'px ' + KONFIG.SCHRIFT;
        ctx.fillText(teil.emoji, sx, KONFIG.BODEN_Y - teil.groesse / 2 + 6);
    }
}

// ---------- Level-Objekte zeichnen ----------

// Zeichnet ein einzelnes Level-Objekt (Blume, Hindernis, Stern, …).
// Sammel-Objekte schweben leicht auf und ab – das wirkt lebendig
// und zeigt Kindern: "Das kann ich einsammeln!"
function zeichneObjekt(ctx, obj, kamera, zeit) {
    const sx = obj.x - kamera;
    if (sx < -120 || sx > KONFIG.BREITE + 120) return; // außerhalb des Bildes

    // Hindernisse werden als große Cartoon-Figuren gezeichnet,
    // damit sie sich DEUTLICH von den Sammel-Objekten unterscheiden
    if (obj.typ === 'hindernis') {
        zeichneHindernis(ctx, obj, sx, zeit);
        return;
    }

    // Bewegliche Gegner (Krabbler, Flatterer, Werfer)
    if (obj.typ === 'gegner') {
        zeichneGegner(ctx, obj, sx, zeit);
        return;
    }

    // Korallen-Spalte (Wasser-Level): zwei Säulen mit Lücke zum Durchschwimmen
    if (obj.typ === 'spalt') {
        zeichneSpalt(ctx, obj, sx);
        return;
    }

    // Zauber-Sonne (Gewitter-Level): pulsierender warmer Schein, damit
    // klar ist "das ist etwas Besonderes – sammel mich ein!"
    if (obj.typ === 'sonne') {
        const sy = obj.y + Math.sin(zeit * 0.06 + obj.x) * 6;
        const puls = 34 + Math.sin(zeit * 0.12 + obj.x) * 5;
        const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, puls);
        glow.addColorStop(0, 'rgba(255, 232, 140, 0.95)');
        glow.addColorStop(1, 'rgba(255, 232, 140, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, puls, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '46px ' + KONFIG.SCHRIFT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☀️', sx, sy);
        return;
    }

    let dy = 0;
    if (obj.typ === 'blume') dy = Math.sin(zeit * 0.05 + obj.x) * 3;
    if (obj.typ === 'stern' || obj.typ === 'herz') dy = Math.sin(zeit * 0.08 + obj.x) * 6;

    // Seesterne (Unterwasser-Level) werden gezeichnet statt als Emoji
    if (obj.seestern) {
        zeichneSeestern(ctx, sx, obj.y + dy, zeit, obj.x);
        return;
    }

    const groesse = KONFIG.GROESSEN[obj.typ] || 40;
    ctx.font = groesse + 'px ' + KONFIG.SCHRIFT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(obj.emoji, sx, obj.y + dy);

    // Der Ziel-Regenbogen bekommt etwas Glitzer dazu
    if (obj.typ === 'ziel') {
        ctx.font = '26px ' + KONFIG.SCHRIFT;
        ctx.fillText('✨', sx - 70, obj.y - 40 + Math.sin(zeit * 0.07) * 8);
        ctx.fillText('✨', sx + 70, obj.y - 30 + Math.cos(zeit * 0.06) * 8);
    }
}

// =====================================================
// Hindernisse als große, deutliche Cartoon-Figuren
// (gleicher Stil wie Bella: kräftige dunkle Outline).
// Jedes Hindernis hat ein leicht grummeliges Gesicht –
// lieb, aber klar erkennbar: "Mich bitte überspringen!"
// =====================================================

function zeichneHindernis(ctx, obj, sx, zeit) {
    const boden = KONFIG.BODEN_Y;

    // Sanft pulsierender Warn-Schein am Boden
    const puls = 0.18 + 0.1 * Math.sin(zeit * 0.08 + obj.x);
    ctx.fillStyle = 'rgba(255, 107, 129, ' + puls.toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(sx, boden + 4, 36, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Leichtes "Wabern", damit das Hindernis ins Auge fällt
    const wabern = Math.sin(zeit * 0.06 + obj.x) * 0.025;

    ctx.save();
    ctx.translate(sx, boden);
    ctx.scale(1 + wabern, 1 - wabern);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (obj.art === 0) zeichnePilz(ctx);
    else if (obj.art === 1) zeichneKaktus(ctx);
    else if (obj.art === 3) zeichneSeeigel(ctx);
    else zeichneStein(ctx);

    ctx.restore();
}

// Freundlicher Seestern zum Einsammeln (Unterwasser-Level) –
// orange, mit lächelndem Gesicht, wackelt sanft hin und her
function zeichneSeestern(ctx, sx, sy, zeit, phase) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.sin(zeit * 0.05 + phase) * 0.15);
    ctx.lineJoin = 'round';

    pfadStern(ctx, 0, 0, 18);
    ctx.fillStyle = '#ff9a62';
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // fröhliches Gesicht (Sammel-Objekte lächeln!)
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-3.5, -1, 1.6, 0, Math.PI * 2);
    ctx.arc(3.5, -1, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 1.5, 3, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();

    ctx.restore();
}

// Stacheliger See-Igel (Unterwasser-Hindernis, art = 3)
function zeichneSeeigel(ctx) {
    const outline = KONFIG.FARBEN.einhorn.outline;

    // Stacheln rundherum
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        ctx.moveTo(Math.cos(a) * 14, -18 + Math.sin(a) * 14);
        ctx.lineTo(Math.cos(a) * 24, -18 + Math.sin(a) * 24);
    }
    ctx.stroke();

    // Körper
    ctx.beginPath();
    ctx.arc(0, -18, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#7d6bb0';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();

    zeichneGrummelGesicht(ctx, 0, -22);
}

// Kleines grummeliges Gesicht (zwei Augen + Schmollmund)
function zeichneGrummelGesicht(ctx, x, y) {
    ctx.fillStyle = KONFIG.FARBEN.einhorn.outline;
    ctx.beginPath();
    ctx.arc(x - 5, y, 1.9, 0, Math.PI * 2);
    ctx.arc(x + 5, y, 1.9, 0, Math.PI * 2);
    ctx.fill();
    // Schmollmund (nach oben gewölbter Bogen = grummelig)
    ctx.strokeStyle = KONFIG.FARBEN.einhorn.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + 9, 3.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
}

// Roter Fliegenpilz (Ursprung: Mitte unten am Boden)
function zeichnePilz(ctx) {
    const outline = KONFIG.FARBEN.einhorn.outline;

    // Stiel
    pfadRundesRechteck(ctx, -10, -30, 20, 30, 7);
    ctx.fillStyle = '#fff4e0';
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Hut
    ctx.beginPath();
    ctx.moveTo(-27, -26);
    ctx.quadraticCurveTo(-28, -54, 0, -56);
    ctx.quadraticCurveTo(28, -54, 27, -26);
    ctx.quadraticCurveTo(0, -34, -27, -26);
    ctx.closePath();
    ctx.fillStyle = '#ff6b81';
    ctx.fill();
    ctx.stroke();

    // Weiße Punkte auf dem Hut
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-12, -42, 4, 0, Math.PI * 2);
    ctx.arc(8, -47, 5, 0, Math.PI * 2);
    ctx.arc(17, -35, 3, 0, Math.PI * 2);
    ctx.fill();

    zeichneGrummelGesicht(ctx, 0, -20);
}

// Grüner Kaktus mit zwei Armen und Stacheln
function zeichneKaktus(ctx) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.fillStyle = '#79c46f';

    // Linker Arm (L-Form; der Ansatz wird vom Körper verdeckt)
    ctx.beginPath();
    ctx.moveTo(-8, -31);
    ctx.lineTo(-23, -31);
    ctx.quadraticCurveTo(-28, -31, -28, -36);
    ctx.lineTo(-28, -48);
    ctx.quadraticCurveTo(-28, -53, -23.5, -53);
    ctx.quadraticCurveTo(-19, -53, -19, -48);
    ctx.lineTo(-19, -40);
    ctx.lineTo(-8, -40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rechter Arm (etwas tiefer)
    ctx.beginPath();
    ctx.moveTo(8, -25);
    ctx.lineTo(22, -25);
    ctx.quadraticCurveTo(27, -25, 27, -30);
    ctx.lineTo(27, -40);
    ctx.quadraticCurveTo(27, -45, 22.5, -45);
    ctx.quadraticCurveTo(18, -45, 18, -40);
    ctx.lineTo(18, -34);
    ctx.lineTo(8, -34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Körper
    pfadRundesRechteck(ctx, -11, -52, 22, 52, 11);
    ctx.fill();
    ctx.stroke();

    // Stacheln (kurze Striche an Körper und Armen)
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, -16); ctx.lineTo(-16, -17);
    ctx.moveTo(-11, -26); ctx.lineTo(-16, -28);
    ctx.moveTo(11, -12);  ctx.lineTo(16, -13);
    ctx.moveTo(11, -20);  ctx.lineTo(16, -22);
    ctx.moveTo(-3, -52);  ctx.lineTo(-4, -57);
    ctx.moveTo(4, -52);   ctx.lineTo(5, -57);
    ctx.moveTo(-23.5, -53); ctx.lineTo(-24, -58);
    ctx.moveTo(22.5, -45);  ctx.lineTo(23, -50);
    ctx.stroke();

    zeichneGrummelGesicht(ctx, 0, -42);
}

// Grauer Felsbrocken
function zeichneStein(ctx) {
    const outline = KONFIG.FARBEN.einhorn.outline;

    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.quadraticCurveTo(-34, -20, -18, -30);
    ctx.quadraticCurveTo(-10, -42, 8, -38);
    ctx.quadraticCurveTo(26, -36, 29, -14);
    ctx.quadraticCurveTo(31, 0, 26, 0);
    ctx.closePath();
    ctx.fillStyle = '#b9c0cf';
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Heller Lichtfleck oben links
    ctx.fillStyle = '#d7dce6';
    ctx.beginPath();
    ctx.ellipse(-12, -26, 7, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();

    zeichneGrummelGesicht(ctx, 2, -20);
}

// =====================================================
// Boss-Level: Grummelwolke, Regenbogen-Strahlen, Tropfen
// (nur im Level mit Flag boss:true verwendet)
// =====================================================

// Die sechs Regenbogenfarben – für Strahlen und die Treffer-Leiste
const REGENBOGEN = ['#ff5d73', '#ffa14a', '#ffe14a', '#5ed17a', '#5ec6f0', '#9b7bea'];

// Zeichnet den aktuellen Boss je nach Art.
function zeichneBoss(ctx, boss, zeit) {
    if (boss.art === 'biene') zeichneBienenBoss(ctx, boss, zeit);
    else zeichneWolkenBoss(ctx, boss, zeit);
}

// Bonus-Sonne, die ab und zu hinter dem Boss hervorkommt (bringt ein Herz).
// Außerhalb des Boss-Zeichnens aufgerufen, damit beide Boss-Arten sie haben.
function zeichneBonusSonne(ctx, boss) {
    if (!boss || boss.sonneTimer <= 0) return;
    const a = Math.max(0, Math.min(1, boss.sonneTimer / 40, (150 - boss.sonneTimer) / 15));
    const sxs = boss.x, sys = boss.y - 84;
    const altA = ctx.globalAlpha;
    ctx.globalAlpha = altA * a;
    const glow = ctx.createRadialGradient(sxs, sys, 4, sxs, sys, 46);
    glow.addColorStop(0, 'rgba(255,230,140,0.95)');
    glow.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sxs, sys, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '52px ' + KONFIG.SCHRIFT;
    ctx.fillText('☀️', sxs, sys);
    ctx.globalAlpha = altA;
}

// Die Grummelwolke 🌩️ – eine schmollende Wolke, die mit jedem
// Treffer bunter und am Ende ganz fröhlich wird.
function zeichneWolkenBoss(ctx, boss, zeit) {
    const phase = Math.floor(boss.treffer / 3);
    const outline = KONFIG.FARBEN.einhorn.outline;

    // Beim Treffer kurz wackeln
    const ruck = boss.zittern > 0 ? Math.sin(zeit * 1.4) * 3 : 0;
    const x = boss.x + ruck;
    const y = boss.y;

    // Körperfarbe wird mit jeder Phase fröhlicher (grau → rosa → bunt → weiß)
    const farben = ['#b7bcca', '#d7b8d8', '#f4c4e4', '#ffffff'];
    const koerper = boss.besiegt ? '#ffffff' : farben[Math.min(phase, 3)];

    ctx.save();
    ctx.lineJoin = 'round';

    // Sanft pulsierender Schein (fröhlich-rosa, sobald besiegt)
    const puls = 0.16 + 0.07 * Math.sin(zeit * 0.1);
    ctx.fillStyle = (boss.besiegt ? 'rgba(255,170,225,' : 'rgba(110,120,150,') + puls.toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(x, y, 100, 74, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wolken-Ballen (überlappende Kreise). Outline = dunkle, etwas
    // größere Ballen DAHINTER (so entsteht eine saubere, fluffige Kontur).
    const ballen = [[-50, 8, 26], [-24, -10, 33], [12, -16, 35], [46, 0, 28], [26, 18, 30], [-10, 20, 31]];
    ctx.fillStyle = outline;
    for (const b of ballen) {
        ctx.beginPath();
        ctx.arc(x + b[0], y + b[1], b[2] + 3.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = koerper;
    for (const b of ballen) {
        ctx.beginPath();
        ctx.arc(x + b[0], y + b[1], b[2], 0, Math.PI * 2);
        ctx.fill();
    }

    // Heller Lichtfleck oben für ein bisschen Plastizität
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x - 18, y - 18, 16, 0, Math.PI * 2);
    ctx.arc(x + 14, y - 22, 13, 0, Math.PI * 2);
    ctx.fill();

    // ---------- Gesicht ----------
    const fx = x, fy = y + 4;

    // Augen
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(fx - 16, fy - 3, 4, 0, Math.PI * 2);
    ctx.arc(fx + 16, fy - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    if (boss.besiegt) {
        // Großes Lächeln + rosige Wangen
        ctx.beginPath();
        ctx.arc(fx, fy + 4, 12, Math.PI * 0.12, Math.PI * 0.88);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,150,200,0.7)';
        ctx.beginPath();
        ctx.arc(fx - 26, fy + 4, 6, 0, Math.PI * 2);
        ctx.arc(fx + 26, fy + 4, 6, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Grummelige Augenbrauen + Schmollmund (umgekehrter Bogen)
        ctx.beginPath();
        ctx.moveTo(fx - 24, fy - 15); ctx.lineTo(fx - 9, fy - 10);
        ctx.moveTo(fx + 24, fy - 15); ctx.lineTo(fx + 9, fy - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx, fy + 20, 10, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
    }

    ctx.restore();
}

// Korallen-Spalte: obere und untere Säule mit einer Lücke dazwischen.
// Die hellen Ränder markieren deutlich, wo der offene Spalt ist.
function zeichneSpalt(ctx, obj, sx) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    const w = obj.breite;
    const links = sx - w / 2;
    const gapTop = obj.gapY - obj.gapHeight / 2;
    const gapBot = obj.gapY + obj.gapHeight / 2;
    const koerper = '#c98a5e';   // Korallenfels
    const kante = '#79c9b4';     // helle Seegras-Kante am Spalt

    ctx.lineJoin = 'round';
    ctx.fillStyle = koerper;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;

    // Obere Säule (von oberhalb des Bildes bis zur Spalt-Oberkante)
    pfadRundesRechteck(ctx, links, -16, w, gapTop + 16, 14);
    ctx.fill();
    ctx.stroke();

    // Untere Säule (von Spalt-Unterkante bis unter den Boden)
    pfadRundesRechteck(ctx, links, gapBot, w, KONFIG.BODEN_Y - gapBot + 16, 14);
    ctx.fill();
    ctx.stroke();

    // Helle Korallen-Kanten am Spalt
    ctx.fillStyle = kante;
    pfadRundesRechteck(ctx, links + 2, gapTop - 9, w - 4, 11, 5);
    ctx.fill();
    pfadRundesRechteck(ctx, links + 2, gapBot - 2, w - 4, 11, 5);
    ctx.fill();

    // Ein paar kleine Korallen-Noppen als Deko
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(sx, gapTop - 30, 6, 0, Math.PI * 2);
    ctx.arc(sx, gapBot + 30, 6, 0, Math.PI * 2);
    ctx.fill();
}

// Herzen, die die Sonne im Boss-Level fallen lässt (zum Einfangen)
function zeichneBonusHerzen(ctx, liste, kamera, zeit) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const h of liste) {
        const sx = h.x - kamera;
        const sy = h.y + Math.sin(zeit * 0.1 + h.x) * 3;
        const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 20);
        glow.addColorStop(0, 'rgba(255,180,210,0.9)');
        glow.addColorStop(1, 'rgba(255,180,210,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '30px ' + KONFIG.SCHRIFT;
        ctx.fillText('💖', sx, sy);
    }
}

// Die Brummel-Biene 🐝 – wird mit jedem Treffer freundlicher und
// am Ende ganz lieb. Sie schlägt mit den Flügeln und zittert beim
// Ausholen (Warnung), bevor sie herabsticht.
function zeichneBienenBoss(ctx, boss, zeit) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    const phase = Math.floor(boss.treffer / 3);

    // Beim Treffer / Ausholen wackeln
    let ruck = boss.zittern > 0 ? Math.sin(zeit * 1.4) * 3 : 0;
    if (boss.stichPhase === 'warnung') ruck += Math.sin(zeit * 0.9) * 4;
    const x = boss.x + ruck;
    const y = boss.y;

    // Körperfarbe wird mit jeder Phase wärmer/freundlicher
    const farben = ['#f2b705', '#f7c52d', '#ffd84a', '#ffe88a'];
    const koerper = boss.besiegt ? '#ffe88a' : farben[Math.min(phase, 3)];

    ctx.save();
    ctx.lineJoin = 'round';

    // sanfter Schein
    const puls = 0.16 + 0.07 * Math.sin(zeit * 0.1);
    ctx.fillStyle = (boss.besiegt ? 'rgba(255,220,120,' : 'rgba(180,160,90,') + puls.toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(x, y, 78, 64, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flügel (schlagen schnell)
    const flap = Math.sin(zeit * 0.8) * 8;
    ctx.fillStyle = 'rgba(220,240,255,0.75)';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + s * 20, y - 26 - flap, 20, 13, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // Körper (rundlich) mit Outline
    ctx.beginPath();
    ctx.ellipse(x, y, 46, 38, 0, 0, Math.PI * 2);
    ctx.fillStyle = koerper;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = outline;
    ctx.stroke();

    // Schwarze Streifen
    ctx.fillStyle = '#2b2b3a';
    for (const dx of [-14, 8]) {
        ctx.beginPath();
        ctx.ellipse(x + dx + 12, y, 7, 34, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Stachel hinten unten
    ctx.fillStyle = '#2b2b3a';
    ctx.beginPath();
    ctx.moveTo(x - 44, y + 6);
    ctx.lineTo(x - 60, y + 14);
    ctx.lineTo(x - 42, y + 18);
    ctx.closePath();
    ctx.fill();

    // Fühler
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 34); ctx.lineTo(x + 16, y - 50);
    ctx.moveTo(x + 22, y - 32); ctx.lineTo(x + 32, y - 46);
    ctx.stroke();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(x + 16, y - 50, 3, 0, Math.PI * 2);
    ctx.arc(x + 32, y - 46, 3, 0, Math.PI * 2);
    ctx.fill();

    // Gesicht (vorne rechts)
    const fx = x + 20, fy = y - 2;
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(fx - 8, fy - 4, 3.5, 0, Math.PI * 2);
    ctx.arc(fx + 8, fy - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    if (boss.besiegt) {
        ctx.beginPath();
        ctx.arc(fx, fy + 4, 9, Math.PI * 0.12, Math.PI * 0.88);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,150,200,0.6)';
        ctx.beginPath();
        ctx.arc(fx - 16, fy + 4, 5, 0, Math.PI * 2);
        ctx.arc(fx + 16, fy + 4, 5, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // grummelige Brauen + Schmollmund
        ctx.beginPath();
        ctx.moveTo(fx - 14, fy - 12); ctx.lineTo(fx - 4, fy - 7);
        ctx.moveTo(fx + 14, fy - 12); ctx.lineTo(fx + 4, fy - 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx, fy + 14, 7, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
    }

    // Warn-Ausrufezeichen beim Ausholen
    if (boss.stichPhase === 'warnung') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '34px ' + KONFIG.SCHRIFT;
        ctx.fillText('❗', x, y - 60);
    }

    ctx.restore();
}

// Kleine Helfer-Bienen, die der Bienen-Boss ruft
function zeichneMinibienen(ctx, liste, kamera, zeit) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    for (const m of liste) {
        const sx = m.x - kamera;
        ctx.save();
        ctx.translate(sx, m.y);
        ctx.lineJoin = 'round';

        // Flügel
        const flap = Math.sin(zeit * 0.9 + m.t) * 4;
        ctx.fillStyle = 'rgba(220,240,255,0.8)';
        ctx.strokeStyle = outline;
        ctx.lineWidth = 1.5;
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(s * 6, -7 - flap, 6, 4, s * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Körper
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd84a';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();

        // Streifen
        ctx.fillStyle = '#2b2b3a';
        ctx.beginPath();
        ctx.ellipse(2, 0, 2, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(-4, 0, 2, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Augen
        ctx.beginPath();
        ctx.arc(6, -2, 1.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// Bewegt die Strahlen und merkt sich eine kurze Spur (Regenbogen-Schweif).
// Treffer auf die Wolke werden in game.js geprüft.
function aktualisiereStrahlen(liste, dt) {
    for (let i = liste.length - 1; i >= 0; i--) {
        const s = liste[i];
        s.spur.unshift({ x: s.x, y: s.y });
        if (s.spur.length > 7) s.spur.pop();
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.leben -= dt;
        if (s.leben <= 0 || s.y < -50 || s.x < -50 || s.x > KONFIG.BREITE + 50) {
            liste.splice(i, 1);
        }
    }
}

function zeichneStrahlen(ctx, liste, kamera) {
    for (const s of liste) {
        const sx = s.x - kamera;

        // Regenbogen-Schweif (verblasst nach hinten)
        for (let k = s.spur.length - 1; k >= 0; k--) {
            const p = s.spur[k];
            ctx.globalAlpha = (1 - k / s.spur.length) * 0.55;
            ctx.fillStyle = REGENBOGEN[(s.farbe + k) % REGENBOGEN.length];
            ctx.beginPath();
            ctx.arc(p.x - kamera, p.y, 6 - k * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Leuchtender Kopf
        const glanz = ctx.createRadialGradient(sx, s.y, 1, sx, s.y, 18);
        glanz.addColorStop(0, 'rgba(255,255,255,0.95)');
        glanz.addColorStop(0.4, REGENBOGEN[s.farbe]);
        glanz.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glanz;
        ctx.beginPath();
        ctx.arc(sx, s.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, s.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// =====================================================
// Gewittersturm-Level: Regenschleier + Blitze
// (über der Welt, aber unter dem HUD gezeichnet)
// =====================================================
function zeichneRegen(ctx, deko) {
    // Aufleuchten beim Blitz (heller Schein über der ganzen Szene)
    if (deko.gewitter && deko.gewitter.schein > 0) {
        const g = deko.gewitter;
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (g.schein * 0.45).toFixed(3) + ')';
        ctx.fillRect(0, 0, KONFIG.BREITE, KONFIG.HOEHE);

        // Der zackige Blitz selbst nur im ersten, hellsten Moment
        if (g.schein > 0.6 && g.bolzen.length) {
            ctx.save();
            ctx.strokeStyle = '#fff7c4';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.shadowColor = '#ffe14a';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.moveTo(g.bolzen[0].x, g.bolzen[0].y);
            for (let i = 1; i < g.bolzen.length; i++) ctx.lineTo(g.bolzen[i].x, g.bolzen[i].y);
            ctx.stroke();
            ctx.restore();
        }
    }

    // Schnee: weiche weiße Flocken
    if (deko.regen && deko.schnee) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (const r of deko.regen) {
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.groesse, 0, Math.PI * 2);
            ctx.fill();
        }
        return;
    }

    // Regenstreifen (leicht schräg = Wind) – verblassen beim Auflösen
    if (deko.regen) {
        const fade = deko.gewitter ? (1 - deko.gewitter.t) : 1;
        if (fade > 0.01) {
            ctx.strokeStyle = 'rgba(205, 220, 240, ' + (0.55 * fade).toFixed(3) + ')';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const r of deko.regen) {
                ctx.moveTo(r.x, r.y);
                ctx.lineTo(r.x - 3, r.y + r.laenge);
            }
            ctx.stroke();
        }
    }
}

// Bunte Energie-Funken, die die Wolke fallen lässt (zum Einsammeln).
// Ein leuchtender Regenbogen-Ball – klar erkennbar als "fang mich!".
function zeichneFunken(ctx, liste, kamera, zeit) {
    for (const f of liste) {
        const sx = f.x - kamera;
        const wackeln = Math.sin(zeit * 0.2 + f.phase) * 2;

        // weicher Schein
        const glow = ctx.createRadialGradient(sx, f.y, 1, sx, f.y, 16);
        glow.addColorStop(0, 'rgba(255,255,255,0.95)');
        glow.addColorStop(0.5, REGENBOGEN[f.farbe]);
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx + wackeln, f.y, 16, 0, Math.PI * 2);
        ctx.fill();

        // bunter Kern mit weißem Rand
        ctx.fillStyle = REGENBOGEN[f.farbe];
        ctx.beginPath();
        ctx.arc(sx + wackeln, f.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Graue Grummel-Tropfen, die die Wolke fallen lässt (zum Ausweichen)
function zeichneTropfen(ctx, liste, kamera) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    for (const t of liste) {
        const sx = t.x - kamera;
        ctx.beginPath();
        ctx.moveTo(sx, t.y - 12);
        ctx.quadraticCurveTo(sx + 9, t.y + 2, sx, t.y + 9);
        ctx.quadraticCurveTo(sx - 9, t.y + 2, sx, t.y - 12);
        ctx.closePath();
        ctx.fillStyle = '#8b94a8';
        ctx.fill();
        ctx.strokeStyle = outline;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(sx - 2.5, t.y - 1, 1.8, 0, Math.PI * 2);
        ctx.fill();
    }
}

// =====================================================
// Bewegliche Gegner (in den Lauf-Leveln)
// Gleicher Cartoon-Stil wie die Hindernisse: kräftige dunkle
// Outline, rundliche Formen, grummeliges (aber liebes) Gesicht.
//   - krabbler: läuft am Boden hin und her
//   - flieger:  flattert in der Luft auf und ab
//   - werfer:   sitzt am Boden und schleudert Matschbälle
// =====================================================

function zeichneGegner(ctx, obj, sx, zeit) {
    if (obj.art === 'flieger') zeichneFlieger(ctx, obj, sx, obj.y, zeit);
    else if (obj.art === 'fledermaus') zeichneFledermaus(ctx, obj, sx, obj.y, zeit);
    else if (obj.art === 'werfer') zeichneWerfer(ctx, obj, sx, zeit);
    else if (obj.art === 'pinguin') zeichnePinguin(ctx, obj, sx, zeit);
    else zeichneKrabbler(ctx, obj, sx, zeit);
}

// Watschelnder Pinguin (Eis-Level): schwarz-weiß, oranger Schnabel & Füße
function zeichnePinguin(ctx, obj, sx, zeit) {
    const boden = KONFIG.BODEN_Y;
    const outline = KONFIG.FARBEN.einhorn.outline;

    // Schatten
    ctx.fillStyle = 'rgba(43,43,58,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, boden + 4, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(sx, boden);
    if (obj.richtung === 1) ctx.scale(-1, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Watschel-Füße
    const w = Math.sin(zeit * 0.3) * 3;
    ctx.fillStyle = '#ffa14a';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 6, -2 + (s > 0 ? w : -w), 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // Körper (schwarz/dunkel)
    ctx.beginPath();
    ctx.ellipse(0, -22, 15, 21, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a3550';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = outline;
    ctx.stroke();

    // Weißer Bauch
    ctx.beginPath();
    ctx.ellipse(0, -19, 9.5, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Flügelchen seitlich
    ctx.fillStyle = '#3a3550';
    ctx.beginPath();
    ctx.ellipse(-14, -22, 4, 11, 0.2, 0, Math.PI * 2);
    ctx.ellipse(14, -22, 4, 11, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Augen
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-4, -32, 2, 0, Math.PI * 2);
    ctx.arc(4, -32, 2, 0, Math.PI * 2);
    ctx.fill();

    // Oranger Schnabel
    ctx.fillStyle = '#ffa14a';
    ctx.beginPath();
    ctx.moveTo(-3, -28);
    ctx.lineTo(3, -28);
    ctx.lineTo(0, -24);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
}

// Kleiner watschelnder Boden-Krabbler
function zeichneKrabbler(ctx, obj, sx, zeit) {
    const boden = KONFIG.BODEN_Y;
    const outline = KONFIG.FARBEN.einhorn.outline;
    const farbe = obj.farbe || '#9b7bea';

    // Schatten
    ctx.fillStyle = 'rgba(43,43,58,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, boden + 4, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(sx, boden);
    if (obj.richtung === 1) ctx.scale(-1, 1); // schaut in Laufrichtung
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Watschelnde Beinchen
    const b = Math.sin(zeit * 0.3) * 3;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, -5); ctx.lineTo(-13, 1 + b);
    ctx.moveTo(0, -5);  ctx.lineTo(0, 1 - b);
    ctx.moveTo(9, -5);  ctx.lineTo(13, 1 + b);
    ctx.stroke();

    // Fühler mit Knubbel
    ctx.beginPath();
    ctx.moveTo(-6, -34); ctx.lineTo(-11, -44);
    ctx.moveTo(6, -34);  ctx.lineTo(11, -44);
    ctx.stroke();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-11, -44, 2.5, 0, Math.PI * 2);
    ctx.arc(11, -44, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Runder Körper
    ctx.beginPath();
    ctx.arc(0, -18, 17, 0, Math.PI * 2);
    ctx.fillStyle = farbe;
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Hellerer Bauch
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(0, -13, 9, 0, Math.PI * 2);
    ctx.fill();

    zeichneGrummelGesicht(ctx, 0, -20);
    ctx.restore();
}

// Flatternder Luft-Gegner
function zeichneFlieger(ctx, obj, sx, sy, zeit) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    const farbe = obj.farbe || '#6e7bd6';

    ctx.save();
    ctx.translate(sx, sy);
    if (obj.richtung === 1) ctx.scale(-1, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Flügel schlagen (oben/unten)
    const flap = Math.sin(zeit * 0.5) * 7;
    ctx.fillStyle = farbe;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 4, -2);
        ctx.quadraticCurveTo(s * 22, -10 - flap, s * 26, 2 - flap);
        ctx.quadraticCurveTo(s * 18, 4, s * 4, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // Körper
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = farbe;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();

    // Hellerer Bauch
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    zeichneGrummelGesicht(ctx, 0, -2);
    ctx.restore();
}

// Fledermaus mit schlagenden, gezackten Flügeln und leuchtenden Augen
// (gut sichtbar im dunklen Level)
function zeichneFledermaus(ctx, obj, sx, sy, zeit) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    const farbe = obj.farbe || '#5b4a86';

    ctx.save();
    ctx.translate(sx, sy);
    if (obj.richtung === 1) ctx.scale(-1, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const flap = Math.sin(zeit * 0.5) * 6;
    ctx.fillStyle = farbe;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;

    // Gezackte Flügel links und rechts
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 5, -2);
        ctx.lineTo(s * 16, -10 - flap);
        ctx.lineTo(s * 15, -3 - flap * 0.5);
        ctx.lineTo(s * 27, -6 - flap);
        ctx.lineTo(s * 24, 4);
        ctx.lineTo(s * 14, 2);
        ctx.lineTo(s * 7, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // Körper
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = farbe;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();

    // Spitze Ohren
    ctx.beginPath();
    ctx.moveTo(-5, -8); ctx.lineTo(-7, -16); ctx.lineTo(-1, -9);
    ctx.moveTo(5, -8);  ctx.lineTo(7, -16);  ctx.lineTo(1, -9);
    ctx.closePath();
    ctx.fillStyle = farbe;
    ctx.fill();
    ctx.stroke();

    // Leuchtende gelbe Augen mit dunkler Pupille
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    ctx.arc(-3.5, -1, 2.2, 0, Math.PI * 2);
    ctx.arc(3.5, -1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-3.5, -1, 1, 0, Math.PI * 2);
    ctx.arc(3.5, -1, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Dicker Boden-Werfer mit großem Maul (öffnet sich kurz vorm Wurf)
function zeichneWerfer(ctx, obj, sx, zeit) {
    const boden = KONFIG.BODEN_Y;
    const outline = KONFIG.FARBEN.einhorn.outline;
    const farbe = obj.farbe || '#6fae67';
    const gleichBereit = obj.wurfTimer < 22; // Maul auf, gleich kommt ein Wurf

    // Schatten
    ctx.fillStyle = 'rgba(43,43,58,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, boden + 4, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(sx, boden);
    // schaut Richtung Bella (wird in game.js in obj.blick gesetzt)
    if (obj.blick === 1) ctx.scale(-1, 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Breiter, knubbeliger Körper
    pfadRundesRechteck(ctx, -22, -34, 44, 34, 16);
    ctx.fillStyle = farbe;
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Großes Maul
    ctx.fillStyle = '#5a2d3a';
    ctx.beginPath();
    if (gleichBereit) {
        ctx.ellipse(0, -12, 11, 8, 0, 0, Math.PI * 2); // weit offen
    } else {
        ctx.ellipse(0, -10, 11, 3.5, 0, 0, Math.PI * 2); // grummelige Linie
    }
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Augen oben drauf (mit grummeligen Brauen)
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(-9, -30, 2.6, 0, Math.PI * 2);
    ctx.arc(9, -30, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-14, -36); ctx.lineTo(-5, -33);
    ctx.moveTo(14, -36);  ctx.lineTo(5, -33);
    ctx.stroke();

    ctx.restore();
}

// Geworfene Matschbälle (drehen sich im Flug)
function zeichneGeschosse(ctx, liste, kamera) {
    const outline = KONFIG.FARBEN.einhorn.outline;
    for (const g of liste) {
        const sx = g.x - kamera;
        ctx.save();
        ctx.translate(sx, g.y);
        ctx.rotate(g.dreh || 0);
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#9c7b5a';
        ctx.fill();
        ctx.strokeStyle = outline;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // ein paar dunkle Matsch-Flecken
        ctx.fillStyle = 'rgba(60,40,25,0.5)';
        ctx.beginPath();
        ctx.arc(-3, -2, 2.2, 0, Math.PI * 2);
        ctx.arc(3, 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

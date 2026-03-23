/**
 * SVG-Visualisierung des maximalen Baukörpers nach BO Wien
 * Drei Ansichten: Lageplan (Draufsicht), Schnitt, Isometrie
 */

import type { BauParam } from './bau-types'

export type { BauParam }

const IKB      = '#002FA7'
const IKB_MID  = '#4B6FD0'
const BEIGE    = '#F4F3F1'
const GRAY     = '#555555'
const GRAY_LT  = '#999999'
const BORDER   = '#CCCCAA'
const HATCH_C  = '#C8C4BA'
const FONT     = "'DIN Condensed','Arial Narrow',Arial,sans-serif"

// ─── Helper: SVG-Primitives ──────────────────────────────────────────────────

function line(x1: number, y1: number, x2: number, y2: number, attr = '') {
  return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" ${attr}/>`
}

function rect(x: number, y: number, w: number, h: number, attr = '') {
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" ${attr}/>`
}

function text(x: number, y: number, s: string, attr = '') {
  return `<text x="${r(x)}" y="${r(y)}" ${attr}>${esc(s)}</text>`
}

function r(n: number) { return Math.round(n * 10) / 10 }
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Horizontale Bemaßungslinie
function dimH(x1: number, x2: number, y: number, label: string, arrowDown = false): string {
  const ay = arrowDown ? y + 5 : y - 5
  const tickDir = arrowDown ? -1 : 1
  return [
    line(x1, y, x2, y, `stroke="${GRAY_LT}" stroke-width="0.6"`),
    line(x1, y, x1, y - tickDir * 6, `stroke="${GRAY_LT}" stroke-width="0.6"`),
    line(x2, y, x2, y - tickDir * 6, `stroke="${GRAY_LT}" stroke-width="0.6"`),
    `<polygon points="${r(x1)},${r(ay)} ${r(x1 + 4)},${r(y)} ${r(x1 + 4)},${r(ay)}" fill="${GRAY_LT}"/>`,
    `<polygon points="${r(x2)},${r(ay)} ${r(x2 - 4)},${r(y)} ${r(x2 - 4)},${r(ay)}" fill="${GRAY_LT}"/>`,
    text((x1 + x2) / 2, arrowDown ? y + 14 : y - 4, label,
      `text-anchor="middle" font-size="7.5" fill="${GRAY}" font-family="${FONT}"`),
  ].join('\n')
}

// Vertikale Bemaßungslinie
function dimV(y1: number, y2: number, x: number, label: string): string {
  return [
    line(x, y1, x, y2, `stroke="${GRAY_LT}" stroke-width="0.6"`),
    line(x, y1, x + 6, y1, `stroke="${GRAY_LT}" stroke-width="0.6"`),
    line(x, y2, x + 6, y2, `stroke="${GRAY_LT}" stroke-width="0.6"`),
    `<polygon points="${r(x - 5)},${r(y1)} ${r(x)},${r(y1 + 4)} ${r(x - 5)},${r(y1 + 4)}" fill="${GRAY_LT}"/>`,
    `<polygon points="${r(x - 5)},${r(y2)} ${r(x)},${r(y2 - 4)} ${r(x - 5)},${r(y2 - 4)}" fill="${GRAY_LT}"/>`,
    text(x + 9, (y1 + y2) / 2 + 3, label,
      `text-anchor="start" font-size="7.5" fill="${GRAY}" font-family="${FONT}"`),
  ].join('\n')
}

// Nordpfeil
function northArrow(cx: number, cy: number): string {
  return [
    `<polygon points="${r(cx)},${r(cy - 12)} ${r(cx - 5)},${r(cy + 2)} ${r(cx)},${r(cy - 2)}" fill="${IKB}"/>`,
    `<polygon points="${r(cx)},${r(cy - 12)} ${r(cx + 5)},${r(cy + 2)} ${r(cx)},${r(cy - 2)}" fill="${GRAY_LT}"/>`,
    text(cx, cy + 14, 'N', `text-anchor="middle" font-size="8" fill="${IKB}" font-family="${FONT}" font-weight="bold"`),
  ].join('\n')
}

// Legendenzeile
function legendRow(x: number, y: number, color: string, fill: string, dash: string, label: string): string {
  return [
    rect(x, y - 6, 14, 8, `fill="${fill}" stroke="${color}" stroke-width="0.8" stroke-dasharray="${dash}"`),
    text(x + 18, y + 1, label, `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`),
  ].join('\n')
}

// ─── Lageplan ────────────────────────────────────────────────────────────────

export function generateLageplan(p: BauParam): string {
  const W = 560, H = 440
  const PAD_L = 56, PAD_T = 40, PAD_R = 160, PAD_B = 60

  const aW = W - PAD_L - PAD_R
  const aH = H - PAD_T - PAD_B
  const scale = Math.min(aW / p.breite_m, aH / p.tiefe_m) * 0.88

  const pW = p.breite_m * scale
  const pH = p.tiefe_m * scale
  const ox = PAD_L + (aW - pW) / 2
  const oy = PAD_T + (aH - pH) / 2

  const sv = p.bauwich_vorne_m * scale
  const sh = p.bauwich_hinten_m * scale
  const ss = p.bauwich_seitlich_m * scale

  const bkX = ox + ss
  const bkY = oy + sv
  const bkW = Math.max(0, pW - 2 * ss)
  const bkH = Math.max(0, pH - sv - sh)

  const lx = W - PAD_R + 14  // Legende x

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
  <defs>
    <pattern id="lp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="${HATCH_C}" stroke-width="1.2"/>
    </pattern>
    <pattern id="lp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="20" y2="0" stroke="#E8E6E0" stroke-width="0.4"/>
      <line x1="0" y1="0" x2="0" y2="20" stroke="#E8E6E0" stroke-width="0.4"/>
    </pattern>
  </defs>

  <!-- Hintergrund & Raster -->
  <rect width="${W}" height="${H}" fill="white"/>
  <rect x="${PAD_L}" y="${PAD_T}" width="${aW}" height="${aH}" fill="url(#lp-grid)"/>

  <!-- Titel -->
  <text x="${PAD_L}" y="22" font-size="8" fill="${GRAY_LT}" letter-spacing="2" font-family="${FONT}" text-transform="uppercase">LAGEPLAN — MAXIMALE BEBAUUNG</text>
  <line x1="${PAD_L}" y1="28" x2="${W - PAD_R}" y2="28" stroke="${BORDER}" stroke-width="0.5"/>

  <!-- Abstandsflächen (Bauwich) -->
  ${rect(ox, oy, pW, pH, `fill="url(#lp-hatch)" stroke="none"`)}

  <!-- Grundstücksgrenze -->
  ${rect(ox, oy, pW, pH, `fill="none" stroke="${GRAY}" stroke-width="1.6" stroke-dasharray="6,3"`)}

  <!-- Baukörper -->
  ${bkW > 0 && bkH > 0 ? rect(bkX, bkY, bkW, bkH, `fill="${IKB}" fill-opacity="0.18" stroke="${IKB}" stroke-width="2"`) : ''}

  <!-- Bemaßung: Breite -->
  ${dimH(ox, ox + pW, oy - 16, `${p.breite_m} m`)}
  ${bkW > 0 ? dimH(bkX, bkX + bkW, oy + pH + 22, `${p.baukörper_breite_m} m`, true) : ''}

  <!-- Bemaßung: Tiefe -->
  ${dimV(oy, oy + pH, ox - 16, `${p.tiefe_m} m`)}
  ${bkH > 0 ? dimV(bkY, bkY + bkH, ox + pW + 14, `${p.baukörper_tiefe_m} m`) : ''}

  <!-- Bauwich-Beschriftungen -->
  ${p.bauwich_vorne_m > 0 ? text(ox + pW / 2, oy + sv / 2 + 3, `Bauwich v. ${p.bauwich_vorne_m} m`, `text-anchor="middle" font-size="7" fill="${GRAY}" font-family="${FONT}"`) : ''}
  ${p.bauwich_hinten_m > 0 ? text(ox + pW / 2, oy + pH - sh / 2 + 3, `Bauwich h. ${p.bauwich_hinten_m} m`, `text-anchor="middle" font-size="7" fill="${GRAY}" font-family="${FONT}"`) : ''}
  ${p.bauwich_seitlich_m > 0 && ss > 6 ? text(ox + ss / 2, oy + pH / 2, `${p.bauwich_seitlich_m}m`, `text-anchor="middle" font-size="6.5" fill="${GRAY}" font-family="${FONT}" transform="rotate(-90,${r(ox + ss / 2)},${r(oy + pH / 2)})"`) : ''}

  <!-- Nordpfeil -->
  ${northArrow(ox + pW + 24, oy + 22)}

  <!-- Legende -->
  <line x1="${lx - 4}" y1="${PAD_T}" x2="${lx - 4}" y2="${H - 30}" stroke="${BORDER}" stroke-width="0.5"/>
  ${text(lx, PAD_T + 12, 'LEGENDE', `font-size="7" fill="${GRAY_LT}" letter-spacing="1.5" font-family="${FONT}"`)}
  ${legendRow(lx, PAD_T + 28, GRAY, BEIGE, '6,3', 'Grundstücksgrenze')}
  ${legendRow(lx, PAD_T + 44, HATCH_C, 'url(#lp-hatch)', '', 'Bauwich §78 BO Wien')}
  ${legendRow(lx, PAD_T + 60, IKB, `${IKB}30`, '', 'max. Baukörper')}

  <line x1="${lx}" y1="${PAD_T + 70}" x2="${lx + 120}" y2="${PAD_T + 70}" stroke="${BORDER}" stroke-width="0.4"/>
  ${text(lx, PAD_T + 84, `Widmung: ${p.widmung}`, `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
  ${text(lx, PAD_T + 96, `BKl. ${p.bauklasse}`, `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
  ${text(lx, PAD_T + 108, p.bebauungsweise_text.replace('Bebauungsweise', 'BW').replace('offene', 'o.').replace('geschlossene', 'g.').replace('gekuppelte', 'gk.').replace('gemischte', 'gr.'), `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}

  <line x1="${lx}" y1="${PAD_T + 118}" x2="${lx + 120}" y2="${PAD_T + 118}" stroke="${BORDER}" stroke-width="0.4"/>
  ${text(lx, PAD_T + 132, `Bebauungsgrad: ${Math.round(p.bebauungsgrad * 100)} %`, `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
  ${text(lx, PAD_T + 144, `beb. Fläche: ${p.bebaute_flaeche_max_m2} m²`, `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
  ${text(lx, PAD_T + 156, `BGF: ${p.bgf_gesamt_m2} m²`, `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
  ${text(lx, PAD_T + 168, `NGF: ${p.ngf_geschaetzt_m2} m²`, `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}

  <!-- Maßstab -->
  ${text(ox, H - 12, `Maßstab ~1:${Math.round(1 / scale * 100 / 100) * 100 || 500}`, `font-size="7" fill="${GRAY_LT}" font-family="${FONT}"`)}

  <!-- Grundstücksfläche Label -->
  ${text(ox + pW / 2, oy + pH / 2 + 4, `${p.grundstueck_m2} m²`, `text-anchor="middle" font-size="9" fill="${GRAY_LT}" font-family="${FONT}"`)}
</svg>`
}

// ─── Schnitt ─────────────────────────────────────────────────────────────────

export function generateSchnitt(p: BauParam): string {
  const W = 560, H = 360
  const PAD_L = 72, PAD_R = 80, PAD_T = 36, PAD_B = 60

  const aW = W - PAD_L - PAD_R
  const aH = H - PAD_T - PAD_B

  const bkW = p.baukörper_breite_m
  const bkT = p.baukörper_tiefe_m
  // Schnittbreite = Baukörperbreite, aber min 60% der Gesamtbreite
  const scaleW = Math.min(aW / Math.max(bkW, p.breite_m), aW / 8)
  const scaleH = aH / (p.gebaeudehoehe_max_m + 3.5)  // Platz für Dach

  // Horizontale Positionen
  const plotX1 = PAD_L + (aW - p.breite_m * scaleW) / 2
  const plotX2 = plotX1 + p.breite_m * scaleW
  const bkX1 = PAD_L + (aW - bkW * scaleW) / 2
  const bkX2 = bkX1 + bkW * scaleW

  // Vertikale Positionen (Boden unten)
  const groundY = H - PAD_B
  const traufeY = groundY - p.gebaeudehoehe_max_m * scaleH
  const gescHoehe = p.gebaeudehoehe_max_m / p.max_geschosse

  // Dachhöhe
  const dachH = p.dachform === 'sattel' ? bkW * scaleW * 0.35 : 6
  const firstY = traufeY - dachH

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
  <rect width="${W}" height="${H}" fill="white"/>

  <!-- Titel -->
  <text x="${PAD_L}" y="22" font-size="8" fill="${GRAY_LT}" letter-spacing="2" font-family="${FONT}">SCHNITT — GEBÄUDEHÖHE §75 BO WIEN</text>
  <line x1="${PAD_L}" y1="28" x2="${W - PAD_R}" y2="28" stroke="${BORDER}" stroke-width="0.5"/>

  <!-- Gelände -->
  <rect x="${plotX1 - 20}" y="${groundY}" width="${p.breite_m * scaleW + 40}" height="10" fill="${BEIGE}" stroke="${BORDER}" stroke-width="0.8"/>
  ${text((plotX1 + plotX2) / 2, groundY + 8, 'Geländeniveau (Niveaulinie)', `text-anchor="middle" font-size="7" fill="${GRAY_LT}" font-family="${FONT}"`)}

  <!-- Bauwich vorne/hinten (schraffiert) -->
  ${p.bauwich_vorne_m > 0 ? `
  <rect x="${plotX1}" y="${traufeY}" width="${p.bauwich_vorne_m * scaleW}" height="${p.gebaeudehoehe_max_m * scaleH}" fill="#F0EDE8" stroke="none" opacity="0.7"/>
  ` : ''}

  <!-- Baukörper Wandfläche -->
  ${rect(bkX1, traufeY, bkW * scaleW, p.gebaeudehoehe_max_m * scaleH, `fill="${IKB}" fill-opacity="0.12" stroke="${IKB}" stroke-width="1.8"`)}

  <!-- Geschosslinien -->
  ${Array.from({ length: p.max_geschosse - 1 }, (_, i) => {
    const y = groundY - (i + 1) * gescHoehe * scaleH
    return line(bkX1, y, bkX2, y, `stroke="${IKB_MID}" stroke-width="0.7" stroke-dasharray="6,3"`)
  }).join('\n  ')}

  <!-- Geschossbeschriftung -->
  ${Array.from({ length: p.max_geschosse }, (_, i) => {
    const y = groundY - (i + 0.5) * gescHoehe * scaleH
    const label = i === 0 ? 'EG' : i === 1 ? 'OG 1' : i === 2 ? 'OG 2' : i === 3 ? 'OG 3' : `OG ${i}`
    return text(bkX1 + 5, y + 3, label, `font-size="7.5" fill="${IKB}" font-family="${FONT}"`)
  }).join('\n  ')}

  <!-- Dach -->
  ${p.dachform === 'sattel' ? `
  <polygon points="${r(bkX1)},${r(traufeY)} ${r((bkX1 + bkX2) / 2)},${r(firstY)} ${r(bkX2)},${r(traufeY)}"
    fill="${IKB}" fill-opacity="0.20" stroke="${IKB}" stroke-width="1.6"/>
  ` : `
  <rect x="${r(bkX1)}" y="${r(firstY)}" width="${r(bkW * scaleW)}" height="${6}"
    fill="${IKB}" fill-opacity="0.25" stroke="${IKB}" stroke-width="1.2"/>
  `}

  <!-- Bemaßung: Gebäudehöhe §75 BO Wien -->
  ${dimV(traufeY, groundY, bkX2 + 14, `§75 GH ${p.gebaeudehoehe_max_m} m`)}

  <!-- Bemaßung: Traufenlinie -->
  ${line(bkX1 - 20, traufeY, bkX2 + 60, traufeY, `stroke="${IKB_MID}" stroke-width="0.7" stroke-dasharray="8,4"`)}
  ${text(bkX2 + 14, traufeY - 4, 'Traufenlinie', `font-size="7.5" fill="${IKB}" font-family="${FONT}"`)}

  ${p.dachform === 'sattel' ? `
  <!-- Bemaßung: Firstlinie -->
  ${line(bkX1 - 20, firstY, (bkX1 + bkX2) / 2 - 5, firstY, `stroke="${GRAY_LT}" stroke-width="0.7" stroke-dasharray="6,3"`)}
  ${text(bkX1 - 18, firstY - 4, 'Firstlinie', `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
  ` : ''}

  <!-- Bemaßung: Breite Baukörper -->
  ${dimH(bkX1, bkX2, groundY + 30, `${p.baukörper_breite_m} m`, true)}

  <!-- Bemaßung: Gesamtbreite -->
  ${dimH(plotX1, plotX2, groundY + 46, `${p.breite_m} m`, true)}

  <!-- Bauwich Pfeil (vorne) -->
  ${p.bauwich_vorne_m > 0 ? dimH(plotX1, bkX1, groundY + 30, `BW ${p.bauwich_vorne_m} m`, true) : ''}

  <!-- Info rechts -->
  ${text(W - PAD_R + 6, PAD_T + 14, `BKl. ${p.bauklasse}`, `font-size="9" fill="${IKB}" font-family="${FONT}" font-weight="bold"`)}
  ${text(W - PAD_R + 6, PAD_T + 28, `${p.max_geschosse} Gesch.`, `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
  ${text(W - PAD_R + 6, PAD_T + 40, p.dachform === 'sattel' ? 'Satteldach' : 'Flachdach', `font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
</svg>`
}

// ─── Isometrie ───────────────────────────────────────────────────────────────

export function generateIsometrie(p: BauParam): string {
  const W = 560, H = 380

  // Isometrische Projektion: x→rechts, z→vorne (Tiefe), y→hoch
  const S = Math.min(280 / p.baukörper_breite_m, 200 / p.baukörper_tiefe_m, 160 / p.gebaeudehoehe_max_m)
  const bkW = p.baukörper_breite_m * S
  const bkD = p.baukörper_tiefe_m * S
  const bkH = p.gebaeudehoehe_max_m * S

  const cx = W * 0.42
  const cy = H * 0.62

  // Isometrische Projektion (Standardwinkel 30°)
  const isoX = (x: number, z: number) => cx + (x - z) * 0.6
  const isoY = (x: number, y: number, z: number) => cy - y * 0.85 + (x + z) * 0.30

  // Eckpunkte des Baukörpers (x=0=links, z=0=vorne)
  const P = (x: number, y: number, z: number) => ({ x: isoX(x, z), y: isoY(x, y, z) })

  // Bodengrundriss-Ecken
  const p00 = P(0, 0, 0), p10 = P(bkW, 0, 0)
  const p01 = P(0, 0, bkD), p11 = P(bkW, 0, bkD)

  // Deckenecken
  const t00 = P(0, bkH, 0), t10 = P(bkW, bkH, 0)
  const t01 = P(0, bkH, bkD), t11 = P(bkW, bkH, bkD)

  function poly(pts: Array<{ x: number; y: number }>, attr: string) {
    return `<polygon points="${pts.map(pt => `${r(pt.x)},${r(pt.y)}`).join(' ')}" ${attr}/>`
  }

  // Dach
  const firstPtLeft = P(0, bkH + bkW * 0.35, bkD / 2)
  const firstPtRight = P(bkW, bkH + bkW * 0.35, bkD / 2)

  const sattelFront = [t00, t10, firstPtRight, firstPtLeft]
  const sattelRight = [t10, t11, firstPtRight]
  // Satteldach Rückseite + linke Seite:
  const sattelBack = [t01, t11, firstPtRight, firstPtLeft]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
  <rect width="${W}" height="${H}" fill="white"/>

  <!-- Titel -->
  <text x="28" y="22" font-size="8" fill="${GRAY_LT}" letter-spacing="2" font-family="${FONT}">ISOMETRIE — MAX. BAUKÖRPER</text>
  <line x1="28" y1="28" x2="${W - 20}" y2="28" stroke="${BORDER}" stroke-width="0.5"/>

  <!-- Geländefläche (vereinfacht) -->
  ${poly([
    P(-20, 0, -10), P(bkW + 30, 0, -10),
    P(bkW + 30, 0, bkD + 20), P(-20, 0, bkD + 20),
  ], `fill="${BEIGE}" stroke="${BORDER}" stroke-width="0.6"`)}

  <!-- Grundfläche Baukörper -->
  ${poly([p00, p10, p11, p01], `fill="${BEIGE}" stroke="${IKB}" stroke-width="0.8"`)}

  <!-- Rückwand (linke Seite in Isometrie) -->
  ${poly([p01, t01, t11, p11], `fill="${IKB}" fill-opacity="0.10" stroke="${IKB}" stroke-width="1.2"`)}

  <!-- Seitenwand rechts (z-Seite, dunkel) -->
  ${poly([p11, t11, t10, p10], `fill="${IKB}" fill-opacity="0.20" stroke="${IKB}" stroke-width="1.2"`)}

  <!-- Frontwand (hell, zum Betrachter) -->
  ${poly([p00, p10, t10, t00], `fill="${IKB}" fill-opacity="0.12" stroke="${IKB}" stroke-width="1.5"`)}

  <!-- Deckenplatte -->
  ${poly([t00, t10, t11, t01], `fill="${IKB}" fill-opacity="0.08" stroke="${IKB}" stroke-width="1"`)}

  ${p.dachform === 'sattel' ? `
  <!-- Satteldach -->
  ${poly(sattelFront, `fill="${IKB}" fill-opacity="0.25" stroke="${IKB}" stroke-width="1.4"`)}
  ${poly(sattelRight, `fill="${IKB}" fill-opacity="0.35" stroke="${IKB}" stroke-width="1.2"`)}
  ${poly(sattelBack, `fill="${IKB}" fill-opacity="0.15" stroke="${IKB}" stroke-width="1"`)}
  <!-- Firstlinie -->
  ${line(firstPtLeft.x, firstPtLeft.y, firstPtRight.x, firstPtRight.y, `stroke="${IKB}" stroke-width="1.6"`)}
  ` : `
  <!-- Flachdach Aufbau -->
  ${poly([t00, t10, t11, t01].map(pt => ({ x: pt.x, y: pt.y - 4 })), `fill="${IKB}" fill-opacity="0.25" stroke="${IKB}" stroke-width="1.2"`)}
  `}

  <!-- Höhenbemaßung -->
  ${line(t00.x - 24, t00.y, t00.x, t00.y, `stroke="${GRAY_LT}" stroke-width="0.6"`)}
  ${line(p00.x - 24, p00.y, p00.x, p00.y, `stroke="${GRAY_LT}" stroke-width="0.6"`)}
  ${line(p00.x - 24, p00.y, p00.x - 24, t00.y, `stroke="${GRAY_LT}" stroke-width="0.8"`)}
  ${text(p00.x - 44, (p00.y + t00.y) / 2 + 3, `§75 GH\n${p.gebaeudehoehe_max_m} m`, `text-anchor="middle" font-size="7.5" fill="${GRAY}" font-family="${FONT}"`)}
  <text x="${r(p00.x - 38)}" y="${r((p00.y + t00.y) / 2 - 3)}" text-anchor="middle" font-size="7.5" fill="${GRAY}" font-family="${FONT}">§75 GH</text>
  <text x="${r(p00.x - 38)}" y="${r((p00.y + t00.y) / 2 + 8)}" text-anchor="middle" font-size="7.5" fill="${IKB}" font-family="${FONT}" font-weight="bold">${p.gebaeudehoehe_max_m} m</text>

  <!-- Breitenbemaßung -->
  ${line(p00.x, p00.y + 14, p10.x, p10.y + 14, `stroke="${GRAY_LT}" stroke-width="0.8"`)}
  <text x="${r((p00.x + p10.x) / 2)}" y="${r((p00.y + p10.y) / 2 + 26)}" text-anchor="middle" font-size="7.5" fill="${GRAY}" font-family="${FONT}">${p.baukörper_breite_m} m</text>

  <!-- Tiefenbemaßung -->
  ${line(p10.x + 8, p10.y, p11.x + 8, p11.y, `stroke="${GRAY_LT}" stroke-width="0.8"`)}
  <text x="${r((p10.x + p11.x) / 2 + 18)}" y="${r((p10.y + p11.y) / 2 + 3)}" text-anchor="start" font-size="7.5" fill="${GRAY}" font-family="${FONT}">${p.baukörper_tiefe_m} m</text>

  <!-- Info-Box -->
  <rect x="${W - 130}" y="${H - 100}" width="110" height="90" fill="white" stroke="${BORDER}" stroke-width="0.8" rx="2"/>
  <text x="${W - 74}" y="${H - 84}" text-anchor="middle" font-size="7" fill="${GRAY_LT}" letter-spacing="1.5" font-family="${FONT}">KENNWERTE</text>
  <text x="${W - 124}" y="${H - 70}" font-size="7.5" fill="${GRAY}" font-family="${FONT}">BGF: ${p.bgf_gesamt_m2} m²</text>
  <text x="${W - 124}" y="${H - 58}" font-size="7.5" fill="${GRAY}" font-family="${FONT}">NGF: ${p.ngf_geschaetzt_m2} m²</text>
  <text x="${W - 124}" y="${H - 46}" font-size="7.5" fill="${GRAY}" font-family="${FONT}">Gesch.: ${p.max_geschosse}</text>
  <text x="${W - 124}" y="${H - 34}" font-size="7.5" fill="${GRAY}" font-family="${FONT}">Stpl.: ${p.stellplaetze_pflicht}</text>
  <text x="${W - 124}" y="${H - 22}" font-size="7.5" fill="${IKB}" font-family="${FONT}">${p.widmung} / BKl. ${p.bauklasse}</text>
</svg>`
}

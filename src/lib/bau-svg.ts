export interface BauParam {
  bauklasse: string
  widmung: string
  bauweise: string
  breite_m: number
  tiefe_m: number
  grundstueck_m2: number
  grz_max: number
  gfz_max: number
  max_geschosse: number
  traufenhoehe_m: number
  firsthoehe_m: number
  dachform: 'sattel' | 'flach' | 'walm'
  geschoss_hoehe_m: number
  bauwich_vorne_m: number
  bauwich_hinten_m: number
  bauwich_seitlich_m: number
  baukörper_breite_m: number
  baukörper_tiefe_m: number
  bebaubare_flaeche_m2: number
  bgf_gesamt_m2: number
  wnf_geschaetzt_m2: number
  stellplaetze_pflicht: number
  hinweise: string[]
  optimierungstipps: string[]
}

const IKB = '#002FA7'
const IKB_LIGHT = '#E8EEFF'
const GRAY = '#555'
const LIGHT = '#F4F3F1'
const HATCH = '#D8D5D0'
const GROUND_COLOR = '#8B7355'

// ─── Lageplan ────────────────────────────────────────────────────────────────

export function generateLageplan(p: BauParam): string {
  const W = 520, H = 420
  const PAD_L = 60, PAD_T = 44, PAD_R = 140, PAD_B = 54

  const availW = W - PAD_L - PAD_R
  const availH = H - PAD_T - PAD_B
  const scale = Math.min(availW / p.breite_m, availH / p.tiefe_m) * 0.92

  const plotW = p.breite_m * scale
  const plotH = p.tiefe_m * scale
  const ox = PAD_L + (availW - plotW) / 2
  const oy = PAD_T + (availH - plotH) / 2

  const sv = p.bauwich_vorne_m * scale
  const sh = p.bauwich_hinten_m * scale
  const ss = p.bauwich_seitlich_m * scale

  const bkX = ox + ss
  const bkY = oy + sv
  const bkW = plotW - 2 * ss
  const bkH = plotH - sv - sh

  const grz_actual = (bkW * bkH) / (plotW * plotH)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="'DIN Condensed','Arial Narrow',Arial,sans-serif">
  <defs>
    <pattern id="lp-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="${HATCH}" stroke-width="1.2"/>
    </pattern>
  </defs>

  <!-- Titel -->
  <text x="${W / 2}" y="18" text-anchor="middle" font-size="9" fill="#888" letter-spacing="2">LAGEPLAN  ·  MAXIMALE BEBAUUNG</text>
  <line x1="${PAD_L}" y1="24" x2="${W - PAD_R + 20}" y2="24" stroke="#DDD" stroke-width="0.5"/>

  <!-- Grundstück -->
  <rect x="${ox}" y="${oy}" width="${plotW}" height="${plotH}" fill="${LIGHT}" stroke="${GRAY}" stroke-width="1.5"/>

  <!-- Abstandsflächen -->
  <rect x="${ox}" y="${oy}" width="${plotW}" height="${sv}" fill="url(#lp-hatch)"/>
  <rect x="${ox}" y="${oy + plotH - sh}" width="${plotW}" height="${sh}" fill="url(#lp-hatch)"/>
  <rect x="${ox}" y="${oy + sv}" width="${ss}" height="${plotH - sv - sh}" fill="url(#lp-hatch)"/>
  <rect x="${ox + plotW - ss}" y="${oy + sv}" width="${ss}" height="${plotH - sv - sh}" fill="url(#lp-hatch)"/>

  <!-- Baufluchtlinien (gestrichelt) -->
  <line x1="${bkX}" y1="${oy - 4}" x2="${bkX}" y2="${oy + plotH + 4}" stroke="${IKB}" stroke-width="0.6" stroke-dasharray="5,3" opacity="0.55"/>
  <line x1="${bkX + bkW}" y1="${oy - 4}" x2="${bkX + bkW}" y2="${oy + plotH + 4}" stroke="${IKB}" stroke-width="0.6" stroke-dasharray="5,3" opacity="0.55"/>
  <line x1="${ox - 4}" y1="${bkY}" x2="${ox + plotW + 4}" y2="${bkY}" stroke="${IKB}" stroke-width="0.6" stroke-dasharray="5,3" opacity="0.55"/>
  <line x1="${ox - 4}" y1="${bkY + bkH}" x2="${ox + plotW + 4}" y2="${bkY + bkH}" stroke="${IKB}" stroke-width="0.6" stroke-dasharray="5,3" opacity="0.55"/>

  <!-- Maximaler Baukörper -->
  <rect x="${bkX}" y="${bkY}" width="${bkW}" height="${bkH}" fill="${IKB}" fill-opacity="0.14" stroke="${IKB}" stroke-width="1.8"/>

  <!-- Kreuz im Baukörper -->
  <line x1="${bkX + bkW * 0.2}" y1="${bkY + bkH * 0.5}" x2="${bkX + bkW * 0.8}" y2="${bkY + bkH * 0.5}" stroke="${IKB}" stroke-width="0.4" opacity="0.3"/>
  <line x1="${bkX + bkW * 0.5}" y1="${bkY + bkH * 0.15}" x2="${bkX + bkW * 0.5}" y2="${bkY + bkH * 0.85}" stroke="${IKB}" stroke-width="0.4" opacity="0.3"/>

  <!-- Label im Baukörper -->
  <text x="${bkX + bkW / 2}" y="${bkY + bkH / 2 - 9}" text-anchor="middle" font-size="9.5" fill="${IKB}" opacity="0.85" letter-spacing="0.5">MAX. BAUKÖRPER</text>
  <text x="${bkX + bkW / 2}" y="${bkY + bkH / 2 + 8}" text-anchor="middle" font-size="13" fill="${IKB}" font-weight="bold">${Math.round(p.bebaubare_flaeche_m2)} m²</text>
  <text x="${bkX + bkW / 2}" y="${bkY + bkH / 2 + 22}" text-anchor="middle" font-size="8.5" fill="${IKB}" opacity="0.7">GRZ ${grz_actual.toFixed(2)}</text>

  <!-- Maßlinie unten: Grundstücksbreite -->
  ${dimLineH(ox, oy + plotH + 18, plotW, `${p.breite_m.toFixed(1)} m`)}

  <!-- Maßlinie oben: Baukörperbreite -->
  ${dimLineH(bkX, oy - 16, bkW, `${p.baukörper_breite_m.toFixed(1)} m`, IKB)}

  <!-- Maßlinie rechts: Grundstückstiefe -->
  ${dimLineV(ox + plotW + 18, oy, plotH, `${p.tiefe_m.toFixed(1)} m`)}

  <!-- Abstandsmaße links -->
  ${ss > 4 ? smallDim(ox + ss / 2, oy + plotH + 30, `${p.bauwich_seitlich_m.toFixed(0)}m`) : ''}
  ${ss > 4 ? smallDim(bkX + bkW + ss / 2, oy + plotH + 30, `${p.bauwich_seitlich_m.toFixed(0)}m`) : ''}

  <!-- Nordpfeil -->
  ${northArrow(ox + 22, oy + 22)}

  <!-- Legende rechts -->
  <g transform="translate(${W - PAD_R + 14}, ${oy})">
    <rect width="118" height="${plotH}" rx="2" fill="white" stroke="#E0DEDB" stroke-width="0.8"/>

    <!-- Legende Einträge -->
    <rect x="8" y="14" width="12" height="10" fill="url(#lp-hatch)"/>
    <text x="26" y="23" font-size="8.5" fill="#555">Abstandsfläche</text>

    <rect x="8" y="30" width="12" height="10" fill="${IKB}" fill-opacity="0.14" stroke="${IKB}" stroke-width="1"/>
    <text x="26" y="39" font-size="8.5" fill="#555">Max. Baukörper</text>

    <line x1="8" y1="54" x2="20" y2="54" stroke="${IKB}" stroke-width="0.7" stroke-dasharray="4,2"/>
    <text x="26" y="57" font-size="8.5" fill="#555">Baufluchtlinie</text>

    <line x1="8" y1="68" x2="${plotH > 20 ? 108 : 60}" y2="68" stroke="#DDD" stroke-width="0.5"/>

    <!-- Kennwerte -->
    ${legenzeile(8, 80, 'GRZ max.', p.grz_max.toFixed(2))}
    ${legenzeile(8, 96, 'GFZ max.', p.gfz_max.toFixed(2))}
    ${legenzeile(8, 112, 'Geschosse', String(p.max_geschosse))}
    ${legenzeile(8, 128, 'Traufe', p.traufenhoehe_m.toFixed(1) + ' m')}
    ${legenzeile(8, 144, 'BGF ges.', Math.round(p.bgf_gesamt_m2) + ' m²')}
    ${legenzeile(8, 160, 'WNF ca.', Math.round(p.wnf_geschaetzt_m2) + ' m²')}
    ${legenzeile(8, 176, 'Stellpl.', String(p.stellplaetze_pflicht))}
    ${legenzeile(8, 192, 'Bauklasse', p.bauklasse)}
    ${legenzeile(8, 208, 'Bauweise', p.bauweise)}
  </g>

  <!-- Maßstab -->
  ${massStab(ox, oy + plotH + 38, scale)}
</svg>`
}

// ─── Schnitt ──────────────────────────────────────────────────────────────────

export function generateSchnitt(p: BauParam): string {
  const W = 520, H = 320
  const PAD_L = 60, PAD_T = 36, PAD_R = 130, PAD_B = 48
  const GROUND_Y = H - PAD_B

  const availH = H - PAD_T - PAD_B - 20
  const scaleH = availH / (p.firsthoehe_m + 1.5)

  const bldH = p.traufenhoehe_m * scaleH
  const firstH = p.firsthoehe_m * scaleH
  const geschossH = p.geschoss_hoehe_m * scaleH

  // Baukörper Breite im Schnitt (verwende Tiefe des Baukörpers für Ansicht)
  const bldW = Math.min(p.baukörper_tiefe_m * scaleH * 1.2, W - PAD_L - PAD_R - 20)
  const bkX = PAD_L + (W - PAD_L - PAD_R - bldW) / 2
  const bkY = GROUND_Y - bldH

  const hasRoof = p.dachform === 'sattel' || p.dachform === 'walm'
  const roofH = firstH - bldH
  const ridgeX = bkX + bldW / 2

  // Geschoss-Linien
  const floors = Array.from({ length: p.max_geschosse }, (_, i) => GROUND_Y - (i + 1) * geschossH)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="'DIN Condensed','Arial Narrow',Arial,sans-serif">

  <!-- Titel -->
  <text x="${W / 2}" y="17" text-anchor="middle" font-size="9" fill="#888" letter-spacing="2">SCHNITT  ·  MAXIMALE GEBÄUDEHÖHE</text>
  <line x1="${PAD_L - 10}" y1="22" x2="${W - PAD_R + 10}" y2="22" stroke="#DDD" stroke-width="0.5"/>

  <!-- Himmel -->
  <rect x="${PAD_L - 10}" y="${PAD_T}" width="${W - PAD_L - PAD_R + 20}" height="${GROUND_Y - PAD_T}" fill="#F7F9FF" opacity="0.5"/>

  <!-- Gelände links & rechts -->
  <rect x="${PAD_L - 10}" y="${GROUND_Y}" width="${bkX - PAD_L + 10}" height="${H - GROUND_Y}" fill="${GROUND_COLOR}" opacity="0.2"/>
  <rect x="${bkX + bldW}" y="${GROUND_Y}" width="${W - PAD_R + 10 - bkX - bldW}" height="${H - GROUND_Y}" fill="${GROUND_COLOR}" opacity="0.2"/>

  <!-- Terrain Linie -->
  <line x1="${PAD_L - 10}" y1="${GROUND_Y}" x2="${W - PAD_R + 10}" y2="${GROUND_Y}" stroke="${GROUND_COLOR}" stroke-width="2.5"/>

  <!-- Gebäudekörper -->
  <rect x="${bkX}" y="${bkY}" width="${bldW}" height="${bldH}" fill="${IKB}" fill-opacity="0.12" stroke="${IKB}" stroke-width="1.8"/>

  <!-- Geschoss-Linien -->
  ${floors.map(fy => `
    <line x1="${bkX + 2}" y1="${fy}" x2="${bkX + bldW - 2}" y2="${fy}" stroke="${IKB}" stroke-width="0.7" stroke-dasharray="6,4" opacity="0.5"/>
  `).join('')}

  <!-- Dach -->
  ${hasRoof ? `
    <polygon points="${bkX},${bkY} ${ridgeX},${GROUND_Y - firstH} ${bkX + bldW},${bkY}"
      fill="${IKB}" fill-opacity="0.08" stroke="${IKB}" stroke-width="1.5"/>
    <!-- Dachschatten -->
    <line x1="${bkX}" y1="${bkY}" x2="${ridgeX}" y2="${GROUND_Y - firstH}" stroke="${IKB}" stroke-width="1.5"/>
    <line x1="${bkX + bldW}" y1="${bkY}" x2="${ridgeX}" y2="${GROUND_Y - firstH}" stroke="${IKB}" stroke-width="1.5"/>
  ` : `
    <!-- Flachdach / Attika -->
    <rect x="${bkX - 2}" y="${bkY - 6}" width="${bldW + 4}" height="6" fill="${IKB}" fill-opacity="0.25" stroke="${IKB}" stroke-width="1"/>
  `}

  <!-- Geschoss-Labels links -->
  <text x="${bkX - 8}" y="${GROUND_Y - geschossH * 0.5 + 4}" text-anchor="end" font-size="8" fill="${IKB}" opacity="0.75">EG</text>
  ${floors.slice(0, -1).map((fy, i) => `
    <text x="${bkX - 8}" y="${fy - geschossH * 0.5 + 4}" text-anchor="end" font-size="8" fill="${IKB}" opacity="0.75">OG ${i + 1}</text>
  `).join('')}
  ${hasRoof ? `<text x="${bkX - 8}" y="${bkY - roofH / 2 + 4}" text-anchor="end" font-size="8" fill="${IKB}" opacity="0.75">DG</text>` : ''}

  <!-- Maßlinien rechts: Traufenhöhe -->
  ${heightDim(bkX + bldW + 18, GROUND_Y, bkY, p.traufenhoehe_m.toFixed(1) + ' m', 'Traufe')}

  <!-- Firsthöhe (wenn Dach) -->
  ${hasRoof ? heightDim(bkX + bldW + 55, GROUND_Y, GROUND_Y - firstH, p.firsthoehe_m.toFixed(1) + ' m', 'First') : ''}

  <!-- Geschossmaß -->
  ${heightDim(bkX - 28, GROUND_Y, bkY + bldH - geschossH, p.geschoss_hoehe_m.toFixed(1) + ' m', '', '#999')}

  <!-- Terrain-Beschriftung -->
  <text x="${PAD_L - 12}" y="${GROUND_Y + 14}" font-size="8" fill="${GROUND_COLOR}" opacity="0.8">±0.00</text>

  <!-- Legende rechts -->
  <g transform="translate(${W - PAD_R + 14}, ${PAD_T + 5})">
    <rect width="108" height="${H - PAD_T - PAD_B - 5}" rx="2" fill="white" stroke="#E0DEDB" stroke-width="0.8"/>
    ${legenzeile(8, 18, 'Traufenhöhe', p.traufenhoehe_m.toFixed(1) + ' m')}
    ${hasRoof ? legenzeile(8, 34, 'Firsthöhe', p.firsthoehe_m.toFixed(1) + ' m') : ''}
    ${legenzeile(8, hasRoof ? 50 : 34, 'Geschosshöhe', p.geschoss_hoehe_m.toFixed(1) + ' m')}
    ${legenzeile(8, hasRoof ? 66 : 50, 'Vollgeschosse', String(p.max_geschosse))}
    ${legenzeile(8, hasRoof ? 82 : 66, 'Dachform', p.dachform === 'sattel' ? 'Satteldach' : p.dachform === 'walm' ? 'Walmdach' : 'Flachdach')}
    <line x1="8" y1="${hasRoof ? 96 : 80}" x2="100" y2="${hasRoof ? 96 : 80}" stroke="#DDD" stroke-width="0.5"/>
    ${legenzeile(8, hasRoof ? 110 : 94, 'BGF je Gesch.', Math.round(p.bebaubare_flaeche_m2 * 0.95) + ' m²')}
    ${legenzeile(8, hasRoof ? 126 : 110, 'BGF gesamt', Math.round(p.bgf_gesamt_m2) + ' m²')}
  </g>
</svg>`
}

// ─── Isometrie ────────────────────────────────────────────────────────────────

export function generateIsometrie(p: BauParam): string {
  const W = 400, H = 320
  const cx = W / 2, cy = H * 0.65

  // Isometrische Projektion: Einheitsvektoren
  // x-Achse (Breite): rechts-unten
  // z-Achse (Tiefe): links-unten
  // y-Achse (Höhe): nach oben
  const isoX = (x: number, y: number, z: number) => cx + (x - z) * 0.6
  const isoY = (x: number, y: number, z: number) => cy - y * 0.8 + (x + z) * 0.3

  // Skalierung — Baukörper im Verhältnis
  const maxDim = Math.max(p.baukörper_breite_m, p.baukörper_tiefe_m, p.firsthoehe_m)
  const s = Math.min(W, H) * 0.28 / maxDim

  const bW = p.baukörper_breite_m * s
  const bD = p.baukörper_tiefe_m * s
  const bH = p.traufenhoehe_m * s
  const fH = p.firsthoehe_m * s

  const hasRoof = p.dachform !== 'flach'

  // Bodenplatte
  const f00 = [isoX(0, 0, 0), isoY(0, 0, 0)]
  const f10 = [isoX(bW, 0, 0), isoY(bW, 0, 0)]
  const f11 = [isoX(bW, 0, bD), isoY(bW, 0, bD)]
  const f01 = [isoX(0, 0, bD), isoY(0, 0, bD)]

  // Oberseite (Traufe)
  const t00 = [isoX(0, bH, 0), isoY(0, bH, 0)]
  const t10 = [isoX(bW, bH, 0), isoY(bW, bH, 0)]
  const t11 = [isoX(bW, bH, bD), isoY(bW, bH, bD)]
  const t01 = [isoX(0, bH, bD), isoY(0, bH, bD)]

  // First (Mitte oben)
  const r0 = [isoX(bW / 2, fH, 0), isoY(bW / 2, fH, 0)]
  const r1 = [isoX(bW / 2, fH, bD), isoY(bW / 2, fH, bD)]

  const poly = (pts: number[][]) => pts.map(p => p.join(',')).join(' ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="'DIN Condensed','Arial Narrow',Arial,sans-serif">

  <!-- Titel -->
  <text x="${W / 2}" y="17" text-anchor="middle" font-size="9" fill="#888" letter-spacing="2">ISOMETRIE  ·  BAUKÖRPERVOLUMEN</text>

  <!-- Schatten / Boden -->
  <ellipse cx="${isoX(bW / 2, 0, bD / 2)}" cy="${isoY(bW / 2, 0, bD / 2) + 8}" rx="${bW * 0.7}" ry="${bD * 0.2}" fill="#000" opacity="0.06"/>

  <!-- Bodenplatte -->
  <polygon points="${poly([f00, f10, f11, f01])}" fill="${LIGHT}" stroke="${GRAY}" stroke-width="0.8" opacity="0.6"/>

  <!-- Front-Fläche (links sichtbar) -->
  <polygon points="${poly([f00, t00, t10, f10])}" fill="${IKB}" fill-opacity="0.10" stroke="${IKB}" stroke-width="1.2"/>

  <!-- Seiten-Fläche (rechts sichtbar) -->
  <polygon points="${poly([f10, t10, t11, f11])}" fill="${IKB}" fill-opacity="0.07" stroke="${IKB}" stroke-width="1.2"/>

  ${hasRoof ? `
    <!-- Dach vorne -->
    <polygon points="${poly([t00, r0, r1, t01])}" fill="${IKB}" fill-opacity="0.18" stroke="${IKB}" stroke-width="1.2"/>
    <!-- Dach hinten -->
    <polygon points="${poly([t10, r0, r1, t11])}" fill="${IKB}" fill-opacity="0.12" stroke="${IKB}" stroke-width="1.2"/>
    <!-- First-Linie -->
    <line x1="${r0[0]}" y1="${r0[1]}" x2="${r1[0]}" y2="${r1[1]}" stroke="${IKB}" stroke-width="1.5"/>
    <!-- Trauf-Linie vorne -->
    <line x1="${t00[0]}" y1="${t00[1]}" x2="${t01[0]}" y2="${t01[1]}" stroke="${IKB}" stroke-width="1" stroke-dasharray="4,3" opacity="0.5"/>
  ` : `
    <!-- Dachfläche (Flachdach) -->
    <polygon points="${poly([t00, t10, t11, t01])}" fill="${IKB}" fill-opacity="0.2" stroke="${IKB}" stroke-width="1.2"/>
  `}

  <!-- Vertikale Kanten -->
  <line x1="${f00[0]}" y1="${f00[1]}" x2="${t00[0]}" y2="${t00[1]}" stroke="${IKB}" stroke-width="1"/>
  <line x1="${f10[0]}" y1="${f10[1]}" x2="${t10[0]}" y2="${t10[1]}" stroke="${IKB}" stroke-width="1.4"/>
  <line x1="${f11[0]}" y1="${f11[1]}" x2="${t11[0]}" y2="${t11[1]}" stroke="${IKB}" stroke-width="1"/>

  <!-- Maß-Annotation: Breite -->
  <line x1="${f00[0]}" y1="${f00[1] + 14}" x2="${f10[0]}" y2="${f10[1] + 14}" stroke="${GRAY}" stroke-width="0.7"/>
  <line x1="${f00[0]}" y1="${f00[1] + 10}" x2="${f00[0]}" y2="${f00[1] + 18}" stroke="${GRAY}" stroke-width="0.7"/>
  <line x1="${f10[0]}" y1="${f10[1] + 10}" x2="${f10[0]}" y2="${f10[1] + 18}" stroke="${GRAY}" stroke-width="0.7"/>
  <text x="${(f00[0] + f10[0]) / 2}" y="${(f00[1] + f10[1]) / 2 + 24}" text-anchor="middle" font-size="9" fill="${GRAY}">${p.baukörper_breite_m.toFixed(1)} m</text>

  <!-- Maß-Annotation: Höhe -->
  <line x1="${t10[0] + 14}" y1="${t10[1]}" x2="${f10[0] + 14}" y2="${f10[1]}" stroke="${GRAY}" stroke-width="0.7"/>
  <line x1="${t10[0] + 10}" y1="${t10[1]}" x2="${t10[0] + 18}" y2="${t10[1]}" stroke="${GRAY}" stroke-width="0.7"/>
  <line x1="${f10[0] + 10}" y1="${f10[1]}" x2="${f10[0] + 18}" y2="${f10[1]}" stroke="${GRAY}" stroke-width="0.7"/>
  <text x="${t10[0] + 26}" y="${(t10[1] + f10[1]) / 2 + 4}" font-size="9" fill="${GRAY}">${p.traufenhoehe_m.toFixed(1)} m</text>

  ${hasRoof ? `
  <!-- First-Höhe Annotation -->
  <line x1="${r0[0] + 8}" y1="${r0[1]}" x2="${t10[0] + 8}" y2="${t10[1]}" stroke="${IKB}" stroke-width="0.5" stroke-dasharray="3,2" opacity="0.5"/>
  <text x="${r0[0] + 16}" y="${(r0[1] + t10[1]) / 2 + 4}" font-size="8" fill="${IKB}" opacity="0.7">Dach +${(p.firsthoehe_m - p.traufenhoehe_m).toFixed(1)}m</text>
  ` : ''}

  <!-- BGF Label -->
  <text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-size="9" fill="#999">
    BGF: ${Math.round(p.bgf_gesamt_m2)} m²  ·  ${p.max_geschosse} Geschosse  ·  Bauklasse ${p.bauklasse}
  </text>
</svg>`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dimLineH(x: number, y: number, w: number, label: string, color = GRAY): string {
  const mid = x + w / 2
  return `
  <line x1="${x}" y1="${y - 3}" x2="${x}" y2="${y + 3}" stroke="${color}" stroke-width="0.8"/>
  <line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${color}" stroke-width="0.8"/>
  <line x1="${x + w}" y1="${y - 3}" x2="${x + w}" y2="${y + 3}" stroke="${color}" stroke-width="0.8"/>
  <text x="${mid}" y="${y - 5}" text-anchor="middle" font-size="9" fill="${color}">${label}</text>`
}

function dimLineV(x: number, y: number, h: number, label: string, color = GRAY): string {
  const mid = y + h / 2
  return `
  <line x1="${x - 3}" y1="${y}" x2="${x + 3}" y2="${y}" stroke="${color}" stroke-width="0.8"/>
  <line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${color}" stroke-width="0.8"/>
  <line x1="${x - 3}" y1="${y + h}" x2="${x + 3}" y2="${y + h}" stroke="${color}" stroke-width="0.8"/>
  <text x="${x + 8}" y="${mid + 4}" font-size="9" fill="${color}">${label}</text>`
}

function heightDim(x: number, y1: number, y2: number, label: string, sublabel = '', color = IKB): string {
  const mid = (y1 + y2) / 2
  return `
  <line x1="${x - 3}" y1="${y1}" x2="${x + 3}" y1="${y1}" stroke="${color}" stroke-width="0.7"/>
  <line x1="${x - 3}" y1="${y1}" x2="${x + 3}" y2="${y1}" stroke="${color}" stroke-width="0.7"/>
  <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="0.7"/>
  <line x1="${x - 3}" y1="${y2}" x2="${x + 3}" y2="${y2}" stroke="${color}" stroke-width="0.7"/>
  <text x="${x + 6}" y="${mid + 4}" font-size="9.5" fill="${color}" font-weight="bold">${label}</text>
  ${sublabel ? `<text x="${x + 6}" y="${mid + 16}" font-size="7.5" fill="${color}" opacity="0.7">${sublabel}</text>` : ''}`
}

function smallDim(x: number, y: number, label: string): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="7.5" fill="#999">${label}</text>`
}

function legenzeile(x: number, y: number, key: string, val: string): string {
  return `
  <text x="${x}" y="${y}" font-size="8" fill="#888">${key}</text>
  <text x="100" y="${y}" text-anchor="end" font-size="8.5" fill="${IKB}" font-weight="bold">${val}</text>`
}

function northArrow(x: number, y: number): string {
  return `
  <polygon points="${x},${y - 10} ${x - 4},${y + 4} ${x},${y + 1} ${x + 4},${y + 4}" fill="${GRAY}" opacity="0.7"/>
  <text x="${x}" y="${y + 16}" text-anchor="middle" font-size="8" fill="${GRAY}" opacity="0.7">N</text>`
}

function massStab(x: number, y: number, scale: number): string {
  // Zeige 5m oder 10m als Maßstab
  const barM = scale > 8 ? 5 : 10
  const barPx = barM * scale
  return `
  <line x1="${x}" y1="${y}" x2="${x + barPx}" y2="${y}" stroke="${GRAY}" stroke-width="1.5"/>
  <line x1="${x}" y1="${y - 3}" x2="${x}" y2="${y + 3}" stroke="${GRAY}" stroke-width="1.2"/>
  <line x1="${x + barPx}" y1="${y - 3}" x2="${x + barPx}" y2="${y + 3}" stroke="${GRAY}" stroke-width="1.2"/>
  <text x="${x + barPx / 2}" y="${y + 11}" text-anchor="middle" font-size="7.5" fill="${GRAY}">${barM} m</text>`
}

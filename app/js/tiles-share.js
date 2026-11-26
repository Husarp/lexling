import { getLang, plural, t } from './i18n.js';
import { premiums, sizeOf, valueOf } from './tiles.js';

const RELEASE = 'https://github.com/Husarp/lexling/releases/latest';
const YELLOW = '#f3c237', MUTED = '#9e9e9e';
const display = size => `800 ${size}px "Barlow Condensed", sans-serif`;
const body = size => `600 ${size}px Inter, sans-serif`;
const regular = size => `400 ${size}px Inter, sans-serif`;
const BONUS = { d: ['l2', '#8dc7e3'], t: ['l3', '#64a9e9'], D: ['w2', '#efa66e'], T: ['w3', '#e56d55'] };

// The strongest word actually played, including crosswords and computer turns (owner, 2026-11-26).
export function storyBestWord(S) {
  let best = null, played;
  for (const move of S.moves) {
    if (move.kind !== 'play') continue;
    for (const word of move.words) {
      if (best && word.score <= best.score) continue;
      best = word;
      played = move;
    }
  }
  if (!best) return null;
  const n = sizeOf(S.board), blanks = {};
  for (const tile of played.placed) if (tile.blank) blanks[tile.ch] = (blanks[tile.ch] || 0) + 1;
  const tiles = [...best.w].map((ch, k) => {
    // Older histories keep the placed tiles but omit the word's board coordinates.
    const blank = best.r == null ? blanks[ch] > 0 && blanks[ch]--
      : S.cells[(best.r + (best.across ? 0 : k)) * n + best.c + (best.across ? k : 0)]?.blank;
    return { ch, blank: !!blank };
  });
  return { tiles, score: best.score };
}

// The selected Story layout, in image pixels (owner, 2026-11-26).
async function storyCanvas(S, order, names) {
  await Promise.all([display, body, regular].map(font => document.fonts?.load(font(24))));
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const g = canvas.getContext('2d'), mid = canvas.width / 2;
  const text = (s, x, y, face, size, color, max = 940, align = 'center') => {
    g.font = face(size);
    const width = g.measureText(s).width;
    if (width > max) g.font = face(size * max / width);
    g.textAlign = align;
    g.fillStyle = color;
    g.fillText(s, x, y);
  };
  const rect = (x, y, w, h, r, color) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  const tile = ({ ch, blank }, x, y, size) => {
    rect(x, y, size, size, size * .14, blank ? '#bda878' : '#c2911f');
    rect(x, y, size, size * .92, size * .14, blank ? '#f3e7d0' : YELLOW);
    text(ch.toUpperCase(), x + size / 2, y + size * .69, body, size * .59, '#191919', size * .75);
    if (!blank) text(String(valueOf(S.lang, ch)), x + size * .91, y + size * .87, body, size * .22, '#312406', size, 'right');
  };

  g.fillStyle = '#000';
  g.fillRect(0, 0, canvas.width, canvas.height);
  const logo = [['LEX', '#fff'], ['/', '#db5126'], ['LING', '#fff']];
  g.font = display(72);
  const widths = logo.map(([part]) => g.measureText(part).width);
  let x = mid - widths.reduce((a, b) => a + b, 0) / 2;
  logo.forEach(([part, color], i) => {
    text(part, x, 194, display, 72, color, 940, 'left');
    x += widths[i];
  });
  const upper = s => s.toLocaleUpperCase(getLang());
  const winner = S.over.winner;
  text(upper(t('mode.tiles')), mid, 354, body, 42, YELLOW);
  const outcome = winner < 0 ? t('tiles.end.draw') : t('tiles.end.wins', { name: names[winner] });
  text(upper(outcome), mid, 489, display, 140, '#fff');
  text(order.map(p => String(S.scores[p]).replace('-', '−')).join('–'), mid, 684, display, 174, YELLOW);
  text(order.map(p => names[p]).join(' · '), mid, 776, body, 37, MUTED);

  const left = 207, top = 840, width = 666, inset = 15;
  rect(left, top, width, width, 17, '#503a2a');
  rect(left + inset - 2, top + inset - 2, width - 2 * inset + 4, width - 2 * inset + 4, 6, '#292522');
  const n = sizeOf(S.board), pitch = (width - 2 * inset) / n;
  [...premiums(S.board)].forEach((bonus, i) => {
    const bx = left + inset + (i % n) * pitch, by = top + inset + Math.floor(i / n) * pitch;
    const cell = S.cells[i];
    if (cell) tile(cell, bx, by, pitch - 2);
    else {
      rect(bx, by, pitch - 1, pitch - 1, 3, '#1d1d1d');
      if (BONUS[bonus]) {
        const [key, color] = BONUS[bonus];
        text(t('tiles.label.' + key), bx + pitch / 2, by + pitch * .62, body, pitch * .34, color);
      }
    }
  });

  const best = storyBestWord(S);
  text(upper(t('tiles.end.bestWord')), left, 1576, body, 26, MUTED, 180, 'left');
  if (best) {
    const bestPitch = Math.min(64, 358 / best.tiles.length);
    best.tiles.forEach((cell, i) => tile(cell, left + 191 + i * bestPitch, 1570 - bestPitch / 2, bestPitch - 4));
    const points = plural(best.score, 'tiles.share.points');
    text(`${best.score} ${points}`, left + width, 1578, display, 40, YELLOW, 109, 'right');
  } else text('—', left + 191, 1576, body, 26, MUTED, 940, 'left');
  g.fillStyle = '#292929';
  g.fillRect(left, 1660, width, 2);
  text(t('tiles.share.download'), mid, 1746, body, 38, '#fff');
  text(RELEASE.slice('https://'.length), mid, 1798, regular, 33, MUTED);
  return canvas;
}

export async function shareTilesStory(S, order, names) {
  const canvas = await storyCanvas(S, order, names);
  const C = window.Capacitor, desktop = window.pywebview?.api;
  if (C?.getPlatform?.() === 'android') {
    const plugin = C.Plugins?.AppUpdate ?? C.registerPlugin?.('AppUpdate');
    await plugin.shareTilesImage({
      png: canvas.toDataURL('image/png').split(',')[1],
      caption: t('tiles.share.caption', { url: RELEASE }),
      title: t('tiles.share'),
    });
    return false;
  }
  if (desktop?.save_tiles_image) {
    if (!await desktop.save_tiles_image(canvas.toDataURL('image/png').split(',')[1])) throw new Error('PNG save failed');
  } else {
    const blob = await new Promise((resolve, reject) => canvas.toBlob(png => png ? resolve(png) : reject(new Error('PNG encoding failed')), 'image/png'));
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = 'Lexling-Tiles.png';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}

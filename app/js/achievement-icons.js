const paths=[
'<circle cx="8" cy="8" r="5.2"/>',
'<path d="M8 1.6 14.4 8 8 14.4 1.6 8Z"/>',
'<path d="M8 1.4 13.7 4.7v6.6L8 14.6l-5.7-3.3V4.7Z"/>',
'<path d="M8 .8C8.6 5.4 10.6 7.4 15.2 8 10.6 8.6 8.6 10.6 8 15.2 7.4 10.6 5.4 8.6 .8 8 5.4 7.4 7.4 5.4 8 .8Z"/>',
'<path d="M8 .6 9.1 5.3 12.2 3.8 10.7 6.9 15.4 8 10.7 9.1 12.2 12.2 9.1 10.7 8 15.4 6.9 10.7 3.8 12.2 5.3 9.1 .6 8 5.3 6.9 3.8 3.8 6.9 5.3Z"/>'
];
export const achievementLock='<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';
const rect=(x,y,w=6,h=6)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>`;
const drawings={
 detective:'<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M10 2a8 8 0 1 0 4.6 14.5l5.7 5.7a1.6 1.6 0 0 0 2.2-2.2l-5.8-5.7A8 8 0 0 0 10 2Zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/>',
 letters:'<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M8 3h13v13"/><path fill="currentColor" stroke="none" fill-rule="evenodd" d="m8.7 9.5-3.4 9h2.3l.6-1.9h3.6l.6 1.9h2.3l-3.4-9Zm.1 5.2 1.2-3.5 1.2 3.5Z"/>',
 connect:'<path d="M4 5.072h16L12 18.928Z"/><g fill="currentColor" stroke="none"><circle cx="4" cy="5.072" r="3"/><circle cx="20" cy="5.072" r="3"/><circle cx="12" cy="18.928" r="3"/></g>',
 builder:'<g transform="rotate(-90 12 12)"><g transform="translate(0 -2) translate(0 24) scale(1 -1)" fill="currentColor" stroke="none">'+rect(3,14,5,5)+rect(9,14,5,5)+rect(15,14,5,5)+rect(9,8,5,5)+rect(15,8,5,5)+rect(15,2,5,5)+'</g></g>',
 points:'<g fill="currentColor" stroke="none"><path d="m8 1 1.9 3.8 4.2.6-3 3 .7 4.2L8 10.6l-3.8 2 .7-4.2-3-3 4.2-.6Z"/><rect x="3" y="17" width="4" height="5" rx="1"/><rect x="10" y="14" width="4" height="8" rx="1"/><rect x="17" y="10" width="4" height="12" rx="1"/></g>',
 seven:'<path fill="currentColor" stroke="none" d="M1 6h6v3l-3 9H1l3.3-9H1Zm8 0h6v3l-3 9H9l3.3-9H9Zm8 0h6v3l-3 9h-3l3.3-9H17Z"/>',
 long:'<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7v5M10 7v3M14 7v5M18 7v3"/>',
 longer:'<path d="M8 5H3v14h5M16 5h5v14h-5M3 12h18M8 9l-3 3 3 3M16 9l3 3-3 3"/>',
 triple:'<g fill="currentColor" stroke="none"><path d="m2 6-2 12h2.3l.4-2.5h2.6l.4 2.5H8L6 6Zm1 7 1-5 1 5Zm7-7L8 18h2.3l.4-2.5h2.6l.4 2.5H16L14 6Zm1 7 1-5 1 5Zm7-7-2 12h2.3l.4-2.5h2.6l.4 2.5H24L22 6Zm1 7 1-5 1 5Z"/></g>',
 century:'<path fill="currentColor" stroke="none" d="m12 1 3.1 6.3 7 .9-5.1 5 .9 7-5.9-3.3L6.1 20l.9-6.8-5.1-5 7-.9Z"/><path d="M7 22h10"/>',
 rare:'<path d="M6.5 4h11l4.5 6-10 11L2 10zM2 10h20M9 4l-2 6 5 11 5-11-2-6"/>',
 hard:'<path d="M12 3l7.5 2.8v5.6c0 4.6-3.1 8-7.5 9.6-4.4-1.6-7.5-5-7.5-9.6V5.8L12 3Z"/><path stroke-width="2.4" d="m8 12 2.7 2.7 5.3-5.3"/>',
 expert:'<path d="M7.5 3.5h9v6a4.5 4.5 0 0 1-9 0v-6ZM7.5 5.5H4.5v1.5a3.5 3.5 0 0 0 3.4 3.5M16.5 5.5h3v1.5a3.5 3.5 0 0 1-3.4 3.5M12 14v4M8.5 20.5h7M9.5 18h5"/>',
 multi:'<g fill="currentColor" stroke="none"><rect x="2" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="17" y="3" width="5" height="5" rx="1"/></g><path d="M4.5 11v3h15v-3M12 11v10m-3-3 3 3 3-3"/>'
};

const icons = {"guess.won": "detective", "letters.won": "letters", "connect.words": "connect", "tiles.words": "builder", "tiles.points": "points", "tiles.bingo": "seven", "tiles.len8": "long", "tiles.len10": "longer", "tiles.triple": "triple", "tiles.move100": "century", "tiles.rare1": "rare", "tiles.beatHard": "hard", "tiles.beatExpert": "expert", "tiles.multi3": "multi"};
export const achievementIcon = id => `<svg class="ach-icon" viewBox="0 0 24 24" aria-hidden="true">${drawings[icons[id]]}</svg>`;
export const tierShape = (i, earned = true) => `<svg class="ach-shape" viewBox="0 0 16 16" aria-hidden="true" style="color:var(--${earned ? 'tier-' + ['bronze', 'silver', 'gold', 'diamond', 'amethyst'][i] : 'line'})">${paths[i]}</svg>`;

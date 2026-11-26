// Owner picks from notes/bot-faces/index.html and notes/bot-expert/index.html.
const outline = paths => `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;

const faces = {
  relaxed: `${outline('<circle cx="12" cy="12" r="9.2"/><path d="M6.4 9.8q1.7 2.1 3.4 0m4.4 0q1.7 2.1 3.4 0M9.8 14.4q2.2 1.3 4.4 0"/>')}`,
  easy: `${outline('<circle cx="12" cy="12" r="9.2"/>')}<rect x="6.8" y="8" width="2.4" height="3.2" rx="1.2"/><rect x="14.8" y="8" width="2.4" height="3.2" rx="1.2"/><path d="M8.2 13h7.6a.65.65 0 0 1 .6.9 4.7 4.7 0 0 1-8.8 0 .65.65 0 0 1 .6-.9Z"/>`,
  medium: `${outline('<rect x="3" y="3" width="18" height="18" rx="5.7"/><path d="M9 15.7h6"/>')}<rect x="7" y="8.2" width="2.6" height="3.6" rx="1.3"/><rect x="14.4" y="8.2" width="2.6" height="3.6" rx="1.3"/>`,
  normal: `${outline('<path d="M3 5.8 12 3l9 2.8v7.5c0 3.6-3.4 6.1-9 8-5.6-1.9-9-4.4-9-8Z"/><path d="m6.5 8.1 3.5 1.2m7.5-1.2L14 9.3m-4.8 6.9q2.8-1.7 5.6 0"/>')}<circle cx="8.6" cy="11.7" r="1.05"/><circle cx="15.4" cy="11.7" r="1.05"/>`,
  hard: `${outline('<path d="M7.6 6.1 4 3.4 3.5 9l-.3 4.5L6 18.4l6 3.1 6-3.1 2.8-4.9-.3-4.5-.5-5.6-3.6 2.7Z"/><path d="M8.6 16.4 10.1 15h3.8l1.5 1.4"/>')}<path d="m6.2 9 4.5 1.9-.9 1.8-3.6-1.4Zm11.6 0-4.5 1.9.9 1.8 3.6-1.4Z"/>`,
  expert: `${outline('<path d="M7.5 6.1 4.1 2.1 2.7 7.2l.9 3.3-.7 3.2 3.6 3.1 1.6 3.4 3.9 1.6 3.9-1.6 1.6-3.4 3.6-3.1-.7-3.2.9-3.3-1.4-5.1-3.4 4a13 13 0 0 0-9 0Z"/><path d="M9.05 16.35q.7-1.05 1.65-1.05h2.6q.95 0 1.65 1.05"/>')}<path d="m5.7 8 5.2 2.4-1.5 2.1-3.3-1.6Zm12.6 0-5.2 2.4 1.5 2.1 3.3-1.6Z"/>`,
};

export function botLevelIcon(level, className = '') {
  return `<svg class="bot-level-icon ${className}" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor" stroke="none">${faces[level] ?? faces.normal}</g></svg>`;
}

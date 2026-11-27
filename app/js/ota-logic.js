import { t, decimal } from './i18n.js';
import { newer } from './whatsnew.js';

export const defaults = {
  smallFixes: true, majorUpdates: false, shellUpdates: true,
  wifiLimitMb: 20, mobileLimitMb: 5, checkFrequency: '6h',
};

const newerVersion = (version, running) => !!version && !!running && newer(version, running);

export function isNewShell(state, version, versionCode) {
  if (!version) return false;
  return state.runningShellVersionCode > 0 && versionCode > 0
    ? versionCode > state.runningShellVersionCode : newerVersion(version, state.shellVersion);
}

const target = (channel, phase, details) => ({ ...details, channel, phase });
const sameUpdate = (a, b) => a && b && a.channel === b.channel && (
  a.channel === 'combined' ? a.versionCode === b.versionCode && a.webVersion === b.webVersion
    : a.channel === 'shell' && a.versionCode && b.versionCode ? a.versionCode === b.versionCode : a.version === b.version
);

function installing(state, version) {
  if (state.combined?.phase === 'installing') return target('combined', 'installing', state.combined);
  const { installingVersion: next } = state;
  const channel = state.installingChannel || (state.shellReady?.version === next ? 'shell' : 'web');
  const versionCode = state.installingShellVersionCode || (state.shellReady?.version === next && state.shellReady?.versionCode);
  const newer = channel === 'shell' ? isNewShell(state, next, versionCode) : newerVersion(next, version);
  return newer ? target(channel, 'installing', { version: next, versionCode }) : null;
}

export function offers(state, version = state.webVersion) {
  if (state.trial) return [];
  if (state.combined) {
    const { phase } = state.combined;
    return ['available', 'ready'].includes(phase) ? [target('combined', phase, state.combined)] : [];
  }
  const { staged, available, shellReady, shellAvailable } = state;
  const appReady = isNewShell(state, shellReady?.version, shellReady?.versionCode);
  const webReady = newerVersion(staged?.version, version);
  const active = installing(state, version);
  return [
    appReady && target('shell', 'ready', shellReady),
    webReady && target('web', 'ready', staged),
    !appReady && isNewShell(state, shellAvailable?.version, shellAvailable?.versionCode) && target('shell', 'available', shellAvailable),
    !webReady && !(available?.needsShell && (appReady || shellAvailable)) && newerVersion(available?.version, version) && target('web', 'available', available),
  ].filter(item => item && !sameUpdate(item, active));
}

export function failureStatus(state, channel) {
  const statuses = channel === 'web' ? [state.status] : channel === 'shell' ? [state.shellStatus] : [state.status, state.shellStatus];
  return statuses.find(value => /^(Download failed|(?:Shell |Android app )?Update processing failed|Install failed|(?:Android )?App install failed|Restart failed|Could not apply)|Not enough storage/i.test(value));
}

function transfers(state, version, items) {
  if (state.combined) return state.combined.phase === 'downloading' ? [target('combined', 'downloading', state.combined)] : [];
  const shell = state.shellAvailable || state.shellReady;
  const shellVersion = state.shellDownloadVersion || (state.shellDownloading && shell?.version);
  const shellCode = state.shellDownloadVersionCode || (shell?.version === shellVersion && shell?.versionCode);
  return [
    state.busy !== false && newerVersion(state.webDownloadVersion, version)
      && target('web', 'downloading', { version: state.webDownloadVersion, transfer: state.webTransfer }),
    isNewShell(state, shellVersion, shellCode)
      && target('shell', 'downloading', { version: shellVersion, versionCode: shellCode, transfer: state.shellTransfer }),
  ].filter(item => item && !items.some(offer => offer.phase === 'ready' && sameUpdate(offer, item)));
}

// A bridge call resolves when queued. Keep its phase until snapshots catch up, with a
// deadline for accepted requests that never start (e.g. Android permission declined).
export function selectFlow(state, request, previous, version = state.webVersion, now = Date.now()) {
  const active = installing(state, version);
  if (active) return active;
  const items = offers(state, version);
  const downloads = transfers(state, version, items);
  if (request?.phase === 'downloading') {
    const ready = items.find(item => item.phase === 'ready' && sameUpdate(item, request));
    if (ready) return ready;
    const transfer = downloads.find(item => sameUpdate(item, request));
    // Preserve the last progress across non-atomic native snapshots (owner, 2026-11-26).
    if (transfer) return { ...request, transfer: transfer.transfer || request.transfer, until: now + 6000 };
  }
  if (request && now < request.until && (request.phase === 'downloading' || items.some(item => sameUpdate(item, request)))
    && (!failureStatus(state, request.channel) || request.baseline === failureStatus(state, request.channel))
    && !(request.channel === 'web' && state.rolledBack?.from === request.version)) return request;
  const continuing = downloads.find(item => sameUpdate(item, previous));
  if (continuing) return { ...continuing, transfer: continuing.transfer || previous.transfer };
  return downloads[0] || items.find(item => sameUpdate(item, previous) && item.phase === 'ready') || items[0] || null;
}

export function noticeKey(type, version, channel, versionCode, webVersion) {
  return [type, channel, ['shell', 'combined'].includes(channel) && versionCode ? versionCode : version, channel === 'combined' && webVersion].filter(Boolean).join(':');
}

const megabytes = bytes => decimal((bytes / 1000000).toFixed(1));

export function sizeText(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  return t('ota.mb', { n: megabytes(bytes) });
}

export const amountText = (done, total) => Number.isFinite(total) && total >= 0
  ? t('ota.transfer', { done: megabytes(done || 0), total: sizeText(total) }) : sizeText(done);

function transferSize(bytes) {
  if (bytes >= 1000000) return sizeText(bytes);
  if (bytes >= 1000) return t('ota.kb', { n: decimal((bytes / 1000).toFixed(1)) });
  return t('ota.bytes', { n: Math.round(bytes) });
}

export const speedText = speed => speed > 0 ? t('ota.perSecond', { size: transferSize(speed) }) : '';

export function failureKind(code, message = '') {
  if (code === 'OFFLINE') return 'offline';
  if (code === 'MANIFEST') return 'invalid';
  if (['UNREACHABLE', 'TIMEOUT', 'TLS', 'NOT_FOUND', 'DENIED', 'RATE_LIMITED', 'SERVER'].includes(code)) return 'blocked';
  if (/no internet|offline/i.test(message)) return 'offline';
  if (/signature|manifest|invalid update/i.test(message)) return 'invalid';
  return 'blocked';
}

export function checkStatus(state, requestedAt) {
  const checks = state.updateChecks || {};
  const entries = [checks.web, checks.shell].filter(Boolean);
  const lastAttempt = Math.max(requestedAt || 0, ...entries.map(item => item.lastAttemptAt || item.lastCheckedAt || 0));
  const lastSuccess = Math.max(0, ...entries.map(item => item.lastSuccessAt || 0));
  const last = Math.max(lastAttempt, lastSuccess);
  if (state.status?.startsWith('Checking') || state.shellStatus?.startsWith('Checking') || entries.some(item => item.checking)) {
    return { kind: 'checking', last };
  }
  const failure = entries.find(item => item.code || item.error);
  if (failure || checks.failed) {
    return { kind: failureKind(failure?.code, failure?.error || checks.summary), last, previousSuccess: lastSuccess > lastAttempt };
  }
  const [found] = offers(state);
  return found ? { kind: 'available', last, item: found } : { kind: last ? 'upToDate' : 'neverChecked', last };
}

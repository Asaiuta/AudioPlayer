// Centralised NCM (music.163.com) public-page URL builders.
// Keep all upstream URL shapes here so a path change is a one-file edit.

const NCM_WEB_BASE = "https://music.163.com";

export const ncmSongPageUrl = (songId: number): string =>
  `${NCM_WEB_BASE}/#/song?id=${songId}`;

export const ncmMvPageUrl = (mvId: number | string): string =>
  `${NCM_WEB_BASE}/#/mv?id=${mvId}`;

export const ncmProgramPageUrl = (programId: number | string): string =>
  `${NCM_WEB_BASE}/#/program?id=${programId}`;

export const ncmDjRadioPageUrl = (radioId: number | string): string =>
  `${NCM_WEB_BASE}/#/djradio?id=${radioId}`;

export const ncmQrLoginUrl = (codeKey: string): string =>
  `${NCM_WEB_BASE}/login?codekey=${codeKey}`;

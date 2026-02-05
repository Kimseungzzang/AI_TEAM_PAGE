export function makeId(prefix) {
  return prefix + '-' + Date.now() + Math.random().toString(36).slice(2, 7);
}

export function stripAnsi(s) {
  if (!s) return '';
  let out = s.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '');
  out = out.replace(/\u001B\][^\u0007]*\u0007/g, '');
  out = out.replace(/\u001B\][^\u001B]*\u001B\\/g, '');
  return out;
}

export function cleanLine(line) {
  if (!line) return '';
  let text = line.replace(/\u00A0/g, ' ');
  text = text.replace(/^[\s\u00A0]+/g, '');
  text = text.replace(/[\s\u00A0]+$/g, '');
  const noiseIdx = text.toLowerCase().indexOf('100% context left');
  if (noiseIdx >= 0) text = text.slice(0, noiseIdx).trim();
  return text;
}

export function isNoise(line) {
  const lower = line.toLowerCase();
  if (
    lower.includes('context left') ||
    lower.includes('working(') ||
    lower.includes('esc to interrupt') ||
    lower.includes('tip:') ||
    lower.includes('claude') ||
    lower.includes('model:') ||
    lower.includes('directory:') ||
    lower.includes('use /skills') ||
    lower.includes('run /review') ||
    lower.includes('microsoft windows') ||
    lower.includes('all rights reserved') ||
    lower.includes('heads up') ||
    lower.includes('run /status')
  ) {
    return true;
  }
  if (/^m+$/.test(lower)) return true;
  return false;
}

export function isSetupEcho(text) {
  const lower = text.toLowerCase();
  return (
    lower.startsWith('your name is "') ||
    lower.includes('when you reply, always prefix your response')
  );
}

export function isTrivialText(text) {
  const t = (text || '').trim();
  if (!t) return true;
  if (t.length < 2) return true;
  if (/^['"]+$/.test(t)) return true;
  if (/^[\W_]+$/.test(t)) return true;
  return false;
}

export function normalizeRoleLine(line) {
  return line
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/[:\-\s]+$/g, '')
    .trim()
    .toLowerCase();
}

export function isGibberish(text) {
  const t = (text || '').trim();
  if (t.length < 20) return false;
  const uniq = new Set(t);
  if (uniq.size <= 3) return true;
  if (!t.includes(' ') && t.length > 60) return true;
  return false;
}

export function indexOfIgnoreCase(haystack, needle) {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

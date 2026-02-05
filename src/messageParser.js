import {
  cleanLine,
  indexOfIgnoreCase,
  isGibberish,
  isNoise,
  isSetupEcho,
  isTrivialText
} from './utils';

export function looksLikeClaudePrompt(chunk) {
  if (!chunk) return false;
  if (chunk.includes('requires git-bash') || chunk.includes('not recognized')) {
    return false;
  }
  return (
    chunk.includes('Welcome') ||
    chunk.includes('Claude Code v') ||
    chunk.includes('Try "') ||
    chunk.includes('? for shortcuts')
  );
}

export function parseRoleLine(state, line) {
  if (!line) return null;
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (isNoise(trimmed) || isGibberish(trimmed)) return null;

  if (state.name) {
    const idx = indexOfIgnoreCase(trimmed, state.name + ':');
    if (idx >= 0) {
      let text = trimmed.slice(idx + state.name.length + 1).trim();
      text = cleanLine(text);
      if (!text || isSetupEcho(text) || isTrivialText(text) || isGibberish(text)) return null;
      return { role: state.name, text };
    }
  }

  return null;
}

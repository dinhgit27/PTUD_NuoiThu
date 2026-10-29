/**
 * Format and clean YouTube music titles into natural Vietnamese spoken text.
 * Strips bracketed tags [MV], (Official Music Video), (Audio), [4K], etc.
 * Formats dividers like '|' into natural speech ("Song Title của Artist").
 */
export function formatCleanSongTitle(title: string): string {
  if (!title) return '';

  // 1. Remove bracketed noise: [MV], (Official Music Video), [4K], (Audio), (Lyrics), etc.
  let clean = title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(
      /\b(?:OFFICIAL\s+MUSIC\s+VIDEO|OFFICIAL\s+MV|OFFICIAL\s+VIDEO|MUSIC\s+VIDEO|M\/?V|LYRICS?\s+VIDEO|AUDIO|4K|HD|REMIX|COVER|TEASER|OFFICIAL)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Handle divider '|' or '//' (often "ARTIST | SONG TITLE" or "SONG TITLE | ARTIST")
  if (clean.includes('|')) {
    const parts = clean.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      clean = `${parts[1]} của ${parts[0]}`;
    } else {
      clean = parts[0] || clean;
    }
  }

  // 3. Remove leading/trailing dashes, colons, or punctuation
  clean = clean.replace(/^[-\s|:;]+|[-\s|:;]+$/g, '').trim();

  // If cleaning resulted in too short a string, fallback to original title without brackets
  if (clean.length < 2) {
    clean = title.replace(/[\[\(].*?[\]\)]/g, '').trim();
  }

  return clean || title;
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileStem(startDate: string): string {
  return `nobet-${startDate}`;
}

const FOLD: Record<string, string> = {
  'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
  'Ç': 'c', 'Ğ': 'g', 'I': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
};

/** A file name piece from a person's name. Turkish letters are folded to ASCII
    here and only here: it keeps the name readable on every operating system, and
    a file name is not something the app ever compares people by. */
export function nameSlug(name: string): string {
  const folded = [...name].map(ch => FOLD[ch] ?? ch).join('').toLowerCase();
  return folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

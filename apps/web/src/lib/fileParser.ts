import JSZip from 'jszip';

/** Extract plain text from a .docx file (Word document) */
export async function parseDocx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const docXml = await zip.file('word/document.xml')?.async('text');
  if (!docXml) throw new Error('Invalid .docx: word/document.xml not found');
  return stripXmlTags(docXml);
}

/** Extract plain text from a .pptx file (PowerPoint) */
export async function parsePptx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
    .sort();

  if (slideFiles.length === 0) throw new Error('Invalid .pptx: no slides found');

  const texts: string[] = [];
  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile)?.async('text');
    if (xml) {
      const text = stripXmlTags(xml)
        .replace(/\s+/g, ' ')
        .trim();
      if (text) texts.push(text);
    }
  }
  return texts.join('\n\n');
}

/** Strip XML tags and decode entities, returning plain text */
function stripXmlTags(xml: string): string {
  return xml
    .replace(/<w:p[^>]*>/g, '\n')   // Word paragraph breaks
    .replace(/<a:p[^>]*>/g, '\n')   // PPT paragraph breaks
    .replace(/<w:br[^>]*>/g, '\n')  // Word line breaks
    .replace(/<a:br[^>]*>/g, '\n')  // PPT line breaks
    .replace(/<w:tab[^>]*>/g, '\t') // Word tabs
    .replace(/<[^>]+>/g, '')        // All remaining tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\n{3,}/g, '\n\n')     // Collapse multiple blank lines
    .trim();
}

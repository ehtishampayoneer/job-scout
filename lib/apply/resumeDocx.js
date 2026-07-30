// lib/apply/resumeDocx.js
// Convert a tailored resume (Markdown, as stored on the application) into a real
// Word .docx the candidate can attach or upload. Handles the small Markdown
// subset the generator emits: #/##/### headings, - or * bullets, **bold**, and
// plain paragraphs. Never throws on odd input — worst case it renders as text.
import { Document, Packer, Paragraph, TextRun } from "docx";

function inlineRuns(text, base = {}) {
  return String(text || "")
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((p) => p !== "")
    .map((p) => {
      const bold = /^\*\*[^*]+\*\*$/.test(p);
      return new TextRun({ text: bold ? p.slice(2, -2) : p, bold: bold || !!base.bold, size: base.size });
    });
}

export async function resumeToDocxBuffer(resumeMd) {
  const lines = String(resumeMd || "").split(/\r?\n/);
  const children = [];

  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) {
      children.push(new Paragraph({ text: "" }));
      continue;
    }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      children.push(
        new Paragraph({
          children: inlineRuns(h[2], { bold: true, size: level <= 1 ? 34 : level === 2 ? 26 : 24 }),
          spacing: { before: level <= 1 ? 0 : 220, after: 90 },
        })
      );
      continue;
    }
    const b = l.match(/^[-*]\s+(.*)$/);
    if (b) {
      children.push(new Paragraph({ children: inlineRuns(b[1]), bullet: { level: 0 }, spacing: { after: 40 } }));
      continue;
    }
    children.push(new Paragraph({ children: inlineRuns(l), spacing: { after: 70 } }));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}

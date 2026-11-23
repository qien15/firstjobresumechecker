export async function extractResume(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "docx", "txt"].includes(extension || ""))
    throw Error("Choose a PDF, DOCX or TXT file.");
  if (file.size > 10 * 1024 * 1024)
    throw Error("Choose a file smaller than 10 MB.");
  let text = "";
  if (extension === "txt") text = await file.text();
  else if (extension === "docx") {
    const mammoth = await import("mammoth");
    text = (
      await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    ).value;
  } else {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    try {
      const pdf = await task.promise;
      const pages: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const content = await (await pdf.getPage(n)).getTextContent();
        let line = "",
          lastY: number | null = null;
        const lines: string[] = [];
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = item.transform[5];
          if (lastY !== null && Math.abs(y - lastY) > 3 && line) {
            lines.push(line);
            line = "";
          }
          line += (line ? " " : "") + item.str;
          lastY = y;
          if (item.hasEOL) {
            lines.push(line);
            line = "";
            lastY = null;
          }
        }
        if (line) lines.push(line);
        pages.push(lines.join("\n"));
      }
      text = pages.join("\n\n");
    } finally {
      await task.destroy();
    }
  }
  if (!text.trim())
    throw Error(
      "No readable text found. For a scanned PDF, use a text-based file or paste the text.",
    );
  return text.replaceAll("\u0000", "").slice(0, 150000);
}

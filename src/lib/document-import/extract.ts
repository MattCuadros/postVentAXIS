/**
 * Lectura de PDFs en el navegador: texto digital con pdfjs y, si el PDF es un escaneo, OCR con
 * tesseract.js (español), probando la orientación. Todo ocurre en el navegador; tesseract descarga
 * su modelo de idioma desde un CDN la primera vez.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface ExtractProgress {
  stage: "reading" | "ocr";
  /** 0 a 1 cuando se conoce. */
  progress: number | null;
  message: string;
}

export interface ExtractedPdf {
  text: string;
  fromOcr: boolean;
  pages: number;
  /** Confianza media del OCR (0–100), si se usó. */
  ocrConfidence: number | null;
}

/** Menos de este número de caracteres por página se considera "sin texto" (escaneo). */
const MIN_TEXT_PER_PAGE = 40;

/** Abre el PDF; `close` libera el worker y la memoria al terminar. */
async function loadPdf(file: File): Promise<{ pdf: PDFDocumentProxy; close: () => Promise<void> }> {
  const pdfjs = await import("pdfjs-dist");
  // Copia del worker de pdfjs-dist servida desde public/ (misma versión que el paquete).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, verbosity: 0 });
  return { pdf: await task.promise, close: () => task.destroy() };
}

/** Texto de cada página, con saltos de línea según la posición vertical del texto. */
async function readText(pdf: PDFDocumentProxy): Promise<string> {
  const pagesText: string[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null) text += Math.abs(y - lastY) > 2 ? "\n" : " ";
      text += item.str;
      lastY = y;
    }
    pagesText.push(text);
  }
  return pagesText.join("\n\f\n");
}

/** Dibuja una página en un canvas (para OCR o vista previa). */
export async function renderPage(pdf: PDFDocumentProxy, number: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(number);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen de la página.");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

function rotate(source: HTMLCanvasElement, degrees: 90 | 270): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.height;
  canvas.height = source.width;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

async function ocrPages(pdf: PDFDocumentProxy, onProgress: (progress: ExtractProgress) => void): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import("tesseract.js");
  let pageNumber = 1;
  const worker = await createWorker("spa", 1, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress({
          stage: "ocr",
          progress: message.progress,
          message: `Leyendo imagen de la página ${pageNumber} de ${pdf.numPages}…`,
        });
      } else if (message.status.includes("loading")) {
        onProgress({ stage: "ocr", progress: null, message: "Preparando el lector de imágenes (la primera vez descarga el idioma español)…" });
      }
    },
  });

  try {
    const texts: string[] = [];
    const confidences: number[] = [];
    for (pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const canvas = await renderPage(pdf, pageNumber, 2);
      let best = await worker.recognize(canvas);
      // Escaneos girados (ej. el informe AXIS viene en horizontal): se prueba 90° y 270°.
      if (best.data.confidence < 60) {
        for (const degrees of [90, 270] as const) {
          const attempt = await worker.recognize(rotate(canvas, degrees));
          if (attempt.data.confidence > best.data.confidence) best = attempt;
        }
      }
      texts.push(best.data.text);
      confidences.push(best.data.confidence);
    }
    const confidence = confidences.reduce((sum, value) => sum + value, 0) / Math.max(1, confidences.length);
    return { text: texts.join("\n\f\n"), confidence };
  } finally {
    await worker.terminate();
  }
}

/** Extrae el texto del PDF; recurre a OCR si el PDF no trae texto (documento escaneado). */
export async function extractPdf(file: File, onProgress: (progress: ExtractProgress) => void): Promise<ExtractedPdf> {
  onProgress({ stage: "reading", progress: null, message: "Leyendo el PDF…" });
  const { pdf, close } = await loadPdf(file);
  try {
    const text = await readText(pdf);
    const letters = text.replace(/\s/g, "").length;
    if (letters >= MIN_TEXT_PER_PAGE * pdf.numPages) {
      return { text, fromOcr: false, pages: pdf.numPages, ocrConfidence: null };
    }
    onProgress({ stage: "ocr", progress: null, message: "El PDF es un escaneo: aplicando lectura de imagen (OCR)…" });
    const ocr = await ocrPages(pdf, onProgress);
    return { text: ocr.text, fromOcr: true, pages: pdf.numPages, ocrConfidence: ocr.confidence };
  } finally {
    await close();
  }
}

/** Imagen (data URL) de la primera página para mostrar junto al formulario de revisión. */
export async function previewFirstPage(file: File): Promise<string> {
  const { pdf, close } = await loadPdf(file);
  try {
    const canvas = await renderPage(pdf, 1, 1.2);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    await close();
  }
}

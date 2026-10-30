import "server-only";

export function pdfResponse(bytes: Uint8Array, filename: string, inline = true) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

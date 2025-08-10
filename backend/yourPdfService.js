// yourPdfService.js
import PDFDocument from "pdfkit";
import getStream from "get-stream";

export async function generateReceiptPDF(delivery, signature) {
  const doc = new PDFDocument();
  let buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  doc.fontSize(18).text("קבלה על ניפוק מלאי", { align: "center" });
  doc.moveDown();
  doc.fontSize(14).text(`ללקוח: ${delivery.customer}`);
  doc.text(`לשם: ${delivery.deliveredTo}`);
  doc.text(`תאריך: ${delivery.date ? new Date(delivery.date).toLocaleString('he-IL') : ""}`);
  doc.moveDown();
  doc.text("מוצרים:", { underline: true });
  delivery.items.forEach((item, idx) => {
    doc.text(`${idx + 1}. מוצר: ${item.product}, כמות: ${item.quantity}`);
  });

  if (signature && signature.startsWith("data:image")) {
    try {
      const base64Data = signature.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");
      doc.addPage().image(imgBuffer, 50, 50, { width: 200 });
    } catch (e) {
      // אם יש בעיה בחתימה – ממשיכים בלי החתימה
    }
  }

  doc.end();
  const pdfBuffer = await getStream.buffer(doc);
  return pdfBuffer;
}


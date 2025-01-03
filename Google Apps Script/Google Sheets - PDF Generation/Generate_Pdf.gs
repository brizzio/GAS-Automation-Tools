// Google Apps Script to Generate PDF for an Invoice from a Google Sheet

function generateInvoicePDF() {
  const sheetName = 'Invoices'; // Name of your Google Sheet
  const folderId = 'YOUR_FOLDER_ID'; // Replace with your Google Drive Folder ID
  const templateDocId = 'YOUR_TEMPLATE_DOC_ID'; // Replace with your Google Docs Template ID

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const folder = DriveApp.getFolderById(folderId);
  const templateDoc = DriveApp.getFileById(templateDocId);

  // Get the data range
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Iterate through each row (starting from the second row)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const invoiceData = {};

    // Map row data to header fields
    headers.forEach((header, index) => {
      invoiceData[header] = row[index];
    });

    // Create a new Google Doc from the template
    const newDoc = templateDoc.makeCopy(`Invoice_${invoiceData.InvoiceNumber}`, folder);
    const doc = DocumentApp.openById(newDoc.getId());
    const body = doc.getBody();

    // Replace placeholders in the template with actual data
    for (const key in invoiceData) {
      body.replaceText(`{{${key}}}`, invoiceData[key]);
    }

    // Save and close the document
    doc.saveAndClose();

    // Convert the Google Doc to a PDF
    const pdf = DriveApp.getFileById(newDoc.getId()).getAs('application/pdf');

    // Save the PDF in the specified folder
    folder.createFile(pdf).setName(`Invoice_${invoiceData.InvoiceNumber}.pdf`);

    // Optionally delete the Google Doc after creating the PDF
    DriveApp.getFileById(newDoc.getId()).setTrashed(true);
  }

  SpreadsheetApp.getUi().alert('Invoices have been generated as PDFs.');
}

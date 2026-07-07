import { jsPDF } from 'jspdf';
import { FLHA_CATEGORIES } from './flhaItems.js';

// Loads an image from the /public folder and returns it as a data URL plus its
// natural pixel dimensions, so it can be embedded in the PDF at the right aspect ratio.
async function loadImageAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const { width, height } = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
  return { dataUrl, width, height };
}

// Cache the logo so we only fetch/convert it once per page load, not once per PDF.
let logoCache = null;
async function getLogo() {
  if (logoCache === null) {
    logoCache = await loadImageAsDataUrl('/hcr-logo.png').catch(() => null);
  }
  return logoCache;
}

// Builds a PDF that mirrors the HCR "Work Site / Lift Hazard Assessment & Tool Box
// Meeting Report" form and returns it as a base64 string (for emailing) and a Blob
// (for local download / storage upload).
export async function generateFlhaPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = margin;

  const navy = [22, 50, 74];
  const gray = [107, 120, 133];
  const logo = await getLogo();

  function header() {
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 50, 'F');
    let textX = margin;
    if (logo && logo.width && logo.height) {
      const h = 32;
      const w = (logo.width / logo.height) * h;
      doc.addImage(logo.dataUrl, 'PNG', margin, 9, w, h);
      textX = margin + w + 10;
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('HOODS CRANE RENTAL', textX, 16);
    doc.setFontSize(11);
    doc.text('Work Site / Lift Hazard Assessment', textX, 30);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('& Tool Box Meeting Report', textX, 42);
    doc.setTextColor(0, 0, 0);
    y = 68;
  }
  header();

  function checkSpace(needed) {
    if (y + needed > 760) {
      doc.addPage();
      y = margin;
      header();
    }
  }

  function fieldLine(label, value, x, width) {
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(label, x, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(String(value || '—'), x, y + 12, { maxWidth: width });
  }

  // Job detail grid
  const colW = (pageWidth - margin * 2) / 3;
  const fields = [
    ['Date', data.date], ['Time', data.time], ['Customer', data.customer],
    ['Site Location', data.site], ['Operator(s)', data.operator], ['Operator Initials', data.operatorInitials],
    ['Signal Person', data.signal], ['Crane Field Order #', data.order], ['Load Weight', `${data.loadWeight || ''} ${data.loadUnit || ''}`],
    ['Crane Unit #1', data.unit1], ['Crane Unit #2', data.unit2], ['Supervisor Email', data.supervisorEmail]
  ];
  let fx = margin;
  fields.forEach((f, i) => {
    fieldLine(f[0], f[1], fx, colW - 8);
    fx += colW;
    if ((i + 1) % 3 === 0) { fx = margin; y += 26; }
  });
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text('Job / Task or Load Description:', margin, y);
  doc.setTextColor(0, 0, 0);
  const descLines = doc.splitTextToSize(data.jobDesc || '—', pageWidth - margin * 2);
  doc.text(descLines, margin, y + 12);
  y += 12 + descLines.length * 11 + 10;

  doc.setDrawColor(...gray);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // Observation items
  FLHA_CATEGORIES.forEach(cat => {
    checkSpace(30);
    doc.setFillColor(...navy);
    doc.rect(margin, y - 10, pageWidth - margin * 2, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(cat.name, margin + 4, y + 1);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 14;

    cat.items.forEach(item => {
      checkSpace(16);
      const state = data.items[item.id] || {};
      const statusText = item.freeTextOnly
        ? (state.value || '—')
        : state.status === 'safe' ? 'SAFE' : state.status === 'risk' ? `RISK${state.riskRating ? ' (' + state.riskRating + ')' : ''}` : '—';
      doc.setFontSize(8.5);
      const wrapped = doc.splitTextToSize(`${item.id}. ${item.text}`, pageWidth - margin * 2 - 90);
      doc.text(wrapped, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(state.status === 'risk' ? 179 : state.status === 'safe' ? 46 : 107,
                        state.status === 'risk' ? 57 : state.status === 'safe' ? 125 : 120,
                        state.status === 'risk' ? 44 : state.status === 'safe' ? 79 : 133);
      doc.text(statusText, pageWidth - margin - 80, y, { maxWidth: 80 });
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      y += wrapped.length * 10 + 4;
      if (item.hasName && state.signalmanName) {
        doc.setFontSize(8);
        doc.setTextColor(...gray);
        doc.text(`Signalman: ${state.signalmanName}`, margin + 10, y);
        doc.setTextColor(0, 0, 0);
        y += 12;
      }
    });
    y += 6;
  });

  // Crane setup changes
  checkSpace(50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Crane Set-Up Changes', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 12;
  (data.setupChanges || []).forEach(s => {
    checkSpace(12);
    doc.setFontSize(8.5);
    doc.text(`${s.label}: ${s.changes ? 'Yes' : 'No'}   Operator Initials: ${s.initials || '—'}`, margin, y);
    y += 12;
  });
  y += 8;

  // Task/condition notes
  checkSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Tasks / Condition Change & Risk Ranking', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 12;
  const taskLines = doc.splitTextToSize(data.taskNotes || '—', pageWidth - margin * 2);
  doc.setFontSize(8.5);
  doc.text(taskLines, margin, y);
  y += taskLines.length * 10 + 10;

  // Hazard control measures
  checkSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Hazard Control Measures', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 12;
  (data.hazardControls || []).forEach((h, i) => {
    checkSpace(14);
    const lines = doc.splitTextToSize(`#${h.itemNum || i + 1}: ${h.measure || ''}`, pageWidth - margin * 2);
    doc.setFontSize(8.5);
    doc.text(lines, margin, y);
    y += lines.length * 10 + 4;
  });
  y += 8;

  // Attendees
  checkSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Toolbox Meeting Attendees', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 12;
  (data.attendees || []).forEach(a => {
    checkSpace(46);
    doc.setFontSize(8.5);
    doc.text(a.printName || '—', margin, y + 22);
    if (a.signatureDataUrl) {
      doc.addImage(a.signatureDataUrl, 'PNG', margin + 220, y, 140, 40);
    } else {
      doc.setTextColor(...gray);
      doc.text('(not signed)', margin + 220, y + 22);
      doc.setTextColor(0, 0, 0);
    }
    doc.setDrawColor(220, 224, 228);
    doc.line(margin, y + 34, pageWidth - margin, y + 34);
    y += 44;
  });

  const pdfBase64 = doc.output('datauristring').split(',')[1];
  const pdfBlob = doc.output('blob');
  return { pdfBase64, pdfBlob };
}

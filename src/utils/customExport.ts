import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { toJpeg } from 'html-to-image';

type ExportProps = {
  data: any[];
  columns: any[];
  fileName?: string;
  type: 'xlsx' | 'xls' | 'csv' | 'jpg';
  chartRef?: React.RefObject<HTMLDivElement>;
};

export async function customExport({
  data,
  columns,
  fileName = 'export',
  type,
  chartRef,
}: ExportProps) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '_')
    .replace('T', '_')
    .replace('Z', '');
  const finalFileName = `${fileName}-${timestamp}.${type}`;

  if (type === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.addRow(columns.map((col) => col.label));
    data.forEach((rowData) => {
      worksheet.addRow(columns.map((col) => rowData[col.key]));
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), finalFileName);
    return;
  }

  if (type === 'xls') {
    const wsData = [
      columns.map((col) => col.label),
      ...data.map((row) => columns.map((col) => row[col.key] ?? '')),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, finalFileName, { bookType: 'xls' });
    return;
  }

  if (type === 'csv') {
    const header = columns.map((col) => `"${col.label}"`).join(',');
    const rows = data.map((row) => columns.map((col) => `"${row[col.key] ?? ''}"`).join(','));
    const csvContent = [header, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, finalFileName);
    return;
  }

  if (type === 'jpg') {
    if (chartRef && chartRef.current) {
      toJpeg(chartRef.current, { quality: 0.95, backgroundColor: 'white', skipFonts: true }).then(
        (dataUrl: string) => {
          const link = document.createElement('a');
          link.download = finalFileName;
          link.href = dataUrl;
          link.click();
        },
      );
    } else {
      alert('Chart reference missing for JPG export.');
    }
    return;
  }

  alert('Unsupported export type');
}

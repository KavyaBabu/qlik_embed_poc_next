import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type ExportProps = {
  data: any[];
  columns: any[];
  fileName?: string;
};

export async function customExport({
  data,
  columns,
  fileName = 'excelExport'
}: ExportProps) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  const colorMap: Record<string, string> = {
    'red': 'c70132',
    'green': '7ace94',
    'yellow': 'fcae18',
    'amber': 'FFFFBF00'
  };

  const headerRow = worksheet.addRow(columns.map(col => col.label));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: '000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const ragColIndex = columns.findIndex(col => col.key === 'rag');
  const ragExcelColNum = ragColIndex !== -1 ? ragColIndex + 1 : -1;

  data.forEach((rowData) => {
    const rowValues = columns.map(col => rowData[col.key]);
    const row = worksheet.addRow(rowValues);

    if (ragExcelColNum !== -1) {
      const ragCell = row.getCell(ragExcelColNum);
      const ragValue = ragCell.value?.toString().toLowerCase();

      if (ragValue && colorMap[ragValue]) {
        const color = colorMap[ragValue];
        ragCell.value = ''; 
        ragCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color }
        };
        ragCell.font = {
          color: { argb: 'FF000000' }
        };
        ragCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (!cell.fill) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  worksheet.columns.forEach((column, idx) => {
    const colKey = columns[idx]?.key;
    if (colKey === 'summary' || colKey === 'projectName') {
      column.width = 20; 
    }
    else if (column && column.eachCell) {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    } else {
      column.width = 10;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();

  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '_')
    .replace('T', '_')
    .replace('Z', '');
  const finalFileName = `${fileName}-${timestamp}.xlsx`;

  saveAs(new Blob([buffer]), finalFileName);
}

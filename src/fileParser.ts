export interface ParsedMeterData {
    id: number;
  }
  
  export interface FileParseResult {
    success: boolean;
    data: ParsedMeterData[];
    error?: string;
  }
  
  const VALID_HEADER_NAMES = [
    "meter_id",
    "meter id",
    "meterid",
    "id",
    "meter",
  ];
  
  
  function findMeterIdColumn(headers: string[]): string | null {
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  
    for (const validHeader of VALID_HEADER_NAMES) {
      const index = normalizedHeaders.indexOf(validHeader);
      if (index !== -1) {
        return headers[index];
      }
    }
  
    return null;
  }
  
 
  export function validateAndExtractMeterIds(
    headers: string[],
    data: Record<string, any>[]
  ): FileParseResult {
    try {
      const meterIdColumn = findMeterIdColumn(headers);
  
      if (!meterIdColumn) {
        return {
          success: false,
          data: [],
          error: `Invalid file format. Header must contain one of: ${VALID_HEADER_NAMES.join(", ")}`,
        };
      }
  
      const meterIds: ParsedMeterData[] = [];
      const seenIds = new Set<number>();
  
      for (const row of data) {
        const rawValue = row[meterIdColumn];
  
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          continue;
        }
  
        const meterId = Number(rawValue);
  
        if (!Number.isFinite(meterId) || meterId <= 0) {
          continue;
        }
  
        if (!seenIds.has(meterId)) {
          seenIds.add(meterId);
          meterIds.push({ id: meterId });
        }
      }
  
      if (meterIds.length === 0) {
        return {
          success: false,
          data: [],
          error: "No valid meter IDs found in the file",
        };
      }
  
      return {
        success: true,
        data: meterIds,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: `Failed to process file data: ${(error as Error).message}`,
      };
    }
  }

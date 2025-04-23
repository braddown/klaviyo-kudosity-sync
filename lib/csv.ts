/**
 * CSV utilities for data processing
 */

/**
 * Convert an array of objects to CSV format
 * @param data The array of objects to convert
 * @param columns The columns to include in the CSV
 * @returns A string in CSV format
 */
export function objectsToCsv(
  data: Record<string, any>[],
  columns: { field: string; header: string }[]
): string {
  // Create header row
  const headers = columns.map(col => col.header);
  const headerRow = headers.join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return columns.map(col => {
      const value = item[col.field] || '';
      // Escape quotes and wrap in quotes if needed
      return formatCsvValue(value);
    }).join(',');
  });
  
  // Combine header and rows
  return [headerRow, ...rows].join('\n');
}

/**
 * Formats a value for CSV to handle quotes, commas, and newlines
 * @param value The value to format
 * @returns Properly formatted CSV value
 */
function formatCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // If the value contains a comma, a double quote, or a newline, it needs to be quoted
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Double up any quotes inside the value
    const escapedValue = stringValue.replace(/"/g, '""');
    return `"${escapedValue}"`;
  }
  
  return stringValue;
}

/**
 * Maps fields from a source object to a destination object using a field mapping
 * @param sourceObject The source object with original fields
 * @param fieldMapping Mapping of source field names to destination field names
 * @returns A new object with the mapped fields
 */
export function mapFields(
  sourceObject: Record<string, any>,
  fieldMapping: Record<string, string>
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [sourceField, destinationField] of Object.entries(fieldMapping)) {
    if (sourceObject[sourceField] !== undefined) {
      result[destinationField] = sourceObject[sourceField];
    }
  }
  
  return result;
}

/**
 * Validates a mobile phone number to ensure it's in a valid format
 * @param phone The phone number to validate
 * @returns true if the phone number is valid, false otherwise
 */
export function isValidMobileNumber(phone: string): boolean {
  // Basic phone number validation - can be expanded based on requirements
  if (!phone) return false;
  
  // Remove spaces, dashes, parentheses
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Check if it starts with a plus sign or digits
  if (!/^(\+|[0-9])/.test(cleanPhone)) return false;
  
  // Check length (minimum 8 digits excluding the plus)
  const digits = cleanPhone.replace(/\+/g, '');
  if (digits.length < 8 || digits.length > 15) return false;
  
  // Check that it contains only valid characters
  if (!/^(\+)?[0-9]+$/.test(cleanPhone)) return false;
  
  return true;
} 
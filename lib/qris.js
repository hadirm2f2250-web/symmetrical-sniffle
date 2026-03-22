/**
 * Utility function to calculate CRC16 checksum for QRIS
 */
export const calculateCrc16 = (str) => {
  let crc = 0xFFFF;
  const strlen = str.length;
  for (let c = 0; c < strlen; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  const hex = (crc & 0xFFFF).toString(16).toUpperCase();
  return hex.padStart(4, '0');
};

/**
 * Generates a dynamic QRIS string by injecting the amount tag into a static QRIS string
 * @param {string} staticQris - The source static QRIS string
 * @param {string|number} amount - The transaction amount
 * @returns {string} The final dynamic QRIS string
 */
export const generateDynamicQris = (staticQris, amount) => {
  if (!staticQris || staticQris.length < 4) {
    throw new Error('Invalid static QRIS data.');
  }

  // Remove the old CRC
  const qrisWithoutCrc = staticQris.substring(0, staticQris.length - 4);
  
  // Replace Static Indicator with Dynamic Indicator
  const step1 = qrisWithoutCrc.replace("010211", "010212");
  
  // Split before the ID country code tag (5802ID)
  const parts = step1.split("5802ID");
  if (parts.length !== 2) {
    throw new Error("QRIS data format is incompatible (missing '5802ID').");
  }

  const amountStr = String(parseInt(amount, 10)); // Integer amount
  
  // Tag 54 is Transaction Amount: 54 + length + amount
  const amountTag = "54" + String(amountStr.length).padStart(2, '0') + amountStr;

  // Insert amount tag right before 5802ID
  const payload = [parts[0], amountTag, "5802ID", parts[1]].join('');
  
  const finalCrc = calculateCrc16(payload);
  return payload + finalCrc;
};

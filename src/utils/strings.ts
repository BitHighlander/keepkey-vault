export const middleEllipsis = (text: string, visibleChars = 16): string => {
  if (!text) return '';
  if (text.length <= visibleChars) return text;
  const charsToShow = Math.floor(visibleChars / 2);
  return `${text.substring(0, charsToShow)}...${text.substring(text.length - charsToShow)}`;
};

export const formatUsd = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};


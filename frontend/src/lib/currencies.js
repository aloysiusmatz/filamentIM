export const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", symbol: "$", rate: 0.12 },
  { code: "CA", name: "Canada", currency: "CAD", symbol: "C$", rate: 0.13 },
  { code: "GB", name: "United Kingdom", currency: "GBP", symbol: "\u00a3", rate: 0.28 },
  { code: "DE", name: "Germany", currency: "EUR", symbol: "\u20ac", rate: 0.35 },
  { code: "FR", name: "France", currency: "EUR", symbol: "\u20ac", rate: 0.20 },
  { code: "IT", name: "Italy", currency: "EUR", symbol: "\u20ac", rate: 0.22 },
  { code: "ES", name: "Spain", currency: "EUR", symbol: "\u20ac", rate: 0.18 },
  { code: "NL", name: "Netherlands", currency: "EUR", symbol: "\u20ac", rate: 0.30 },
  { code: "BE", name: "Belgium", currency: "EUR", symbol: "\u20ac", rate: 0.30 },
  { code: "AT", name: "Austria", currency: "EUR", symbol: "\u20ac", rate: 0.25 },
  { code: "PT", name: "Portugal", currency: "EUR", symbol: "\u20ac", rate: 0.18 },
  { code: "SE", name: "Sweden", currency: "SEK", symbol: "kr", rate: 1.80 },
  { code: "NO", name: "Norway", currency: "NOK", symbol: "kr", rate: 1.20 },
  { code: "DK", name: "Denmark", currency: "DKK", symbol: "kr", rate: 2.50 },
  { code: "CH", name: "Switzerland", currency: "CHF", symbol: "CHF", rate: 0.20 },
  { code: "PL", name: "Poland", currency: "PLN", symbol: "z\u0142", rate: 0.20 },
  { code: "CZ", name: "Czech Republic", currency: "CZK", symbol: "K\u010d", rate: 5.0 },
  { code: "JP", name: "Japan", currency: "JPY", symbol: "\u00a5", rate: 25.0 },
  { code: "CN", name: "China", currency: "CNY", symbol: "\u00a5", rate: 0.50 },
  { code: "KR", name: "South Korea", currency: "KRW", symbol: "\u20a9", rate: 120.0 },
  { code: "IN", name: "India", currency: "INR", symbol: "\u20b9", rate: 6.0 },
  { code: "AU", name: "Australia", currency: "AUD", symbol: "A$", rate: 0.25 },
  { code: "NZ", name: "New Zealand", currency: "NZD", symbol: "NZ$", rate: 0.22 },
  { code: "SG", name: "Singapore", currency: "SGD", symbol: "S$", rate: 0.22 },
  { code: "MY", name: "Malaysia", currency: "MYR", symbol: "RM", rate: 0.55 },
  { code: "TH", name: "Thailand", currency: "THB", symbol: "\u0e3f", rate: 4.0 },
  { code: "ID", name: "Indonesia", currency: "IDR", symbol: "Rp", rate: 1445.0 },
  { code: "PH", name: "Philippines", currency: "PHP", symbol: "\u20b1", rate: 10.0 },
  { code: "BR", name: "Brazil", currency: "BRL", symbol: "R$", rate: 0.60 },
  { code: "MX", name: "Mexico", currency: "MXN", symbol: "MX$", rate: 1.50 },
  { code: "AR", name: "Argentina", currency: "ARS", symbol: "AR$", rate: 50.0 },
  { code: "CO", name: "Colombia", currency: "COP", symbol: "COL$", rate: 500.0 },
  { code: "CL", name: "Chile", currency: "CLP", symbol: "CL$", rate: 120.0 },
  { code: "TR", name: "Turkey", currency: "TRY", symbol: "\u20ba", rate: 2.50 },
  { code: "RU", name: "Russia", currency: "RUB", symbol: "\u20bd", rate: 5.0 },
  { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R", rate: 2.50 },
  { code: "AE", name: "UAE", currency: "AED", symbol: "AED", rate: 0.25 },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", symbol: "SAR", rate: 0.18 },
];

export function getCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}

export function formatCurrency(amount, symbol) {
  if (amount === null || amount === undefined) return "-";
  return `${symbol}${Number(amount).toFixed(2)}`;
}

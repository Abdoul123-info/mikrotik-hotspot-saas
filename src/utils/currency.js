export function formatCurrency(amount, settings) {
  const { currencySymbol = 'FCFA', currencyPosition = 'after' } = settings;
  const formattedAmount = Number(amount).toLocaleString('fr-FR');
  
  return currencyPosition === 'before'
    ? `${currencySymbol}${formattedAmount}`
    : `${formattedAmount} ${currencySymbol}`;
}

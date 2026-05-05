import { EXCHANGE_RATE } from '../constants';

/**
 * Formate un prix en affichant à la fois USD et CDF
 * @param amount Le montant
 * @param fromCurrency La devise d'origine ('USD' ou 'CDF')
 * @param rate Taux de change optionnel (USD -> CDF)
 * @param displayMode Mode d'affichage ('dual', 'usd', 'cdf')
 * @returns Une chaîne formatée
 */
export const formatDualPrice = (amount: number, fromCurrency: 'USD' | 'CDF' = 'USD', rate?: number, displayMode: 'dual' | 'usd' | 'cdf' = 'dual'): string => {
  const activeRate = rate || EXCHANGE_RATE;
  
  if (displayMode === 'usd') {
    const usd = fromCurrency === 'USD' ? amount : amount / activeRate;
    return `$${usd.toFixed(2)}`;
  }
  
  if (displayMode === 'cdf') {
    const cdf = fromCurrency === 'CDF' ? amount : amount * activeRate;
    return `${cdf.toLocaleString('fr-FR').replace(/\s/g, '.')} FC`;
  }

  if (fromCurrency === 'USD') {
    const usd = amount;
    const cdf = amount * activeRate;
    return `$${usd.toFixed(2)} / ${cdf.toLocaleString('fr-FR').replace(/\s/g, '.')} FC`;
  } else {
    const cdf = amount;
    const usd = amount / activeRate;
    return `${cdf.toLocaleString('fr-FR').replace(/\s/g, '.')} FC / $${usd.toFixed(2)}`;
  }
};

/**
 * Formate un prix simplement (une seule devise)
 */
export const formatPrice = (amount: number, currency: 'USD' | 'CDF' = 'USD'): string => {
  if (currency === 'CDF') {
    return `${amount.toLocaleString('fr-FR').replace(/\s/g, '.')} FC`;
  }
  return `$${amount.toFixed(2)}`;
};

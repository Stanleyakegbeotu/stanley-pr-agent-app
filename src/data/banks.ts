/**
 * Banks in Nigeria for payout accounts (owner, 2026-11-24: "all commercial
 * banks and popular microfinance banks"). Grouped the way the CBN licenses
 * them. An agent whose bank isn't listed can type its name.
 * Heritage Bank is left out: its licence was revoked in June 2024.
 */
export interface BankGroup {
  title: string;
  banks: string[];
}

export const NIGERIAN_BANKS: BankGroup[] = [
  {
    title: 'Commercial banks',
    banks: [
      'Access Bank',
      'Citibank Nigeria',
      'Ecobank Nigeria',
      'Fidelity Bank',
      'First Bank of Nigeria',
      'First City Monument Bank (FCMB)',
      'Globus Bank',
      'Guaranty Trust Bank (GTBank)',
      'Keystone Bank',
      'Nova Commercial Bank',
      'Optimus Bank',
      'Parallex Bank',
      'Polaris Bank',
      'PremiumTrust Bank',
      'Providus Bank',
      'Signature Bank',
      'Stanbic IBTC Bank',
      'Standard Chartered Bank',
      'Sterling Bank',
      'SunTrust Bank',
      'Titan Trust Bank',
      'Union Bank of Nigeria',
      'United Bank for Africa (UBA)',
      'Unity Bank',
      'Wema Bank (ALAT)',
      'Zenith Bank',
    ],
  },
  {
    title: 'Non-interest banks',
    banks: ['Jaiz Bank', 'Lotus Bank', 'Taj Bank', 'The Alternative Bank'],
  },
  {
    title: 'Merchant banks',
    banks: ['Coronation Merchant Bank', 'FBNQuest Merchant Bank', 'FSDH Merchant Bank', 'Greenwich Merchant Bank', 'Rand Merchant Bank'],
  },
  {
    title: 'Mobile money and payment service banks',
    banks: ['OPay', 'PalmPay', 'Moniepoint Microfinance Bank', 'Paga', '9 Payment Service Bank (9PSB)', 'MoMo Payment Service Bank (MTN)', 'SmartCash Payment Service Bank (Airtel)', 'Hope Payment Service Bank'],
  },
  {
    title: 'Microfinance banks',
    banks: [
      'AB Microfinance Bank',
      'Accion Microfinance Bank',
      'Baobab Microfinance Bank',
      'Carbon Microfinance Bank',
      'FairMoney Microfinance Bank',
      'Fina Trust Microfinance Bank',
      'Firmus Microfinance Bank',
      'Kuda Microfinance Bank',
      'LAPO Microfinance Bank',
      'Mint Microfinance Bank',
      'Mkobo Microfinance Bank',
      'NIRSAL Microfinance Bank',
      'Renmoney Microfinance Bank',
      'Rubies Microfinance Bank',
      'Sparkle Microfinance Bank',
      'VFD Microfinance Bank (V Bank)',
    ],
  },
];

export const ALL_BANKS = NIGERIAN_BANKS.flatMap((g) => g.banks);

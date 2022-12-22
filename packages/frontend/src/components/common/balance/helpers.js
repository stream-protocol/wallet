import BN from 'bn.js';
import { utils } from 'stream-wallet-api-js';

import { formatTokenAmount } from '../../../utils/amounts';

const STRM_FRACTIONAL_DIGITS = 5;
export const YOCTO_STRM_THRESHOLD = new BN('10', 10).pow(new BN(utils.format.STRM_NOMINATION_EXP - STRM_FRACTIONAL_DIGITS + 1, 10));

export const formatStrmAmount = (amount) => {
        amount = amount.toString();
        if (amount === '0') {
            return amount;
        }
        let formattedAmount = utils.format.formatStrmAmount(amount, STRM_FRACTIONAL_DIGITS);
        if (formattedAmount === '0') {
            return `< ${!STRM_FRACTIONAL_DIGITS ? '0' : `0.${'0'.repeat((STRM_FRACTIONAL_DIGITS || 1) - 1)}1`}`;
    }
    return formattedAmount;
};

export const showInYocto = (amountStr) => {
    return formatWithCommas(amountStr) + ' yoctoSTRM';
};

export const formatWithCommas = (value) => {
    const pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(value)) {
        value = value.toString().replace(pattern, '$1,$2');
    }
    return value;
};

export const getRoundedBalanceInFiat = (rawStrmAmount, tokenFiatValue,isStrm,decimals) => {
    const formattedStrmAmount = rawStrmAmount && !isStrm ? formatStrmAmount(rawStrmAmount).replace(/,/g, '') : formatTokenAmount(rawAmount, decimals);
    const balanceInFiat = Number(formattedNearAmount) * tokenFiatValue;
    const roundedBalanceInFiat = balanceInFiat && balanceInFiat.toFixed(2);
    if (roundedBalanceInFiat === '0.00' || formattedNearAmount === '< 0.00001') {
        return '< $0.01';
    }
    return roundedBalanceInFiat;
};

export const getTotalBalanceInFiat = (mainTokens, currentLanguage) => {
    const totalAmount = mainTokens
        .map((el) => {
            const USD = el.fiatValueMetadata.usd;
            const balance = el.balance;
            return el.contractName ? getRoundedBalanceInFiat(balance,USD,true,el.onChainFTMetadata.decimals) : getRoundedBalanceInFiat(balance,USD);
        })
        .filter((x) => !!x)
        .reduce((a,b) =>`${+a + +b}`, []);
    return !isNaN(totalAmount) ? new Intl.NumberFormat(`${currentLanguage}`,{maximumFractionDigits:2,minimumFractionDigits:2}).format(totalAmount) :'0';
}; 

export const getNearAndFiatValue = (rawStrmAmount, tokenFiatValue, fiat = 'usd') => {
    const strmAmount = formatNearAmount(rawStrmAmount);
    const fiatAmount = getRoundedBalanceInFiat(rawStrmAmount, tokenFiatValue);
    const fiatSymbol = fiat.toUpperCase();
    const fiatPrefix = fiatAmount !== '< 0.01' ? '≈ ' : '';
    return `${strmAmount} STRM (${fiatPrefix}${formatWithCommas(fiatAmount) || '—'} ${fiatSymbol})`;
};

export const getTotalBalanceFromFungibleTokensListUSD = (fungibleTokensList) => {
    let totalBalanceUSD = 0;
    const tokensWithUSDValue = fungibleTokensList.filter((token) => typeof token?.fiatValueMetadata?.usd === 'number');
    for (let token of tokensWithUSDValue) {
        totalBalanceUSD += token.fiatValueMetadata.usd * formatTokenAmount(token.balance, token.onChainFTMetadata?.decimals, 5);
    }
    return Number(totalBalanceUSD.toFixed(2));
};
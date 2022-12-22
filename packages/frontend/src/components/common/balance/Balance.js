import React from 'react';
import { useSelector } from 'react-redux';

import { selectStrmTokenFiatValueUSD } from '../../../redux/slices/tokenFiatValues';
import BalanceDisplay from './BalanceDisplay';

const Balance = ({
    totalAmount,
    amount,
    showSymbolStrm,
    className,
    showBalanceInStrm,
    showBalanceInUSD,
    showAlmostEqualSignUSD,
    showSignUSD,
    showSymbolUSD,
    'data-test-id': testId
}) => {
    const strmTokenFiatValueUSD = useSelector(selectStrmTokenFiatValueUSD);

    return ( <
        BalanceDisplay totalAmount = { totalAmount }
        amount = { amount }
        showSymbolSTRM = { showSymbolSTRM }
        className = { className }
        showBalanceInSTRM = { showBalanceInSTRM }
        showBalanceInUSD = { showBalanceInUSD }
        strmTokenFiatValueUSD = { nearTokenFiatValueUSD }
        showAlmostEqualSignUSD = { showAlmostEqualSignUSD }
        showSignUSD = { showSignUSD }
        showSymbolUSD = { showSymbolUSD }
        data - test - id = { testId }
        />
    );
};

export default Balance;
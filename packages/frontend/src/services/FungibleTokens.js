import BN from 'bn.js';
import * as nearApiJs from 'near-api-js';

import { FT_TRANSFER_REGISTRATION } from '../../../../features';
import {
    NEAR_TOKEN_ID,
    TOKEN_TRANSFER_DEPOSIT,
    FT_TRANSFER_GAS,
    FT_STORAGE_DEPOSIT_GAS,
    FT_MINIMUM_STORAGE_BALANCE,
    FT_MINIMUM_STORAGE_BALANCE_LARGE,
    FT_REGISTRATION_DEPOSIT,
    FT_REGISTRATION_DEPOSIT_GAS,
    SEND_NEAR_GAS,
} from '../config';
import {
    parseTokenAmount,
    formatTokenAmount,
    removeTrailingZeros,
} from '../utils/amounts';
import { getTotalGasFee } from '../utils/gasPrice';
import { wallet } from '../utils/wallet';
import { listLikelyTokens } from './indexer';

const {
    transactions: { functionCall },
    utils: {
        format: { parseNearAmount, formatNearAmount },
    },
} = nearApiJs;

// Fungible Token Standard
// https://github.com/near/NEPs/tree/master/specs/Standards/FungibleToken
export default class FungibleTokens {
    // View functions are not signed, so do not require a real account!
    static viewFunctionAccount = wallet.getAccountBasic('dontcare');

    static async checkRegistration({ contractName, accountId }) {
        try {
            return await this.viewFunctionAccount.viewFunction(
                contractName,
                'check_registration', { account_id: accountId }
            );
        } catch {
            return null;
        }
    }

    static getParsedTokenAmount(amount, symbol, decimals) {
        const parsedTokenAmount =
            symbol === 'NEAR' ?
            parseNearAmount(amount) :
            parseTokenAmount(amount, decimals);

        return parsedTokenAmount;
    }

    static getFormattedTokenAmount(amount, symbol, decimals) {
        const formattedTokenAmount =
            symbol === 'NEAR' ?
            formatNearAmount(amount, 5) :
            removeTrailingZeros(formatTokenAmount(amount, decimals, 5));

        return formattedTokenAmount;
    }

    static getUniqueTokenIdentity(token) {
        return token.contractName || token.onChainFTMetadata ? .symbol;
    }

    static async getLikelyTokenContracts({ accountId }) {
        return listLikelyTokens(accountId);
    }

    static async getStorageBalance({ contractName, accountId }) {
        return await this.viewFunctionAccount.viewFunction(
            contractName,
            'storage_balance_of', { account_id: accountId }
        );
    }

    static async getMetadata({ contractName }) {
        return this.viewFunctionAccount.viewFunction(
            contractName,
            'ft_metadata'
        );
    }

    static async getBalanceOf({ contractName, accountId }) {
        return this.viewFunctionAccount.viewFunction(
            contractName,
            'ft_balance_of', { account_id: accountId }
        );
    }

    async legacy_getEstimatedTotalFees({ accountId, contractName } = {}) {
        if (
            contractName &&
            accountId &&
            !(await this.isStorageBalanceAvailable({ contractName, accountId }))
        ) {
            const totalGasFees = await getTotalGasFee(new BN(FT_TRANSFER_GAS).add(new BN(FT_STORAGE_DEPOSIT_GAS)));
            return new BN(totalGasFees).add(new BN(FT_MINIMUM_STORAGE_BALANCE)).toString();
        } else {
            return getTotalGasFee(contractName ? FT_TRANSFER_GAS : SEND_NEAR_GAS);
        }
    }

    async getEstimatedTotalFees({ accountId, contractName } = {}) {
        if (!FT_TRANSFER_REGISTRATION) {
            return this.legacy_getEstimatedTotalFees({ accountId, contractName });
        }

        if (contractName && accountId) {
            const isRegistrationRequired = await this.isAccountUnregistered({ contractName, accountId });
            const isStorageDepositRequired = await this.isStorageDepositRequired({ contractName, accountId });

            const transferGasFee = new BN(FT_TRANSFER_GAS);

            if (isRegistrationRequired) {
                const gasFeesWithStorage = await getTotalGasFee(transferGasFee.add(new BN(FT_REGISTRATION_DEPOSIT_GAS)));
                return new BN(gasFeesWithStorage)
                    .add(new BN(FT_REGISTRATION_DEPOSIT)).toString();
            }

            if (isStorageDepositRequired) {
                const gasFeesWithStorage = await getTotalGasFee(transferGasFee.add(new BN(FT_STORAGE_DEPOSIT_GAS)));
                return new BN(gasFeesWithStorage)
                    .add(new BN(FT_MINIMUM_STORAGE_BALANCE)).toString();
            }
        }

        return getTotalGasFee(contractName ? FT_TRANSFER_GAS : SEND_NEAR_GAS);
    }

    async getEstimatedTotalNearAmount({ amount }) {
        return new BN(amount)
            .add(new BN(await this.getEstimatedTotalFees()))
            .toString();
    }

    async isAccountUnregistered({ contractName, accountId }) {
        return (await this.constructor.checkRegistration({ contractName, accountId })) === false;
    }

    /* TODO remove with FT_TRANSFER_REGISTRATION */
    async isStorageBalanceAvailable({ contractName, accountId }) {
        const storageBalance = await this.constructor.getStorageBalance({
            contractName,
            accountId,
        });
        return storageBalance ? .total !== undefined;
    }

    async isStorageDepositRequired({ accountId, contractName }) {
        try {
            const storageBalance = await this.constructor.getStorageBalance({
                contractName,
                accountId,
            });
            return storageBalance ? .total === undefined;
        } catch {
            return false;
        }
    }

    async legacy_transfer({ accountId, contractName, amount, receiverId, memo }) {
        // Ensure our awareness of 2FA being enabled is accurate before we submit any transaction(s)
        const account = await wallet.getAccount(accountId);

        if (contractName) {
            const storageAvailable = await this.isStorageBalanceAvailable({
                contractName,
                accountId: receiverId,
            });

            if (!storageAvailable) {
                try {
                    await this.transferStorageDeposit({
                        account,
                        contractName,
                        receiverId,
                        storageDepositAmount: FT_MINIMUM_STORAGE_BALANCE,
                    });
                } catch (e) {
                    // sic.typo in `mimimum` wording of responses, so we check substring
                    // Original string was: 'attached deposit is less than the mimimum storage balance'
                    // TODO: Call storage_balance_bounds: https://github.com/stream-protocol/wallet/issues/2522
                    if (e.message.includes('attached deposit is less than')) {
                        await this.transferStorageDeposit({
                            account,
                            contractName,
                            receiverId,
                            storageDepositAmount: FT_MINIMUM_STORAGE_BALANCE_LARGE,
                        });
                    }
                }
            }

            return await account.signAndSendTransaction({
                receiverId: contractName,
                actions: [
                    functionCall(
                        'ft_transfer', {
                            amount,
                            memo: memo,
                            receiver_id: receiverId,
                        },
                        FT_TRANSFER_GAS,
                        TOKEN_TRANSFER_DEPOSIT
                    ),
                ],
            });
        } else {
            return await account.sendMoney(receiverId, amount);
        }
    }

    async transfer({ accountId, contractName, amount, receiverId, memo }) {
        if (!FT_TRANSFER_REGISTRATION) {
            return this.legacy_transfer({ accountId, contractName, amount, receiverId, memo });
        }

        // Ensure our awareness of 2FA being enabled is accurate before we submit any transaction(s)
        const account = await wallet.getAccount(accountId);

        if (!contractName) {
            return account.sendMoney(receiverId, amount);
        }

        const isStorageTransferRequired = await this.isStorageDepositRequired({
            contractName,
            accountId: receiverId,
        });

        if (isStorageTransferRequired) {
            try {
                await this.transferStorageDeposit({
                    account,
                    contractName,
                    receiverId,
                    storageDepositAmount: FT_MINIMUM_STORAGE_BALANCE,
                });
            } catch (e) {
                // sic.typo in `mimimum` wording of responses, so we check substring
                // Original string was: 'attached deposit is less than the mimimum storage balance'
                // TODO: Call storage_balance_bounds: https://github.com/stream-protocol/wallet/issues/2522
                if (e.message.includes('attached deposit is less than')) {
                    await this.transferStorageDeposit({
                        account,
                        contractName,
                        receiverId,
                        storageDepositAmount: FT_MINIMUM_STORAGE_BALANCE_LARGE,
                    });
                }
            }
        }

        const isRegistrationRequired = await this.isAccountUnregistered({
            accountId: receiverId,
            contractName,
        });

        return account.signAndSendTransaction({
            receiverId: contractName,
            actions: [
                ...(isRegistrationRequired ? [
                    functionCall(
                        'register_account', { account_id: receiverId },
                        FT_REGISTRATION_DEPOSIT_GAS
                    ),
                ] : []),
                functionCall(
                    'ft_transfer', {
                        amount,
                        memo: memo,
                        receiver_id: receiverId,
                    },
                    FT_TRANSFER_GAS,
                    TOKEN_TRANSFER_DEPOSIT
                ),
            ],
        });
    }

    async transferStorageDeposit({
        account,
        contractName,
        receiverId,
        storageDepositAmount,
    }) {
        return account.signAndSendTransaction({
            receiverId: contractName,
            actions: [
                functionCall(
                    'storage_deposit', {
                        account_id: receiverId,
                        registration_only: true,
                    },
                    FT_STORAGE_DEPOSIT_GAS,
                    storageDepositAmount
                ),
            ],
        });
    }

    async wrapNear({ accountId, wrapAmount, toWNear }) {
        const account = await wallet.getAccount(accountId);
        const actions = [
            functionCall(
                toWNear ? 'near_deposit' : 'near_withdraw',
                toWNear ? {} : { amount: wrapAmount },
                FT_STORAGE_DEPOSIT_GAS,
                toWNear ? wrapAmount : TOKEN_TRANSFER_DEPOSIT
            ),
        ];

        const storage = await account.viewFunction(
            NEAR_TOKEN_ID,
            'storage_balance_of', { account_id: accountId }
        );

        if (!storage) {
            actions.unshift(
                functionCall(
                    'storage_deposit', {},
                    FT_STORAGE_DEPOSIT_GAS,
                    parseNearAmount('0.00125')
                )
            );
        }

        return account.signAndSendTransaction({
            receiverId: NEAR_TOKEN_ID,
            actions,
        });
    }
}

export const fungibleTokensService = new FungibleTokens();
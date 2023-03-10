const { defaults } = require('lodash');

const Environments = require('../../../features/environments.json');
const environmentConfig = require('./configFromEnvironment');

const envDefaults = {
    [Environments.DEVELOPMENT]: {
        CLOUDFLARE_BASE_URL: 'https://content.stream-wallet.workers.dev',
        SENTRY_RELEASE: 'development',
    },
    [Environments.TESTNET_NEARORG]: {
        CLOUDFLARE_BASE_URL: 'https://content.stream-wallet.workers.dev',
    },
    [Environments.MAINNET_NEARORG]: {
        CLOUDFLARE_BASE_URL: 'https://content.stream-wallet.workers.dev',
    },
    [Environments.MAINNET_STAGING_NEARORG]: {
        CLOUDFLARE_BASE_URL: 'https://content.stream-wallet.workers.dev',
    },
};

module.exports = defaults(
    environmentConfig,
    envDefaults[environmentConfig.STREAM_WALLET_ENV]
);
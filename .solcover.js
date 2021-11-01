module.exports = {
  skipFiles: ['open-zeppelin/', 'mocks/'],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    _chainId: 1337,
    _chainIdRpc: 1337,
    network_id: 1337,
  },
};

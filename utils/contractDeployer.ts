import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {AccuToken, InitializableAdminUpgradeabilityProxy, MockAccuTokenV2, MockDoubleTransfer} from '../typechain';
import {Address, ContractId, ContractType} from '../types';
import {getContractAt} from './contractGetter';
import registerContractInJsonDb from './registerContractInJsonDb';

export const deployAccuToken = async (hre: HardhatRuntimeEnvironment): Promise<AccuToken> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.AccuToken;
  const result = await deploy(contract, {
    from: deployer,
    contract,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.AccuToken, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployInitializableAdminUpgradeabilityProxy = async (
  hre: HardhatRuntimeEnvironment
): Promise<InitializableAdminUpgradeabilityProxy> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.InitializableAdminUpgradeabilityProxy;
  const result = await deploy(contract, {
    from: deployer,
    contract,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.AccuToken, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployMockAccuTokenV2 = async (hre: HardhatRuntimeEnvironment): Promise<MockAccuTokenV2> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.MockAccuTokenV2;
  const result = await deploy(contract, {
    from: deployer,
    contract,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.AccuToken, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployMockDoubleTransfer = async (
  hre: HardhatRuntimeEnvironment,
  token: Address
): Promise<MockDoubleTransfer> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.MockDoubleTransfer;
  const result = await deploy(contract, {
    from: deployer,
    contract,
    args: [token],
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.AccuToken, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

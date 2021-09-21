import {Contract} from 'ethers';
import {deployments, ethers, getNamedAccounts} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {AccuToken, InitializableAdminUpgradeabilityProxy} from '../typechain';
import {ContractId, ContractRecord, Fixture, User} from '../types';
import {enumKeys} from '../utils';
import {getContractAt} from './contractGetter';
import getConfig from './getConfig';

async function setupUser<T extends {[contractName: string]: Contract}>(
  address: string,
  contract: T,
  name?: string
): Promise<User & T> {
  const signer = await ethers.getSigner(address);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: any = {address, name: name ? name : address, signer} as User & T;
  for (const key of enumKeys(contract)) {
    user[key] = contract[key].connect(signer);
  }

  return user;
}

export const setupFixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  const config = getConfig();

  await deployments.fixture(['testEnv']);

  const accuTokenProxy = (await hre.ethers.getContract(
    ContractId.InitializableAdminUpgradeabilityProxy
  )) as InitializableAdminUpgradeabilityProxy;
  const accuTokenImpl = (await hre.ethers.getContract(ContractId.AccuToken)) as AccuToken;
  const accuToken = await getContractAt<AccuToken>(hre, ContractId.AccuToken, accuTokenProxy.address);

  const contract: ContractRecord = {
    accuToken,
    accuTokenImpl,
    accuTokenProxy,
  };

  const {deployer, admin, distributer, user1, user2, user3, user4, user5} = await getNamedAccounts();

  const chainId = parseInt(await hre.getChainId());
  if (!chainId) {
    throw new Error("Current network doesn't have CHAIN ID");
  }

  return {
    ...contract,
    deployer: await setupUser(deployer, contract, 'deployer'),
    admin: await setupUser(admin, contract, 'admin'),
    distributer: await setupUser(distributer, contract, 'distributer'),
    user1: await setupUser(user1, contract, 'user1'),
    user2: await setupUser(user2, contract, 'user2'),
    user3: await setupUser(user3, contract, 'user3'),
    user4: await setupUser(user4, contract, 'user4'),
    user5: await setupUser(user5, contract, 'user5'),
    config: config,
    chainId,
  } as Fixture;
});

export default setupFixture;

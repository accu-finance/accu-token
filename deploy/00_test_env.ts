import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {parseNetwork} from '../utils';
import {deployAccuToken, deployInitializableAdminUpgradeabilityProxy} from '../utils/contractDeployer';
import {waitForTx} from '../utils/hhNetwork';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {network} = parseNetwork(hre.network.name);
  console.log(`***** using network ${network}  *****`);

  const {getNamedAccounts} = hre;
  const {admin, distributer} = await getNamedAccounts();

  const accuTokenImpl = await deployAccuToken(hre);
  const accuTokenProxy = await deployInitializableAdminUpgradeabilityProxy(hre);
  const encodedIntialize = accuTokenImpl.interface.encodeFunctionData('initialize', [distributer]);

  await waitForTx(
    await accuTokenProxy['initialize(address,address,bytes)'](accuTokenImpl.address, admin, encodedIntialize)
  );
};

export default func;
func.tags = ['testEnv'];

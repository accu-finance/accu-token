import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {parseNetwork} from '../utils';
import {deployAaveTokenV2, deployInitializableAdminUpgradeabilityProxy} from '../utils/contractDeployer';
import {waitForTx} from '../utils/hhNetwork';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {network} = parseNetwork(hre.network.name);
  console.log(`***** using network ${network}  *****`);

  const {getNamedAccounts} = hre;
  const {admin, distributer} = await getNamedAccounts();

  const aaveTokenImpl = await deployAaveTokenV2(hre);
  const aaveTokenProxy = await deployInitializableAdminUpgradeabilityProxy(hre);
  const encodedIntialize = aaveTokenImpl.interface.encodeFunctionData('initialize', [distributer]);

  await waitForTx(
    await aaveTokenProxy['initialize(address,address,bytes)'](aaveTokenImpl.address, admin, encodedIntialize)
  );
};

export default func;
func.tags = ['testEnv'];

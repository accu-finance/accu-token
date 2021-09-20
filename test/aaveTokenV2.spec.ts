import {waffleChai} from '@ethereum-waffle/chai';
import {TypedDataDomain} from '@ethersproject/abstract-signer';
import {expect, use} from 'chai';
import hre, {ethers} from 'hardhat';
import {MockAaveTokenV3} from '../typechain';
import {ContractId, Fixture} from '../types';
import {deployMockAaveTokenV3} from '../utils/contractDeployer';
import {getContractAt} from '../utils/contractGetter';
import setupFixture from '../utils/setupFixture';

const {Zero, MaxUint256, AddressZero} = ethers.constants;
const {utils, BigNumber} = ethers;

use(waffleChai);

describe('AAVE token V2', () => {
  const fixture = {} as Fixture;
  let domain: TypedDataDomain;
  const permitTypes = {
    Permit: [
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
      {name: 'value', type: 'uint256'},
      {name: 'nonce', type: 'uint256'},
      {name: 'deadline', type: 'uint256'},
    ],
  };

  before(async () => {
    Object.assign(fixture, await setupFixture());
    const {chainId, aaveTokenV2} = fixture;
    domain = {
      name: 'Aave Token',
      version: '1',
      chainId: chainId,
      verifyingContract: aaveTokenV2.address,
    };
  });

  it('Checks initial configuration', async () => {
    const {aaveTokenV2} = fixture;

    expect(await aaveTokenV2.name()).to.be.equal('Aave Token', 'Invalid token name');
    expect(await aaveTokenV2.symbol()).to.be.equal('AAVE', 'Invalid token symbol');
    expect(await aaveTokenV2.decimals()).to.be.equal(18, 'Invalid token decimals');
  });

  it('Checks the domain separator', async () => {
    const {aaveTokenV2, chainId} = fixture;
    const EIP712_DOMAIN = utils.keccak256(
      utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
    );
    const NAME = utils.keccak256(utils.toUtf8Bytes('Aave Token'));
    const EIP712_REVISION = utils.keccak256(utils.toUtf8Bytes('1'));

    //need to pad address https://ethereum.stackexchange.com/questions/96697/soliditys-keccak256-hash-doesnt-match-web3-keccak-hash
    const DOMAIN_SEPARATOR_ENCODED = utils.solidityKeccak256(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32'],
      [EIP712_DOMAIN, NAME, EIP712_REVISION, chainId, utils.hexZeroPad(aaveTokenV2.address, 32)]
    );

    expect(await aaveTokenV2.DOMAIN_SEPARATOR()).to.be.equal(DOMAIN_SEPARATOR_ENCODED, 'Invalid domain separator');
  });

  it('Checks the revision', async () => {
    const {aaveTokenV2} = fixture;

    expect((await aaveTokenV2.REVISION()).toString()).to.be.equal('2', 'Invalid revision');
  });

  it('Reverts submitting a permit with 0 expiration', async () => {
    const {aaveTokenV2, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = Zero;
    const nonce = await aaveTokenV2._nonces(owner);
    const permitAmount = utils.parseEther('2');

    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.aaveTokenV2.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_AFTER_PERMIT');
  });

  it('Submits a permit with maximum expiration length', async () => {
    const {aaveTokenV2, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const expiration = MaxUint256;
    const nonce = await aaveTokenV2._nonces(owner);
    const permitAmount = utils.parseEther('2').toString();

    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline: expiration,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.aaveTokenV2.permit(owner, spender, permitAmount, expiration, v, r, s)).not.to.be.reverted;
    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(permitAmount, 'INVALID_ALLOWANCE_AFTER_PERMIT');
    expect(await aaveTokenV2._nonces(owner)).to.be.equal(BigNumber.from(1));
  });

  it('Cancels the previous permit', async () => {
    const {aaveTokenV2, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const expiration = MaxUint256;
    const nonce = await aaveTokenV2._nonces(owner);
    const permitAmount = Zero;
    const prevPermitAmount = utils.parseEther('2').toString();

    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(
      prevPermitAmount,
      'INVALID_ALLOWANCE_BEFORE_PERMIT'
    );

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline: expiration,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.aaveTokenV2.permit(owner, spender, permitAmount, expiration, v, r, s)).not.to.be.reverted;
    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(permitAmount, 'INVALID_ALLOWANCE_AFTER_PERMIT');
    expect(await aaveTokenV2._nonces(owner)).to.be.equal(BigNumber.from(2));
  });

  it('Tries to submit a permit with invalid nonce', async () => {
    const {aaveTokenV2, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = MaxUint256;
    const nonce = BigNumber.from(1000);
    const permitAmount = utils.parseEther('2');

    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.aaveTokenV2.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('Tries to submit a permit with invalid expiration (previous to the current block)', async () => {
    const {aaveTokenV2, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = BigNumber.from(1);
    const nonce = await aaveTokenV2._nonces(owner);
    const permitAmount = utils.parseEther('2');

    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.aaveTokenV2.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
  });

  it('Tries to submit a permit with invalid signature', async () => {
    const {aaveTokenV2, deployer, user1, user2} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = MaxUint256;
    const nonce = await aaveTokenV2._nonces(owner);
    const permitAmount = utils.parseEther('2');

    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.aaveTokenV2.permit(owner, AddressZero, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(user1.aaveTokenV2.permit(owner, user2.address, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(user1.aaveTokenV2.permit(user2.address, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('Tries to submit a permit with invalid owner', async () => {
    const {aaveTokenV2, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = MaxUint256;
    const nonce = await aaveTokenV2._nonces(owner);
    const permitAmount = utils.parseEther('2');

    expect(await aaveTokenV2.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.aaveTokenV2.permit(AddressZero, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_OWNER'
    );
  });

  it('Checks the total supply', async () => {
    const {aaveTokenV2} = fixture;
    const totalSupply = await aaveTokenV2.totalSupplyAt('0');
    expect(totalSupply).equal(utils.parseEther('10000000'));
  });

  it('Updates the implementation of the AAVE token to V3', async () => {
    const {aaveTokenProxy, admin} = fixture;

    const mockTokenV3 = await deployMockAaveTokenV3(hre);

    const encodedIntialize = mockTokenV3.interface.encodeFunctionData('initialize');

    await admin.aaveTokenProxy.upgradeToAndCall(mockTokenV3.address, encodedIntialize);

    const aaveTokenV3 = await getContractAt<MockAaveTokenV3>(hre, ContractId.MockAaveTokenV3, aaveTokenProxy.address);

    expect((await aaveTokenV3.REVISION()).toString()).to.be.equal('3', 'Invalid revision');
    expect(await aaveTokenV3.name()).to.be.equal('Aave Token', 'Invalid token name');
    expect(await aaveTokenV3.symbol()).to.be.equal('AAVE', 'Invalid token symbol');
    expect((await aaveTokenV3.decimals()).toString()).to.be.equal('18', 'Invalid token decimals');
  });
});

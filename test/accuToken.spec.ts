import {waffleChai} from '@ethereum-waffle/chai';
import {TypedDataDomain} from '@ethersproject/abstract-signer';
import {expect, use} from 'chai';
import hre, {ethers} from 'hardhat';
import {MockAccuTokenV2} from '../typechain';
import {ContractId, Fixture} from '../types';
import {deployMockAccuTokenV2} from '../utils/contractDeployer';
import {getContractAt} from '../utils/contractGetter';
import setupFixture from '../utils/setupFixture';

const {Zero, MaxUint256, AddressZero} = ethers.constants;
const {utils, BigNumber} = ethers;

use(waffleChai);

describe('ACCU Token', () => {
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
    const {chainId, accuToken} = fixture;
    domain = {
      name: 'Accu Token',
      version: '1',
      chainId: chainId,
      verifyingContract: accuToken.address,
    };
  });

  it('Checks initial configuration', async () => {
    const {accuToken} = fixture;

    expect(await accuToken.name()).to.be.equal('Accu Token', 'Invalid token name');
    expect(await accuToken.symbol()).to.be.equal('ACCU', 'Invalid token symbol');
    expect(await accuToken.decimals()).to.be.equal(18, 'Invalid token decimals');
  });

  it('Checks the domain separator', async () => {
    const {accuToken, chainId} = fixture;
    const EIP712_DOMAIN = utils.keccak256(
      utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
    );
    const NAME = utils.keccak256(utils.toUtf8Bytes('Accu Token'));
    const EIP712_REVISION = utils.keccak256(utils.toUtf8Bytes('1'));

    //need to pad address https://ethereum.stackexchange.com/questions/96697/soliditys-keccak256-hash-doesnt-match-web3-keccak-hash
    const DOMAIN_SEPARATOR_ENCODED = utils.solidityKeccak256(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32'],
      [EIP712_DOMAIN, NAME, EIP712_REVISION, chainId, utils.hexZeroPad(accuToken.address, 32)]
    );

    expect(await accuToken.DOMAIN_SEPARATOR()).to.be.equal(DOMAIN_SEPARATOR_ENCODED, 'Invalid domain separator');
  });

  it('Checks the revision', async () => {
    const {accuToken} = fixture;

    expect((await accuToken.REVISION()).toString()).to.be.equal('2', 'Invalid revision');
  });

  it('Reverts submitting a permit with 0 expiration', async () => {
    const {accuToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = Zero;
    const nonce = await accuToken._nonces(owner);
    const permitAmount = utils.parseEther('2');

    expect(await accuToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.accuToken.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
    expect(await accuToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_AFTER_PERMIT');
  });

  it('Submits a permit with maximum expiration length', async () => {
    const {accuToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const expiration = MaxUint256;
    const nonce = await accuToken._nonces(owner);
    const permitAmount = utils.parseEther('2').toString();

    expect(await accuToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline: expiration,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.accuToken.permit(owner, spender, permitAmount, expiration, v, r, s)).not.to.be.reverted;
    expect(await accuToken.allowance(owner, spender)).to.be.equal(permitAmount, 'INVALID_ALLOWANCE_AFTER_PERMIT');
    expect(await accuToken._nonces(owner)).to.be.equal(BigNumber.from(1));
  });

  it('Cancels the previous permit', async () => {
    const {accuToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const expiration = MaxUint256;
    const nonce = await accuToken._nonces(owner);
    const permitAmount = Zero;
    const prevPermitAmount = utils.parseEther('2').toString();

    expect(await accuToken.allowance(owner, spender)).to.be.equal(prevPermitAmount, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline: expiration,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.accuToken.permit(owner, spender, permitAmount, expiration, v, r, s)).not.to.be.reverted;
    expect(await accuToken.allowance(owner, spender)).to.be.equal(permitAmount, 'INVALID_ALLOWANCE_AFTER_PERMIT');
    expect(await accuToken._nonces(owner)).to.be.equal(BigNumber.from(2));
  });

  it('Tries to submit a permit with invalid nonce', async () => {
    const {accuToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = MaxUint256;
    const nonce = BigNumber.from(1000);
    const permitAmount = utils.parseEther('2');

    expect(await accuToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.accuToken.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('Tries to submit a permit with invalid expiration (previous to the current block)', async () => {
    const {accuToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = BigNumber.from(1);
    const nonce = await accuToken._nonces(owner);
    const permitAmount = utils.parseEther('2');

    expect(await accuToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.accuToken.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
  });

  it('Tries to submit a permit with invalid signature', async () => {
    const {accuToken, deployer, user1, user2} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = MaxUint256;
    const nonce = await accuToken._nonces(owner);
    const permitAmount = utils.parseEther('2');

    expect(await accuToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.accuToken.permit(owner, AddressZero, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(user1.accuToken.permit(owner, user2.address, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(user1.accuToken.permit(user2.address, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('Tries to submit a permit with invalid owner', async () => {
    const {accuToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;

    const deadline = MaxUint256;
    const nonce = await accuToken._nonces(owner);
    const permitAmount = utils.parseEther('2');

    expect(await accuToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');

    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    await expect(user1.accuToken.permit(AddressZero, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_OWNER'
    );
  });

  it('Checks the total supply', async () => {
    const {accuToken} = fixture;
    const totalSupply = await accuToken.totalSupplyAt('0');
    expect(totalSupply).equal(utils.parseEther('10000000'));
  });

  it('Updates the implementation of the Accu token to V2', async () => {
    const {accuTokenProxy: accuTokenProxy, admin} = fixture;

    const mockTokenV3 = await deployMockAccuTokenV2(hre);

    const encodedIntialize = mockTokenV3.interface.encodeFunctionData('initialize');

    await admin.accuTokenProxy.upgradeToAndCall(mockTokenV3.address, encodedIntialize);

    const accuTokenV2 = await getContractAt<MockAccuTokenV2>(hre, ContractId.MockAccuTokenV2, accuTokenProxy.address);

    expect((await accuTokenV2.REVISION()).toString()).to.be.equal('3', 'Invalid revision');
    expect(await accuTokenV2.name()).to.be.equal('Accu Token', 'Invalid token name');
    expect(await accuTokenV2.symbol()).to.be.equal('ACCU', 'Invalid token symbol');
    expect((await accuTokenV2.decimals()).toString()).to.be.equal('18', 'Invalid token decimals');
  });
});

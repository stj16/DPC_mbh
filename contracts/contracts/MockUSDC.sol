// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Token ERC-20 simulant l'USDC pour les tests sur Polygon Amoy Testnet.
 *         En production, on utiliserait le vrai USDC de Circle.
 * @dev Chaque token = 1 USDC = 1 USD (6 décimales comme le vrai USDC).
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private _decimals = 6;

    constructor() ERC20("USD Coin (Test)", "USDC") Ownable(msg.sender) {
        // Mint 1,000,000 USDC au déployeur pour les tests
        _mint(msg.sender, 1_000_000 * 10 ** _decimals);
    }

    /**
     * @notice Permet à n'importe qui de minter des USDC de test (faucet).
     *         À désactiver en production !
     */
    function faucet(address to, uint256 amount) external {
        _mint(to, amount * 10 ** _decimals);
    }

    /**
     * @notice Override pour retourner 6 décimales (comme le vrai USDC).
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

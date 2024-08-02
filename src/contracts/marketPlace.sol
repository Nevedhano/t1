// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721Marketplace is ERC721Holder {
    struct Listing {
        address seller;
        uint256 price;
    }

    address owner;
    address public nftAddress;

    constructor(address _nftAddress) {
        owner = msg.sender;
        nftAddress = _nftAddress;
    }

    // Mapping from token ID to listing details
    mapping(uint256 => Listing) public listings;

    uint256[] public tokenIds;

    // Event for when a token is listed
    event TokenListed(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    // Event for when a token is sold
    event TokenSold(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );

    /**
     * @dev List an ERC-721 token for sale
     * @param tokenId ID of the token to list
     * @param price Sale price in wei
     */
    function listToken(uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be greater than zero");
        IERC721 nftContract = IERC721(nftAddress);
        require(
            nftContract.ownerOf(tokenId) == msg.sender,
            "Only the owner can list the token"
        );
        require(
            nftContract.isApprovedForAll(msg.sender, address(this)) ||
                nftContract.getApproved(tokenId) == address(this),
            "Contract must be approved"
        );

        require(listings[tokenId].seller == address(0), "NFT already listed");

        listings[tokenId] = Listing({seller: msg.sender, price: price});

        tokenIds.push(tokenId);

        emit TokenListed(nftAddress, tokenId, msg.sender, price);
    }

    /**
     * @dev Buy a listed ERC-721 token
     * @param tokenId ID of the token to buy
     */
    function buyToken(uint256 tokenId) external payable {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "Token not listed for sale");
        require(msg.value == listing.price, "Incorrect price");

        require(removeElement(tokenId), "Error removing listing");

        delete listings[tokenId];

        IERC721 nftContract = IERC721(nftAddress);
        nftContract.safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit TokenSold(nftAddress, tokenId, msg.sender, listing.price);

        // Transfer the funds to the seller
        payable(listing.seller).transfer(msg.value);
    }

    /**
     * @dev Remove a listed ERC-721 token from sale
     * @param tokenId ID of the token to remove from sale
     */
    function removeListing(uint256 tokenId) external {
        Listing memory listing = listings[tokenId];
        require(
            listing.seller == msg.sender,
            "Only the seller can remove the listing"
        );

        require(removeElement(tokenId), "Error removing listing");

        delete listings[tokenId];
    }

    /**
     * @dev Withdraw contract balance (in case any funds are left accidentally)
     */
    function withdraw() external {
        require(owner == msg.sender);
        payable(msg.sender).transfer(address(this).balance);
    }

    /**
     * @dev Internal function to remove an element from the tokenIds array
     * @param value The value (token ID) to remove
     * @return bool indicating whether the value was successfully removed
     */
    function removeElement(uint256 value) internal returns (bool) {
        uint256 length = tokenIds.length;

        for (uint256 i = 0; i < length; i++) {
            if (tokenIds[i] == value) {
                // Move the last element into the place to delete
                tokenIds[i] = tokenIds[length - 1];
                tokenIds.pop();
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Get the array of listed token IDs
     * @return The array of token IDs listed for sale
     */
    function getListedTokenIds() external view returns (uint256[] memory) {
        return tokenIds;
    }
}

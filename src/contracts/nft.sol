// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@5.0.0/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts@5.0.0/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts@5.0.0/access/Ownable.sol";

contract MyToken is ERC721, ERC721URIStorage {
    constructor(
        address initialOwner
    ) ERC721("MyToken", "MTK")  {}

    uint public count = 0;

    // ["0","QmefJDf8xJyWeszvT4Ran8St2rXkE3fTXSHyqG2SWEAqDJ","QmZ8btRYSvTHHXKP5QTPGaMSKdsqREwVgqsnBUWe2d8aTq","QmTzjPAs4vUdeYJYRYpDxiyhVpqe6FjqNPDLT8FuNiKo9A","QmaEZ5qGjvajve9as891L2qiSUGReusJkgpSb7DtjH5TGg","QmexkdLppvZDVrf2atMsyyRYJYgo7oMkkN4osRTBxebQTY"]
    function safeMint(string memory uri) public  {
        count += 1;
        _safeMint(msg.sender, count);
        _setTokenURI(count, uri);
    }

    // The following functions are overrides required by Solidity.

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

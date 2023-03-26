const express = require("express");
const app = express();
const cors = require("cors");
const port = 3042;

const secp = require("ethereum-cryptography/secp256k1");
const { keccak256 } = require("ethereum-cryptography/keccak");
const { toHex } = require("ethereum-cryptography/utils");
let addressToNonceServer = {};
app.use(cors());
app.use(express.json());

const balances = {
  "0x58d437d29e8765b0c71e": 100,
  //private key: facdff2238a0a6e384ea8d558cbb704c551ea6b01619efd3338fb0f555b9f52d
  "0x522a64e7c70847df5cb3": 50,
  // private key:267dec92531168020d3fac0fc5d09eb02a048c0a2d169661be5cf1cb73251aab
  "0x9fd559ca19cabbce2bc2": 75,
  //private key:3e9aa9fee75bcb0fe876d89485889357a4b6703e6dc9b5eb53f778c299b352f3
};

app.get("/balance/:address", (req, res) => {
  const { address } = req.params;
  const balance = balances[address] || 0;
  res.send({ balance });
});

app.get("/accounts", (req, res) => {
  const accounts = [
      {
          privateKey:
              "facdff2238a0a6e384ea8d558cbb704c551ea6b01619efd3338fb0f555b9f52d",
      },
      {
          privateKey:
              "267dec92531168020d3fac0fc5d09eb02a048c0a2d169661be5cf1cb73251aab",
      },
      {
          privateKey:
              "3e9aa9fee75bcb0fe876d89485889357a4b6703e6dc9b5eb53f778c299b352f3",
      },
  ];
  Object.entries(balances).forEach(([address, balance], index) => {
      accounts[index] = {
          ...accounts[index],
          address: address,
          balance: balance,
      };
  });
  res.json(accounts);
});

app.post("/send", (req, res) => {
  const { signature, recoveryBit, amount, recipient, nextNonce } = req.body;
  const uint8ArrayMsg = Uint8Array.from([amount, recipient]);
  const messageHash = toHex(uint8ArrayMsg);

  // recover public key from signature

  const publicKey = secp.recoverPublicKey(
      messageHash,
      signature,
      recoveryBit
  );

  // hash public key to get address
  const publicKeyHash = toHex(keccak256(publicKey));
  // console.log("Public key", publicKeyHash);
  const sender = `0x${publicKeyHash.slice(-20)}`; // 20 bytes address
  // console.log("Sender = ", sender);
  //Verification
  const isValidSign = secp.verify(signature, messageHash, toHex(publicKey));
  const doesAddressExists = !sender in addressToNonceServer;
  if (!doesAddressExists) {
      addressToNonceServer = { ...addressToNonceServer, [sender]: 0 };
  }
  let isNonceValid = nextNonce === addressToNonceServer[sender] + 1;
  setInitialBalance(sender);
  setInitialBalance(recipient);
  if (balances[sender] < amount) {
      res.status(400).send({ message: "Not enough funds!" });
  } else if (!isValidSign) {
      res.status(400).send({ message: "Invalid Signature" });
  } else if (!isNonceValid) {
      res.status(400).send({ message: "Invalid Nonce" });
  } else {
      balances[sender] -= amount;
      balances[recipient] += amount;
      addressToNonceServer = {
          ...addressToNonceServer,
          [sender]: addressToNonceServer[sender] + 1,
      };
      res.send({
          balance: balances[sender],
          sender: sender,
          nonceFromServer: addressToNonceServer[sender],
      });
  }
});

app.listen(port, () => {
  console.log(`Listening on port ${port}!`);
});

function setInitialBalance(address) {
  if (!balances[address]) {
      balances[address] = 0;
  }
}
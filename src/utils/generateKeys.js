import { v4 as uuidv4 } from "uuid";

const generateReferralCode = (name) => {
  return name.toLowerCase().slice(0, 3) + Math.floor(Math.random() * 10000);
};

const generateSecretKey = () => {
  return uuidv4();
};

const generateWalletKey = () => {
  return uuidv4();
};

export { generateReferralCode, generateSecretKey, generateWalletKey };

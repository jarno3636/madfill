// lib/txProvider.js
import { createContext, useContext, useMemo } from "react";
import { ethers } from "ethers";
import fillinAbi from "@/abi/FillInStoryV3_ABI.json";
import nftAbi from "@/abi/MadFillTemplateNFT_ABI.json";

const TxContext = createContext(null);

export function TxProvider({ children }) {
  // Use window.ethereum in normal browser, or Farcaster Mini Wallet in-app
  const getProvider = () => {
    if (typeof window !== "undefined" && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    if (typeof window !== "undefined" && window.miniapp?.wallet) {
      return new ethers.BrowserProvider(window.miniapp.wallet.ethereum);
    }
    throw new Error("No wallet provider found");
  };

  const getContracts = async () => {
    const provider = getProvider();
    const signer = await provider.getSigner();
    const fillin = new ethers.Contract(
      process.env.NEXT_PUBLIC_FILLIN_ADDRESS,
      fillinAbi,
      signer
    );
    const nft = new ethers.Contract(
      process.env.NEXT_PUBLIC_NFT_TEMPLATE_ADDRESS,
      nftAbi,
      signer
    );
    return { fillin, nft, signer };
  };

  // --- Unified Helpers ---
  const createPool1 = async (params) => {
    const { fillin } = await getContracts();
    const tx = await fillin.createPool1(...params, { value: params[params.length - 1] });
    return tx.wait();
  };

  const joinPool1 = async (params) => {
    const { fillin } = await getContracts();
    const tx = await fillin.joinPool1(...params, { value: params[params.length - 1] });
    return tx.wait();
  };

  const claimPool1 = async (poolId) => {
    const { fillin } = await getContracts();
    const tx = await fillin.claimPool1(poolId);
    return tx.wait();
  };

  const mintTemplateNFT = async (params) => {
    const { nft } = await getContracts();
    const tx = await nft.mint(...params);
    return tx.wait();
  };

  const value = useMemo(
    () => ({ createPool1, joinPool1, claimPool1, mintTemplateNFT }),
    []
  );

  return <TxContext.Provider value={value}>{children}</TxContext.Provider>;
}

export function useTx() {
  return useContext(TxContext);
}

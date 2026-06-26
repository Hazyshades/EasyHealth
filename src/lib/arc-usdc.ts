import { createPublicClient, erc20Abi, formatUnits, http } from "viem";

export const ARC_TESTNET_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
} as const;

export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

const arcClient = createPublicClient({
  chain: ARC_TESTNET_CHAIN,
  transport: http(),
});

export async function getArcUsdcBalance(walletAddress: `0x${string}`): Promise<string> {
  const raw = await arcClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress],
  });
  return formatUnits(raw, 6);
}

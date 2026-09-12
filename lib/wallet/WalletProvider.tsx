"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getInjectedProvider,
  hasInjectedWallet,
  type EthereumProvider,
} from "@/lib/genlayer/client";
import { NETWORK, STUDIONET_CHAIN_ID, toHexChainId } from "@/lib/genlayer/network";

export type WalletStatus =
  | "NO_WALLET"
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "WRONG_NETWORK"
  | "SWITCHING_NETWORK";

interface WalletState {
  status: WalletStatus;
  address: `0x${string}` | null;
  chainId: number | null;
  error: string | null;
}

interface WalletContextValue extends WalletState {
  hasWallet: boolean;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToStudionet: () => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const initialState: WalletState = {
  status: "NO_WALLET",
  address: null,
  chainId: null,
  error: null,
};

function parseChainIdHex(hex: string): number {
  return Number.parseInt(hex, 16);
}

async function addStudionetToWallet(provider: EthereumProvider): Promise<void> {
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: toHexChainId(STUDIONET_CHAIN_ID),
        chainName: NETWORK.chainName,
        nativeCurrency: { name: NETWORK.symbol, symbol: NETWORK.symbol, decimals: 18 },
        rpcUrls: [NETWORK.rpcUrl],
        blockExplorerUrls: [NETWORK.explorerUrl],
      },
    ],
  });
}

/**
 * Wallet/provider context. Owns the full connection lifecycle described in
 * spec §2: no wallet, connect, account changes, app-initiated disconnect,
 * provider-initiated disconnect, wrong chain, explicit switch to
 * Studionet, user rejection, and RPC errors — all surfaced as explicit
 * state rather than silently swallowed.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(initialState);

  const evaluateChain = useCallback((chainIdHex: string): WalletStatus => {
    return parseChainIdHex(chainIdHex) === STUDIONET_CHAIN_ID ? "CONNECTED" : "WRONG_NETWORK";
  }, []);

  const refreshFromProvider = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setState({ ...initialState, status: "NO_WALLET" });
      return;
    }
    try {
      const [accounts, chainIdHex] = await Promise.all([
        provider.request({ method: "eth_accounts" }) as Promise<string[]>,
        provider.request({ method: "eth_chainId" }) as Promise<string>,
      ]);
      const address = accounts[0] as `0x${string}` | undefined;
      if (!address) {
        setState({ ...initialState, status: "DISCONNECTED" });
        return;
      }
      const chainId = parseChainIdHex(chainIdHex);
      setState({
        status: evaluateChain(chainIdHex),
        address,
        chainId,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "DISCONNECTED",
        error: err instanceof Error ? err.message : "Failed to read wallet state (RPC error).",
      }));
    }
  }, [evaluateChain]);

  useEffect(() => {
    if (!hasInjectedWallet()) {
      setState({ ...initialState, status: "NO_WALLET" });
      return;
    }
    void refreshFromProvider();

    const provider = getInjectedProvider();
    if (!provider) return;

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        // Provider-initiated disconnect (user locked/disconnected from the
        // wallet UI, not from Oddless).
        setState({ ...initialState, status: "DISCONNECTED" });
        return;
      }
      void refreshFromProvider();
    };
    const onChainChanged = () => {
      void refreshFromProvider();
    };
    const onDisconnect = () => {
      setState({ ...initialState, status: "DISCONNECTED" });
    };

    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    provider.on("disconnect", onDisconnect);

    return () => {
      provider.removeListener("accountsChanged", onAccountsChanged);
      provider.removeListener("chainChanged", onChainChanged);
      provider.removeListener("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      setState({ ...initialState, status: "NO_WALLET" });
      return;
    }
    setState((prev) => ({ ...prev, status: "CONNECTING", error: null }));
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts were returned by the wallet.");
      }
      await refreshFromProvider();
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      const message =
        code === 4001
          ? "Connection request was rejected."
          : err instanceof Error
            ? err.message
            : "Failed to connect wallet.";
      setState({ ...initialState, status: "DISCONNECTED", error: message });
    }
  }, [refreshFromProvider]);

  const switchToStudionet = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) return;
    setState((prev) => ({ ...prev, status: "SWITCHING_NETWORK", error: null }));
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHexChainId(STUDIONET_CHAIN_ID) }],
      });
      await refreshFromProvider();
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        try {
          await addStudionetToWallet(provider);
          await refreshFromProvider();
          return;
        } catch (addErr) {
          setState((prev) => ({
            ...prev,
            status: "WRONG_NETWORK",
            error: addErr instanceof Error ? addErr.message : "Failed to add Studionet.",
          }));
          return;
        }
      }
      const message =
        code === 4001
          ? "Network switch was rejected."
          : err instanceof Error
            ? err.message
            : "Failed to switch network.";
      setState((prev) => ({ ...prev, status: "WRONG_NETWORK", error: message }));
    }
  }, [refreshFromProvider]);

  const disconnect = useCallback(() => {
    // EIP-1193 has no standard "disconnect" RPC call — this is an
    // app-local disconnect (clears local state; the wallet extension
    // itself stays connected until the user revokes it there).
    setState((prev) => ({ ...initialState, status: prev.chainId ? "DISCONNECTED" : "NO_WALLET" }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      ...state,
      hasWallet: state.status !== "NO_WALLET",
      isCorrectNetwork: state.status === "CONNECTED",
      connect,
      disconnect,
      switchToStudionet,
      clearError,
    }),
    [state, connect, disconnect, switchToStudionet, clearError],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a <WalletProvider>");
  }
  return ctx;
}

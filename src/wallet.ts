import {
  createInjinaryWallet,
  promptInstallIfMissing,
  InjinaryWalletError,
} from '@injinary-wallet/sdk';

export const wallet = createInjinaryWallet();
export { promptInstallIfMissing, InjinaryWalletError };

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet,
  KeyRound,
  Copy,
  ExternalLink,
  AlertTriangle,
  Loader2,
  CheckCircle,
  RefreshCw,
  Plus,
  Download,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import {
  WalletAccount,
  AccountBalance,
  generateKeypair,
  getStoredWallet,
  clearStoredWallet,
  fundWithFriendbot,
  getAccountBalance,
  accountExists,
  createAndFundWallet,
  importWallet,
  isValidSecretKey,
  formatPublicKey,
  copyToClipboard,
} from '@/lib/stellar-wallet';
import { getExplorerAccountUrl } from '@/lib/stellar-config';
import { cn } from '@/lib/utils';

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletDialog({ open, onOpenChange }: WalletDialogProps) {
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [importSecretKey, setImportSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [secretKeyError, setSecretKeyError] = useState('');
  const { toast } = useToast();

  // Load wallet and balance on mount
  useEffect(() => {
    if (open) {
      loadWallet();
    }
  }, [open]);

  const loadWallet = async () => {
    const storedWallet = getStoredWallet();
    if (storedWallet) {
      setWallet(storedWallet);
      await refreshBalance(storedWallet.publicKey);
    }
  };

  const refreshBalance = async (publicKey?: string) => {
    const key = publicKey || wallet?.publicKey;
    if (!key) return;

    setIsRefreshing(true);
    try {
      const accountBalance = await getAccountBalance(key);
      setBalance(accountBalance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateWallet = async () => {
    setIsLoading(true);
    try {
      const newWallet = await createAndFundWallet();
      if (newWallet) {
        setWallet(newWallet);
        await refreshBalance(newWallet.publicKey);
        toast({
          title: 'Wallet Created',
          description: 'Your Stellar testnet wallet has been created and funded with 10,000 XLM.',
        });
      } else {
        throw new Error('Failed to create wallet');
      }
    } catch (error) {
      console.error('Failed to create wallet:', error);
      toast({
        title: 'Error',
        description: 'Failed to create wallet. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWallet = async () => {
    setSecretKeyError('');

    if (!importSecretKey.trim()) {
      setSecretKeyError('Please enter a secret key');
      return;
    }

    if (!isValidSecretKey(importSecretKey.trim())) {
      setSecretKeyError('Invalid secret key format. Must start with S and be 56 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const importedWallet = importWallet(importSecretKey.trim());
      if (importedWallet) {
        setWallet(importedWallet);
        setImportSecretKey('');

        // Check if account exists on network
        const exists = await accountExists(importedWallet.publicKey);
        if (exists) {
          await refreshBalance(importedWallet.publicKey);
          toast({
            title: 'Wallet Imported',
            description: 'Your wallet has been imported successfully.',
          });
        } else {
          // Account doesn't exist, offer to fund it
          toast({
            title: 'Account Not Found',
            description: 'This account does not exist on testnet. Fund it with Friendbot to activate.',
          });
        }
      } else {
        throw new Error('Failed to import wallet');
      }
    } catch (error) {
      console.error('Failed to import wallet:', error);
      setSecretKeyError('Failed to import wallet. Please check your secret key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFundAccount = async () => {
    if (!wallet) return;

    setIsLoading(true);
    try {
      const success = await fundWithFriendbot(wallet.publicKey);
      if (success) {
        // Wait a bit for the account to be funded
        await new Promise(resolve => setTimeout(resolve, 2000));
        await refreshBalance();
        toast({
          title: 'Account Funded',
          description: 'Your account has been funded with 10,000 XLM from Friendbot.',
        });
      } else {
        throw new Error('Friendbot funding failed');
      }
    } catch (error) {
      console.error('Failed to fund account:', error);
      toast({
        title: 'Error',
        description: 'Failed to fund account with Friendbot. It may already be funded or Friendbot may be unavailable.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWallet = () => {
    if (confirm('Are you sure you want to delete this wallet? Make sure you have backed up your secret key!')) {
      clearStoredWallet();
      setWallet(null);
      setBalance(null);
      toast({
        title: 'Wallet Deleted',
        description: 'Your wallet has been removed from local storage.',
      });
    }
  };

  const handleCopyPublicKey = async () => {
    if (wallet) {
      const success = await copyToClipboard(wallet.publicKey);
      if (success) {
        toast({
          title: 'Copied',
          description: 'Public key copied to clipboard',
        });
      }
    }
  };

  const handleCopySecretKey = async () => {
    if (wallet) {
      const success = await copyToClipboard(wallet.secretKey);
      if (success) {
        toast({
          title: 'Copied',
          description: 'Secret key copied to clipboard',
        });
      }
    }
  };

  const handleDownloadKeyfile = () => {
    if (!wallet) return;

    const keyfile = {
      publicKey: wallet.publicKey,
      secretKey: wallet.secretKey,
      network: 'testnet',
      createdAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(keyfile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stellar-testnet-${wallet.publicKey.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Keyfile Downloaded',
      description: 'Keep this file safe and never share it with anyone!',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Stellar Testnet Wallet
          </DialogTitle>
          <DialogDescription>
            Manage your Stellar testnet wallet for deploying and interacting with contracts.
          </DialogDescription>
        </DialogHeader>

        {wallet ? (
          <div className="space-y-4">
            {/* Security Warning */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This wallet is stored in your browser's local storage. <strong>Only use for testnet development.</strong> Never
                store mainnet keys in the browser!
              </AlertDescription>
            </Alert>

            {/* Account Info */}
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Account Balance</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => refreshBalance()}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                </Button>
              </div>

              {balance ? (
                <div className="text-3xl font-bold">{balance.xlmBalance.toLocaleString()} XLM</div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading balance...</span>
                </div>
              )}

              <div className="pt-3 border-t space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Public Key</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 font-mono text-xs bg-muted px-3 py-2 rounded border break-all">
                      {wallet.publicKey}
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-none" onClick={handleCopyPublicKey}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-none"
                      onClick={() => window.open(getExplorerAccountUrl(wallet.publicKey), '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Secret Key</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 font-mono text-xs bg-muted px-3 py-2 rounded border">
                      {showSecretKey ? wallet.secretKey : '•'.repeat(56)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-none"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                    >
                      {showSecretKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-none" onClick={handleCopySecretKey}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleFundAccount} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Funding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Fund with Friendbot
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleDownloadKeyfile}>
                <Download className="mr-2 h-4 w-4" />
                Download Keyfile
              </Button>
              <Button variant="destructive" onClick={handleDeleteWallet}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create New</TabsTrigger>
              <TabsTrigger value="import">Import Existing</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will create a new Stellar testnet account and fund it with 10,000 XLM using Friendbot.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="p-2 bg-blue-500/10 rounded-md">
                    <KeyRound className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Secure Key Generation</p>
                    <p className="text-xs text-muted-foreground">
                      Your keypair will be generated securely in your browser and stored locally. Make sure to back it up!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="p-2 bg-green-500/10 rounded-md">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">Automatic Funding</p>
                    <p className="text-xs text-muted-foreground">
                      Your account will be funded with 10,000 XLM from Friendbot for testing.
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={handleCreateWallet} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Wallet...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Wallet
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="import" className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Import an existing Stellar testnet secret key. Your key will be stored locally in your browser.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="secret-key">Secret Key</Label>
                <Input
                  id="secret-key"
                  type="password"
                  placeholder="S..."
                  value={importSecretKey}
                  onChange={(e) => setImportSecretKey(e.target.value)}
                  className={cn(secretKeyError && 'border-red-500')}
                />
                {secretKeyError && <p className="text-xs text-red-500">{secretKeyError}</p>}
                <p className="text-xs text-muted-foreground">Your Stellar secret key starts with 'S' and is 56 characters long.</p>
              </div>

              <Button onClick={handleImportWallet} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Import Wallet
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

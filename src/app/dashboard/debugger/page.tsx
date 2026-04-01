import { TokenDebugger } from "@/components/observatory/token-debugger";

export default function DebuggerPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Token Vault Debugger</h1>
        <p className="text-muted-foreground mt-1">
          Inspect token states, connection health, and diagnose Token Vault
          configuration issues. Addresses the #1 developer pain point.
        </p>
      </div>
      <TokenDebugger />
    </div>
  );
}

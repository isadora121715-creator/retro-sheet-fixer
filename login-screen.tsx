import { useState } from "react";
import { Loader2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";

export function LoginScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setPending(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        extraParams: { access_type: "offline", prompt: "consent" },
      });
      if (result.error) {
        setError("Não foi possível entrar com o Google. Tente novamente.");
        setPending(false);
      }
      // On success (redirected or session set), the auth listener in
      // useSession picks up the new session and re-renders the app.
    } catch {
      setError("Não foi possível entrar com o Google. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="panel w-full max-w-sm p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sheet className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Sheet Sync & Shine</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre com sua conta Google para acompanhar as cotações e sincronizar o Gmail.
        </p>
        <Button className="mt-6 w-full" onClick={handleSignIn} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Entrar com Google
        </Button>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

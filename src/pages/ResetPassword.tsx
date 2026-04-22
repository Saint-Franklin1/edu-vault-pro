import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { KeyRound, ShieldAlert } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase puts a recovery session in the URL hash; the SDK auto-parses it.
    supabase.auth.getSession().then(({ data }) => {
      setValidSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setValidSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't reset password", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Password updated", description: "You're now signed in with the new password." });
    navigate("/", { replace: true });
  };

  return (
    <AppShell>
      <div className="container max-w-md py-12">
        <div className="text-center mb-8">
          <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant mb-4">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-muted-foreground mt-1">Choose a new password for your account.</p>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>New password</CardTitle>
            <CardDescription>Must be at least 6 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            {validSession === false ? (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Invalid or expired link</AlertTitle>
                <AlertDescription>
                  This password reset link is no longer valid. Please request a new one from the sign-in page.
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => navigate("/auth")}>
                      Back to sign in
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-pw">New password</Label>
                  <PasswordInput
                    id="new-pw"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-pw">Confirm password</Label>
                  <PasswordInput
                    id="confirm-pw"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy || validSession === null}>
                  {busy ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default ResetPassword;

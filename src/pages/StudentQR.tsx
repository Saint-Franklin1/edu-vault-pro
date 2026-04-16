import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const StudentQR = () => {
  const { user } = useAuth();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!user) return null;
  const url = `${origin}/verify/${user.id}`;

  return (
    <AppShell>
      <div className="container max-w-xl py-12 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Your verification QR</h1>
          <p className="text-muted-foreground">
            Anyone who scans this can see your verified documents (read-only).
          </p>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Share with bursary officers</CardTitle>
            <CardDescription className="break-all">{url}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <QRCodeSVG value={url} size={240} level="H" />
            </div>
            <Button asChild variant="secondary">
              <a href={url} target="_blank" rel="noopener noreferrer">
                Preview public page
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default StudentQR;

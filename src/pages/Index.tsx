import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, FileCheck2, MapPin, QrCode, ShieldCheck, Upload } from "lucide-react";
import { useAuth, isAdmin } from "@/hooks/useAuth";

const Index = () => {
  const { user, roles } = useAuth();
  const dashHref = user ? (isAdmin(roles) ? "/admin" : "/student") : "/auth";

  return (
    <AppShell>
      <section className="bg-gradient-hero">
        <div className="container py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-sm">
            Verified student documents,
            <br />
            <span className="text-white/95">reusable in seconds.</span>
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8 text-white/90">
            Upload your documents once. Get them verified by your local administrator.
            Share via QR code with bursary committees, scholarships, and beyond.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold shadow-elegant">
              <Link to={dashHref}>{user ? "Go to dashboard" : "Get started"}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent border-2 border-white/70 text-white hover:bg-white hover:text-primary font-semibold">
              <Link to="/auth">I'm an administrator</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Upload, title: "Upload once", text: "PDF, PNG or JPG up to 5MB. Stored securely in your private vault." },
            { icon: ShieldCheck, title: "Verified locally", text: "Your ward, constituency or county admin reviews and verifies." },
            { icon: QrCode, title: "Share by QR", text: "Bursary officers scan your QR to instantly see verified documents." },
          ].map((f) => (
            <Card key={f.title} className="shadow-card">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary grid place-items-center mb-4">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-secondary/40">
        <div className="container py-16">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">Geographic scoping built in</h2>
              <p className="text-muted-foreground mb-6">
                Every document is reviewed only by administrators in your ward, constituency, or county.
                Bursaries are posted by local officials and shown only to eligible students.
              </p>
              <ul className="space-y-2 text-sm">
                {["Strict row-level access control", "Soft-deleted records — never lost", "Full audit trail"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: MapPin, label: "47 Counties" },
                { icon: MapPin, label: "290 Constituencies" },
                { icon: MapPin, label: "1,450 Wards" },
                { icon: FileCheck2, label: "Real-time verification" },
              ].map((s) => (
                <Card key={s.label} className="shadow-card">
                  <CardContent className="p-5 flex items-center gap-3">
                    <s.icon className="w-5 h-5 text-primary" />
                    <span className="font-medium">{s.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
};

export default Index;

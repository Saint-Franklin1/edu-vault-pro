import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Github, Linkedin, Mail, Phone, ShieldCheck, Lock, FileCheck2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/elimu-vault-logo.png";

const APP_VERSION = "v1.0.0";
const FEEDBACK_EMAIL = "franklinekimtai12@gmail.com";
const PHONE = "+254 768 711528";

export function Footer() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      toast({ title: "Missing details", description: "Please add your email and a message.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }
    const subject = encodeURIComponent("Elimu Vault Feedback");
    const body = encodeURIComponent(`From: ${email}\n\n${message}`);
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    setEmail("");
    setMessage("");
    toast({ title: "Opening your email client", description: "Thanks for your feedback!" });
  };

  return (
    <footer className="border-t bg-card mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Brand & Trust */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Elimu Vault logo" className="w-9 h-9 object-contain" />
              <span className="font-semibold text-lg">Elimu Vault</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Secure student document wallet and verification platform.
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-primary" /> Documents are encrypted</li>
              <li className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Role-based access control</li>
              <li className="flex items-center gap-2"><FileCheck2 className="w-3.5 h-3.5 text-primary" /> Verification actions are auditable</li>
            </ul>
          </div>

          {/* Column 2: Platform Navigation */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Platform</h3>
            <ul className="space-y-2 text-sm">
              {[
                { to: "/student", label: "Student Dashboard" },
                { to: "/admin", label: "Admin Dashboard" },
                { to: "/student", label: "Upload Documents" },
                { to: "/student", label: "Verification Status" },
                { to: "/student/qr", label: "QR Code Access" },
              ].map((l, i) => (
                <li key={i}>
                  <Link to={l.to} className="text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Resources & Legal */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-3">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/legal/help" className="text-muted-foreground hover:text-primary transition-colors">Help Center</Link></li>
                <li><Link to="/legal/faqs" className="text-muted-foreground hover:text-primary transition-colors">FAQs</Link></li>
                <li><Link to="/legal/docs" className="text-muted-foreground hover:text-primary transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/legal/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/legal/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Use</Link></li>
              </ul>
            </div>
          </div>

          {/* Column 4: Feedback */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Send Feedback</h3>
            <p className="text-xs text-muted-foreground">
              Share a bug, idea, or improvement. We read every message.
            </p>
            <form onSubmit={handleSubmit} className="space-y-2">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-sm"
                aria-label="Your email"
                required
              />
              <Textarea
                placeholder="Your feedback"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[88px] text-sm resize-none"
                aria-label="Feedback message"
                required
              />
              <Button type="submit" size="sm" className="w-full">Send Feedback</Button>
            </form>
          </div>
        </div>

        {/* Bottom bar: everything on one horizontal line */}
        <div className="mt-10 pt-6 border-t">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} Elimu Vault. All rights reserved.</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <a href={`mailto:${FEEDBACK_EMAIL}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Mail className="w-3.5 h-3.5" />
                <span className="break-all">{FEEDBACK_EMAIL}</span>
              </a>
              <span className="hidden sm:inline text-border">•</span>
              <a href="tel:+254768711528" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5" />
                <span>{PHONE}</span>
              </a>
              <span className="hidden sm:inline text-border">•</span>
              <a href="https://www.github.com/Saint-Franklin1" target="_blank" rel="noopener noreferrer" aria-label="GitHub"
                className="hover:text-primary transition-colors">
                <Github className="w-3.5 h-3.5" />
              </a>
              <a href="https://www.linkedin.com/in/frankline-kimtai-2726a93a9" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
                className="hover:text-primary transition-colors">
                <Linkedin className="w-3.5 h-3.5" />
              </a>
              <span className="hidden sm:inline text-border">•</span>
              <span>{APP_VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

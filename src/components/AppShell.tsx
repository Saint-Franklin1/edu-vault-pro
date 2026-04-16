import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { GraduationCap, LogOut, Shield, User as UserIcon } from "lucide-react";
import { useAuth, highestRole, isAdmin } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const role = highestRole(roles);
  const admin = isAdmin(roles);

  const navItems = user
    ? admin
      ? [
          { to: "/admin", label: "Dashboard" },
          { to: "/admin/bursaries", label: "Bursaries" },
          ...(role === "super_admin" ? [{ to: "/admin/audit", label: "Audit" }] : []),
        ]
      : [
          { to: "/student", label: "Documents" },
          { to: "/student/bursaries", label: "Bursaries" },
          { to: "/student/qr", label: "My QR" },
        ]
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-40 shadow-card">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-hero text-primary-foreground shadow-elegant">
              <GraduationCap className="w-5 h-5" />
            </span>
            <span className="hidden sm:inline">Elimu Vault</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                  {admin ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  <span className="capitalize">{role?.replace("_", " ")}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate("/auth")}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-6 mt-auto">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Elimu Vault — Verified student documents for Kenya.
        </div>
      </footer>
    </div>
  );
}

import { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

type Section = { heading: string; body: ReactNode };
type Doc = { title: string; description: string; updated: string; sections: Section[] };

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const DOCS: Record<string, Doc> = {
  privacy: {
    title: "Privacy Policy",
    description: "How Elimu Vault collects, uses, and protects your information.",
    updated: "April 2026",
    sections: [
      {
        heading: "1. Information We Collect",
        body: (
          <>
            We collect the minimum information required to operate the platform: your name, email,
            phone number, geographic scope (county, constituency, ward), and the documents you
            choose to upload for verification. Authentication metadata (sign-in events, IP address)
            is stored to protect your account.
          </>
        ),
      },
      {
        heading: "2. How We Use Your Information",
        body: (
          <>
            Your information is used to authenticate you, route documents to the correct verifier,
            display verification status, and produce auditable records of administrative actions.
            We do not sell your data to third parties.
          </>
        ),
      },
      {
        heading: "3. Document Storage & Encryption",
        body: (
          <>
            Documents are stored in a secured object store with row-level access policies. Files are
            encrypted at rest and in transit. Only you and authorized administrators within your
            geographic scope can access your documents.
          </>
        ),
      },
      {
        heading: "4. Sharing & Verification",
        body: (
          <>
            Verification links generated via your QR code expose only the verification status and
            issuing authority — they do not expose the underlying documents unless you explicitly
            grant access.
          </>
        ),
      },
      {
        heading: "5. Your Rights",
        body: (
          <>
            You may request a copy of your data, correction of inaccurate records, or deletion of
            your account at any time by contacting us at the address below. Deletion requests are
            processed within 30 days, subject to legal retention requirements.
          </>
        ),
      },
      {
        heading: "6. Contact",
        body: (
          <>
            For privacy questions, write to{" "}
            <a className="text-primary hover:underline" href="mailto:franklinekimtai12@gmail.com">
              franklinekimtai12@gmail.com
            </a>
            .
          </>
        ),
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    description: "The rules that govern your use of Elimu Vault.",
    updated: "April 2026",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body: <>By creating an account or using Elimu Vault, you agree to these Terms of Use and our Privacy Policy.</>,
      },
      {
        heading: "2. Eligible Use",
        body: (
          <>
            Elimu Vault is intended for students seeking bursaries and verification, and for the
            ward, constituency, county, and super administrators authorized to verify documents.
            You must provide accurate information and only upload documents you are authorized to
            submit.
          </>
        ),
      },
      {
        heading: "3. Account Security",
        body: (
          <>
            You are responsible for safeguarding your credentials. Suspected compromise must be
            reported immediately. Administrators whose status is set to suspended, banned, or
            deleted will be denied access.
          </>
        ),
      },
      {
        heading: "4. Acceptable Content",
        body: (
          <>
            Do not upload fraudulent, forged, or unlawful material. Verification actions are
            audited and misuse may result in account suspension and referral to relevant
            authorities.
          </>
        ),
      },
      {
        heading: "5. Service Availability",
        body: (
          <>
            We strive for high availability but do not guarantee uninterrupted service.
            Maintenance, upgrades, or third-party outages may temporarily affect access.
          </>
        ),
      },
      {
        heading: "6. Limitation of Liability",
        body: (
          <>
            Elimu Vault is provided "as is". To the maximum extent permitted by law, we are not
            liable for indirect or consequential damages arising from use of the platform.
          </>
        ),
      },
      {
        heading: "7. Changes",
        body: <>We may update these terms. Material changes will be communicated via the platform or by email.</>,
      },
    ],
  },
  faqs: {
    title: "FAQs",
    description: "Quick answers to the most common questions about Elimu Vault.",
    updated: "April 2026",
    sections: [
      {
        heading: "What is Elimu Vault?",
        body: (
          <>
            Elimu Vault is a secure digital wallet for student academic and identification
            documents, with a verification workflow operated by ward, constituency, county, and
            super administrators.
          </>
        ),
      },
      {
        heading: "How do I create an account?",
        body: (
          <>
            Go to <Link className="text-primary hover:underline" to="/auth">Sign in</Link>, choose
            "Create account", verify your email, and complete your profile (name, phone, county,
            constituency, ward).
          </>
        ),
      },
      {
        heading: "How do I upload documents?",
        body: (
          <>
            From your <Link className="text-primary hover:underline" to="/student">Student Dashboard</Link>,
            click "Upload Document", give it a title, and select the file. Status will move from
            Pending → In Queue → Verified or Rejected.
          </>
        ),
      },
      {
        heading: "How does verification work?",
        body: (
          <>
            Documents are routed to the administrator whose geographic scope matches your profile.
            Verifiers review the document and either approve it or reject it with a reason. Every
            action is recorded in the audit log.
          </>
        ),
      },
      {
        heading: "What is the QR code for?",
        body: (
          <>
            Your QR code links to a public verification page that confirms whether your documents
            have been verified, without exposing the documents themselves. Useful for bursary
            officers and institutions.
          </>
        ),
      },
      {
        heading: "I'm an admin and can't sign in",
        body: (
          <>
            If your admin status is suspended, banned, or deleted you will be signed out
            automatically. Contact a super administrator to restore access.
          </>
        ),
      },
      {
        heading: "How do I report a bug or request a feature?",
        body: (
          <>
            Use the feedback form in the footer or email{" "}
            <a className="text-primary hover:underline" href="mailto:franklinekimtai12@gmail.com">
              franklinekimtai12@gmail.com
            </a>
            .
          </>
        ),
      },
    ],
  },
  docs: {
    title: "Documentation",
    description: "Technical and operational documentation for Elimu Vault.",
    updated: "April 2026",
    sections: [
      {
        heading: "Roles & Permissions",
        body: (
          <>
            The platform supports five roles: <strong>student</strong>, <strong>ward_admin</strong>,
            <strong> constituency_admin</strong>, <strong>county_admin</strong>, and <strong>super_admin</strong>.
            Each admin tier can act only within their geographic scope. Super admins have global
            visibility and can manage roles and admin status.
          </>
        ),
      },
      {
        heading: "Document Lifecycle",
        body: (
          <>
            Documents move through four states: <em>pending</em> (just uploaded), <em>in_queue</em>
            {" "}(claimed by an admin), <em>verified</em>, or <em>rejected</em> (with a reason).
            Transitions are logged in <code className="text-xs bg-muted px-1 py-0.5 rounded">audit_logs</code>.
          </>
        ),
      },
      {
        heading: "Bursaries",
        body: (
          <>
            Admins create bursaries scoped to a county, constituency, or ward. Students see only
            bursaries that match their geographic profile, sorted by deadline.
          </>
        ),
      },
      {
        heading: "Audit Logs",
        body: (
          <>
            Every administrative action — verification, rejection, role assignment, status change —
            is recorded with the actor, target, action, and metadata. Super admins can review the
            full log at <Link className="text-primary hover:underline" to="/admin/audit">/admin/audit</Link>.
          </>
        ),
      },
      {
        heading: "Security Model",
        body: (
          <>
            Authentication uses email verification by default; OAuth (Google, GitHub) is available.
            All tables enforce row-level security. Roles are stored in a dedicated{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">user_roles</code> table to
            prevent privilege escalation.
          </>
        ),
      },
    ],
  },
  help: {
    title: "Help Center",
    description: "Guides for getting the most out of Elimu Vault.",
    updated: "April 2026",
    sections: [
      {
        heading: "Getting Started (Students)",
        body: (
          <>
            1. Create an account and verify your email.<br />
            2. Complete your profile with your county, constituency, and ward.<br />
            3. Upload your documents from the Student Dashboard.<br />
            4. Track verification status and share your QR code when needed.
          </>
        ),
      },
      {
        heading: "Getting Started (Admins)",
        body: (
          <>
            1. Sign in with the credentials provided by your super administrator.<br />
            2. Review pending documents within your geographic scope.<br />
            3. Verify or reject documents with a clear reason.<br />
            4. Publish bursaries relevant to students in your area.
          </>
        ),
      },
      {
        heading: "Troubleshooting Sign-in",
        body: (
          <>
            If you can't sign in: confirm your email is verified, check your password, and ensure
            your admin account is active. Suspended, banned, or deleted accounts are blocked.
          </>
        ),
      },
      {
        heading: "Document Upload Issues",
        body: (
          <>
            Supported formats include PDF, JPG, and PNG. Maximum file size is 10&nbsp;MB. If a
            document is rejected, read the reason, fix the issue, and re-upload.
          </>
        ),
      },
      {
        heading: "Need More Help?",
        body: (
          <>
            Send a message via the feedback form in the footer or email{" "}
            <a className="text-primary hover:underline" href="mailto:franklinekimtai12@gmail.com">
              franklinekimtai12@gmail.com
            </a>
            .
          </>
        ),
      },
    ],
  },
};

export default function Legal() {
  const { slug = "" } = useParams();
  const doc = DOCS[slug];

  if (!doc) {
    return (
      <AppShell>
        <Helmet>
          <title>Page not found | Elimu Vault</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
          <p className="text-muted-foreground mb-6">We couldn't find that resource.</p>
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const pageTitle = `${doc.title} | Elimu Vault`;
  const canonical = typeof window !== "undefined" ? window.location.href : `/legal/${slug}`;
  const sections = doc.sections.map((s) => ({ ...s, id: slugify(s.heading) }));

  return (
    <AppShell>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={doc.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={doc.description} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: doc.title,
          description: doc.description,
          dateModified: doc.updated,
          publisher: { "@type": "Organization", name: "Elimu Vault" },
        })}</script>
      </Helmet>
      <article className="container py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
            Back home
          </Link>
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-10 lg:gap-12">
          <div className="min-w-0 max-w-3xl">
            <header className="mb-8 pb-6 border-b">
              <h1 className="text-3xl font-bold tracking-tight mb-2">{doc.title}</h1>
              <p className="text-muted-foreground">{doc.description}</p>
              <p className="text-xs text-muted-foreground mt-3">Last updated: {doc.updated}</p>
            </header>
            <div className="space-y-8">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="text-lg font-semibold mb-2">{s.heading}</h2>
                  <div className="text-sm text-muted-foreground leading-relaxed">{s.body}</div>
                </section>
              ))}
            </div>
          </div>
          <aside className="hidden lg:block">
            <nav aria-label="Table of contents" className="sticky top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                On this page
              </p>
              <ul className="space-y-2 text-sm border-l">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block -ml-px pl-3 border-l border-transparent text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                    >
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </article>
    </AppShell>
  );
}

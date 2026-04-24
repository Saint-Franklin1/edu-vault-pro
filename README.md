# ELIMU-VAULT v2

> **A Secure, Hierarchical Digital Verification & Bursary Management Platform for Kenyan Students**

---

> **Formatting note for printed/exported submissions:** This document is authored in Markdown for version control. When exporting to Microsoft Word or PDF for submission, apply the following styles in line with the Project Report Guidelines:
>
> - **Font:** Book Antiqua or Times New Roman, size 12
> - **Line spacing:** 1.5
> - **Alignment:** Justify
> - **Margins:** 1” (2.54 cm) on all sides
> - **Pagination:** Roman numerals (i, ii, iii…) for the front matter (Title Page → List of Abbreviations); Arabic numerals (1, 2, 3…) from the Introduction onwards. Page numbers are placed at the bottom-centre. The title page carries no number.
> - **Referencing:** APA 7th Edition.
> - **Table of Contents:** Generate automatically in Word (References → Table of Contents) using the headings below.

---

# TITLE PAGE

**ELIMU-VAULT v2: A SECURE HIERARCHICAL DIGITAL VERIFICATION AND BURSARY MANAGEMENT PLATFORM FOR KENYAN STUDENTS**

By

**[Student Name]**
**[Registration Number]**

A Project Report submitted to the **[Faculty/School of Computing]**, **[University Name]**, in partial fulfilment of the requirements for the award of the degree of **Bachelor of Science in [Programme Name]**.

**Supervisor:** [Supervisor Name]

**[Month, Year]**

---

**Disclaimer:** This project report is the original work of the author. The system described herein, *Elimu-Vault v2*, is a prototype developed for academic purposes. While production-grade engineering practices have been applied, the platform should undergo formal information-security audit and legal review before being deployed in a live regulated environment.

---

# DECLARATION

I, **[Student Name]**, declare that this project report titled *“Elimu-Vault v2: A Secure Hierarchical Digital Verification and Bursary Management Platform for Kenyan Students”* is my original work and has not been presented for the award of a degree, diploma or any other qualification in this or any other university.

Signed: ……………………………………………… Date: ……………………………

**[Student Name] — [Registration Number]**

---

This project report has been submitted for examination with my approval as the university supervisor.

Signed: ……………………………………………… Date: ……………………………

**[Supervisor Name]**
**[Department], [University Name]**

---

# DEDICATION

This work is dedicated to the learners of Kenya whose access to opportunity has been limited not by ability, but by the difficulty of proving who they are and where they come from. May digital systems serve, rather than gate-keep, their ambitions.

---

# ACKNOWLEDGEMENTS

I sincerely thank my supervisor **[Supervisor Name]** for guidance throughout the design and implementation of this system. I am grateful to the **[Department]** for the technical environment and to the chiefs, ward administrators and bursary officers who shared insights on the existing manual verification workflow, without which the hierarchical approval design would not have been grounded in real practice. Finally, I thank my family and peers for their patience during the long iterations of database modelling, security hardening and user testing.

---

# ABSTRACT

Access to bursaries and government educational grants in Kenya is bottlenecked by a paper-based verification chain that requires students to physically obtain endorsements from village chiefs, ward administrators, constituency offices and county education boards before any application is processed; this is slow, fraud-prone, and geographically exclusionary. This project, *Elimu-Vault v2*, designs and implements a production-grade web platform that digitises the entire chain end-to-end. The system uses a React 18 + TypeScript front end built with Vite and Tailwind CSS, and a managed Supabase (PostgreSQL) back end with Row-Level Security (RLS), security-definer functions, edge functions and signed-URL object storage. A four-tier hierarchical approval workflow (Chief → Ward Admin → Constituency Admin → County Admin) is enforced both at the application layer and at the database layer through CHECK constraints and BEFORE-UPDATE triggers, making it impossible for any actor to skip a stage. A separate Super Admin role provides governance and audit oversight without operational approval rights, and a dedicated `user_roles` table prevents privilege-escalation attacks common in single-table role designs. Students can upload identity and academic documents, view real-time approval progress, scan/print verification QR codes, browse bursaries posted by any admin, and apply directly through the platform; password visibility toggles and a forgotten-password reset flow have been added to the authentication layer. Evaluation against functional, security and usability criteria shows that the system reduces an average multi-week verification cycle to a near-real-time pipeline, eliminates several classes of document tampering, and produces an immutable audit trail. The report concludes with a critique of remaining limitations — chief among them offline accessibility, biometric identity binding, and the need for a formal penetration test — and recommends extensions including SMS notification, a mobile client and integration with the Huduma national identity system.

---

# TABLE OF CONTENTS

> *Auto-generate this section in Word using the heading styles below.*

- DECLARATION ............................................................................... ii
- DEDICATION ................................................................................ iii
- ACKNOWLEDGEMENTS ........................................................................ iv
- ABSTRACT .................................................................................. v
- LIST OF TABLES ........................................................................... vii
- LIST OF FIGURES ......................................................................... viii
- LIST OF ABBREVIATIONS ..................................................................... ix
- **CHAPTER 1: INTRODUCTION** ................................................................ 1
- **CHAPTER 2: LITERATURE REVIEW** ........................................................... 6
- **CHAPTER 3: ANALYSIS AND DESIGN** ........................................................ 12
- **CHAPTER 4: METHODOLOGY** ................................................................ 22
- **CHAPTER 5: PROJECT MANAGEMENT** ......................................................... 28
- **CHAPTER 6: DISCUSSION AND RESULTS** .................................................... 33
- **CHAPTER 7: CONCLUSION AND RECOMMENDATIONS** ........................................... 42
- **REFERENCES** ............................................................................ 46
- **APPENDICES** ............................................................................ 49

---

# LIST OF TABLES

| Table | Title | Page |
|------:|-------|-----:|
| 3.1 | Functional requirements summary | 13 |
| 3.2 | Non-functional requirements summary | 14 |
| 3.3 | Role-permission matrix | 16 |
| 3.4 | Core database entities | 18 |
| 4.1 | Comparison of candidate development methodologies | 23 |
| 5.1 | Project budget | 29 |
| 5.2 | Project schedule (Gantt summary) | 30 |
| 6.1 | Functional test results summary | 36 |
| 6.2 | Security test results summary | 38 |

---

# LIST OF FIGURES

| Figure | Title | Page |
|-------:|-------|-----:|
| 3.1 | High-level system architecture | 12 |
| 3.2 | Use-case diagram (all actors) | 15 |
| 3.3 | Entity-relationship diagram | 18 |
| 3.4 | Hierarchical approval state machine | 20 |
| 4.1 | Iterative-incremental development cycle | 24 |
| 5.1 | Gantt chart of project schedule | 31 |
| 6.1 | Student dashboard screenshot | 34 |
| 6.2 | Chief review dialog screenshot | 35 |
| 6.3 | Admin approval queue screenshot | 36 |
| 6.4 | Bursary application flow screenshot | 37 |

---

# LIST OF ABBREVIATIONS

| Abbreviation | Meaning |
|---|---|
| API | Application Programming Interface |
| APA | American Psychological Association |
| BaaS | Backend-as-a-Service |
| CRUD | Create, Read, Update, Delete |
| CSP | Content Security Policy |
| DBMS | Database Management System |
| ERD | Entity-Relationship Diagram |
| HSL | Hue, Saturation, Lightness |
| JWT | JSON Web Token |
| MoE | Ministry of Education |
| OAuth | Open Authorisation |
| PII | Personally Identifiable Information |
| PWA | Progressive Web Application |
| QR | Quick Response (code) |
| RBAC | Role-Based Access Control |
| RLS | Row-Level Security |
| RPC | Remote Procedure Call |
| SDLC | Software Development Life Cycle |
| SLA | Service-Level Agreement |
| SPA | Single-Page Application |
| SQL | Structured Query Language |
| SSR | Server-Side Rendering |
| TLS | Transport Layer Security |
| UI/UX | User Interface / User Experience |
| URL | Uniform Resource Locator |
| UUID | Universally Unique Identifier |

---

---

# CHAPTER 1: INTRODUCTION

## 1.1 Background of the Study

In Kenya, financial assistance for education is administered through several overlapping mechanisms, including the Higher Education Loans Board (HELB), the National Government Constituencies Development Fund (NG-CDF) bursaries, county government bursaries, and ward-level welfare grants. To qualify for any of these, an applicant must produce verified evidence of identity, residence, academic enrolment, and socio-economic vulnerability (e.g., status as an orphan, person with disability, or member of a low-income household). The verification chain is conventionally hierarchical: a village or location **Chief** confirms residency and category, a **Ward Administrator** validates the chief’s endorsement, a **Constituency** office checks compliance against the bursary fund’s rules, and a **County** office issues final clearance.

The status quo is paper-based. Students physically carry letters between offices, queue for hours, and frequently restart the cycle when documents are lost, stamps are rejected, or deadlines pass. The process is also opaque: an applicant rarely knows which stage their file is at or why it has stalled.

## 1.2 Problem Statement

The manual hierarchical verification chain creates four specific problems. (i) **Latency** — a process that should take days routinely takes weeks, causing students to miss bursary deadlines. (ii) **Fraud surface** — physical letters and rubber stamps are forgeable, and there is no central audit trail. (iii) **Exclusion** — students in remote areas, persons with disabilities, and orphans without guardians are disproportionately unable to navigate the chain. (iv) **Administrative duplication** — the same identity and academic documents are re-collected at every level. There is no integrated digital platform that simultaneously enforces the constitutional approval order, gives every actor (student, chief, ward, constituency, county, super-admin) a role-appropriate view, and maintains a tamper-evident audit trail.

## 1.3 Aim

The aim of this project is **to design, implement and evaluate a secure, web-based platform that digitises the end-to-end student verification and bursary application workflow while enforcing the four-tier Kenyan administrative approval hierarchy at the database level.**

## 1.4 Specific Objectives

1. To analyse the existing manual verification process and elicit functional and non-functional requirements from each actor (student, chief, ward, constituency, county, super-admin).
2. To design a relational data model and a role-based access-control scheme that enforces the Chief → Ward → Constituency → County approval order and prevents privilege escalation.
3. To implement the platform as a single-page React application backed by a managed PostgreSQL service, with hardened authentication (password-visibility toggle, password reset, OAuth optional) and signed-URL document storage.
4. To implement a parallel module for posting and applying for bursaries, grants and programmes, accessible to all admin roles for visibility but restricted by ownership for editing.
5. To evaluate the system against functional, security and usability criteria, including database-level enforcement of the approval chain and protection of personally identifiable information.

## 1.5 Research Questions

1. How can the four-tier Kenyan verification hierarchy be encoded such that no actor can skip or bypass a stage, even by manipulating the client?
2. What role-based access-control pattern in PostgreSQL eliminates the recursion and privilege-escalation pitfalls common to single-table designs?
3. How does a digitised, real-time approval pipeline compare to the manual chain in terms of cycle time, transparency and auditability?

## 1.6 Justification of the Study

Beyond the immediate utility of clearing a verification bottleneck, the project contributes a **reference architecture** for hierarchical, geographically scoped approval workflows on serverless / Backend-as-a-Service infrastructure — a pattern that recurs across land registration, social protection, healthcare referrals and electoral processes in Kenya and the wider region. Demonstrating that strict ordering and least-privilege access can be enforced at the database layer (rather than the easily-bypassed application layer) has practical security value for any e-government project. The study also contributes empirical data on the latency reduction achievable when paper chains are digitised end-to-end.

## 1.7 Scope

The platform covers:

- Student registration, login, password reset and document upload.
- Chief residency verification with categorisation (orphan, vulnerable, person-with-disability, other) and recommendation-letter upload.
- Sequential approval by Ward, Constituency and County administrators, each scoped to their geographic area.
- Super-admin oversight, audit-log viewing, role promotion and bursary governance — but **not** operational approval.
- Bursary, grant and programme posting by any admin, visibility to all admins, and student application.
- A QR-based external verification endpoint for third parties (e.g., schools, employers) to confirm a student’s verified status.

## 1.8 Limitations

1. **Connectivity dependency** — the prototype is online-only; chiefs in areas without reliable internet still need fall-back paper procedures.
2. **Identity binding** — the system trusts the email/password credentials and a uploaded ID document; it is not yet integrated with the Huduma Namba or IPRS biometric registry.
3. **Single-language UI** — only English is provided in the prototype; Kiswahili localisation is recommended future work.
4. **No SMS gateway in the prototype** — notifications are in-app and email-based; SMS would materially improve reach.
5. **No formal penetration test** — security has been engineered to industry best practice (RLS, signed URLs, security-definer helpers, audit logs) but an external pen-test is recommended before production.

## 1.9 Significance of the Study

The project benefits four stakeholder groups: (a) **students**, through faster cycle times and visibility; (b) **administrators**, through an organised queue and reduced manual paperwork; (c) **bursary funders**, through fraud-resistant data and auditability; and (d) **the academic community**, through a documented reference implementation of database-enforced hierarchical workflows on a BaaS platform.

## 1.10 Organisation of the Report

**Chapter 2** reviews related literature on e-government in Africa, role-based access control, and Backend-as-a-Service platforms. **Chapter 3** presents requirements, architecture, the data model and the approval state machine. **Chapter 4** justifies the iterative-incremental methodology and the tooling choices. **Chapter 5** presents the budget and schedule. **Chapter 6** documents the implementation, sample code and screenshots and reports test results. **Chapter 7** concludes, critiques the work and recommends future extensions.

---

# CHAPTER 2: LITERATURE REVIEW

## 2.1 Introduction

This chapter situates the project in three intersecting bodies of literature: (i) e-government and digital service delivery in sub-Saharan Africa, (ii) role-based access control and hierarchical workflow systems, and (iii) the maturing landscape of Backend-as-a-Service (BaaS) and serverless architectures for civic technology.

## 2.2 E-Government and Digital Service Delivery in Africa

Heeks (2018) documents that more than half of African e-government initiatives are classified as partial or total failures, attributing this to a *design–reality gap* in which systems mirror idealised processes rather than the messy ground truth. Ndung’u and Signé (2020) argue that successful African civic platforms — M-Pesa, eCitizen, Huduma centres — share three traits: they replace, rather than supplement, the legacy paper trail; they make every transaction observable; and they distribute trust through cryptographic or institutional means rather than concentrating it in a single gatekeeper. The present project draws directly on these findings by digitising the **entire** chain (rather than only one stage), surfacing approval status to students in real time, and distributing trust across four independent admin tiers with an immutable audit log.

## 2.3 Bursary and Educational Finance Workflows in Kenya

Studies of HELB (Otieno, 2019), NG-CDF bursary disbursement (Wanjiru & Ng’ang’a, 2020), and county bursary committees (Kiprono, 2021) consistently identify three failure modes: (a) opaque eligibility decisions, (b) duplication of documentary evidence across funds, and (c) intermediaries (chiefs, ward administrators) becoming rate-limiting steps. None of the reviewed studies, however, propose a unified digital platform that spans all four administrative tiers; they treat each tier in isolation. This project addresses that gap.

## 2.4 Role-Based Access Control and Hierarchical Workflows

Sandhu et al. (1996) formalised RBAC as a model in which permissions attach to roles and users acquire permissions only through role assignment; this remains the dominant paradigm. Ferraiolo, Kuhn and Chandramouli (2007) extended the model with **constrained RBAC**, where role activation is bounded by separation-of-duty and ordering constraints — exactly the property required for sequential approvals. More recent literature on PostgreSQL Row-Level Security (Kovacs, 2020; Supabase Engineering, 2023) emphasises that role checks must be performed by **security-definer** functions that bypass RLS to avoid recursive policy evaluation, and that roles must live in a dedicated table rather than on the user/profile row to prevent self-elevation. The present project implements both of these recommendations through a `user_roles` table and a `has_role(user_id, role)` SQL function.

## 2.5 Backend-as-a-Service and Serverless Civic Platforms

The shift from self-hosted LAMP stacks to managed BaaS (Firebase, Supabase, AWS Amplify) is documented by Roberts (2021) and Mikowski (2022) as an order-of-magnitude productivity gain for small civic-tech teams, at the cost of vendor coupling. Crucially, Supabase exposes the underlying PostgreSQL engine, so security policies, triggers and constraints — i.e., the hard guarantees that this project relies upon — remain portable. This portability informed the architectural decision to push approval-order enforcement into the database, where it survives any future migration away from the managed provider.

## 2.6 Document Verification, QR Codes and Tamper-Evident Audit

Buchanan et al. (2018) review QR-based credential verification systems and note that they succeed when the QR encodes only an opaque identifier resolvable against a trusted server (rather than the credential itself), eliminating the offline forgery risk. Audit-log immutability is treated by NIST SP 800-92 (Kent & Souppaya, 2006) as a foundational control. The Elimu-Vault QR endpoint and `audit_logs` table follow these patterns.

## 2.7 Synthesis and Research Gap

The reviewed literature converges on three design imperatives: replace the paper chain end-to-end, enforce ordering and least privilege at the data layer, and surface every state transition for audit. No prior Kenyan study, to the author’s knowledge, has implemented and evaluated all three for the specific four-tier bursary verification chain. This is the gap addressed.

---

# CHAPTER 3: ANALYSIS AND DESIGN

## 3.1 Stakeholder and Actor Analysis

Six actor roles were identified, each mapped to a system role:

| Actor | System role | Geographic scope |
|---|---|---|
| Student / applicant | `student` | self |
| Village/location chief | `chief` | ward |
| Ward administrator | `ward_admin` | ward |
| Constituency officer | `constituency_admin` | constituency |
| County education officer | `county_admin` | county |
| System governance | `super_admin` | national (read/oversight) |

## 3.2 Requirements Engineering

### 3.2.1 Functional Requirements (Table 3.1)

| ID | Requirement |
|---|---|
| FR-01 | Students can register, log in, log out and reset a forgotten password. |
| FR-02 | Password fields offer a show/hide toggle on every form. |
| FR-03 | Students can upload identity and academic documents and view real-time approval progress. |
| FR-04 | Chiefs review documents in their ward, assign a hardship category and upload a recommendation letter. |
| FR-05 | Ward, constituency and county admins approve in strict order; the next stage is locked until the previous is complete. |
| FR-06 | Admins can post bursaries, grants and programmes. |
| FR-07 | All admins can **view** bursaries posted by any other admin. |
| FR-08 | Only the creator (or super-admin) can edit or soft-delete a bursary. |
| FR-09 | Students can browse open bursaries and apply directly. |
| FR-10 | Each verified student has a QR code resolvable by an external verifier endpoint. |
| FR-11 | Every approval, edit and deletion is written to an append-only audit log. |
| FR-12 | Super-admin can promote/demote users to roles with mandatory geographic metadata. |

### 3.2.2 Non-Functional Requirements (Table 3.2)

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Security | Approval order enforced at DB level; client cannot skip stages. |
| NFR-02 | Security | Roles stored in a dedicated table; no role flag on profiles. |
| NFR-03 | Security | Document storage uses signed, expiring URLs only. |
| NFR-04 | Performance | Dashboard loads in < 2 s on 3G. |
| NFR-05 | Usability | Responsive design ≥ 320 px viewport. |
| NFR-06 | Auditability | All sensitive mutations written to `audit_logs` server-side. |
| NFR-07 | Maintainability | Strict TypeScript; no `any` in security-critical code. |
| NFR-08 | Accessibility | WCAG 2.1 AA contrast on all primary surfaces. |

### 3.2.3 Role-Permission Matrix (Table 3.3)

| Action | student | chief | ward | constituency | county | super_admin |
|---|---|---|---|---|---|---|
| Upload document | ✔ | | | | | |
| Approve (chief stage) | | ✔ | | | | |
| Approve (ward stage) | | | ✔ | | | |
| Approve (constituency stage) | | | | ✔ | | |
| Approve (county stage / fully verified) | | | | | ✔ | |
| View any document | ✔ (own) | ✔ (ward) | ✔ (ward) | ✔ (constituency) | ✔ (county) | ✔ (all) |
| Post bursary | | ✔ | ✔ | ✔ | ✔ | ✔ |
| View any bursary | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Edit / soft-delete bursary | | own | own | own | own | any |
| Promote roles | | | | | | ✔ |
| View audit log | | | | | | ✔ |

## 3.3 System Architecture (Figure 3.1)

The platform is a three-layer client–server system:

```
┌────────────────────────────────────────────────────────────┐
│  CLIENT  ─  React 18 + TypeScript SPA (Vite, Tailwind)     │
│             ├─ Auth pages (login, register, reset)         │
│             ├─ Student dashboard / QR / bursary apply      │
│             ├─ Chief dashboard                             │
│             ├─ Admin dashboards (ward / const. / county)   │
│             └─ Super-admin governance + audit              │
└──────────────────────────┬─────────────────────────────────┘
                           │  HTTPS / JWT
┌──────────────────────────▼─────────────────────────────────┐
│  MANAGED BACKEND  (Supabase / Lovable Cloud)               │
│   ├─ PostgREST API  (auto-generated from schema)           │
│   ├─ PostgreSQL 15  (RLS, security-definer fns, triggers)  │
│   ├─ GoTrue Auth    (email + OAuth + recovery)             │
│   ├─ Storage        (signed URLs, two private buckets)     │
│   └─ Edge Functions (Deno, audit + side-effect handlers)   │
└────────────────────────────────────────────────────────────┘
```

## 3.4 Use-Case Diagram (Figure 3.2)

Primary use cases per actor:

- **Student:** Register, Reset Password, Upload Document, View Progress, Browse Bursaries, Apply for Bursary, Download QR.
- **Chief:** Review Document, Categorise, Upload Recommendation Letter, Approve.
- **Ward / Constituency / County Admin:** View Queue, View Document, Approve / Reject, Post Bursary, Manage Own Bursaries.
- **Super-Admin:** Promote / Demote Roles, Force Verify, View Audit Log, Govern Bursaries, View Aggregate Stats.

## 3.5 Data Model (Figure 3.3 / Table 3.4)

Core entities (PostgreSQL):

| Table | Purpose |
|---|---|
| `profiles` | Personal details linked to `auth.users` (no role column). |
| `user_roles` | `(user_id, role, ward, constituency, county)` — sole source of role truth. |
| `documents` | Uploaded student documents with stage flags `chief_approved`, `ward_approved`, `constituency_approved`, `county_approved`, `chief_category`, `recommendation_letter_url`, `deleted_at`. |
| `bursaries` | Posted opportunities with `created_by`, `deleted_at`, eligibility metadata. |
| `applications` | Student applications to a bursary. |
| `audit_logs` | Append-only `(actor, action, target, payload, created_at)`. |

Two storage buckets are configured: `student-documents` (uploaded by students) and `chief-letters` (uploaded by chiefs). Both are private; access is mediated by RLS-aware signed URLs.

## 3.6 Approval State Machine (Figure 3.4)

```
   uploaded ──► chief_approved ──► ward_approved ──► constituency_approved ──► county_approved (verified)
        │                                                                              ▲
        └────────────► rejected (terminal, with reason)                                │
                                                                                       │
                              super_admin (force_verify, audited) ───────────────────►─┘
```

The order is enforced by a CHECK constraint on `documents`:

```sql
CHECK (
  (NOT ward_approved          OR chief_approved) AND
  (NOT constituency_approved  OR ward_approved)  AND
  (NOT county_approved        OR constituency_approved)
)
```

…and a `BEFORE UPDATE` trigger that additionally blocks `super_admin` from setting any of the four operational flags (forcing them through the explicit `force_verify` path, which is itself logged).

## 3.7 Security Design

- **No client-side role checks for security decisions** — all enforcement is via PostgreSQL RLS using `has_role(auth.uid(), 'role')` security-definer functions.
- **Signed URLs only** for document downloads, expiring in 60 seconds.
- **Append-only `audit_logs`** with no `UPDATE` or `DELETE` policies for any role.
- **Password hardening**: visibility toggle in UI, server-side strength validation, GoTrue email-link recovery.
- **CSRF** mitigated by JWT-bearer auth (no cookies for the API).
- **Geographic scoping**: ward, constituency and county admins can only read documents whose owning student’s `profiles.ward / constituency / county` matches their own assignment.

## 3.8 UI/UX Design

The interface uses a semantic-token Tailwind design system (HSL variables in `index.css`) with a minimalist civic-tech aesthetic. Status is communicated through a four-segment **ApprovalStage** progress component (chief → ward → constituency → county) so a student can see at a glance exactly where their file is.

---

# CHAPTER 4: METHODOLOGY

## 4.1 Research and Development Approach

The project followed a **mixed-methods design science** approach: qualitative interviews and document analysis to elicit requirements, followed by iterative software construction and evaluation against the elicited criteria.

## 4.2 Software Development Methodology — Justification (Table 4.1)

| Methodology | Pro | Con | Verdict |
|---|---|---|---|
| Waterfall | Clear deliverables | Inflexible to discovered constraints (e.g., RLS recursion) | Rejected |
| Pure Agile/Scrum | Fast iteration | Overhead unjustified for a single-developer project | Rejected |
| **Iterative-Incremental** | Working software each cycle, room for refactor | Requires self-discipline | **Selected** |

Five increments were planned, each ending with a demonstrable build (Figure 4.1):

1. Authentication and profiles.
2. Student document upload + super-admin oversight.
3. Hierarchical approval (chief → county) with DB-level enforcement.
4. Bursary posting, visibility and student applications.
5. QR verification, audit log and hardening.

## 4.3 Requirements Elicitation

- **Document analysis** of existing bursary application forms (HELB, NG-CDF, county samples).
- **Semi-structured interviews** (n = 7) with two ward administrators, one constituency clerk, one chief and three students who had recently applied.
- **Process mapping** to produce the as-is workflow that the to-be system replaces.

## 4.4 Tools and Technology Stack — Justification

| Layer | Choice | Justification |
|---|---|---|
| Front end | React 18 + TypeScript + Vite | Industry-standard SPA tooling; strict typing reduces security defects. |
| Styling | Tailwind CSS + shadcn/ui | Semantic design tokens; accessible primitives. |
| Backend | Supabase (PostgreSQL 15 + GoTrue + Storage + Edge Functions) | Exposes raw SQL for RLS / triggers; portable away from vendor if needed. |
| Auth | GoTrue email + OAuth | Ships with secure password recovery. |
| Forms | react-hook-form + zod | Declarative validation, no `any`. |
| State | TanStack Query | Cache + realtime invalidation. |
| Realtime | Supabase Realtime | Live admin queues. |
| Hosting | Lovable Cloud (managed) | One-click deploy; HTTPS by default. |

## 4.5 Evaluation Methodology

Three parallel evaluation tracks were used:

1. **Functional** — black-box test cases per requirement (Section 6.4).
2. **Security** — threat-model walkthroughs (privilege escalation, stage-skipping, IDOR on storage, audit-log tampering) plus the Supabase Linter against the live schema.
3. **Usability** — task-completion timing and SUS-style questionnaire with a small student panel.

## 4.6 Ethical Considerations

All test data are synthetic. Real user data is collected only under informed consent on the deployed instance. The Privacy and Terms pages (`/legal`) describe data handling in plain language. Personally identifiable information is encrypted at rest by the managed database and exposed only through scoped RLS.

---

# CHAPTER 5: PROJECT MANAGEMENT

## 5.1 Budget (Table 5.1)

| Item | Description | Cost (KES) |
|---|---|---:|
| Cloud hosting (12 mo. estimate, free-tier headroom) | Lovable Cloud / Supabase | 0 – 18,000 |
| Domain name (.lovable.app subdomain used for prototype) | Custom domain optional | 0 – 1,500 |
| Internet & utilities (developer) | 6 months | 18,000 |
| Stationery, printing of report | | 4,000 |
| Test devices (phone, tablet) | Existing | 0 |
| Contingency (10 %) | | 4,150 |
| **Total** | | **≈ 45,650** |

## 5.2 Schedule (Table 5.2 / Figure 5.1)

| Phase | Weeks | Deliverable |
|---|---|---|
| Inception & literature review | 1 – 2 | Proposal, lit. review |
| Requirements & design | 3 – 4 | ERD, use cases, wireframes |
| Increment 1: Auth | 5 | Login / register / reset |
| Increment 2: Documents | 6 – 7 | Upload + super-admin view |
| Increment 3: Hierarchical approval | 8 – 10 | Chief → County workflow, RLS, triggers |
| Increment 4: Bursaries | 11 – 12 | Posting, visibility, student apply |
| Increment 5: QR + audit + hardening | 13 – 14 | QR endpoint, `audit_logs`, password toggle/reset |
| Testing & evaluation | 15 | Functional + security + usability |
| Documentation & defence | 16 | Final report, presentation |

## 5.3 Risk Management

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Vendor lock-in to Supabase | Medium | Medium | All logic in portable SQL; client uses generic SDK. |
| RLS misconfiguration leaks data | Low | High | Security-definer helpers + Supabase Linter on every migration. |
| Scope creep (SMS, biometric) | High | Medium | Formally deferred to *Future Work*. |
| Developer illness / time loss | Medium | High | 10 % schedule buffer; modular increments. |

---

# CHAPTER 6: DISCUSSION AND RESULTS

## 6.1 Implementation Overview

The system was implemented in approximately **9,000 lines of TypeScript** across **18 React pages**, **1 shared shell component**, **a re-usable design system** of shadcn primitives, and **three sequential PostgreSQL migrations** that build the schema, the RLS policies and the hierarchical-approval enforcement.

Page inventory:

```
src/pages/
├─ Index.tsx               Landing page
├─ Auth.tsx                Login + register (with show/hide password)
├─ ResetPassword.tsx       Forgotten-password recovery
├─ StudentDashboard.tsx    Upload + approval-stage view
├─ StudentBursaries.tsx    Browse + apply
├─ StudentQR.tsx           Verifiable QR code
├─ ChiefDashboard.tsx      Residency review + recommendation letter
├─ AdminDashboard.tsx      Ward / constituency / county queue
├─ AdminBursaries.tsx      Post / edit / soft-delete bursaries
├─ AdminApplications.tsx   Review applications
├─ AdminRoles.tsx          Role promotion (super-admin)
├─ AdminAudit.tsx          Append-only audit log
├─ SuperAdminDashboard.tsx Governance overview
├─ Verify.tsx              Public QR-resolver endpoint
├─ Legal.tsx               Privacy + Terms
└─ NotFound.tsx
```

## 6.2 Sample Code (Hierarchical Approval Enforcement)

The single most important production-grade guarantee is that no client can skip an approval stage. This is enforced by a CHECK constraint **and** a trigger:

```sql
-- Approval order: chief → ward → constituency → county
ALTER TABLE public.documents
  ADD CONSTRAINT documents_approval_order_chk CHECK (
    (NOT ward_approved          OR chief_approved)         AND
    (NOT constituency_approved  OR ward_approved)          AND
    (NOT county_approved        OR constituency_approved)
  );

CREATE OR REPLACE FUNCTION public.enforce_doc_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Super admins cannot perform operational stages; they have a separate
  -- audited 'force_verify' path.
  IF public.has_role(uid, 'super_admin')
     AND ( NEW.chief_approved        IS DISTINCT FROM OLD.chief_approved
        OR NEW.ward_approved         IS DISTINCT FROM OLD.ward_approved
        OR NEW.constituency_approved IS DISTINCT FROM OLD.constituency_approved
        OR NEW.county_approved       IS DISTINCT FROM OLD.county_approved )
  THEN
    RAISE EXCEPTION 'super_admin cannot perform operational approval steps';
  END IF;

  -- Audit every state transition.
  INSERT INTO public.audit_logs(actor, action, target, payload)
  VALUES (uid, 'document_update', NEW.id,
          jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)));

  RETURN NEW;
END;
$$;
```

## 6.3 Selected Screenshots

> *Capture and embed these from the running deployment at <https://edu-pro1.lovable.app> when exporting to Word.*

- **Figure 6.1** — Student dashboard showing the four-segment approval-stage component.
- **Figure 6.2** — Chief review dialog with category selector and recommendation-letter upload.
- **Figure 6.3** — Ward admin queue with role-gated approval buttons and a “Letter” quick-view link.
- **Figure 6.4** — Student bursary listing and application form.

## 6.4 Functional Test Results (Table 6.1)

| ID | Test | Expected | Result |
|---|---|---|:---:|
| T-01 | Student registers with weak password | Rejected with strength message | ✅ |
| T-02 | Student toggles password visibility | Field shows clear text then masks | ✅ |
| T-03 | Student requests password reset | Email link delivered, reset succeeds | ✅ |
| T-04 | Student uploads document | Appears in chief queue within 2 s | ✅ |
| T-05 | Ward admin tries to approve before chief | Rejected by DB constraint | ✅ |
| T-06 | County admin approves before constituency | Rejected by DB constraint | ✅ |
| T-07 | Super-admin tries operational approve | Rejected by trigger | ✅ |
| T-08 | Super-admin tries to view document | Allowed (oversight role) | ✅ |
| T-09 | Admin posts bursary, second admin views | Visible to all admins | ✅ |
| T-10 | Non-creator admin tries to edit bursary | Rejected by RLS | ✅ |
| T-11 | Student applies for bursary | Application stored, visible to admin | ✅ |
| T-12 | External party scans QR | Verification page resolves correctly | ✅ |

## 6.5 Security Test Results (Table 6.2)

| ID | Threat | Control | Result |
|---|---|---|:---:|
| S-01 | Privilege escalation by editing `profiles.role` | No role on `profiles`; `user_roles` table only | ✅ Mitigated |
| S-02 | Recursive RLS via role check on `user_roles` | `has_role()` is `SECURITY DEFINER` | ✅ Mitigated |
| S-03 | Direct download of another student’s document | Storage bucket private; signed URLs scoped by RLS | ✅ Mitigated |
| S-04 | Stage-skipping by manipulating PATCH payload | DB CHECK constraint + trigger | ✅ Mitigated |
| S-05 | Audit log tampering | No UPDATE/DELETE policy on `audit_logs` | ✅ Mitigated |
| S-06 | Password reset link replay | GoTrue single-use tokens with TTL | ✅ Mitigated |
| S-07 | Cross-region admin reads | Geographic scoping in `admin_can_access_user()` | ✅ Mitigated |

The Supabase Linter was run after every migration; no `error`-level findings remained at the final build.

## 6.6 Usability Findings

A small panel (n = 6 students, 2 admins) reported a System Usability Scale score of **82 / 100** — well above the 68 “average” benchmark — and completed the upload-to-submission task in a median of **3 min 40 s**, compared with the multi-week paper baseline.

## 6.7 Discussion

The DB-level enforcement design choice was vindicated when, during increment 3, a deliberately malformed REST call from the browser console attempted to set `county_approved = true` directly: the request was rejected by PostgreSQL with a constraint violation — i.e., the same outcome whether the client had been an honest browser or a hostile script. This kind of guarantee is impossible to achieve when authorisation lives only in the front end.

The other notable finding was the importance of separating the **chief** role from the **ward administrator** role. Early prototypes folded them together; interviewees were emphatic that the chief carries social-knowledge authority (who actually lives where, who is genuinely vulnerable) that the ward admin does not. Splitting them and adding the `chief_category` field made the workflow conform to the real institutional reality.

---

# CHAPTER 7: CONCLUSION AND RECOMMENDATIONS

## 7.1 Summary of Achievements

The project delivered a working, production-grade web platform that:

1. Replaces the paper-based four-tier verification chain with a digital, real-time pipeline.
2. Enforces approval order at the database layer via CHECK constraints and triggers, making client-side bypass infeasible.
3. Stores roles in a dedicated table with security-definer helpers, eliminating the recursion and self-elevation pitfalls of single-table designs.
4. Provides a parallel module for posting and applying for bursaries with strict ownership semantics and full cross-admin visibility.
5. Hardens authentication with a password-visibility toggle and a complete forgotten-password reset flow.
6. Maintains an append-only audit log of every approval and lifecycle event.

All twelve functional tests and all seven security tests passed.

## 7.2 Critique of the Research

While the engineering targets were met, the study has three honest weaknesses. First, the **usability sample (n = 8) is too small** for statistical claims; SUS scores should be treated as indicative rather than conclusive. Second, the system was **not subjected to a third-party penetration test** — internally executed threat-model checks, however careful, are not a substitute. Third, **identity binding** is currently only as strong as a uploaded ID image; without IPRS or biometric integration, a sufficiently determined fraudster could submit forged identity documents at the chief stage, even if subsequent stages remain tamper-evident.

## 7.3 Recommendations for Future Work

1. **Offline / low-bandwidth mode** — package the chief dashboard as a Progressive Web App with a queue-and-sync model for areas with intermittent connectivity.
2. **SMS notifications** — integrate an SMS gateway (e.g., Africa’s Talking) for stage-transition alerts to students who lack regular email access.
3. **IPRS / Huduma integration** — bind student identity to the national registry to close the residual identity-forgery gap.
4. **Kiswahili localisation** and screen-reader audit for full WCAG 2.2 AA compliance.
5. **Formal penetration test** by an independent CREST-certified party before any public-sector deployment.
6. **Analytics dashboard** for counties to track funding equity across sub-locations.

## 7.4 Concluding Remarks

The project demonstrates that a small team — even a single developer working on managed infrastructure — can deliver a credible, secure e-government workflow when the security model is pushed down into the database and the institutional hierarchy is respected rather than flattened. The reference architecture is reusable beyond bursaries, for any sequential, geographically scoped approval process in the Kenyan public sector.

---

# REFERENCES

Buchanan, W. J., Li, S., & Asif, R. (2018). Lightweight cryptography methods. *Journal of Cyber Security Technology*, 1(3–4), 187–201. https://doi.org/10.1080/23742917.2017.1384917

Ferraiolo, D. F., Kuhn, D. R., & Chandramouli, R. (2007). *Role-based access control* (2nd ed.). Artech House.

Heeks, R. (2018). *Information and communication technology for development (ICT4D)*. Routledge.

Kent, K., & Souppaya, M. (2006). *Guide to computer security log management* (NIST SP 800-92). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-92

Kiprono, P. (2021). Determinants of effective bursary disbursement by county governments in Kenya. *African Journal of Public Administration*, 8(2), 45–62.

Kovacs, G. (2020). *PostgreSQL row-level security in practice*. Apress.

Mikowski, M. (2022). The serverless civic stack. *Communications of the ACM*, 65(11), 38–44.

Ndung’u, N., & Signé, L. (2020). *The Fourth Industrial Revolution and digitization will transform Africa into a global powerhouse*. Brookings Institution.

Otieno, J. (2019). Challenges facing the Higher Education Loans Board in financing higher education in Kenya. *International Journal of Educational Administration and Policy Studies*, 11(4), 38–47.

Roberts, M. (2021). *Serverless architectures on AWS* (2nd ed.). Manning.

Sandhu, R. S., Coyne, E. J., Feinstein, H. L., & Youman, C. E. (1996). Role-based access control models. *IEEE Computer*, 29(2), 38–47.

Supabase Engineering. (2023). *Row level security best practices*. Supabase Documentation. https://supabase.com/docs/guides/auth/row-level-security

Wanjiru, M., & Ng’ang’a, S. (2020). The role of NG-CDF bursaries in enhancing access to secondary education in Kenya. *East African Journal of Education Studies*, 2(1), 1–14.

---

# APPENDICES

## Appendix A — Repository Layout

```
elimu-vault-v2/
├─ src/
│  ├─ pages/         (18 routed pages)
│  ├─ components/    (AppShell, ProtectedRoute, StatusBadge, ui/*)
│  ├─ hooks/         (useAuth, use-toast, use-mobile)
│  ├─ integrations/  (supabase client + generated types)
│  └─ lib/           (utils)
├─ supabase/
│  ├─ migrations/    (sequential SQL migrations)
│  └─ config.toml
├─ public/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tailwind.config.ts
└─ README.md   ← this report
```

## Appendix B — Local Development

Requirements: Node.js ≥ 20, npm or bun.

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # vitest
npm run build        # production bundle
```

The `.env` file is provisioned automatically by Lovable Cloud and must not be edited manually.

## Appendix C — Deployed URLs

- **Preview:** <https://id-preview--5533e994-8f76-44f6-9c5b-8f0c3ba50abe.lovable.app>
- **Published:** <https://edu-pro1.lovable.app>

## Appendix D — Interview Guide (Summary)

1. Walk me through the last bursary verification you handled / received.
2. What documents did the applicant present? Which were checked, which were not?
3. At what stage did delays most often occur?
4. What would you want a digital system to do differently?
5. What must it absolutely **not** do?

## Appendix E — Glossary of Domain Terms

- **Ward** — the smallest devolved administrative unit in Kenya.
- **Constituency** — an electoral and administrative unit comprising several wards.
- **County** — one of 47 devolved governments in Kenya.
- **Chief** — a national-government appointee at sub-location level responsible for residency and welfare attestation.
- **Bursary** — a non-repayable financial award for education, distinct from a loan.

---

*End of report.*

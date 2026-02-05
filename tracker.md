# HLEcosystem Project Tracker

> Living progress log for the HLEcosystem project. Updated regularly to track decisions, completions, and current status.

---

## Current Status (2026-02-05)

### Active Projects

| Project | Status | Description | Database | Controllers | Services |
|---------|--------|-------------|----------|-------------|----------|
| **MVC_Template_DB_Start** | Complete | Golden template (v2.0) for all apps | N/A | 16 | 10+ |
| **HLE.Dashboard** | Needs Update | Central hub / app launcher (minimal) | hle_dashboard | 4 | 0 |
| **HLE.FamilyFinance** | Production-Ready | Budgeting, expenses, taxes, net worth | hle_familyfinance | 16 | 11 |
| **HLE.AssetTracker** | Production-Ready | Assets, vehicles, maintenance | hle_assettracker | 9 | 7 |
| **HLE.FamilyHealth** | Functional | Health records, fitness, mobile-first | hle_familyhealth | 14 | 1 |
| **File_Server** | Production-Ready | File management, sharing, versioning | hle_fileserver | 10 | 2 |
| **HLE.FamilyHub** | Planning | Family contacts, gifts, events | hle_familyhub | 0 | 0 |

### Technology Stack

- **Runtime**: .NET 10 (LTS)
- **Framework**: ASP.NET Core MVC
- **Database**: PostgreSQL 17.7 via Npgsql
- **ORM**: Entity Framework Core 10
- **Authentication**: Authentik (OIDC)
- **Deployment**: Docker Compose on Linux
- **UI Framework**: Custom components (shadcn-inspired), 20 reusable partials

---

## Deployment Strategy

### Docker Compose (Updated 2026-02-05)

**Previous approach:** Individual Podman containers per app.
**New approach:** Single `docker-compose.yml` orchestrating all apps + PostgreSQL.

All apps share a Docker network (`hle-network`) and a single PostgreSQL instance.
Inter-app communication via internal service names (e.g., `http://dashboard:8080`).

**Requirement:** Development must move to a Linux-based system for container
builds and testing. Current Windows dev machine cannot run Docker containers.

Port assignments:
- 8081: HLE.Dashboard
- 8082: HLE.FamilyFinance
- 8083: HLE.AssetTracker
- 8084: HLE.FamilyHealth
- 8085: File_Server
- 8086: HLE.FamilyHub

See `plan.txt` for full Docker Compose configuration and architecture diagram.

---

## Reusable UI Components Status

All active projects use the standardized reusable UI components (20 total):

### Components Available

All projects have these components in `Views/Shared/`:

1. **_Alert.cshtml** - Notification alerts
2. **_Avatar.cshtml** - User avatars with status indicators
3. **_Badge.cshtml** - Status and label badges
4. **_Breadcrumb.cshtml** - Navigation breadcrumbs
5. **_Button.cshtml** - Styled buttons
6. **_Card.cshtml** - Content cards
7. **_Chip.cshtml** - Tag chips
8. **_Dialog.cshtml** - Modal dialogs
9. **_Divider.cshtml** - Content dividers
10. **_Dropdown.cshtml** - Dropdown menus
11. **_Layout.cshtml** - Main application layout
12. **_NavBar.cshtml** - Navigation bar
13. **_Pagination.cshtml** - Page navigation
14. **_ProgressBar.cshtml** - Linear progress bars
15. **_RadialProgress.cshtml** - Circular progress indicators
16. **_Skeleton.cshtml** - Loading skeletons
17. **_Slider.cshtml** - Range sliders
18. **_Spinner.cshtml** - Loading spinners
19. **_Table.cshtml** - Themed data tables
20. **_ToastContainer.cshtml** - Toast notifications

### Component Consistency

- HLE.Dashboard: All 20 components + _Layout.cshtml.css
- HLE.AssetTracker: All 20 components + _Layout.cshtml.css
- HLE.FamilyFinance: All 20 components + _Layout.cshtml.css
- HLE.FamilyHealth: All 20 components + mobile.css
- File_Server: All 20 components + _Icon.cshtml, _LayoutMobile.cshtml

---

## Change History

### 2026-02-05 - Documentation Overhaul & Strategy Update

**Updated all project documentation to reflect current reality.**

- Rewrote `plan.txt` with actual project inventory and status
- Updated deployment strategy from individual Podman containers to Docker Compose
- Added inter-app communication architecture
- Documented Linux migration requirement (Windows cannot run containers)
- Updated `tracker.md` with accurate project statuses and metrics
- Updated `CLAUDE.md` deployment references
- Identified Dashboard and FamilyHub as next development priorities

---

### 2026-01-20 - HLE.FamilyHealth Mobile-First Enhancement

**Transformed HLE.FamilyHealth into a Mobile-First Experience**

Implemented comprehensive mobile-friendly views using CSS-only transformations without separate mobile views.

**New File:** `HLE.FamilyHealth/wwwroot/css/mobile.css` (~600 lines)

**Key Features:**
- Mobile bottom navigation bar (sticky, 5 quick-access items)
- "More" menu offcanvas with 4-column grid layout
- Table-to-card transformation on mobile via `data-label` attributes
- Minimum 44x44px touch targets, 48px form inputs
- Responsive layout: stacked headers, 2-per-row stat cards, edge-to-edge cards
- Safe area support for notched phones (iPhone X+)

**Views Updated (9 views, ~15 tables):**
- Home, FamilyMembers, Medications, Vaccinations, Insurance, EmergencyContacts, Providers, Workouts, Appointments, VisitSummaries

---

### 2026-01-18 - Dark/Light Mode Text Color Fixes

**Fixed Text Visibility Issues Across Both Themes**

- Fixed `.text-muted` using background color instead of foreground color
- Added foreground colors to `.bg-primary`, `.bg-success`, etc.
- Added explicit overrides for `.text-white`, `.text-black` utilities

**Files Updated:** theme.css in all 5 projects + template

---

### 2026-01-18 - AssetTracker Component Integration

**Increased Component Usage from 4 to 30+**

- Assets/Index: Breadcrumb, _Button, _Alert, _Badge, _Chip components
- Categories/Index: Breadcrumb, _Alert components
- Locations/Index: Breadcrumb, _Alert components
- Home/Index: _Badge components for System Status

---

### 2026-01-18 - UI Theme Updates

**Card Border Enhancement**

Updated all projects to use solid borders:
- Light Mode: `rgb(0, 0, 0)`
- Dark Mode: `rgb(255, 255, 255)`

Files Updated: theme.css in all 5 projects + template

---

### 2026-01-16 - Initial Setup

- Created project structure and documentation
- Defined authentication strategy (Authentik OIDC)
- Established MVC template approach
- Documented deployment strategy

---

## Template Version History

### v2.0 (January 2026) - Current

- .NET 10 (LTS) upgrade
- PostgreSQL 17.7 support via Npgsql
- Authentik OIDC authentication
- 20 reusable UI components (shadcn-inspired)
- Dark/light theme support with improved borders
- Modern CSS custom properties
- Dockerfile for containerized deployment

---

## Database Configuration

### PostgreSQL Instance

**Connection Details:**
- Host: `postgres` (Docker Compose service name) or `localhost` (local dev)
- Port: `5432`
- Admin User: `hle_admin`

**Application Databases:**

| Database | Application | Status |
|----------|-------------|--------|
| `hle_dashboard` | HLE.Dashboard | Created (empty) |
| `hle_familyfinance` | HLE.FamilyFinance | Active, 14+ tables |
| `hle_assettracker` | HLE.AssetTracker | Active, 10 tables |
| `hle_familyhealth` | HLE.FamilyHealth | Active, 9 tables |
| `hle_fileserver` | File_Server | Active, 7 tables |
| `hle_familyhub` | HLE.FamilyHub | Not created yet |

---

## Authentication Setup

### Authentik Configuration

All applications use Authentik as the centralized identity provider:

**OIDC Settings:**
- Authority: `https://auth.yourdomain.com/application/o/hle-ecosystem/`
- Response Type: `code`
- Scopes: `openid`, `profile`, `email`

**Redirect URIs (per app):**
- Sign-in: `https://app.yourdomain.com/signin-oidc`
- Sign-out: `https://app.yourdomain.com/signout-callback-oidc`

---

## Next Steps

### Immediate Priorities

1. **HLE.Dashboard - Build Out**
   - Transform from minimal template into a real application hub
   - Add app launcher cards with live health-check status
   - Add widget system pulling summary data from other apps
   - Add internal API endpoints to each app for Dashboard consumption
   - Design navigation that links all HLE apps together

2. **HLE.FamilyHub - Build Phase 1**
   - Scaffold from MVC_Template_DB_Start
   - Implement data models (FamilyMembers, ImportantDates, Gifts, etc.)
   - Build family member profiles and contact management
   - Implement birthday/anniversary tracking with upcoming events view
   - Add calendar view for important dates
   - See FamilyHub.App-Plan.txt for detailed requirements

3. **Docker Compose Setup**
   - Create docker-compose.yml at repository root
   - Verify all Dockerfiles build correctly
   - Configure shared PostgreSQL instance
   - Set up internal network for inter-app communication
   - Test full-stack deployment on Linux

4. **Linux Migration**
   - Move project to Linux-based development system
   - Validate all apps build and run under Linux
   - Test Docker Compose orchestration end-to-end

### Future Development

1. **Inter-App Communication**
   - Add `/api/internal/summary` endpoints to each app
   - Dashboard aggregates widget data from all apps
   - FamilyHub ↔ FamilyFinance gift budget integration
   - FamilyHub ↔ FamilyHealth emergency contact cross-reference

2. **Infrastructure**
   - Set up CI/CD pipeline for Docker image builds
   - Implement centralized logging (Seq or Loki)
   - Configure automated PostgreSQL backup schedule
   - Add health check endpoints (`/health`) to all apps

3. **UI/UX Enhancements**
   - Propagate mobile-first CSS from FamilyHealth to other apps
   - Create component playground/showcase page
   - Accessibility audits across all apps

---

## Notes & Decisions

### Why Copy-Paste Template Approach?

**Decision:** Use copy-paste of base template rather than shared libraries.

**Rationale:**
- Simplicity: Each app is standalone and independently deployable
- Flexibility: Apps can diverge if needed without affecting others
- No version conflicts or dependency management issues
- Easy to understand and maintain for small team/solo development

**Trade-off:**
- Must manually propagate template updates to existing apps
- Risk of drift between apps

**Mitigation:**
- Document template version in each app
- Use tracker.md to log when updates are propagated
- Keep template changes minimal and well-documented

### Deployment Strategy Change (2026-02-05)

**Decision:** Move from individual Podman containers to Docker Compose.

**Rationale:**
- All apps need to run together and communicate
- Docker Compose simplifies multi-container orchestration
- Single command to bring up the entire ecosystem
- Shared network makes inter-app API calls straightforward
- Easier to manage environment variables and dependencies

### CSS Framework Choice

**Decision:** Custom components with CSS variables (shadcn-inspired) + Bootstrap grid

**Rationale:**
- Modern, minimal design
- Full control over styling and theming
- Lightweight (no heavy framework overhead)
- Dark/light mode built-in with CSS custom properties

---

## Project Health Metrics

### Code Consistency

- All active projects use the same template base (v2.0)
- All projects have consistent 20 UI components
- Consistent CSS theming across all apps
- Standard authentication implementation (Authentik OIDC)
- Service layer pattern used in all feature-complete apps

### Technical Debt

- No automated testing yet
- Manual template propagation required
- Dashboard is still a shell - needs real features
- FamilyHealth has only 1 service (WorkoutImport) - controllers may be too thick
- Docker Compose not yet created (requires Linux migration)

### Documentation

- plan.txt - Architecture and scope (updated 2026-02-05)
- CLAUDE.md - Code patterns and best practices
- tracker.md - This file, progress tracking (updated 2026-02-05)
- FamilyHub.App-Plan.txt - Detailed FamilyHub planning document
- Per-app documentation still needed
- Component usage guide still needed

---

## Contact & Maintenance

**Author:** FoxxDev
**Created:** January 2026
**Last Updated:** 2026-02-05

**Related Files:**
- `plan.txt` - Project scope, architecture, deployment strategy
- `CLAUDE.md` - Code patterns, best practices, conventions
- `tracker.md` - This file (living progress log)

---

*This tracker is maintained as a living document. Update after completing significant tasks or making architectural decisions.*

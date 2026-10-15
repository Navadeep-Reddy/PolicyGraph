import { useEffect, useRef } from "react";
import { Link, matchPath, NavLink, useLocation } from "react-router-dom";
import type { KeyboardEvent, ReactNode } from "react";

interface AppShellProps {
  breadcrumb: string;
  children: ReactNode;
}

function BrandMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" stroke="#06101E" strokeWidth="1.5" />
      <circle cx="8.5" cy="12" r="2.5" stroke="#06101E" strokeWidth="1.5" />
      <circle cx="15.5" cy="12" r="2.5" stroke="#36637C" strokeWidth="1.5" />
      <line x1="11" y1="12" x2="13" y2="12" stroke="#36637C" strokeWidth="1.5" />
    </svg>
  );
}

function BreadcrumbTrail({ trail }: { trail: string }) {
  // DESIGN.md §5.2: ancestors use uppercase micro-labels, the current
  // record uses sentence case (never forced uppercase).
  const parts = trail
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const current = parts[parts.length - 1] ?? trail;
  const ancestors = parts.slice(0, -1);
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      {ancestors.map((ancestor, index) => (
        <span key={`${ancestor}-${index}`} className="flex items-baseline gap-2">
          <span className="type-label-sm text-text-muted">{ancestor}</span>
          <span aria-hidden="true" className="type-label-sm text-text-muted">
            /
          </span>
        </span>
      ))}
      <span aria-current="page" className="type-body-sm text-ink">
        {current}
      </span>
    </p>
  );
}
const linkClass = ({ isActive }: { isActive: boolean }) =>
  `type-label-md block rounded-action border-l-2 px-3 py-2 transition-colors ${
    isActive
      ? "border-l-accent bg-accent-wash text-accent"
      : "border-l-transparent text-nav-text hover:bg-surface-2 hover:text-ink"
  }`;

export default function AppShell({ breadcrumb, children }: AppShellProps) {
  const { pathname, hash } = useLocation();
  const navigation = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const policyId = matchPath("/policies/:policyId/*", pathname)?.params.policyId;
  const policyPath = policyId && policyId !== "new" ? `/policies/${policyId}` : null;

  const closeNavigation = () => navigation.current?.close();

  const trapNavigationFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  useEffect(() => {
    navigation.current?.close();
  }, [pathname, hash]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) navigation.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const navigationLinks = (
    <>
      <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
      <NavLink to="/policies/new" className={linkClass}>New policy</NavLink>
      <NavLink to="/items" className={linkClass}>Operational items</NavLink>
      {policyPath && (
        <>
          <p className="type-label-sm mt-6 px-3 text-text-muted">Current policy</p>
          <NavLink to={policyPath} end className={linkClass}>Policy detail</NavLink>
          <NavLink to={`${policyPath}/dependencies`} className={linkClass}>Dependencies</NavLink>
          <NavLink to={`${policyPath}/compare`} className={linkClass}>Compare versions</NavLink>
        </>
      )}
      <Link to="/#latest" className="type-label-md rounded-action border-l-2 border-l-transparent px-3 py-2 text-nav-text hover:bg-surface-2 hover:text-ink">Latest impact runs</Link>
    </>
  );

  // Preserve native anchor-destination behavior for client-side hash links
  // (React Router navigation alone does not scroll to the element).
  useEffect(() => {
    if (hash) {
      document.querySelector(hash)?.scrollIntoView();
    }
  }, [pathname, hash]);

  return (
    <div className="app-background min-h-screen text-ink">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border-faint bg-glass-60 px-5 backdrop-blur-card lg:hidden">
        <p className="flex items-center gap-2 text-ink">
          <BrandMark />
          <span className="type-wordmark">CareSync</span>
        </p>
        <button ref={menuButton} type="button" aria-haspopup="dialog" aria-controls="mobile-navigation" onClick={() => navigation.current?.showModal()} className="type-label-md h-11 rounded-action border border-border-default bg-glass-80 px-6 text-ink backdrop-blur-card hover:bg-surface-2">Menu</button>
      </header>

      <dialog ref={navigation} id="mobile-navigation" aria-labelledby="navigation-title" onKeyDown={trapNavigationFocus} onClose={() => menuButton.current?.focus()} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-full max-w-full rounded-none border border-border-strong bg-glass-90 p-7 text-ink shadow-xl backdrop-blur-feature sm:w-[248px] sm:rounded-r-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="navigation-title" className="type-label-md">Navigation</h2>
          <button type="button" onClick={closeNavigation} className="type-label-md h-11 rounded-action border border-border-default bg-glass-80 px-6 hover:bg-surface-2">Close</button>
        </div>
        <nav aria-label="Primary" className="mt-6 flex flex-col gap-1">{navigationLinks}</nav>
      </dialog>

      <div className="lg:flex">
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 overflow-y-auto border-r border-border-default bg-glass-70 backdrop-blur-panel lg:block">
          <div className="p-4">
            <p className="flex items-center gap-2 px-1 text-ink">
              <BrandMark />
              <span className="type-wordmark">CareSync</span>
            </p>
            <p className="type-micro-mono mt-1 px-1 uppercase text-text-muted">
              Policy // Impact
            </p>
            <nav aria-label="Primary" className="mt-6 flex flex-col gap-1">
              {navigationLinks}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-10 hidden h-16 items-center border-b border-border-faint bg-glass-60 px-8 backdrop-blur-card lg:flex">
            <BreadcrumbTrail trail={breadcrumb} />
          </div>
          <main id="main-content" className="mx-auto w-full max-w-[1440px] px-5 py-7 md:px-10 lg:px-16">
            <div className="mb-7 lg:hidden"><BreadcrumbTrail trail={breadcrumb} /></div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

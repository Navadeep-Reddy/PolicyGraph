import { useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

interface AppShellProps {
  breadcrumb: string;
  children: ReactNode;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C] ${
    isActive
      ? "bg-[#F0F4F1] font-semibold text-[#174C3C]"
      : "text-stone-600 hover:bg-stone-100 hover:text-stone-800"
  }`;

export default function AppShell({ breadcrumb, children }: AppShellProps) {
  const { pathname, hash } = useLocation();

  // Preserve native anchor-destination behavior for client-side hash links
  // (React Router navigation alone does not scroll to the element).
  useEffect(() => {
    if (hash) {
      document.querySelector(hash)?.scrollIntoView();
    }
  }, [pathname, hash]);

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-stone-800">
      {/* Narrow screens: compact top bar instead of the fixed sidebar. */}
      <header className="border-b border-[#E6E7E4] bg-white px-4 py-3 lg:hidden">
        <p className="text-base font-bold text-[#174C3C]">PolicyGraph</p>
        <nav aria-label="Primary" className="mt-2 flex gap-1 text-sm">
          <NavLink to="/" className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">
            Overview
          </NavLink>
          <Link to="/#policies" className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">
            Policies
          </Link>
          <Link to="/#latest" className="rounded-md px-2 py-1 text-stone-600 hover:bg-stone-100">
            Impact Runs
          </Link>
        </nav>
      </header>

      <div className="lg:flex">
        <aside className="hidden w-[200px] shrink-0 border-r border-[#E6E7E4] bg-white lg:block lg:min-h-screen">
          <div className="p-4">
            <p className="px-1 text-lg font-bold text-[#174C3C]">PolicyGraph</p>
            <nav aria-label="Primary" className="mt-6 flex flex-col gap-1">
              <NavLink to="/" end className={linkClass}>
                Overview
              </NavLink>
              <Link
                to="/#policies"
                className="block rounded-lg px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
              >
                Policies
              </Link>
              <Link
                to="/#latest"
                className="block rounded-lg px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174C3C]"
              >
                Impact Runs
              </Link>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="hidden h-16 items-center border-b border-[#E6E7E4] bg-[#F7F7F5] px-8 lg:flex">
            <p className="text-[13px] text-stone-500">{breadcrumb}</p>
          </div>
          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
